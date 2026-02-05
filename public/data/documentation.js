(() => {
  const root = document.querySelector('section.documentation');
  if (!root) return;

  const datasetSelect = root.querySelector('[data-doc-dataset]');
  const categorySelect = root.querySelector('[data-doc-category]');
  const countrySelect = root.querySelector('[data-doc-country]');
  const topicSelect = root.querySelector('[data-doc-topic]');
  const dateSelect = root.querySelector('[data-doc-date]');
  const criminalizaSelect = root.querySelector('[data-doc-criminaliza]');
  const eliminaCrimSelect = root.querySelector('[data-doc-elimina-crim]');
  const sancionCivilSelect = root.querySelector('[data-doc-sancion-civil]');
  const eliminaSancionSelect = root.querySelector('[data-doc-elimina-sancion]');
  const regulaContenidoSelect = root.querySelector('[data-doc-regula-contenido]');
  const distingueOnlineSelect = root.querySelector('[data-doc-distingue-online]');
  const intermediariosSelect = root.querySelector('[data-doc-intermediarios]');
  const limitaSelect = root.querySelector('[data-doc-limita]');
  const testSelect = root.querySelector('[data-doc-test]');
  const searchInput = root.querySelector('[data-doc-search]');
  const rowsContainer = root.querySelector('[data-doc-rows]');
  const countEl = root.querySelector('[data-doc-count]');
  const loadBtn = root.querySelector('[data-doc-load]');

  const proyectosUrl = root.dataset.docProyectosUrl || '/data/proyectos_clean.csv';
  const leyesUrl = root.dataset.docLeyesUrl || '/data/leyes_clean.csv';

  const DATASETS = {
    proyectos: {
      url: proyectosUrl,
      fields: {
        title: 'Extracto',
        category: 'Tipo',
        country: 'País',
        year: 'Año',
        topic: 'Objetivo legítimo',
        date: 'Fecha de entrada',
        type: 'Tipo',
        link: 'Link',
        ref: 'N° de expediente',
        origin: 'Origen',
        criminaliza: '¿Criminaliza la expresión?',
        eliminaCrim: '¿Elimina criminalización?',
        sancionCivil: '¿Impone una sanción civil?',
        eliminaSancion: '¿Elimina una sanción civil?',
        regulaContenido: '¿Regula contenido en Internet?',
        distingueOnline: '¿Distingue la expresión online de la offline?',
        intermediarios: '¿Regula intermediarios en internet?',
        limita: '¿Limita el discurso?',
        test: '¿Cumple con todos los elementos del test?'
      }
    },
    leyes: {
      url: leyesUrl,
      fields: {
        title: 'Extracto',
        category: 'Tipo',
        country: 'País',
        year: 'Año',
        topic: 'Objetivo legítimo',
        date: 'Fecha de sanción',
        type: 'Tipo',
        link: 'Link',
        ref: 'N° de ley',
        origin: '',
        criminaliza: '¿Criminaliza la expresión?',
        eliminaCrim: '¿Elimina criminalización?',
        sancionCivil: '¿Impone una sanción civil?',
        eliminaSancion: '¿Elimina una sanción civil?',
        regulaContenido: '¿Regula contenido en Internet?',
        distingueOnline: '¿Distingue la expresión online de la offline?',
        intermediarios: '¿Regula intermediarios en Internet?',
        limita: '¿Limita o promueve el discurso?',
        test: '¿Cumple con todos los elementos del test?'
      }
    }
  };

  const state = {
    rows: [],
    filtered: [],
    limit: 20
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
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (current || row.length) {
          row.push(current);
          rows.push(row);
          row = [];
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (current || row.length) {
      row.push(current);
      rows.push(row);
    }

    return rows;
  };

  const toObjects = (rows) => {
    const [header, ...data] = rows;
    return data.map((row) => {
      const obj = {};
      header.forEach((key, idx) => {
        obj[key] = row[idx] || '';
      });
      return obj;
    });
  };

  const uniqueSorted = (values) => {
    const set = Array.from(new Set(values.filter(Boolean)));
    return set.sort((a, b) => String(a).localeCompare(String(b)));
  };

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

  const formatTitle = (row, fields) => {
    const ref = row[fields.ref];
    const origin = fields.origin ? row[fields.origin] : '';
    const prefix = [ref, origin].filter(Boolean).join(' • ');
    const excerpt = row[fields.title] || '';
    return prefix ? `${prefix} — ${excerpt}` : excerpt;
  };

  const applyFilters = () => {
    const dataset = datasetSelect.value;
    const fields = DATASETS[dataset].fields;
      const category = categorySelect.value;
      const country = countrySelect.value;
      const topic = topicSelect.value;
      const date = dateSelect.value;
      const criminaliza = criminalizaSelect.value;
      const eliminaCrim = eliminaCrimSelect.value;
      const sancionCivil = sancionCivilSelect.value;
      const eliminaSancion = eliminaSancionSelect.value;
      const regulaContenido = regulaContenidoSelect.value;
      const distingueOnline = distingueOnlineSelect.value;
      const intermediarios = intermediariosSelect.value;
      const limita = limitaSelect.value;
      const test = testSelect.value;
      const search = searchInput.value.trim().toLowerCase();

      state.filtered = state.rows.filter((row) => {
        if (category && row[fields.category] !== category) return false;
        if (country && row[fields.country] !== country) return false;
        if (topic && row[fields.topic] !== topic) return false;
        if (date && (row[fields.date] || '').slice(0, 4) !== date) return false;
        if (criminaliza && row[fields.criminaliza] !== criminaliza) return false;
        if (eliminaCrim && row[fields.eliminaCrim] !== eliminaCrim) return false;
        if (sancionCivil && row[fields.sancionCivil] !== sancionCivil) return false;
        if (eliminaSancion && row[fields.eliminaSancion] !== eliminaSancion) return false;
        if (regulaContenido && row[fields.regulaContenido] !== regulaContenido) return false;
        if (distingueOnline && row[fields.distingueOnline] !== distingueOnline) return false;
        if (intermediarios && row[fields.intermediarios] !== intermediarios) return false;
        if (limita && row[fields.limita] !== limita) return false;
        if (test && row[fields.test] !== test) return false;
        if (search) {
          const haystack = `${row[fields.title]} ${row[fields.ref]} ${row[fields.origin] || ''}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
    });

    renderRows();
  };

  const renderRows = () => {
    const dataset = datasetSelect.value;
    const fields = DATASETS[dataset].fields;
    rowsContainer.innerHTML = '';

    const toShow = state.filtered.slice(0, state.limit);
    toShow.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'doc-row';
      const link = row[fields.link];
      const title = formatTitle(row, fields);
      rowEl.innerHTML = `
        <div class="doc-title">
          <span>${title}</span>
          ${link ? `
            <a class="doc-link" href="${link}" target="_blank" rel="noopener" aria-label="Abrir enlace">
              <svg class="doc-link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"></path>
                <path d="M5 5h7V3H3v9h2V5zm0 14v-7H3v9h9v-2H5z"></path>
              </svg>
            </a>` : ''
          }
        </div>
        <div>${row[fields.country] || ''}</div>
        <div>${row[fields.year] || ''}</div>
        <div>${row[fields.type] || ''}</div>
      `;
      rowsContainer.appendChild(rowEl);
    });

    countEl.textContent = `${state.filtered.length}`;
    loadBtn.style.display = state.filtered.length > state.limit ? 'inline-flex' : 'none';
  };

  const loadDataset = async () => {
    const dataset = datasetSelect.value;
    const response = await fetch(DATASETS[dataset].url);
    const text = await response.text();
    const rows = parseCSV(text);
    const data = toObjects(rows);

    state.rows = data;
    state.filtered = data;
    state.limit = 20;

    const fields = DATASETS[dataset].fields;
      populateSelect(categorySelect, uniqueSorted(data.map((row) => row[fields.category])));
      populateSelect(countrySelect, uniqueSorted(data.map((row) => row[fields.country])));
      populateSelect(topicSelect, uniqueSorted(data.map((row) => row[fields.topic])));
      populateSelect(dateSelect, uniqueSorted(data.map((row) => (row[fields.date] || '').slice(0, 4)).filter(Boolean)));
      populateSelect(criminalizaSelect, uniqueSorted(data.map((row) => row[fields.criminaliza])));
      populateSelect(eliminaCrimSelect, uniqueSorted(data.map((row) => row[fields.eliminaCrim])));
      populateSelect(sancionCivilSelect, uniqueSorted(data.map((row) => row[fields.sancionCivil])));
      populateSelect(eliminaSancionSelect, uniqueSorted(data.map((row) => row[fields.eliminaSancion])));
      populateSelect(regulaContenidoSelect, uniqueSorted(data.map((row) => row[fields.regulaContenido])));
      populateSelect(distingueOnlineSelect, uniqueSorted(data.map((row) => row[fields.distingueOnline])));
      populateSelect(intermediariosSelect, uniqueSorted(data.map((row) => row[fields.intermediarios])));
      populateSelect(limitaSelect, uniqueSorted(data.map((row) => row[fields.limita])));
      populateSelect(testSelect, uniqueSorted(data.map((row) => row[fields.test])));

    applyFilters();
  };

  datasetSelect.addEventListener('change', loadDataset);
  [
    categorySelect,
    countrySelect,
    topicSelect,
    dateSelect,
    criminalizaSelect,
    eliminaCrimSelect,
    sancionCivilSelect,
    eliminaSancionSelect,
    regulaContenidoSelect,
    distingueOnlineSelect,
    intermediariosSelect,
    limitaSelect,
    testSelect
  ].forEach((select) => {
    select.addEventListener('change', applyFilters);
  });
  searchInput.addEventListener('input', applyFilters);
  loadBtn.addEventListener('click', () => {
    state.limit += 20;
    renderRows();
  });

  loadDataset();
})();
