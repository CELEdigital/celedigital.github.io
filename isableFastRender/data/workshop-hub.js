(function () {
  function setActive(container, targetId, updateHash) {
    var links = container.querySelectorAll(".workshop-links__trigger");
    var items = container.querySelectorAll(".workshop-links__item");
    var panels = container.querySelectorAll("[data-workshop-panel]");
    var activeSlug = null;

    items.forEach(function (item) {
      item.classList.remove("is-active");
    });

    links.forEach(function (link) {
      var isTarget = link.getAttribute("data-workshop-target") === targetId;
      if (isTarget) {
        link.setAttribute("aria-current", "page");
        activeSlug = link.getAttribute("data-workshop-slug");
        var parentItem = link.closest(".workshop-links__item");
        if (parentItem) parentItem.classList.add("is-active");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    panels.forEach(function (panel) {
      if (panel.id === targetId) {
        panel.hidden = false;
        panel.classList.add("is-active");
      } else {
        panel.hidden = true;
        panel.classList.remove("is-active");
      }
    });

    if (updateHash && activeSlug) {
      var nextHash = "#" + activeSlug;
      if (window.location.hash !== nextHash) {
        window.history.pushState({ workshopSlug: activeSlug }, "", nextHash);
      }
    }
  }

  function setActiveFromHash(container) {
    var hash = (window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (!hash) return false;
    var link = container.querySelector('.workshop-links__trigger[data-workshop-slug="' + hash + '"]');
    if (!link) return false;
    var targetId = link.getAttribute("data-workshop-target");
    if (!targetId) return false;
    setActive(container, targetId, false);
    return true;
  }

  function initWorkshopHub(hub) {
    var links = hub.querySelectorAll(".workshop-links__trigger");
    if (!links.length) return;

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var targetId = link.getAttribute("data-workshop-target");
        if (!targetId) return;
        setActive(hub, targetId, true);
      });
    });

    if (!setActiveFromHash(hub)) {
      var firstTarget = links[0].getAttribute("data-workshop-target");
      if (firstTarget) setActive(hub, firstTarget, false);
    }

    window.addEventListener("popstate", function () {
      setActiveFromHash(hub);
    });
    window.addEventListener("hashchange", function () {
      setActiveFromHash(hub);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var hubs = document.querySelectorAll(".workshop-hub");
    hubs.forEach(initWorkshopHub);
  });
})();
