(function () {
  function init() {
    var grid = document.getElementById('inv-grid');
    if (!grid) return;

    var step = parseInt(grid.getAttribute('data-load-step'), 10) || 6;
    var items = Array.from(grid.querySelectorAll('.inv-item'));
    var featuredSection = document.querySelector('[data-inv-featured]');
    var featuredCard = featuredSection ? featuredSection.querySelector('[data-inv-issues]') : null;
    var filterBtns = document.querySelectorAll('[data-inv-filter]');
    var loadBtn = document.querySelector('[data-hub-load-more][data-hub-target="inv-grid"]');

    // Parse issues from data attribute once
    items.forEach(function (item) {
      try {
        var parsed = JSON.parse(item.getAttribute('data-inv-issues') || '[]');
        item._issues = Array.isArray(parsed) ? parsed : [];
      } catch (e) { item._issues = []; }
    });

    var featuredIssues = [];
    if (featuredCard) {
      try {
        var parsed = JSON.parse(featuredCard.getAttribute('data-inv-issues') || '[]');
        featuredIssues = Array.isArray(parsed) ? parsed : [];
      } catch (e) { featuredIssues = []; }
    }

    var activeFilter = '';
    var shown = 0;

    function getMatching() {
      if (!activeFilter) return items;
      return items.filter(function (item) {
        return item._issues.indexOf(activeFilter) !== -1;
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
        if (activeFilter && featuredIssues.indexOf(activeFilter) === -1) {
          featuredSection.hidden = true;
        } else {
          featuredSection.hidden = false;
        }
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

  // Run after DOMContentLoaded so section-hub.js has already attached
  // its handlers (which we then remove via cloneNode)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
