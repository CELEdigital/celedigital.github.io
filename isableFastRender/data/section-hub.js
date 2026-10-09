(function () {
  function getItems(list) {
    return Array.from(list.querySelectorAll(".section-block__item, .inv-item"));
  }

  function revealBatch(items, step) {
    var hiddenItems = items.filter(function (item) {
      return item.hidden;
    });

    if (!hiddenItems.length) return 0;

    hiddenItems.slice(0, step).forEach(function (item) {
      item.hidden = false;
      item.classList.remove("is-hub-hidden");
    });

    return hiddenItems.length - Math.min(step, hiddenItems.length);
  }

  function initBlock(button) {
    var targetId = button.getAttribute("data-hub-target");
    if (!targetId) return;

    var list = document.getElementById(targetId);
    if (!list) return;

    var step = parseInt(list.getAttribute("data-load-step") || "3", 10);
    if (!Number.isFinite(step) || step < 1) step = 3;

    var items = getItems(list);
    if (items.length <= step) return;

    button.hidden = false;
    button.addEventListener("click", function () {
      var remaining = revealBatch(items, step);
      if (remaining <= 0) {
        button.hidden = true;
      }
    });
  }

  function initSectionHubLoadMore() {
    var buttons = document.querySelectorAll("[data-hub-load-more]");
    buttons.forEach(initBlock);
  }

  function initRegionChips() {
    var container = document.querySelector("[data-region-chips]");
    if (!container) return;

    var chips = Array.from(container.querySelectorAll("[data-region-chip]"));
    var allItems = Array.from(document.querySelectorAll(".section-block__item[data-region]"));

    // Default active: global, latam, europe
    var activeRegions = { global: true, latam: true, europe: true };
    // Initialize from chip classes already set in HTML
    chips.forEach(function (chip) {
      var r = chip.getAttribute("data-region-chip");
      activeRegions[r] = chip.classList.contains("is-active");
    });

    function itemRegions(item) {
      var raw = (item.getAttribute("data-region") || "").toLowerCase().trim();
      if (!raw) return ["global"]; // no region = always visible
      return raw.split(/[\s,]+/).filter(Boolean);
    }

    function applyRegionFilter() {
      allItems.forEach(function (item) {
        var regions = itemRegions(item);
        var match = regions.some(function (r) { return activeRegions[r]; });
        if (match) {
          item.classList.remove("is-region-hidden");
          item.style.display = "";
        } else {
          item.classList.add("is-region-hidden");
          item.style.display = "none";
        }
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var r = chip.getAttribute("data-region-chip");
        activeRegions[r] = !activeRegions[r];
        chip.classList.toggle("is-active", activeRegions[r]);
        applyRegionFilter();
      });
    });

    applyRegionFilter();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSectionHubLoadMore();
    initRegionChips();
  });
})();
