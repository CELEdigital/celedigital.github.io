(() => {
  const roots = Array.from(document.querySelectorAll('section.documentation'));
  if (!roots.length) return;

  const BASE_DATASETS = {
    proyectos: {
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
        test: '¿Cumple con todos los elementos del test?',
        analisis: 'Análisis del test tripartito'
      }
    },
    leyes: {
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
        test: '¿Cumple con todos los elementos del test?',
        analisis: 'Análisis del test tripartito'
      }
    }
  };

  const csvCache = new Map();

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

  const normalize = (value) => {
    if (value === null || value === undefined || value === '') return '';
    return String(value).trim();
  };

  // Los gráficos colapsan las variantes de grafía de tipo/impacto/objetivo
  // (ver scripts/actualizar_observatorio.py), así que el filtro cruzado tiene que
  // comparar ignorando mayúsculas y acentos: si no, hacer clic en «Proyecto de
  // ley» descartaba las filas que en el CSV dicen «Proyecto de Ley».
  const fold = (value) => normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const normalizeAnalysis = (value) => {
    const text = String(value === null || value === undefined ? '' : value)
      .replace(/\s+/g, ' ')
      .trim();
    if (!/[\p{L}\p{N}]/u.test(text)) return '';
    return text;
  };

  const buildFlag = (text, labels) => {
    const wrap = document.createElement('span');
    wrap.className = 'doc-flag';

    const btn = document.createElement('button');
    btn.className = 'doc-flag__btn';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', labels.flag);
    btn.innerHTML = `
      <svg class="doc-flag__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.88 18.3 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z"></path>
      </svg>`;

    const bubble = document.createElement('span');
    bubble.className = 'doc-flag__bubble';
    bubble.setAttribute('role', 'tooltip');

    const title = document.createElement('span');
    title.className = 'doc-flag__title';
    title.textContent = labels.analysis;

    const body = document.createElement('span');
    body.className = 'doc-flag__text';
    body.textContent = text;

    bubble.appendChild(title);
    bubble.appendChild(body);
    wrap.appendChild(btn);
    wrap.appendChild(bubble);
    return wrap;
  };

  // Centre the bubble under the icon, then pull it back if that would run past
  // either edge of the screen — on narrow columns the icon sits near the margin.
  const positionBubble = (flag) => {
    const bubble = flag.querySelector('.doc-flag__bubble');
    if (!bubble) return;
    bubble.style.left = '0px';
    const anchor = flag.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const margin = 8;
    const viewport = document.documentElement.clientWidth;
    const centred = anchor.left + (anchor.width - width) / 2;
    const clamped = Math.max(margin, Math.min(centred, viewport - margin - width));
    bubble.style.left = `${Math.round(clamped - anchor.left)}px`;
  };

  const normalizeDatasetFromCharts = (value) => {
    const normalized = normalize(value).toLowerCase();
    if (!normalized) return '';
    if (normalized.startsWith('proyecto')) return 'proyectos';
    if (normalized.startsWith('ley')) return 'leyes';
    if (normalized === 'proyectos' || normalized === 'leyes') return normalized;
    return '';
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

  const fetchDatasetRows = async (datasetConfig) => {
    const url = datasetConfig.url;
    if (csvCache.has(url)) return csvCache.get(url);

    const response = await fetch(url);
    const text = await response.text();
    const rows = toObjects(parseCSV(text));
    csvCache.set(url, rows);
    return rows;
  };

  const initDocumentation = (root) => {
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

    if (!datasetSelect || !rowsContainer || !countEl || !loadBtn) return;

    const datasetConfigs = {
      proyectos: {
        ...BASE_DATASETS.proyectos,
        url: root.dataset.docProyectosUrl || '/data/proyectos_clean.csv'
      },
      leyes: {
        ...BASE_DATASETS.leyes,
        url: root.dataset.docLeyesUrl || '/data/leyes_clean.csv'
      }
    };

    const state = {
      rows: [],
      filtered: [],
      limit: 20,
      external: {
        dataset: '',
        country: '',
        featureField: '',
        featureValue: '',
        year: ''
      },
      // Rango del slider compartido. Va fuera de `external` a propósito:
      // applyExternalFilters reconstruye ese objeto entero en cada clic sobre
      // un gráfico, y se llevaba puesto el rango.
      years: { min: null, max: null }
    };

    const syncKey = normalize(root.dataset.docSync);
    const interactive = String(root.dataset.docInteractive || '').toLowerCase() === 'true';

    const flagLabels = {
      flag: root.dataset.docFlagLabel || 'No cumple con el test tripartito',
      analysis: root.dataset.docFlagTitle || 'Análisis del test tripartito'
    };

    const closeFlags = (except) => {
      rowsContainer.querySelectorAll('.doc-flag.is-open').forEach((flag) => {
        if (flag === except) return;
        flag.classList.remove('is-open');
        const btn = flag.querySelector('.doc-flag__btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    };

    const applyFilters = () => {
      const dataset = datasetSelect.value;
      const fields = datasetConfigs[dataset].fields;
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
      const ext = state.external;

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

        if (ext.country && row[fields.country] !== ext.country) return false;

        if (ext.featureField && ext.featureValue) {
          const key = ext.featureField.toLowerCase();
          // Los gráficos muestran «Sin dato» donde el CSV trae la celda vacía.
          const target = fold(ext.featureValue) === 'sin dato' ? '' : fold(ext.featureValue);
          if (key === 'objetivo' && fold(row[fields.topic]) !== target) return false;
          if (key === 'impacto' && fold(row[fields.limita]) !== target) return false;
          if (key === 'tipo' && fold(row[fields.type]) !== target) return false;
        }

        if (ext.year && normalize(row[fields.year]) !== normalize(ext.year)) return false;

        // Rango del slider compartido de la sección Visualizaciones.
        if (state.years.min !== null || state.years.max !== null) {
          const anio = parseInt(normalize(row[fields.year]), 10);
          if (Number.isFinite(anio)) {
            if (state.years.min !== null && anio < state.years.min) return false;
            if (state.years.max !== null && anio > state.years.max) return false;
          }
        }

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
      const fields = datasetConfigs[dataset].fields;
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

        const analysis = normalizeAnalysis(row[fields.analisis]);
        const failsTest = normalize(row[fields.test]).toUpperCase() === 'NO';
        if (analysis && failsTest) {
          rowEl.querySelector('.doc-title').appendChild(buildFlag(analysis, flagLabels));
        }

        rowsContainer.appendChild(rowEl);
      });

      countEl.textContent = `${state.filtered.length}`;
      loadBtn.style.display = state.filtered.length > state.limit ? 'inline-flex' : 'none';
    };

    const loadDataset = async () => {
      const dataset = datasetSelect.value;
      const config = datasetConfigs[dataset];
      const data = await fetchDatasetRows(config);

      state.rows = data;
      state.filtered = data;
      state.limit = 20;

      const fields = config.fields;
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

    const applyExternalFilters = async (detail) => {
      if (!interactive) return;
      if (syncKey && detail.sync && syncKey !== detail.sync) return;

      const mappedDataset = normalizeDatasetFromCharts(detail.dataset);
      if (mappedDataset && mappedDataset !== datasetSelect.value) {
        datasetSelect.value = mappedDataset;
        await loadDataset();
      }

      state.external = {
        dataset: mappedDataset,
        country: normalize(detail.country),
        featureField: normalize(detail.featureField),
        featureValue: normalize(detail.featureValue),
        year: normalize(detail.year)
      };

      applyFilters();
    };

    datasetSelect.addEventListener('change', () => {
      if (!interactive) {
        loadDataset();
        return;
      }

      state.external = {
        dataset: '',
        country: '',
        featureField: '',
        featureValue: '',
        year: ''
      };
      loadDataset();
    });

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

    rowsContainer.addEventListener('click', (event) => {
      const btn = event.target.closest('.doc-flag__btn');
      if (!btn) return;
      const flag = btn.closest('.doc-flag');
      const willOpen = !flag.classList.contains('is-open');
      closeFlags(flag);
      if (willOpen) positionBubble(flag);
      flag.classList.toggle('is-open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    // Hover and focus reveal the bubble in CSS; place it before it shows.
    ['mouseover', 'focusin'].forEach((type) => {
      rowsContainer.addEventListener(type, (event) => {
        const flag = event.target.closest('.doc-flag');
        if (flag) positionBubble(flag);
      });
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('.doc-flag')) return;
      closeFlags();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeFlags();
    });

    searchInput.addEventListener('input', applyFilters);
    loadBtn.addEventListener('click', () => {
      state.limit += 20;
      renderRows();
    });

    if (interactive) {
      window.addEventListener('documentation:filter', async (event) => {
        await applyExternalFilters(event.detail || {});
      });
      // Slider de años compartido (vega-scripts.html). Es independiente del
      // clic en los gráficos, así que solo toca yearMin/yearMax.
      window.addEventListener('documentation:years', (event) => {
        const d = event.detail || {};
        state.years.min = Number.isFinite(d.yearMin) ? d.yearMin : null;
        state.years.max = Number.isFinite(d.yearMax) ? d.yearMax : null;
        applyFilters();
      });
    }

    loadDataset();
  };

  roots.forEach((root) => initDocumentation(root));
})();
