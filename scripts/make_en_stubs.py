#!/usr/bin/env python3
"""Create an English twin for each newly added/modified Spanish post that has
no English version yet.

Run from the repo root. Driven by a GitHub Action (env BEFORE / SHA give the
push range); falls back to HEAD~1..HEAD when run locally. You can also pass one
or more ES file paths as CLI arguments to process exactly those (handy for
local testing without crafting commits).

For each changed content/es/<section>/<name>.md without a matching
content/en/<section>/<name>.md, it writes a twin with:
  - translationKey ensured (so Hugo links the ES/EN versions), and
  - the human-readable fields (title, description, tagline, body) translated
    ES -> EN via the DeepL API when DEEPL_API_KEY is set.

Publish behaviour:
  - If DeepL translation succeeds, the twin is published immediately (no draft),
    unless the Spanish post is `draft: true`: then the twin is a draft too.
  - If DEEPL_API_KEY is missing or a DeepL call fails, it falls back to a
    *verbatim copy* marked `draft: true`, so untranslated Spanish never goes
    live by accident (and local runs work without a key).

Idempotent: never overwrites an existing English file.
"""

import os
import re
import subprocess
import sys

import frontmatter

# (ES source dir, EN destination dir) pairs to mirror.
DIR_PAIRS = [
    ("content/es/posts", "content/en/posts"),
    ("content/es/noticias-cruzando-el-mar", "content/en/noticias-cruzando-el-mar"),
]

# Front-matter fields that hold human-readable text and should be translated.
TRANSLATE_KEYS = ("title", "description", "tagline")

# Hugo shortcodes ({{< … >}}, {{< /… >}}, {{% … %}}) are never translated: DeepL
# once turned `{{< galeria carpeta=… >}}` into `{{< gallery folder=… >}}`, a
# shortcode that does not exist, and the whole site stopped building. They are
# swapped for opaque tokens before the call and restored after; if any token
# comes back missing, duplicated or altered, the translation is discarded and
# the post falls back to the draft copy. Text *between* a paired shortcode's
# tags (e.g. the body of {{< aviso >}}…{{< /aviso >}}) is still translated.
SHORTCODE_RE = re.compile(r"\{\{[<%].*?[>%]\}\}", re.S)
TOKEN = "XSC{:04d}X"
TOKEN_RE = re.compile(r"XSC\d{4}X")


def protect_shortcodes(text: str, saved: list):
    """Replace each shortcode in text with a token, appending it to saved."""
    def swap(match):
        saved.append(match.group(0))
        return TOKEN.format(len(saved) - 1)
    return SHORTCODE_RE.sub(swap, text)


def restore_shortcodes(text: str, saved: list, expected: set):
    """Put back the shortcodes whose tokens should be in text. Raises ValueError
    if a token is missing or repeated, or if anything token-like is left over."""
    for i in sorted(expected):
        token = TOKEN.format(i)
        if text.count(token) != 1:
            raise ValueError(f"shortcode token {token} came back {text.count(token)} times")
        text = text.replace(token, saved[i])
    if TOKEN_RE.search(text):
        raise ValueError("unexpected shortcode token in translation")
    return text


def changed_es_posts():
    """Return the list of added/modified ES markdown files in the push range."""
    before = os.environ.get("BEFORE", "").strip()
    sha = os.environ.get("SHA", "").strip() or "HEAD"
    # all-zeros = no previous commit (first push / new branch)
    base = before if before and set(before) != {"0"} else f"{sha}~1"
    es_dirs = [es for es, _ in DIR_PAIRS]
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-only", "-z", "--diff-filter=AM", base, sha, "--", *es_dirs],
            text=True,
        )
    except subprocess.CalledProcessError:
        return []
    # -z gives NUL-separated, *unquoted* paths. Without it, git wraps non-ASCII
    # filenames in quotes with octal escapes (e.g. "…expresi\303\263n.md"), which
    # would fail the .md check and silently skip accented posts.
    return [p for p in out.split("\0") if p.endswith(".md")]


