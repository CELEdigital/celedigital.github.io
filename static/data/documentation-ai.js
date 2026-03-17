(() => {
  const roots = Array.from(document.querySelectorAll('section.documentation--ai'));
  if (!roots.length) return;

  const FIELDS = {
    ref: 'Número',
    title: 'Objeto',
    country: 'País',
    year: 'Año',
    type: 'Tipo',
    origin: 'Origen',
    estado: 'Estado',
    topic: 'Tema',
    moderacion: 'Regula moderación de contenido',
    sanciones: 'Incluye sanciones',
    test: 'Test tripartito'
  };

  const parseCSV = (text) => {
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') { current += '"'; i += 1; }
        else { inQuotes = !inQuotes; }
        continue;
      }
      if (char === ',' && !inQuotes) { row.push(current); current = ''; continue; }
      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (current || row.length) { row.push(current); rows.push(row); row = []; current = ''; }
        continue;
      }
      current += char;
    }
    if (current || row.length) { row.push(current); rows.push(row); }
    return rows;
  };

  const toObjects = (rows) => {
    const [header, ...data] = rows;
    return data.map((row) => {
      const obj = {};
      header.forEach((key, idx) => { obj[key] = row[idx] || ''; });
      return obj;
    });
  };

  const uniqueSorted = (values) =>
    Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));

  const populateSelect = (select, values) => {
    const current = select.value;
    select.querySelectorAll('option:not([value=""])').forEach((opt) => opt.remove());
    values.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
    select.value = values.includes(current) ? current : '';
  };

  const initDocumentationAI = (root) => {
    const tipoSelect      = root.querySelector('[data-doc-ai-tipo]');
    const paisSelect      = root.querySelector('[data-doc-ai-pais]');
    const anioSelect      = root.querySelector('[data-doc-ai-anio]');
    const estadoSelect    = root.querySelector('[data-doc-ai-estado]');
    const origenSelect    = root.querySelector('[data-doc-ai-origen]');
    const temaSelect      = root.querySelector('[data-doc-ai-tema]');
    const moderacionSelect = root.querySelector('[data-doc-ai-moderacion]');
    const sancionesSelect = root.querySelector('[data-doc-ai-sanciones]');
    const testSelect      = root.querySelector('[data-doc-ai-test]');
    const searchInput     = root.querySelector('[data-doc-ai-search]');
    const rowsContainer   = root.querySelector('[data-doc-ai-rows]');
    const countEl         = root.querySelector('[data-doc-ai-count]');
    const loadBtn         = root.querySelector('[data-doc-ai-load]');

    if (!rowsContainer || !countEl || !loadBtn) return;

    const url = root.dataset.docAiUrl || '/data/ai_clean.csv';
    const state = { rows: [], filtered: [], limit: 20 };

    const applyFilters = () => {
      const tipo       = tipoSelect.value;
      const pais       = paisSelect.value;
      const anio       = anioSelect.value;
      const estado     = estadoSelect.value;
      const origen     = origenSelect.value;
      const tema       = temaSelect.value;
      const moderacion = moderacionSelect.value;
      const sanciones  = sancionesSelect.value;
      const test       = testSelect.value;
      const search     = searchInput.value.trim().toLowerCase();

      state.filtered = state.rows.filter((row) => {
        if (tipo       && row[FIELDS.type]       !== tipo)       return false;
        if (pais       && row[FIELDS.country]    !== pais)       return false;
        if (anio       && row[FIELDS.year]       !== anio)       return false;
        if (estado     && row[FIELDS.estado]     !== estado)     return false;
        if (origen     && row[FIELDS.origin]     !== origen)     return false;
        if (tema       && row[FIELDS.topic]      !== tema)       return false;
        if (moderacion && row[FIELDS.moderacion] !== moderacion) return false;
        if (sanciones  && row[FIELDS.sanciones]  !== sanciones)  return false;
        if (test       && row[FIELDS.test]       !== test)       return false;
        if (search) {
          const haystack = `${row[FIELDS.ref]} ${row[FIELDS.title]}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      });

      state.limit = 20;
      renderRows();
    };

    const renderRows = () => {
      rowsContainer.innerHTML = '';
      const toShow = state.filtered.slice(0, state.limit);
      toShow.forEach((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'doc-row';
        const ref    = row[FIELDS.ref]   || '';
        const title  = row[FIELDS.title] || '';
        const label  = ref ? `${ref} — ${title}` : title;
        rowEl.innerHTML = `
          <div class="doc-title"><span>${label}</span></div>
          <div>${row[FIELDS.country] || ''}</div>
          <div>${row[FIELDS.year]    || ''}</div>
          <div>${row[FIELDS.type]    || ''}</div>
        `;
        rowsContainer.appendChild(rowEl);
      });
      countEl.textContent = `${state.filtered.length}`;
      loadBtn.style.display = state.filtered.length > state.limit ? 'inline-flex' : 'none';
    };

    const loadData = async () => {
      const response = await fetch(url);
      const text     = await response.text();
      state.rows     = toObjects(parseCSV(text));
      state.filtered = state.rows;
      state.limit    = 20;

      populateSelect(tipoSelect,       uniqueSorted(state.rows.map((r) => r[FIELDS.type])));
      populateSelect(paisSelect,       uniqueSorted(state.rows.map((r) => r[FIELDS.country])));
      populateSelect(anioSelect,       uniqueSorted(state.rows.map((r) => r[FIELDS.year])));
      populateSelect(estadoSelect,     uniqueSorted(state.rows.map((r) => r[FIELDS.estado])));
      populateSelect(origenSelect,     uniqueSorted(state.rows.map((r) => r[FIELDS.origin])));
      populateSelect(temaSelect,       uniqueSorted(state.rows.map((r) => r[FIELDS.topic])));
      populateSelect(moderacionSelect, uniqueSorted(state.rows.map((r) => r[FIELDS.moderacion])));
      populateSelect(sancionesSelect,  uniqueSorted(state.rows.map((r) => r[FIELDS.sanciones])));
      populateSelect(testSelect,       uniqueSorted(state.rows.map((r) => r[FIELDS.test])));

      applyFilters();
    };

    [tipoSelect, paisSelect, anioSelect, estadoSelect, origenSelect,
     temaSelect, moderacionSelect, sancionesSelect, testSelect
    ].forEach((sel) => sel.addEventListener('change', applyFilters));

    searchInput.addEventListener('input', applyFilters);
    loadBtn.addEventListener('click', () => { state.limit += 20; renderRows(); });

    loadData();

    // ── Chart → documentation bridge ────────────────────────
    // The IA Vega charts emit 'documentation:filter' with sync:'ia'.
    // Map chart signals to the filter selects and re-apply.
    window.addEventListener('documentation:filter', (event) => {
      const d = event.detail || {};
      if (d.sync && d.sync !== 'ia') return;

      // dataset → Tipo
      if (d.dataset !== undefined) {
        tipoSelect.value = d.dataset !== null ? d.dataset : '';
      }
      // country → País
      if (d.country !== undefined) {
        paisSelect.value = d.country !== null ? d.country : '';
      }
      // year → Año
      if (d.year !== undefined) {
        anioSelect.value = d.year !== null ? String(d.year) : '';
      }

      // featureField + featureValue → the matching category select.
      // Sunburst uses field names (objetivo/impacto/estado/sanciones);
      // drilldown uses display labels (Tema/Test tripartito/Estado/Sanciones).
      const ff = (d.featureField || '').toLowerCase().trim();
      const fv = (d.featureValue !== null && d.featureValue !== undefined) ? d.featureValue : '';

      // Clear all category selects before applying
      temaSelect.value       = '';
      testSelect.value       = '';
      estadoSelect.value     = '';
      sancionesSelect.value  = '';

      if (ff === 'objetivo' || ff === 'tema') {
        temaSelect.value = fv;
      } else if (ff === 'impacto' || ff === 'test tripartito') {
        testSelect.value = fv;
      } else if (ff === 'estado') {
        estadoSelect.value = fv;
      } else if (ff === 'sanciones') {
        sancionesSelect.value = fv;
      }

      applyFilters();
    });
  };

  roots.forEach((root) => initDocumentationAI(root));
})();
