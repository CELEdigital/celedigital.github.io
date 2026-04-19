(function () {
  var list = document.querySelector('[data-blog-list]');
  if (!list) return;

  var step = parseInt(list.getAttribute('data-blog-step'), 10) || 10;
  var items = Array.from(list.querySelectorAll('[data-blog-item]'));
  var loadBtn = document.querySelector('[data-blog-load]');
  var countEl = document.querySelector('[data-blog-count]');
  var categoryLinks = document.querySelectorAll('[data-blog-tab]');
  var tagLinks = document.querySelectorAll('[data-blog-tag]');
  var regionLinks = document.querySelectorAll('[data-blog-region-btn]');
  var countryLinks = document.querySelectorAll('[data-blog-country]');

  // Timeline elements
  var timeline = document.querySelector('[data-blog-timeline]');
  var sliderMin = document.querySelector('[data-blog-timeline-min]');
  var sliderMax = document.querySelector('[data-blog-timeline-max]');
  var timelineLabel = document.querySelector('[data-blog-timeline-label]');
  var timelineRange = document.querySelector('[data-blog-timeline-range]');
  var globalMinYear = timeline ? parseInt(timeline.getAttribute('data-min-year'), 10) : 0;
  var globalMaxYear = timeline ? parseInt(timeline.getAttribute('data-max-year'), 10) : 9999;
  var yearMin = globalMinYear;
  var yearMax = globalMaxYear;

  // Parse data attributes once
  items.forEach(function (item) {
    try { item._blogIssues = JSON.parse(item.getAttribute('data-blog-issues') || '[]'); }
    catch (e) { item._blogIssues = []; }
    try { item._blogTags = JSON.parse(item.getAttribute('data-blog-tags') || '[]'); }
    catch (e) { item._blogTags = []; }
    try { item._blogCountry = JSON.parse(item.getAttribute('data-blog-country') || '[]'); }
    catch (e) { item._blogCountry = []; }
    if (!Array.isArray(item._blogCountry)) item._blogCountry = [];
    item._blogRegion = (item.getAttribute('data-blog-region') || 'global').toLowerCase();
    item._blogYear = parseInt(item.getAttribute('data-blog-year'), 10) || 0;
  });

  var filterCategory = '';
  var filterTag = '';
  var filterRegion = '';
  var filterCountry = '';
  var candidates;
  var shown = 0;

  function getCandidates() {
    var base = items;
    if (filterCategory) {
      base = base.filter(function (i) { return i._blogIssues.indexOf(filterCategory) !== -1; });
    }
    if (filterTag) {
      base = base.filter(function (i) { return i._blogTags.indexOf(filterTag) !== -1; });
    }
    if (filterRegion) {
      base = base.filter(function (i) {
        return i._blogRegion === filterRegion || i._blogRegion === 'global';
      });
    }
    if (filterCountry) {
      base = base.filter(function (i) {
        return i._blogCountry.indexOf(filterCountry) !== -1;
      });
    }
    if (yearMin > globalMinYear || yearMax < globalMaxYear) {
      base = base.filter(function (i) {
        return !i._blogYear || (i._blogYear >= yearMin && i._blogYear <= yearMax);
      });
    }
    return base;
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
  }

  // Helper: set is-active within one nav section only
  function setActiveInSection(el) {
    var section = el.closest('.blog-nav__section');
    if (section) {
      section.querySelectorAll('.blog-nav__item.is-active').forEach(function (p) {
        p.classList.remove('is-active');
      });
    }
    var p = el.closest('.blog-nav__item');
    if (p) p.classList.add('is-active');
  }

  // Category links
  categoryLinks.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      filterCategory = el.getAttribute('data-blog-tab');
      setActiveInSection(el);
      applyFilter();
    });
  });

  // Tag links
  tagLinks.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      filterTag = el.getAttribute('data-blog-tag');
      setActiveInSection(el);
      applyFilter();
    });
  });

  // Region links
  regionLinks.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      filterRegion = el.getAttribute('data-blog-region-btn');
      setActiveInSection(el);
      applyFilter();
    });
  });

  // Country links
  countryLinks.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      filterCountry = el.getAttribute('data-blog-country');
      setActiveInSection(el);
      applyFilter();
    });
  });

  // Load more
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

  // Timeline slider handlers
  function updateTimelineUI() {
    if (!timeline) return;
    var span = globalMaxYear - globalMinYear || 1;
    var leftPct = ((yearMin - globalMinYear) / span) * 100;
    var rightPct = ((globalMaxYear - yearMax) / span) * 100;
    timelineRange.style.left = leftPct + '%';
    timelineRange.style.right = rightPct + '%';
    timelineLabel.textContent = yearMin + ' – ' + yearMax;
  }

  if (sliderMin && sliderMax) {
    function onSliderInput() {
      var lo = parseInt(sliderMin.value, 10);
      var hi = parseInt(sliderMax.value, 10);
      if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
      yearMin = lo;
      yearMax = hi;
      sliderMin.value = lo;
      sliderMax.value = hi;
      updateTimelineUI();
      applyFilter();
    }
    sliderMin.addEventListener('input', onSliderInput);
    sliderMax.addEventListener('input', onSliderInput);
    updateTimelineUI();
  }

  // Hash-based category pre-selection
  var hashMap = {
    'empresas': 'Empresas y DDHH', 'empresas-y-ddhh': 'Empresas y DDHH',
    'erosion': 'Erosión democrática', 'erosion-democratica': 'Erosión democrática',
    'plataformas': 'Plataformas',
    'regulacion': 'Regulación y tecnología', 'regulacion-y-tecnologia': 'Regulación y tecnología',
    'violencias': 'Violencias'
  };
  var hashSlug = window.location.hash.replace(/^#/, '').toLowerCase();
  if (hashMap[hashSlug]) {
    filterCategory = hashMap[hashSlug];
    categoryLinks.forEach(function (el) {
      if (el.getAttribute('data-blog-tab') === filterCategory) setActiveInSection(el);
    });
  }

  applyFilter();
})();
