(function () {
  function init() {
    var grid = document.getElementById('inv-grid');
    if (!grid) return;

    var step = parseInt(grid.getAttribute('data-load-step'), 10) || 6;
    var items = Array.from(grid.querySelectorAll('.inv-item'));
    var featuredSection = document.querySelector('[data-inv-featured]');
    var featuredCard = featuredSection ? featuredSection.querySelector('[data-inv-issues]') : null;
    var filterBtns = document.querySelectorAll('[data-inv-filter]');
    var typeBtns = document.querySelectorAll('[data-inv-filter-type]');
    var regionBtns = document.querySelectorAll('[data-inv-filter-region]');
    var loadBtn = document.querySelector('[data-hub-load-more][data-hub-target="inv-grid"]');

    // Timeline elements
    var timeline = document.querySelector('[data-inv-timeline]');
    var sliderMin = document.querySelector('[data-inv-timeline-min]');
    var sliderMax = document.querySelector('[data-inv-timeline-max]');
    var timelineLabel = document.querySelector('[data-inv-timeline-label]');
    var timelineRange = document.querySelector('[data-inv-timeline-range]');
    var globalMinYear = timeline ? parseInt(timeline.getAttribute('data-min-year'), 10) : 0;
    var globalMaxYear = timeline ? parseInt(timeline.getAttribute('data-max-year'), 10) : 9999;

    // Parse data attributes once
    items.forEach(function (item) {
      try {
        item._issues = JSON.parse(item.getAttribute('data-inv-issues') || '[]');
        if (!Array.isArray(item._issues)) item._issues = [];
      } catch (e) { item._issues = []; }
      try {
        item._types = JSON.parse(item.getAttribute('data-inv-type') || '[]');
        if (!Array.isArray(item._types)) item._types = [];
      } catch (e) { item._types = []; }
      item._region = (item.getAttribute('data-inv-region') || '').toLowerCase();
      item._year = parseInt(item.getAttribute('data-inv-year'), 10) || 0;
    });

    var featuredIssues = [];
    var featuredTypes = [];
    var featuredRegion = '';
    var featuredYear = 0;
    if (featuredCard) {
      try {
        featuredIssues = JSON.parse(featuredCard.getAttribute('data-inv-issues') || '[]');
        if (!Array.isArray(featuredIssues)) featuredIssues = [];
      } catch (e) { featuredIssues = []; }
      try {
        featuredTypes = JSON.parse(featuredCard.getAttribute('data-inv-type') || '[]');
        if (!Array.isArray(featuredTypes)) featuredTypes = [];
      } catch (e) { featuredTypes = []; }
      featuredRegion = (featuredCard.getAttribute('data-inv-region') || '').toLowerCase();
      featuredYear = parseInt(featuredCard.getAttribute('data-inv-year'), 10) || 0;
    }

    var activeFilter = '';
    var activeTypes = [];
    var activeRegions = [];
    var yearMin = globalMinYear;
    var yearMax = globalMaxYear;
    var shown = 0;

    function updateTimelineUI() {
      if (!timeline) return;
      var span = globalMaxYear - globalMinYear || 1;
      var leftPct = ((yearMin - globalMinYear) / span) * 100;
      var rightPct = ((globalMaxYear - yearMax) / span) * 100;
      timelineRange.style.left = leftPct + '%';
      timelineRange.style.right = rightPct + '%';
      timelineLabel.textContent = yearMin + ' – ' + yearMax;
    }

    function getMatching() {
      return items.filter(function (item) {
        if (activeFilter && item._issues.indexOf(activeFilter) === -1) return false;
        if (activeTypes.length > 0) {
          var hasType = activeTypes.some(function (t) { return item._types.indexOf(t) !== -1; });
          if (!hasType) return false;
        }
        if (activeRegions.length > 0 && activeRegions.indexOf(item._region) === -1) return false;
        if (item._year && (item._year < yearMin || item._year > yearMax)) return false;
        return true;
      });
    }

    function applyFilter() {
      var matching = getMatching();
      var visible = new Set(matching.slice(0, step));

      items.forEach(function (item) {
        var show = visible.has(item);
        item.hidden = !show;
        item.classList.toggle('is-hub-hidden', !show);
      });

      shown = visible.size;

      // Show/hide featured section
      if (featuredSection) {
        var hideFeatured = false;
        if (activeFilter && featuredIssues.indexOf(activeFilter) === -1) hideFeatured = true;
        if (activeTypes.length > 0) {
          var hasType = activeTypes.some(function (t) { return featuredTypes.indexOf(t) !== -1; });
          if (!hasType) hideFeatured = true;
        }
        if (activeRegions.length > 0 && activeRegions.indexOf(featuredRegion) === -1) hideFeatured = true;
        if (featuredYear && (featuredYear < yearMin || featuredYear > yearMax)) hideFeatured = true;
        featuredSection.hidden = hideFeatured;
      }

      // Update load-more button
      if (loadBtn) {
        loadBtn.hidden = matching.length <= step;
      }
    }

    // Button click handlers
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-inv-filter');
        filterBtns.forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        applyFilter();
      });
    });

    // Multi-select button handler helper
    function initMultiFilter(btns, attr, getActive, setActive) {
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var val = btn.getAttribute(attr);
          if (val === '') {
            setActive([]);
            btns.forEach(function (b) {
              b.classList.toggle('is-active', b.getAttribute(attr) === '');
            });
          } else {
            var current = getActive();
            var idx = current.indexOf(val);
            if (idx === -1) { current.push(val); } else { current.splice(idx, 1); }
            setActive(current);
            btns.forEach(function (b) {
              var bVal = b.getAttribute(attr);
              if (bVal === '') {
                b.classList.toggle('is-active', current.length === 0);
              } else {
                b.classList.toggle('is-active', current.indexOf(bVal) !== -1);
              }
            });
          }
          applyFilter();
        });
      });
    }

    initMultiFilter(typeBtns, 'data-inv-filter-type',
      function () { return activeTypes; },
      function (v) { activeTypes = v; }
    );
    initMultiFilter(regionBtns, 'data-inv-filter-region',
      function () { return activeRegions; },
      function (v) { activeRegions = v.map(function (r) { return r.toLowerCase(); }); }
    );

    // Timeline slider handlers
    if (sliderMin && sliderMax) {
      function onSliderInput() {
        var lo = parseInt(sliderMin.value, 10);
        var hi = parseInt(sliderMax.value, 10);
        if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
        yearMin = lo;
        yearMax = hi;
        // Keep sliders in sync so they don't cross
        sliderMin.value = lo;
        sliderMax.value = hi;
        updateTimelineUI();
        applyFilter();
      }
      sliderMin.addEventListener('input', onSliderInput);
      sliderMax.addEventListener('input', onSliderInput);
      updateTimelineUI();
    }

    // Load-more: replace button to remove section-hub.js listeners
    if (loadBtn) {
      var newBtn = loadBtn.cloneNode(true);
      loadBtn.parentNode.replaceChild(newBtn, loadBtn);
      loadBtn = newBtn;

      loadBtn.addEventListener('click', function () {
        var matching = getMatching();
        var next = matching.slice(shown, shown + step);
        next.forEach(function (item) {
          item.hidden = false;
          item.classList.remove('is-hub-hidden');
        });
        shown += next.length;
        if (shown >= matching.length) loadBtn.hidden = true;
      });
    }

    // Initial render
    applyFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
