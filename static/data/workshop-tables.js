(function () {
  function compact(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isDashValue(value) {
    var normalized = compact(value);
    return normalized === "-" || normalized === "–" || normalized === "—";
  }

  function getBodyRows(table) {
    return table.tBodies.length ? Array.from(table.tBodies[0].rows) : Array.from(table.rows).slice(1);
  }

  function markTimeColumn(table) {
    var headRow = table.tHead && table.tHead.rows.length ? table.tHead.rows[0] : table.rows[0];
    if (headRow && headRow.cells.length > 1) {
      headRow.cells[1].classList.add("workshop-time-cell");
    }

    var bodyRows = getBodyRows(table);
    bodyRows.forEach(function (row) {
      if (row.cells.length > 1) {
        row.cells[1].classList.add("workshop-time-cell");
      }
    });
  }

  function mergeDashCells(table) {
    var rows = getBodyRows(table);
    rows.forEach(function (row) {
      var cells = Array.from(row.cells);
      for (var i = cells.length - 1; i >= 0; i -= 1) {
        var cell = cells[i];
        if (!isDashValue(cell.textContent)) continue;

        var leftIndex = i - 1;
        while (leftIndex >= 0 && isDashValue(cells[leftIndex].textContent)) {
          leftIndex -= 1;
        }
        if (leftIndex < 0) continue;

        var leftCell = cells[leftIndex];
        var colSpan = parseInt(leftCell.getAttribute("colspan") || "1", 10);
        leftCell.setAttribute("colspan", String(colSpan + 1));
        cell.remove();
        cells.splice(i, 1);
      }
    });
  }

  function unifyDateColumn(table) {
    var rows = getBodyRows(table);
    var previousCell = null;
    var previousText = "";

    rows.forEach(function (row) {
      if (!row.cells.length) return;
      var firstCell = row.cells[0];
      var firstText = compact(firstCell.textContent);
      if (isDashValue(firstText)) {
        firstText = previousText || "";
        firstCell.textContent = firstText;
      }
      if (!firstText) return;

      if (previousCell && firstText === previousText) {
        var rowSpan = parseInt(previousCell.getAttribute("rowspan") || "1", 10);
        previousCell.setAttribute("rowspan", String(rowSpan + 1));
        firstCell.remove();
      } else {
        previousCell = firstCell;
        previousText = firstText;
      }
    });
  }

  function wrapTable(table) {
    var parent = table.parentElement;
    if (!parent) return null;
    if (parent.classList.contains("workshop-table-wrap")) return parent;

    var wrapper = document.createElement("div");
    wrapper.className = "workshop-table-wrap";
    parent.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    return wrapper;
  }

  function hasActivityColumn(table) {
    var headRow = table.tHead && table.tHead.rows.length ? table.tHead.rows[0] : table.rows[0];
    if (!headRow) return false;

    var headers = Array.from(headRow.cells);
    for (var i = 0; i < headers.length; i += 1) {
      var text = compact(headers[i].textContent).toLowerCase();
      if (text.indexOf("actividad") !== -1 || text.indexOf("activity") !== -1) {
        return true;
      }
    }
    return false;
  }

  function setAriaExpanded(summaries, selectedSummary) {
    summaries.forEach(function (summary) {
      summary.setAttribute("aria-expanded", summary === selectedSummary ? "true" : "false");
    });
  }

  function setupActivityInspector(table) {
    if (!hasActivityColumn(table)) return;

    var rows = getBodyRows(table);

    function clearSelection() {
      rows.forEach(function (row) {
        row.classList.remove("is-activity-selected");
      });
    }

    var summaries = [];

    function resetInspector() {
      clearSelection();
      setAriaExpanded(summaries, null);
      rows.forEach(function (row) {
        var details = row.querySelector("details");
        if (details) details.open = false;
      });
    }

    rows.forEach(function (row) {
      var details = row.querySelector("details");
      var summary = details && details.querySelector("summary");
      if (!details || !summary) return;

      var description = details.innerHTML.replace(summary.outerHTML, "").trim();
      if (!description) return;

      summaries.push(summary);
      details.open = false;
      var cell = details.closest("td,th");
      if (!cell) return;
      cell.classList.add("workshop-activity-trigger");
      summary.classList.add("workshop-activity-summary");
      summary.setAttribute("role", "button");
      summary.setAttribute("tabindex", "0");
      summary.setAttribute("aria-expanded", "false");

      function openPanel() {
        clearSelection();
        row.classList.add("is-activity-selected");
        setAriaExpanded(summaries, summary);
        details.open = true;
      }

      summary.addEventListener("click", function (event) {
        if (event.target && event.target.closest("a")) return;
        window.requestAnimationFrame(function () {
          if (details.open) {
            openPanel();
          } else if (row.classList.contains("is-activity-selected")) {
            clearSelection();
            setAriaExpanded(summaries, null);
          }
        });
      });

      details.addEventListener("toggle", function () {
        if (details.open) {
          openPanel();
        } else if (row.classList.contains("is-activity-selected")) {
          clearSelection();
          setAriaExpanded(summaries, null);
        }
      });

      cell.addEventListener("click", function (event) {
        if (event.target && event.target.closest("a")) return;
        if (event.target && event.target.closest("summary")) return;
        openPanel();
      });
    });

    resetInspector();
    window.addEventListener("pageshow", resetInspector);
  }

  function enhanceTable(table) {
    markTimeColumn(table);
    mergeDashCells(table);
    unifyDateColumn(table);
    wrapTable(table);
    setupActivityInspector(table);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var tables = document.querySelectorAll(".workshop-subhub__block .section-content table");
    tables.forEach(enhanceTable);
  });
})();
