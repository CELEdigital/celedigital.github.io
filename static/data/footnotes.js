/* ── Footnotes: desktop sidenotes + mobile inline expand ─── */

(function () {
  document.addEventListener('DOMContentLoaded', function () {

    /* ── Desktop: sidenotes (≥1200px) ───────────────────────── */
    if (window.matchMedia('(min-width: 1200px)').matches) {
      document.querySelectorAll('sup[id^="fnref"]').forEach(function (ref) {
        // Prevent duplicates on re-run
        if (ref.nextElementSibling && ref.nextElementSibling.classList.contains('sidenote')) return;

        var link = ref.querySelector('a');
        if (!link) return;

        var number = link.textContent.trim();
        if (!number) return;

        var id = link.getAttribute('href').replace(/^#/, '');
        var footnote = document.getElementById(id);
        if (!footnote) return;

        var aside = document.createElement('aside');
        aside.className = 'sidenote';
        aside.innerHTML =
          '<span class="sidenote-number">' + number + '</span>' +
          footnote.innerHTML.replace(/<a[^>]*>↩︎?<\/a>/g, '');

        ref.after(aside);
      });
      return; // sidenotes active — skip mobile wiring
    }

    /* ── Mobile: inline expandable footnotes (<1200px) ──────── */
    document.querySelectorAll('a.footnote-ref').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();

        var sup = this.closest('sup');
        if (!sup) return;

        var id = decodeURIComponent((this.getAttribute('href') || '').replace(/^#/, ''));
        if (!id) return;

        var note = document.getElementById(id);
        if (!note) return;

        // Toggle if already created
        var existing = sup.nextElementSibling;
        if (existing && existing.classList.contains('inline-footnote')) {
          var willOpen = !existing.classList.contains('is-open');
          existing.classList.toggle('is-open', willOpen);
          this.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return;
        }

        var inline = document.createElement('span');
        inline.className = 'inline-footnote is-open';

        var clone = note.cloneNode(true);
        clone.querySelectorAll('a.footnote-backref, a[role="doc-backlink"]').forEach(function (b) {
          b.remove();
        });

        inline.innerHTML = clone.innerHTML;
        this.setAttribute('aria-expanded', 'true');

        sup.after(inline);
      });
    });

  });
})();
