(function () {
  var list = document.querySelector('[data-blog-list]');
  if (!list) return;

  var step = parseInt(list.getAttribute('data-blog-step'), 10) || 10;
  var items = Array.from(list.querySelectorAll('[data-blog-item]'));
  var loadBtn = document.querySelector('[data-blog-load]');
  var countEl = document.querySelector('[data-blog-count]');
  var categoryLinks = document.querySelectorAll('[data-blog-tab]');
  var tagLinks = document.querySelectorAll('[data-blog-tag]');
  var regionBtns = document.querySelectorAll('[data-blog-region-btn]');

  // Parse issues, tags, and region from each item once
  items.forEach(function (item) {
    try { item._blogIssues = JSON.parse(item.getAttribute('data-blog-issues') || '[]'); }
    catch (e) { item._blogIssues = []; }
    try { item._blogTags = JSON.parse(item.getAttribute('data-blog-tags') || '[]'); }
    catch (e) { item._blogTags = []; }
    item._blogRegion = item.getAttribute('data-blog-region') || 'global';
  });

  var filterType = null;
  var filterValue = '';
  var filterRegion = '';
  var candidates;
  var shown = 0;

  function getCandidates() {
    var base = items;
    // Apply category/tag filter
    if (filterValue) {
      if (filterType === 'category') {
        base = base.filter(function (i) { return i._blogIssues.indexOf(filterValue) !== -1; });
      } else {
        base = base.filter(function (i) { return i._blogTags.indexOf(filterValue) !== -1; });
      }
    }
    // Apply region filter (AND) — posts tagged 'global' appear under any region
    if (filterRegion) {
      base = base.filter(function (i) {
        return i._blogRegion === filterRegion || i._blogRegion === 'global';
      });
    }
    return base;
  }

  function updateMapCount() {
    var mapCount = document.querySelector('[data-blog-map-count]');
    if (mapCount) mapCount.textContent = candidates.length ? '(' + candidates.length + ')' : '';
  }

  function applyFilter() {
    candidates = getCandidates();
    var toShow = new Set(candidates.slice(0, step));

    items.forEach(function (item) {
      var shouldShow = toShow.has(item);
      item.hidden = !shouldShow;
      item.classList.toggle('is-hub-hidden', !shouldShow);
    });

    shown = toShow.size;

    if (countEl) {
      var n = candidates.length;
      countEl.textContent = n + ' resultado' + (n !== 1 ? 's' : '');
    }
    if (loadBtn) {
      loadBtn.hidden = candidates.length <= step;
    }
    updateMapCount();
  }

  function clearAllActive() {
    document.querySelectorAll('.blog-nav__item.is-active').forEach(function (p) {
      p.classList.remove('is-active');
    });
  }

  function setActive(el) {
    clearAllActive();
    var p = el.closest('.blog-nav__item');
    if (p) p.classList.add('is-active');
  }

  function attachFilterHandler(links, type, attr) {
    links.forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        filterType = type;
        filterValue = el.getAttribute(attr);
        setActive(el);
        applyFilter();
      });
    });
  }

  attachFilterHandler(categoryLinks, 'category', 'data-blog-tab');
  attachFilterHandler(tagLinks, 'tag', 'data-blog-tag');

  // Region button wiring
  regionBtns.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var val = btn.getAttribute('data-blog-region-btn');
      // Toggle off if clicking the same region again
      filterRegion = (filterRegion === val && val !== '') ? '' : val;
      // Update aria-pressed and is-active on all region buttons
      regionBtns.forEach(function (b) {
        var bVal = b.getAttribute('data-blog-region-btn');
        var isActive = bVal === filterRegion;
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        b.classList.toggle('is-active', isActive);
      });
      applyFilter();
    });
    // Keyboard support
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  if (loadBtn) {
    loadBtn.addEventListener('click', function () {
      var next = candidates.slice(shown, shown + step);
      next.forEach(function (item) {
        item.hidden = false;
        item.classList.remove('is-hub-hidden');
      });
      shown += next.length;
      if (shown >= candidates.length) loadBtn.hidden = true;
    });
  }

  // Hash-based category pre-selection
  var hashMap = {
    'lde': 'LDE', 'ddhh': 'DDHH',
    'amenazas': 'Amenazas a la LDE', 'amenazas-a-la-lde': 'Amenazas a la LDE',
    'privacidad': 'Privacidad y vigilancia', 'privacidad-y-vigilancia': 'Privacidad y vigilancia',
    'gobernanza': 'Gobernanza de Internet', 'gobernanza-de-internet': 'Gobernanza de Internet',
    'ia': 'Inteligencia Artificial', 'inteligencia-artificial': 'Inteligencia Artificial'
  };
  var hashSlug = window.location.hash.replace(/^#/, '').toLowerCase();
  if (hashMap[hashSlug]) {
    filterType = 'category';
    filterValue = hashMap[hashSlug];
    categoryLinks.forEach(function (el) {
      if (el.getAttribute('data-blog-tab') === filterValue) setActive(el);
    });
  } else {
    var allTab = document.querySelector('[data-blog-tab=""]');
    if (allTab) {
      var p = allTab.closest('.blog-nav__item');
      if (p) p.classList.add('is-active');
    }
  }

  applyFilter();
})();
