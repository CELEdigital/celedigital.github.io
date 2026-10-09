/* ── Client-side citation renderer ─────────────────────────────────
   Processes Pandoc-style [@citekey] markers using CSL-JSON references
   and a CSL style file declared in data-csl-refs / data-csl-style on
   the .single-content element.

   One bracket [@a; @b, p. 2] → one footnote number → one footnote
   entry listing all cited works.

   Renders inline superscript numbers + OSCOLA-formatted sidenotes on
   desktop (≥1200px) or tap-to-expand on mobile.
   ──────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* Pandoc citation bracket: [@key], [@key, p. 5], [@a; @b, p. 2] */
  var CITE_RE = /\[@([^\]]+?)\]/g;

  /* Matches one citekey token (optionally with a locator after comma) */
  var KEY_RE = /^@?([\w:./-]+?)(?:\s*,.*)?$/;

  function parseBracket(inner) {
    /* Returns [{key, locator}, …] from the inside of [@…] */
    return inner.split(';').map(function (part) {
      part = part.trim();
      var m = KEY_RE.exec(part);
      if (!m) return null;
      var key = m[1];
      var locatorMatch = /,\s*(.+)$/.exec(part.replace(/^@[\w:./-]+/, ''));
      return { key: key, locator: locatorMatch ? locatorMatch[1].trim() : null };
    }).filter(Boolean);
  }

  function collectTextNodes(root, skip) {
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        while (p && p !== root) {
          if (skip[p.tagName.toLowerCase()]) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Main entry ──────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var contentEl = document.querySelector('[data-csl-refs]');
    if (!contentEl) return;

    var refsUrl  = contentEl.getAttribute('data-csl-refs');
    var styleUrl = contentEl.getAttribute('data-csl-style');
    if (!refsUrl || !styleUrl) return;

    /* citation.js browser bundle exposes itself via window.require */
    var Cite;
    try {
      Cite = (typeof require !== 'undefined') ? require('citation-js') : null;
      if (!Cite && window.require) Cite = window.require('citation-js');
    } catch (e) { /* ignore */ }
    if (!Cite) { console.warn('[citations.js] citation-js not available'); return; }

    Promise.all([
      fetch(refsUrl).then(function (r) { return r.json(); }),
      fetch(styleUrl).then(function (r) { return r.text(); })
    ]).then(function (results) {
      render(Cite, contentEl, results[0], results[1]);
    }).catch(function (err) {
      console.warn('[citations.js] Failed to load refs/csl:', err);
    });
  });

  /* ── Render ──────────────────────────────────────────────────────── */
  function render(Cite, contentEl, refsArray, cslXml) {

    /* Register the CSL template */
    try {
      Cite.plugins.config.get('@csl').templates.add('paper-csl', cslXml);
    } catch (e) {
      console.warn('[citations.js] Could not register CSL template:', e);
      return;
    }

    /* Build citekey → CSL entry lookup */
    var refMap = {};
    refsArray.forEach(function (entry) { if (entry.id) refMap[entry.id] = entry; });

    /* ── Pass 1: collect all [@…] matches from text nodes ───────── */
    var skip = { code: 1, pre: 1, script: 1, style: 1 };
    var textNodes = collectTextNodes(contentEl, skip);

    /*
     * Each match: { node, start, end, keys: [{key, locator}] }
     * One bracket = one match, regardless of how many keys it contains.
     */
    var matches = [];
    textNodes.forEach(function (node) {
      var text = node.nodeValue;
      var m;
      CITE_RE.lastIndex = 0;
      while ((m = CITE_RE.exec(text)) !== null) {
        var keys = parseBracket(m[1]);
        if (keys.length) {
          matches.push({ node: node, start: m.index, end: m.index + m[0].length, keys: keys });
        }
      }
    });

    if (!matches.length) return;

    /* ── Pass 2: assign one sequential footnote number per bracket ── */
    matches.forEach(function (m, idx) { m.num = idx + 1; });

    /* ── Pass 3: replace text nodes with <sup> markers ──────────── */
    var grouped = [];
    matches.forEach(function (m) {
      var last = grouped[grouped.length - 1];
      if (last && last.node === m.node) {
        last.hits.push(m);
      } else {
        grouped.push({ node: m.node, hits: [m] });
      }
    });

    grouped.forEach(function (g) {
      var node = g.node;
      var parent = node.parentNode;
      if (!parent) return;

      var text = node.nodeValue;
      var hits = g.hits.slice().sort(function (a, b) { return a.start - b.start; });
      var cursor = 0;
      var frag = document.createDocumentFragment();

      hits.forEach(function (hit) {
        if (hit.start > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, hit.start)));
        }

        var num = hit.num;
        var sup = document.createElement('sup');
        sup.className = 'cite-fn-ref';
        sup.id = 'cite-fnref-' + num;

        var a = document.createElement('a');
        a.href = '#cite-fnref-' + num;
        a.setAttribute('aria-label', 'Note ' + num);
        a.textContent = '[' + num + ']';
        sup.appendChild(a);
        frag.appendChild(sup);

        cursor = hit.end;
      });

      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)));
      }

      parent.replaceChild(frag, node);
    });

    /* ── Pass 4: format each bracket's note text ─────────────────── */
    /*
     * noteTexts[num] = HTML string combining all keys in that bracket.
     * If a key has a locator (e.g. "p. 105"), it is appended after the
     * formatted citation.
     */
    var noteTexts = {};

    matches.forEach(function (m) {
      var parts = m.keys.map(function (k) {
        var entry = refMap[k.key];
        if (!entry) {
          return '<span class="cite-missing">[' + escapeHtml(k.key) + ']</span>';
        }
        var html;
        try {
          var cite = new Cite(entry);
          html = cite.format('citation', {
            format: 'html',
            template: 'paper-csl',
            lang: 'en-GB',
            entry: [k.key]
          });
        } catch (e) {
          /* Fallback: author + year */
          var fb = '';
          if (entry.author && entry.author.length) {
            fb = entry.author[0].family || entry.author[0].literal || '';
          }
          if (entry.issued && entry.issued['date-parts'] && entry.issued['date-parts'][0]) {
            fb += ' (' + entry.issued['date-parts'][0][0] + ')';
          }
          html = fb || escapeHtml(k.key);
        }
        /* Append locator, stripping any trailing period from the formatted text */
        if (k.locator) {
          html = (html || '').replace(/\.\s*$/, '') + ', ' + escapeHtml(k.locator) + '.';
        }
        return html || escapeHtml(k.key);
      });

      noteTexts[m.num] = parts.join('; ');
    });

    /* ── Pass 5: stamp note text onto each <sup> for mobile expand ── */
    contentEl.querySelectorAll('sup.cite-fn-ref').forEach(function (sup) {
      var a = sup.querySelector('a');
      if (!a) return;
      var num = parseInt(a.textContent.replace(/[\[\]]/g, '').trim(), 10);
      if (num && noteTexts[num]) sup.setAttribute('data-note', noteTexts[num]);
    });

    /* ── Pass 6: sidenotes on desktop / expand on mobile ─────────── */
    if (window.matchMedia && window.matchMedia('(min-width: 1200px)').matches) {
      applySidenotes(contentEl, noteTexts);
    } else {
      applyMobileExpand(contentEl);
    }
  }

  /* ── Desktop: float each citation as a sidenote ──────────────── */
  function applySidenotes(contentEl, noteTexts) {
    contentEl.querySelectorAll('sup.cite-fn-ref').forEach(function (sup) {
      if (sup.nextElementSibling && sup.nextElementSibling.classList.contains('sidenote')) return;

      var a = sup.querySelector('a');
      if (!a) return;

      var num = parseInt(a.textContent.replace(/[\[\]]/g, '').trim(), 10);
      if (!num || !noteTexts[num]) return;

      var aside = document.createElement('aside');
      aside.className = 'sidenote';

      var numLabel = document.createElement('span');
      numLabel.className = 'sidenote-number';
      numLabel.textContent = num;
      aside.appendChild(numLabel);

      var body = document.createElement('span');
      body.innerHTML = noteTexts[num];
      aside.appendChild(body);

      sup.after(aside);
    });
  }

  /* ── Mobile: tap to expand inline ────────────────────────────── */
  function applyMobileExpand(contentEl) {
    contentEl.querySelectorAll('sup.cite-fn-ref a').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();

        var sup = this.closest('sup');
        if (!sup) return;

        var noteHtml = sup.getAttribute('data-note');
        if (!noteHtml) return;

        var existing = sup.nextElementSibling;
        if (existing && existing.classList.contains('inline-footnote')) {
          var willOpen = !existing.classList.contains('is-open');
          existing.classList.toggle('is-open', willOpen);
          this.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return;
        }

        var inline = document.createElement('span');
        inline.className = 'inline-footnote is-open';
        inline.innerHTML = noteHtml;

        this.setAttribute('aria-expanded', 'true');
        sup.after(inline);
      });
    });
  }

})();
