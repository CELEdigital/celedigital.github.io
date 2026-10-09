/* Prohibiciones e incentivos / Bans and nudges.
 *
 * Renders static/data/bans_nudges.json into filterable cards. Every record in
 * that file carries both languages, so the language chosen by Hugo (data-bn-lang)
 * selects a side rather than triggering a second fetch.
 *
 * Companion to layouts/partials/bans-nudges.html. The chrome is server-rendered
 * and translated there; only the strings in data-bn-strings cross over.
 */
(() => {
  const roots = Array.from(document.querySelectorAll('[data-bans-nudges]'));
  if (!roots.length) return;

  const TONE_ORDER = ['live', 'contested', 'pending', 'gone'];
  const OFFICIAL_TIERS = ['statute', 'gazette', 'regulator', 'parliament'];

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* Accent- and case-insensitive, so "turkiye" finds "Türkiye". */
  const fold = (value) => (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const pick = (value, lang) => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return value[lang] || value.en || '';
  };

  const pickList = (value, lang) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    const side = value[lang] || value.en;
    return Array.isArray(side) ? side : [];
  };

  /* ------------------------------------------------------------------ */
  /* Treemap "squarified" (Bruls, Huizing & van Wijk 2000): acomoda los
     rectángulos en filas eligiendo, en cada paso, la que deja la peor relación
     de aspecto más cerca de 1. Sin esto los bloques salen como tiras. */

  const worstRatio = (row, sum, side) => {
    const max = Math.max(...row);
    const min = Math.min(...row);
    const s2 = sum * sum;
    const side2 = side * side;
    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  };

  /* items: [{ value, ... }] ordenados de mayor a menor. Devuelve el mismo
     item con su rectángulo, en coordenadas relativas a (x, y). */
  const squarify = (items, x, y, w, h) => {
    const out = [];
    const queue = items.slice();
    let rx = x; let ry = y; let rw = w; let rh = h;

    while (queue.length && rw > 0.5 && rh > 0.5) {
      const total = queue.reduce((sum, it) => sum + it.value, 0);
      if (total <= 0) break;
      const scale = (rw * rh) / total;
      const side = Math.min(rw, rh);

      const row = [];
      const areas = [];
      let rowSum = 0;
      let best = Infinity;

      while (queue.length) {
        const area = queue[0].value * scale;
        const nextSum = rowSum + area;
        const ratio = worstRatio(areas.concat([area]), nextSum, side);
        if (areas.length && ratio > best) break;
        areas.push(area);
        row.push(queue.shift());
        rowSum = nextSum;
        best = ratio;
      }

      const thickness = rowSum / side;
      let offset = 0;
      row.forEach((item, i) => {
        const len = areas[i] / thickness;
        out.push(rw >= rh
          ? { item, x: rx, y: ry + offset, w: thickness, h: len }
          : { item, x: rx + offset, y: ry, w: len, h: thickness });
        offset += len;
      });

      if (rw >= rh) { rx += thickness; rw -= thickness; }
      else { ry += thickness; rh -= thickness; }
    }

    /* Lo que quede por redondeo se mete en el último rectángulo antes que
       desaparecer sin decirlo. */
    queue.forEach((item) => out.push({ item, x: rx, y: ry, w: rw, h: rh }));
    return out;
  };

  const inset = (r, gap) => ({
    x: r.x + gap,
    y: r.y + gap,
    w: Math.max(0, r.w - gap * 2),
    h: Math.max(0, r.h - gap * 2),
  });

  const place = (node, r) => {
    node.style.left = `${r.x}px`;
    node.style.top = `${r.y}px`;
    node.style.width = `${r.w}px`;
    node.style.height = `${r.h}px`;
    return node;
  };

  /* ------------------------------------------------------------------ */

  const buildSource = (source, lang, strings, kindLabel) => {
    if (!source || !source.url) return null;
    const tier = source.kind || '';
    const node = el(source.url ? 'a' : 'div', 'bn-src');
    node.dataset.tier = tier;
    if (source.url) {
      node.href = source.url;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    }

    const tierText = pick(source.tierLabel, lang);
    node.appendChild(el('span', 'bn-src__tier',
      tierText ? `${kindLabel} · ${tierText}` : kindLabel));

    const label = source.label || source.title || source.outlet || source.url;
    node.appendChild(el('span', 'bn-src__label', label));

    /* An outlet plus a date is what makes a status claim checkable, so it is
       shown even when it duplicates part of the label. */
    const bits = [];
    if (source.outlet && source.outlet !== label) bits.push(source.outlet);
    if (source.title && source.title !== label) bits.push(source.title);
    if (source.date) bits.push(source.date);
    if (bits.length) node.appendChild(el('span', 'bn-src__note', bits.join(' · ')));

    return node;
  };

  const buildBody = (rec, lang, strings) => {
    const body = el('div', 'bn-card__body');
    body.hidden = true;

    /* --- what it covers ------------------------------------------- */
    const covers = el('section', 'bn-block');
    covers.appendChild(el('h4', null, strings.covers));

    const dl = el('dl', 'bn-def');
    const row = (label, value, flagUntranslated) => {
      if (!value) return;
      const dt = el('dt', null, label);
      if (flagUntranslated) dt.appendChild(el('span', 'bn-untranslated', strings.untranslated));
      dl.appendChild(dt);
      dl.appendChild(el('dd', null, value));
    };

    /* Scope taken verbatim from the US tracker is English-only; say so rather
       than let a Spanish reader assume it was translated. */
    const whoUntranslated = lang !== 'en' && rec.covered.whoTranslated === false;
    row(strings.who, pick(rec.covered.who, lang), whoUntranslated);
    row(strings.whom, pick(rec.covered.whom, lang), whoUntranslated);
    const exceptions = pickList(rec.covered.exceptions, lang);
    if (exceptions.length) row(strings.exceptions, exceptions.join(' · '), whoUntranslated);
    covers.appendChild(dl);

    const defSource = pick(rec.covered.defSource, lang);
    if (defSource) {
      const box = el('div', 'bn-src');
      box.dataset.tier = rec.covered.defTier || '';
      const tierText = pick(rec.covered.defTierLabel, lang);
      box.appendChild(el('span', 'bn-src__tier',
        tierText ? `${strings.defSource} · ${tierText}` : strings.defSource));
      box.appendChild(el('span', 'bn-src__label', defSource));
      covers.appendChild(box);
    }
    body.appendChild(covers);

    /* --- what it does --------------------------------------------- */
    const does = el('section', 'bn-block');
    does.appendChild(el('h4', null, strings.does));

    const mech = el('dl', 'bn-def');
    mech.appendChild(el('dt', null, strings.mechanism));
    mech.appendChild(el('dd', null,
      `${pick(rec.action.quadrant, lang)} — ${pick(rec.action.mechanism, lang)}`));
    does.appendChild(mech);

    const reqs = pickList(rec.action.requirements, lang);
    if (reqs.length) {
      const heading = el('dl', 'bn-def');
      const dt = el('dt', null, strings.requirements);
      if (lang !== 'en' && rec.action.requirementsTranslated === false) {
        dt.appendChild(el('span', 'bn-untranslated', strings.untranslated));
      }
      heading.appendChild(dt);
      does.appendChild(heading);
      const ul = el('ul', 'bn-reqs');
      reqs.forEach((r) => ul.appendChild(el('li', null, r)));
      does.appendChild(ul);
    }

    if (rec.action.ageVerification) {
      const av = el('dl', 'bn-def');
      av.appendChild(el('dt', null, strings.ageCheck));
      av.appendChild(el('dd', null, rec.action.ageVerification));
      does.appendChild(av);
    }

    const enf = el('dl', 'bn-def');
    const enfText = pick(rec.action.enforcementText, lang) || pick(rec.action.enforcer, lang);
    const enfDt = el('dt', null, strings.enforcement);
    if (lang !== 'en' && rec.action.enforcementTranslated === false) {
      enfDt.appendChild(el('span', 'bn-untranslated', strings.untranslated));
    }
    enf.replaceChildren(enfDt);
    enf.appendChild(el('dd', null, enfText));
    does.appendChild(enf);
    body.appendChild(does);

    /* --- where it stands ------------------------------------------ */
    const stands = el('section', 'bn-block bn-block--wide');
    stands.appendChild(el('h4', null, strings.stands));

    if (rec.status.correction) {
      const flag = el('div', 'bn-flag');
      flag.appendChild(el('strong', null, strings.correction));
      flag.appendChild(document.createTextNode(pick(rec.status.correction, lang)));
      stands.appendChild(flag);
    }

    const note = pick(rec.status.note, lang);
    if (note) stands.appendChild(el('p', 'bn-prose', note));

    if (rec.status.note2) {
      const extra = el('div', 'bn-flag');
      extra.appendChild(el('strong', null, strings.note));
      extra.appendChild(document.createTextNode(pick(rec.status.note2, lang)));
      stands.appendChild(extra);
    }

    if (rec.status.effective) {
      const eff = el('p', 'bn-prose');
      eff.appendChild(el('strong', null, `${strings.effective}: `));
      eff.appendChild(document.createTextNode(rec.status.effective));
      stands.appendChild(eff);
    }

    if (rec.status.history && rec.status.history.length) {
      const heading = el('dl', 'bn-def');
      heading.appendChild(el('dt', null, strings.history));
      stands.appendChild(heading);
      const ul = el('ul', 'bn-history');
      rec.status.history.forEach((h) => ul.appendChild(el('li', null, h)));
      stands.appendChild(ul);
    }
    body.appendChild(stands);

    /* --- sources --------------------------------------------------- */
    const sources = el('section', 'bn-block bn-block--wide');
    sources.appendChild(el('h4', null, strings.sources));

    const primary = buildSource(rec.status.primary, lang, strings, strings.primary);
    if (primary) sources.appendChild(primary);

    const reporting = buildSource(rec.status.reporting, lang, strings, strings.reporting);
    if (reporting) sources.appendChild(reporting);

    if (rec.trackerUrl) {
      const t = el('a', 'bn-src');
      t.dataset.tier = 'tracker';
      t.href = rec.trackerUrl;
      t.target = '_blank';
      t.rel = 'noopener noreferrer';
      t.appendChild(el('span', 'bn-src__tier', strings.tracker));
      t.appendChild(el('span', 'bn-src__label', rec.trackerUrl.replace(/^https?:\/\//, '')));
      sources.appendChild(t);
    }

    if (rec.citedFor) {
      const cited = el('p', 'bn-prose');
      cited.appendChild(el('strong', null, `${strings.citedFor}: `));
      cited.appendChild(document.createTextNode(rec.citedFor));
      sources.appendChild(cited);
    }
    body.appendChild(sources);

    return body;
  };

  const buildCard = (rec, lang, strings) => {
    const card = el('article', 'bn-card');
    card.dataset.tone = rec.status.tone;
    card.dataset.id = rec.id;

    const head = el('button', 'bn-card__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'false');

    const meta = el('div', 'bn-card__meta');
    meta.appendChild(el('span', 'bn-card__place', rec.jurisdiction));
    meta.appendChild(el('span', null, String(rec.year)));
    meta.appendChild(el('span', null, pick(rec.region, lang)));
    head.appendChild(meta);

    head.appendChild(el('h3', 'bn-card__name', rec.instrument));

    if (rec.officialTitle && rec.officialTitle !== rec.instrument) {
      head.appendChild(el('p', 'bn-card__official', rec.officialTitle));
    }

    const chips = el('div', 'bn-chips');
    const status = el('span', 'bn-chip bn-chip--status', pick(rec.status.label, lang));
    status.dataset.tone = rec.status.tone;
    chips.appendChild(status);
    chips.appendChild(el('span', 'bn-chip bn-chip--quadrant', pick(rec.action.quadrant, lang)));
    chips.appendChild(el('span', 'bn-chip', pick(rec.action.mechanism, lang)));
    head.appendChild(chips);

    card.appendChild(head);

    const body = buildBody(rec, lang, strings);
    const bodyId = `bn-body-${rec.id}`;
    body.id = bodyId;
    head.setAttribute('aria-controls', bodyId);
    card.appendChild(body);

    head.addEventListener('click', () => {
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      body.hidden = open;
    });

    return card;
  };

  /* ------------------------------------------------------------------ */

  const init = (root, payload) => {
    const lang = root.dataset.bnLang === 'en' ? 'en' : 'es';
    const stringsNode = root.parentNode.querySelector('[data-bn-strings]')
      || document.querySelector('[data-bn-strings]');
    const strings = stringsNode ? JSON.parse(stringsNode.textContent) : {};

    const records = payload.records;
    const vocab = payload.vocab;

    const listEl = root.querySelector('[data-bn-list]');
    const countEl = root.querySelector('[data-bn-count]');
    const stripEl = root.querySelector('[data-bn-strip]');
    const legendEl = root.querySelector('[data-bn-legend]');
    const searchEl = root.querySelector('[data-bn-search]');
    const resetEl = root.querySelector('[data-bn-reset]');
    const selects = Array.from(root.querySelectorAll('[data-bn-filter]'));

    /* --- populate the selects from the data, in the vocabulary order -- */
    const fillSelect = (name, entries) => {
      const select = selects.find((s) => s.dataset.bnFilter === name);
      if (!select) return;
      entries.forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });
    };

    const used = (fn) => new Set(records.map(fn));

    fillSelect('region', Object.entries(vocab.region)
      .filter(([k]) => used((r) => r.regionKey).has(k))
      .map(([k, v]) => [k, v[lang]]));

    fillSelect('quadrant', Object.entries(vocab.quadrant)
      .filter(([k]) => used((r) => r.action.quadrantKey).has(k))
      .map(([k, v]) => [k, v[lang]]));

    fillSelect('mechanism', Object.entries(vocab.mechanism)
      .filter(([k]) => used((r) => r.action.mechanismKey).has(k))
      .map(([k, v]) => [k, v[lang]]));

    fillSelect('status', Object.entries(vocab.state)
      .filter(([k]) => used((r) => r.status.key).has(k))
      .map(([k, v]) => [k, v[lang]]));

    /* --- search index ------------------------------------------------ */
    const haystack = new Map();
    records.forEach((r) => {
      haystack.set(r.id, fold([
        r.jurisdiction, r.instrument, r.officialTitle, r.citation, r.year,
        pick(r.region, lang), pick(r.action.quadrant, lang), pick(r.action.mechanism, lang),
        pick(r.status.label, lang), pick(r.status.note, lang),
        pick(r.covered.who, lang), pick(r.covered.whom, lang),
        pickList(r.action.requirements, lang).join(' '),
      ].join(' ')));
    });

    const cards = new Map();
    records.forEach((rec) => {
      const card = buildCard(rec, lang, strings);
      cards.set(rec.id, card);
      listEl.appendChild(card);
    });

    const empty = el('p', 'bn-empty', strings.empty);
    empty.hidden = true;
    listEl.appendChild(empty);

    /* --- treemap ------------------------------------------------------- */
    /* Dos lecturas de la misma selección, según «Agrupar por»:

       · por jurisdicción: regiones anidadas, una celda por instrumento y el
         color por estado. Es el mapa de dónde está cada norma.
       · por cualquier otra dimensión: un bloque por categoría y sin celdas.
         El área y el tono son la cantidad. Cuenta, no lista.

       Los filtros mandan en las dos: siempre se dibuja el array `visible`. */

    const GAP_REGION = 5;
    const GAP_JUR = 2;
    const GAP_CELL = 1;
    const GAP_BLOCK = 3;
    const BAND = 17;          /* franja con el nombre de la región */

    const mapEl = root.querySelector('[data-bn-treemap]');
    const titleEl = root.querySelector('[data-bn-map-title]');
    const hintEl = root.querySelector('[data-bn-map-hint]');
    const tip = el('div', 'bn-map__tip');
    tip.hidden = true;
    if (mapEl) mapEl.appendChild(tip);

    /* Cada dimensión dice cómo agrupar, cómo se llama la categoría y qué
       filtro aplica un clic. `tone` marca las que ya tienen color propio. */
    const DIMENSIONS = {
      jurisdiction: {
        key: (r) => r.jurisdiction,
        label: (r) => r.jurisdiction,
        nested: true,
      },
      region: {
        key: (r) => r.regionKey,
        label: (r) => pick(r.region, lang),
        filter: 'region',
      },
      quadrant: {
        key: (r) => r.action.quadrantKey,
        label: (r) => pick(r.action.quadrant, lang),
        filter: 'quadrant',
      },
      mechanism: {
        key: (r) => r.action.mechanismKey,
        label: (r) => pick(r.action.mechanism, lang),
        filter: 'mechanism',
      },
      status: {
        key: (r) => r.status.key,
        label: (r) => pick(r.status.label, lang),
        filter: 'status',
        tone: (r) => r.status.tone,
      },
      tier: {
        key: (r) => r.covered.defTier,
        label: (r) => pick(r.covered.defTierLabel, lang) || r.covered.defTier,
        filter: 'tier',
        /* El mapa muestra los cuatro tipos de fuente y el filtro tiene dos
           valores, así que el clic aplica el grupo al que pertenece. */
        filterValue: (key) => (OFFICIAL_TIERS.includes(key) ? 'official' : 'secondary'),
      },
    };

    let groupKey = 'jurisdiction';

    /* Rampa de las vistas agregadas, armada con la paleta del sitio: la crema
       del fondo (--base-bg), el amarillo CELE (--cele-yellow) y un ámbar
       quemado que lo cierra. Acá el color es la cantidad —más oscuro, más
       instrumentos—, no una categoría, y ningún paso se pisa con los cuatro
       colores de estado, que en estas vistas no significan nada.

       El amarillo va en 0,62 y no en el medio a propósito: repartido en partes
       iguales, la mitad de los bloques salían amarillo pleno y el mapa gritaba
       más que el resto de la página. Así la mayoría queda en arena y el
       amarillo aparece cuando la categoría ya pesa. */
    const RAMP = [
      { at: 0, rgb: [245, 243, 238] },      /* --base-bg */
      { at: 0.62, rgb: [253, 198, 67] },    /* --cele-yellow */
      { at: 1, rgb: [110, 58, 28] },        /* ámbar quemado */
    ];

    const rampColor = (t) => {
      const value = Math.max(0, Math.min(1, t));
      let i = 0;
      while (i < RAMP.length - 2 && value > RAMP[i + 1].at) i += 1;
      const from = RAMP[i];
      const to = RAMP[i + 1];
      const k = (value - from.at) / (to.at - from.at);
      return from.rgb.map((c, j) => Math.round(c + (to.rgb[j] - c) * k));
    };

    /* Luminancia relativa (sRGB) para decidir tinta o blanco encima del paso.
       El corte en 0,25 es el punto donde las dos opciones empatan: es el mejor
       piso de contraste que admite una rampa continua con dos colores de
       texto, y las etiquetas van en negrita y con halo. */
    const luminance = (rgb) => {
      const channel = (value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(rgb[0])
        + 0.7152 * channel(rgb[1])
        + 0.0722 * channel(rgb[2]);
    };

    /* Agrupa conservando el orden: más instrumentos primero, que es lo que el
       algoritmo squarified necesita para no dejar tiras. */
    const groupBy = (list, key) => {
      const map = new Map();
      list.forEach((rec) => {
        const k = key(rec);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(rec);
      });
      return Array.from(map.entries())
        .map(([k, items]) => ({ key: k, items, value: items.length }))
        .sort((a, b) => b.value - a.value || String(a.key).localeCompare(b.key));
    };

    const buildCell = (rec, rect) => {
      const cell = place(el('div', 'bn-tm__cell'), rect);
      cell.dataset.tone = rec.status.tone;
      cell.dataset.id = rec.id;
      return cell;
    };

    const buildLabel = (name, count, w, h) => {
      const label = el('div', 'bn-tm__label');
      if (h > w * 1.5 && w < 62) label.classList.add('bn-tm__label--rot');
      label.style.fontSize = `${Math.max(9, Math.min(15, Math.round(Math.min(w, h) / 4.2)))}px`;
      label.appendChild(el('b', null, name));
      if (count > 1) label.appendChild(el('i', null, String(count)));
      return label;
    };

    /* En las vistas agregadas el número es el dato, así que va siempre y en
       cuerpo mayor; el que se sacrifica cuando no entra es el nombre. */
    const buildGroupLabel = (name, count, w, h) => {
      const label = el('div', 'bn-tm__label bn-tm__label--group');
      label.style.fontSize = `${Math.max(9, Math.min(16, Math.round(Math.min(w, h) / 5)))}px`;
      label.appendChild(el('b', null, name));
      label.appendChild(el('i', null, String(count)));
      return label;
    };

    /* Medir es más barato que adivinar cuántos caracteres entran, y hay
       nombres de una sola palabra («Mississippi») que no se pueden partir:
       primero se cae la parte prescindible, después baja el cuerpo, y recién
       si el bloque es más alto que ancho se prueba en vertical. Devuelve
       false cuando no entra de ninguna manera y hay que sacar la etiqueta. */
    const fitLabel = (label, w, h, expendable) => {
      /* El nombre es un hijo flexible: se encoge hasta el ancho del bloque y
         su propio texto se desborda adentro, así que medir sólo la caja de
         afuera da un falso negativo («Mississippi» sin la última i). De los
         hijos se mira el ancho y no el alto: el alto de una línea redondea
         para arriba y daba desbordes falsos que borraban etiquetas enteras.
         El alto real de la pila ya lo controla la caja de afuera. */
      const over = () => label.scrollWidth > label.clientWidth + 1
        || label.scrollHeight > label.clientHeight + 1
        || Array.from(label.children).some((child) =>
          child.scrollWidth > child.clientWidth + 1);
      if (!over()) return true;

      const size0 = parseFloat(label.style.fontSize);
      const shrink = () => {
        let size = parseFloat(label.style.fontSize);
        while (over() && size > 9) {
          size -= 1;
          label.style.fontSize = `${size}px`;
        }
      };

      /* Primero achicar, y sólo si aun así no entra sacar la parte
         prescindible: perder el nombre o el total es peor que dos puntos
         menos de cuerpo. */
      shrink();
      if (!over()) return true;

      const spare = expendable || label.querySelector('i');
      if (spare && spare.parentNode) {
        label.style.fontSize = `${size0}px`;
        spare.remove();
        if (!over()) return true;
        shrink();
        if (!over()) return true;
      }

      /* Rotar una pila de nombre + número no se lee: sólo las de una línea. */
      if (h > w && !label.classList.contains('bn-tm__label--rot')
        && !label.classList.contains('bn-tm__label--group')) {
        label.classList.add('bn-tm__label--rot');
        label.style.fontSize = `${Math.min(15, Math.round(Math.min(w, h) / 4.2))}px`;
        shrink();
      }
      return !over();
    };

    const tryLabel = (parent, label, rect, expendable) => {
      place(label, rect);
      parent.appendChild(label);
      if (fitLabel(label, rect.w, rect.h, expendable)) return label;
      label.remove();
      return null;
    };

    let lastVisible = records;

    /* Vista anidada: región → jurisdicción → instrumento. */
    const renderNested = (visible, W, H) => {
      const regions = groupBy(visible, (r) => r.regionKey);

      squarify(regions, 0, 0, W, H).forEach((slot) => {
        const rect = inset(slot, GAP_REGION / 2);
        if (rect.w < 2 || rect.h < 2) return;

        const group = place(el('div', 'bn-tm__region'), rect);
        mapEl.appendChild(group);

        /* La franja con el nombre sólo entra si el grupo es grande; si no, la
           región se lee en el tooltip. */
        const band = (rect.h >= 64 && rect.w >= 64) ? BAND : 0;
        if (band) {
          const name = pick(slot.item.items[0].region, lang);
          group.appendChild(el('span', 'bn-tm__region-name', name));
        }

        const jurisdictions = groupBy(slot.item.items, (r) => r.jurisdiction);
        squarify(jurisdictions, 0, band, rect.w, rect.h - band).forEach((jslot) => {
          const jrect = inset(jslot, GAP_JUR / 2);
          if (jrect.w < 1 || jrect.h < 1) return;

          const block = place(el('div', 'bn-tm__jur'), jrect);
          group.appendChild(block);

          /* Dentro del bloque las celdas se reparten en partes iguales sobre
             el lado más largo: cada una es un instrumento. */
          const items = jslot.item.items.slice().sort((a, b) =>
            TONE_ORDER.indexOf(a.status.tone) - TONE_ORDER.indexOf(b.status.tone)
            || a.year - b.year);
          const n = items.length;
          const along = jrect.w >= jrect.h ? 'w' : 'h';
          const step = jrect[along] / n;

          const cellRects = items.map((rec, i) => {
            const raw = along === 'w'
              ? { x: i * step, y: 0, w: step, h: jrect.h }
              : { x: 0, y: i * step, w: jrect.w, h: step };
            const cellRect = n > 1 ? inset(raw, GAP_CELL / 2) : raw;
            block.appendChild(buildCell(rec, cellRect));
            return cellRect;
          });

          /* La etiqueta se ancla en la celda más grande y no en el centro:
             centrada sobre dos celdas, el hueco que las separa cruza el texto
             y parece tachado. */
          const first = cellRects[0];
          const whole = { x: 0, y: 0, w: jrect.w, h: jrect.h };
          const placed = n > 1 && tryLabel(block,
            buildLabel(jslot.item.key, n, first.w, first.h), first);
          if (!placed) {
            tryLabel(block, buildLabel(jslot.item.key, n, jrect.w, jrect.h), whole);
          }
        });
      });
    };

    /* Vista agregada: un bloque por categoría, con su total. */
    const renderGrouped = (visible, W, H) => {
      const dim = DIMENSIONS[groupKey];
      const cats = groupBy(visible, dim.key);
      const max = cats[0].value;

      squarify(cats, 0, 0, W, H).forEach((slot) => {
        const rect = inset(slot, GAP_BLOCK / 2);
        if (rect.w < 2 || rect.h < 2) return;

        const sample = slot.item.items[0];
        const name = dim.label(sample);
        const block = place(el('div', 'bn-tm__block'), rect);
        block.dataset.cat = slot.item.key;
        block.dataset.name = name;
        block.dataset.count = String(slot.item.value);

        if (dim.tone) {
          block.dataset.tone = dim.tone(sample);
        } else {
          const rgb = rampColor(0.12 + 0.88 * (slot.item.value / max));
          block.style.background = `rgb(${rgb.join(', ')})`;
          if (luminance(rgb) >= 0.25) block.classList.add('bn-tm__block--light');
        }
        mapEl.appendChild(block);

        const label = buildGroupLabel(name, slot.item.value, rect.w, rect.h);
        tryLabel(block, label, { x: 0, y: 0, w: rect.w, h: rect.h },
          label.querySelector('b'));
      });
    };

    const renderTreemap = (visible) => {
      if (!mapEl) return;
      lastVisible = visible;

      tip.hidden = true;      /* lo que se estaba mirando ya no existe */
      const W = mapEl.clientWidth;
      const H = mapEl.clientHeight;
      Array.from(mapEl.children).forEach((n) => { if (n !== tip) n.remove(); });
      if (!W || !H) return;

      if (!visible.length) {
        mapEl.appendChild(el('p', 'bn-map__empty', strings.empty));
        return;
      }

      if (DIMENSIONS[groupKey].nested) renderNested(visible, W, H);
      else renderGrouped(visible, W, H);
    };

    /* --- control «Agrupar por» ------------------------------------------ */

    const groupButtons = Array.from(root.querySelectorAll('[data-bn-group]'));

    const setGroup = (key, quiet) => {
      if (!DIMENSIONS[key]) return;
      groupKey = key;
      groupButtons.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.bnGroup === key));
      });
      const active = groupButtons.find((btn) => btn.dataset.bnGroup === key);
      if (titleEl && active && strings.mapTitle) {
        titleEl.textContent = strings.mapTitle
          .replace('{dim}', active.textContent.toLocaleLowerCase(lang));
      }
      if (hintEl) {
        hintEl.textContent = DIMENSIONS[key].nested
          ? strings.mapHintItems : strings.mapHintGroups;
      }
      if (!quiet) renderTreemap(lastVisible);
    };

    groupButtons.forEach((btn) => {
      btn.addEventListener('click', () => setGroup(btn.dataset.bnGroup));
    });
    setGroup(groupKey, true);

    /* --- tooltip y clic ------------------------------------------------- */

    const byId = new Map(records.map((r) => [r.id, r]));

    const positionTip = (event) => {
      const box = mapEl.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      tip.style.left = `${Math.min(Math.max(0, x + 14), Math.max(0, box.width - tip.offsetWidth))}px`;
      tip.style.top = `${Math.max(0, y - tip.offsetHeight - 12)}px`;
    };

    const showCellTip = (cell, event) => {
      const rec = byId.get(cell.dataset.id);
      if (!rec) return;
      tip.replaceChildren();
      tip.appendChild(el('b', null, `${rec.jurisdiction} · ${rec.year}`));
      tip.appendChild(el('span', null, rec.instrument));
      const state = el('span', 'bn-map__tip-state', pick(rec.status.label, lang));
      state.dataset.tone = rec.status.tone;
      tip.appendChild(state);
      tip.hidden = false;
      positionTip(event);
    };

    const showBlockTip = (block, event) => {
      const count = Number(block.dataset.count);
      const noun = count === 1 ? (strings.showingOne || strings.showing) : strings.showing;
      const share = lastVisible.length
        ? Math.round((count / lastVisible.length) * 100) : 0;
      tip.replaceChildren();
      tip.appendChild(el('b', null, block.dataset.name));
      tip.appendChild(el('span', null, `${count} ${noun} · ${share}%`));
      tip.hidden = false;
      positionTip(event);
    };

    /* Un clic sobre una categoría la aplica como filtro, y sobre la misma otra
       vez lo saca: el mapa es también la manera de filtrar. */
    const toggleFilter = (dim, key) => {
      const select = selects.find((s) => s.dataset.bnFilter === dim.filter);
      if (!select) return;
      const value = dim.filterValue ? dim.filterValue(key) : key;
      select.value = select.value === value ? '' : value;
      select.dispatchEvent(new Event('change'));
    };

    if (mapEl) {
      mapEl.addEventListener('mousemove', (event) => {
        const block = event.target.closest('.bn-tm__block');
        if (block) { showBlockTip(block, event); return; }
        const cell = event.target.closest('.bn-tm__cell');
        if (cell) showCellTip(cell, event);
        else tip.hidden = true;
      });
      mapEl.addEventListener('mouseleave', () => { tip.hidden = true; });

      mapEl.addEventListener('click', (event) => {
        const block = event.target.closest('.bn-tm__block');
        if (block) {
          toggleFilter(DIMENSIONS[groupKey], block.dataset.cat);
          return;
        }
        /* En la vista anidada cada celda es una norma, así que el clic lleva a
           su ficha: el mapa dice cuánto hay, la ficha dice qué es. */
        const cell = event.target.closest('.bn-tm__cell');
        if (!cell) return;
        const card = cards.get(cell.dataset.id);
        if (!card || card.hidden) return;
        const head = card.querySelector('.bn-card__head');
        if (head && head.getAttribute('aria-expanded') !== 'true') head.click();
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        card.classList.remove('bn-card--flash');
        void card.offsetWidth;
        card.classList.add('bn-card--flash');
      });

      /* El reparto depende del ancho, así que hay que rehacerlo al cambiar de
         tamaño; en un frame, para no recalcular en cada píxel del arrastre. */
      if (window.ResizeObserver) {
        let frame = null;
        let width = 0;
        let height = 0;
        new ResizeObserver(() => {
          if (mapEl.clientWidth === width && mapEl.clientHeight === height) return;
          width = mapEl.clientWidth;
          height = mapEl.clientHeight;
          window.cancelAnimationFrame(frame);
          frame = window.requestAnimationFrame(() => renderTreemap(lastVisible));
        }).observe(mapEl);
      }
    }

    /* --- filtering ---------------------------------------------------- */
    const state = { region: '', quadrant: '', mechanism: '', status: '', tier: '', q: '' };

    const matches = (rec) => {
      if (state.region && rec.regionKey !== state.region) return false;
      if (state.quadrant && rec.action.quadrantKey !== state.quadrant) return false;
      if (state.mechanism && rec.action.mechanismKey !== state.mechanism) return false;
      if (state.status && rec.status.key !== state.status) return false;
      if (state.tier) {
        const official = OFFICIAL_TIERS.includes(rec.covered.defTier);
        if (state.tier === 'official' && !official) return false;
        if (state.tier === 'secondary' && official) return false;
      }
      if (state.q && !haystack.get(rec.id).includes(state.q)) return false;
      return true;
    };

    const render = () => {
      const visible = [];
      records.forEach((rec) => {
        const ok = matches(rec);
        cards.get(rec.id).hidden = !ok;
        if (ok) visible.push(rec);
      });

      renderTreemap(visible);

      countEl.innerHTML = '';
      countEl.appendChild(el('b', null, String(visible.length)));
      const noun = visible.length === 1 ? (strings.showingOne || strings.showing) : strings.showing;
      countEl.appendChild(document.createTextNode(
        ` ${noun} ${strings.of} ${records.length}`));

      empty.hidden = visible.length !== 0;

      /* Distribution strip: proportion of the current selection by status
         tone. It moves as filters change, which is the point of showing it. */
      const counts = {};
      visible.forEach((r) => { counts[r.status.tone] = (counts[r.status.tone] || 0) + 1; });

      stripEl.innerHTML = '';
      legendEl.innerHTML = '';
      TONE_ORDER.forEach((tone) => {
        const n = counts[tone] || 0;
        if (!n) return;
        const seg = el('div', 'bn-strip__seg');
        seg.dataset.tone = tone;
        seg.style.flexGrow = String(n);
        seg.style.flexBasis = '0';
        stripEl.appendChild(seg);

        const label = (vocab.tone[tone] && vocab.tone[tone][lang]) || tone;
        const li = el('li');
        li.dataset.tone = tone;
        li.appendChild(el('i'));
        li.appendChild(document.createTextNode(`${label} · ${n}`));
        legendEl.appendChild(li);
      });
    };

    selects.forEach((select) => {
      select.addEventListener('change', () => {
        state[select.dataset.bnFilter] = select.value;
        render();
      });
    });

    let timer = null;
    searchEl.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        state.q = fold(searchEl.value.trim());
        render();
      }, 120);
    });

    resetEl.addEventListener('click', () => {
      Object.keys(state).forEach((k) => { state[k] = ''; });
      selects.forEach((s) => { s.value = ''; });
      searchEl.value = '';
      render();
    });

    const provenance = root.querySelector('[data-bn-provenance]');
    if (provenance && strings.provenance) {
      provenance.textContent = strings.provenance
        .replace('{count}', payload.meta.count)
        .replace('{built}', payload.meta.built)
        .replace('{tracker}', payload.meta.sources.usScope);
    }

    render();
  };

  roots.forEach((root) => {
    fetch(root.dataset.bnUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((payload) => init(root, payload))
      .catch((err) => {
        const list = root.querySelector('[data-bn-list]');
        if (list) list.appendChild(el('p', 'bn-empty', String(err)));
      });
  });
})();
