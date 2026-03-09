(function () {
  function wrapTable(table) {
    if (!table || !table.parentElement) return;
    if (table.closest(".table-responsive, .workshop-table-wrap, .documentation-table")) return;

    var wrapper = document.createElement("div");
    wrapper.className = "table-responsive";
    table.parentElement.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var tables = document.querySelectorAll("main table");
    tables.forEach(wrapTable);
  });
})();
