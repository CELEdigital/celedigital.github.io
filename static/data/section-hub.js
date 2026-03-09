(function () {
  function getItems(list) {
    return Array.from(list.querySelectorAll(".section-block__item"));
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

  document.addEventListener("DOMContentLoaded", initSectionHubLoadMore);
})();
