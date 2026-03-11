(function () {
  function buildInlineColumns(panel) {
    if (!panel || panel.dataset.columnsReady === "true") return;
    if (panel.classList.contains("observatory-inline-panel--boletines")) return;
    if (panel.classList.contains("observatory-inline-panel--mesas")) return;

    var children = Array.from(panel.children);
    if (!children.length) return;

    var grid = document.createElement("div");
    grid.className = "observatory-inline-grid";

    var block = null;
    children.forEach(function (node) {
      var tagName = node.tagName ? node.tagName.toUpperCase() : "";
      var startsBlock = tagName === "H1" || tagName === "H2";

      if (startsBlock) {
        block = document.createElement("section");
        block.className = "observatory-inline-block";
        grid.appendChild(block);
      }

      if (!block) {
        block = document.createElement("section");
        block.className = "observatory-inline-block";
        grid.appendChild(block);
      }

      block.appendChild(node);
    });

    if (grid.children.length) {
      panel.appendChild(grid);
      panel.dataset.columnsReady = "true";
    }
  }

  function setExpanded(toggle, expanded) {
    toggle.setAttribute("aria-expanded", String(expanded));
  }

  function scrollToSubsection(toggle) {
    if (!toggle) return;

    var container = toggle.closest(".observatory-links") || toggle;
    var fixedHeader = document.querySelector(".site-header");
    var headerOffset = fixedHeader ? fixedHeader.getBoundingClientRect().height : 0;
    var top = window.scrollY + container.getBoundingClientRect().top - headerOffset - 12;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }

  function expandPanel(panel) {
    panel.hidden = false;
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("is-open");
    panel.style.maxHeight = "0px";

    window.requestAnimationFrame(function () {
      panel.style.maxHeight = panel.scrollHeight + "px";
    });

    function onTransitionEnd(event) {
      if (event.propertyName !== "max-height") return;
      if (panel.classList.contains("is-open")) {
        panel.style.maxHeight = "none";
      }
    }

    panel.addEventListener("transitionend", onTransitionEnd, { once: true });
  }

  function collapsePanel(panel) {
    if (panel.hidden) return;

    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");

    if (panel.style.maxHeight === "none" || !panel.style.maxHeight) {
      panel.style.maxHeight = panel.scrollHeight + "px";
    }

    window.requestAnimationFrame(function () {
      panel.style.maxHeight = "0px";
    });

    function onTransitionEnd(event) {
      if (event.propertyName !== "max-height") return;
      if (!panel.classList.contains("is-open")) {
        panel.hidden = true;
        panel.style.maxHeight = "";
      }
    }

    panel.addEventListener("transitionend", onTransitionEnd, { once: true });
  }

  function initObservatoryHub() {
    var toggles = document.querySelectorAll("[data-observatory-inline-toggle]");
    if (!toggles.length) return;

    toggles.forEach(function (toggle) {
      var panelId = toggle.getAttribute("aria-controls");
      if (!panelId) return;
      var panel = document.getElementById(panelId);
      if (!panel) return;

      buildInlineColumns(panel);

      panel.hidden = true;
      panel.style.maxHeight = "";
      panel.setAttribute("aria-hidden", "true");
      setExpanded(toggle, false);

      toggle.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        var isOpen = toggle.getAttribute("aria-expanded") === "true";

        toggles.forEach(function (otherToggle) {
          var otherPanelId = otherToggle.getAttribute("aria-controls");
          if (!otherPanelId) return;
          var otherPanel = document.getElementById(otherPanelId);
          if (!otherPanel) return;
          setExpanded(otherToggle, false);
          collapsePanel(otherPanel);
        });

        if (!isOpen) {
          setExpanded(toggle, true);
          expandPanel(panel);
        }

        window.requestAnimationFrame(function () {
          scrollToSubsection(toggle);
        });
      });
    });
  }

  function initBoletinesLoadMore() {
    var buttons = document.querySelectorAll("[data-observatory-boletines-more]");
    if (!buttons.length) return;

    buttons.forEach(function (button) {
      var listId = button.getAttribute("data-target");
      if (!listId) return;

      var list = document.getElementById(listId);
      if (!list) return;

      var step = parseInt(button.getAttribute("data-step") || "5", 10);
      if (!Number.isFinite(step) || step < 1) step = 5;

      var items = Array.from(list.querySelectorAll(".observatory-boletines-item"));
      var hiddenItems = items.filter(function (item) {
        return item.hidden;
      });

      if (!hiddenItems.length) return;

      button.hidden = false;
      button.addEventListener("click", function () {
        var pending = items.filter(function (item) {
          return item.hidden;
        });

        pending.slice(0, step).forEach(function (item) {
          item.hidden = false;
          item.classList.remove("is-observatory-hidden");
        });

        if (items.every(function (item) { return !item.hidden; })) {
          button.hidden = true;
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initObservatoryHub();
    initBoletinesLoadMore();
  });
})();