def en_path_for(es_path: str):
    """Map an ES source path to its EN twin path, or None if not under a known dir."""
    es_path = es_path.replace(os.sep, "/")
    for es_dir, en_dir in DIR_PAIRS:
        prefix = es_dir.rstrip("/") + "/"
        if es_path.startswith(prefix):
            return en_dir.rstrip("/") + "/" + es_path[len(prefix):]
    return None


def translate_post(metadata: dict, content: str):
    """Translate whitelisted metadata fields + body ES->EN with DeepL.

    Returns (new_metadata, new_content) on success, or None if no API key is
    configured or any DeepL call fails (caller then uses the verbatim fallback).
    """
    key = os.environ.get("DEEPL_API_KEY", "").strip()
    if not key:
        return None
    try:
        import deepl

        translator = deepl.Translator(key)

        # Gather translatable strings into one batch: the whitelisted metadata
        # values (non-empty strings) followed by the body.
        meta_keys = [
            k for k in TRANSLATE_KEYS
            if isinstance(metadata.get(k), str) and metadata.get(k).strip()
        ]
        texts = [metadata[k] for k in meta_keys]
        body = content if content.strip() else None
        if body is not None:
            texts.append(body)

        if not texts:
            return dict(metadata), content  # nothing to translate

        saved = []
        protected = []
        for t in texts:
            start = len(saved)
            protected.append(protect_shortcodes(t, saved))
            protected[-1] = (protected[-1], set(range(start, len(saved))))

        results = translator.translate_text(
            [p for p, _ in protected],
            source_lang="ES",
            target_lang="EN-US",
            preserve_formatting=True,
        )
        translated = [
            restore_shortcodes(r.text, saved, expected)
            for r, (_, expected) in zip(results, protected)
        ]
        # Belt and braces: the shortcodes in the output must be exactly the
        # ones in the input, in the same order.
        for src, out in zip(texts, translated):
            if SHORTCODE_RE.findall(src) != SHORTCODE_RE.findall(out):
                raise ValueError("shortcodes changed in translation")

        new_metadata = dict(metadata)
        for k, value in zip(meta_keys, translated):
            new_metadata[k] = value
        new_content = translated[-1] if body is not None else content
        return new_metadata, new_content
    except Exception as exc:  # noqa: BLE001 - any failure -> safe fallback
        print(f"  ! DeepL translation failed ({exc}); falling back to draft copy")
        return None


def make_stub(es_path: str):
    en_path = en_path_for(es_path)
    if en_path is None:
        return None
    if os.path.exists(en_path):
        return None  # never clobber an existing (possibly translated) EN file

    post = frontmatter.load(es_path)
    stem = os.path.splitext(os.path.basename(es_path))[0]
    # Ensure the ES/EN versions are linked.
    if "translationKey" not in post.metadata:
        post.metadata["translationKey"] = stem

    es_draft = post.metadata.get("draft") is True
    translated = translate_post(post.metadata, post.content)
    if translated is not None:
        # Published immediately, unless the Spanish post is itself a draft.
        post.metadata, post.content = translated
        post.metadata.pop("draft", None)
        if es_draft:
            post.metadata["draft"] = True
    else:
        # Fallback: verbatim copy, kept out of the published site.
        post.metadata["draft"] = True

    os.makedirs(os.path.dirname(en_path), exist_ok=True)
    with open(en_path, "w", encoding="utf-8") as fh:
        fh.write(frontmatter.dumps(post, sort_keys=False, allow_unicode=True))
        fh.write("\n")
    return en_path


def main():
    args = [a for a in sys.argv[1:] if a.endswith(".md")]
    targets = args if args else changed_es_posts()
    created = []
    for es in targets:
        if not os.path.exists(es):
            continue
        en = make_stub(es)
        if en:
            created.append(en)
    if created:
        print("Created EN twins:")
        for c in created:
            print(" ", c)
    else:
        print("No EN twins to create.")


if __name__ == "__main__":
    main()
