# CELEdigital — Memoria de trabajo para Claude

## El proyecto
Sitio web estático en Hugo con soporte multilingüe (ES/EN). Contenidos en `content/es/` y `content/en/`. Layouts en `layouts/`. CSS en `assets/css/components/`. JS en `static/data/`.

## Referencia principal
Leer siempre **`notas_sitio_web_cele.md`** antes de tocar front matter de posts. Documenta el sistema de `placements`, hubs, bloques, temas/topics e `issues`.

---

## Lo que ya está hecho

### 1. Placements de temas en posts ES
- Todos los posts en `content/es/posts/` (≈174) tienen entradas `placements` con `hub: temas/SLUG`.
- Formato correcto: `hub: temas/libertad-de-expresion` (con prefijo `temas/`, sin él el partial no lo reconoce).
- El único archivo con indentación 2-espacios en placements es `community-in-the-digital-realm.md` — ya está corregido.

### 2. content_type: mesa
Los siguientes 25 posts tienen `content_type: [mesa]` (cambiado desde `[blog]`):
- take-it-down-act, abril-const-art-19, brito-cruz, caso-sin-vs-facebook, casos-netchoice-y-murthy-ante-la-corte-suprema-eeuu, codigo-buenas-practicas, content-moderation-policies, gobernanza-de-las-plataformas-digitales-de-la-unesco, ley-de-seguridad-en-linea-del-reino-unido, ley-de-uso-indebido-de-computadoras-y-ciberdelitos, ley-libertad-de-prensa-de-la-union-europea, ley-seguridad-sri-lanka, leyes-de-california-y-texas-sobre-redes-sociales, leyes-tecnologicas-de-bangladesh-y-espacio-digital, marco-regulatorio-electoral-de-brasil, marcos-regulatorios-de-la-inteligencia-artificial, marzo-daphne-keller, proyecto-de-ley-de-violencia-de-genero-en-la-vida-politica-en-colombia, proyecto-de-ley-noticias-falsas-brasil, proyecto-de-ley-prohibicion-de-escritos-con-contenido-religioso, proyecto-de-ley-publicidad-politica-union-europea, proyecto-de-ley-servicios-digitales-y-comercio-electronico-costa-rica, proyecto-ley-de-danos-en-linea, resumen-de-las-mesas-legislativas-del-cele-2023, transparencia-en-eeuu-y-en-la-union-europea

### 3. Sección "Mesas" en Observatorio Legislativo
Se añadió un panel "Mesas" al observatorio. Archivos modificados:

**`layouts/partials/observatory-hub.html`**
- Descubre posts con `content_type: mesa` iterando `.Site.RegularPages` (no `.RegularPages`, porque los posts están en `content/es/posts/`, no en la sección del observatorio).
- Los ordena por fecha descendente (más nuevo primero).
- Añade un link "Mesas" en la barra `observatory-links` con el mismo toggle que Boletines.
- Añade un panel `observatory-mesas-panel` con lista + botón "cargar más", idéntico al de Boletines.

**`static/data/observatory-hub.js`**
- La función `buildInlineColumns` envuelve los paneles en un grid de 2 columnas, lo que restringiría el ancho. Boletines ya tenía una excepción (línea 4). Se añadió la misma excepción para `--mesas` (línea 5) para que el panel use ancho completo.


### 4. Sección "Objetivos legítimos" en Observatorio Legislativo
Panel inline nuevo, con el mismo patrón que Metodología/Objetivos (link con `data-observatory-inline-toggle` + `<section class="observatory-inline-panel">` que inyecta el `.Content` de una subpágina).

**`content/es/observatorio-legislativo/objetivos-legitimos.md`**
- Taxonomía de objetivos legítimos: cada categoría es un `# H1`, sus términos una lista.
- Los `# H1` importan: el JS del hub (`buildInlineColumns`) parte el panel en bloques usando H1/H2, así que cambiar el nivel de encabezado rompe la grilla.

**`layouts/partials/observatory-hub.html`** — link + panel (`observatory-inline-panel--objetivos-legitimos`).
**`layouts/_default/single.html`** — `objetivos-legitimos` / `legitimate-aims` añadidos a `$isObservatorySubpage` para que la página suelta use `hub-single.html`.
**`layouts/partials/hub-single.html`** — ahora emite `hub-single--{{ .BaseFileName }}` para poder estilar páginas sueltas concretas.
**`assets/css/components/observatory-hub.css`** — 3 columnas + términos como chips, tanto en el panel del hub (grid del JS) como en la página suelta (columnas CSS, porque ahí no corre el JS).

Falta la versión EN (`content/en/observatorio-legislativo/legitimate-aims.md`): el link y el panel están guardados con `{{ if $objetivosLegitimosPage }}`, así que en EN simplemente no aparecen hasta que exista el archivo.


### 5. Columna «Objetivo legítimo» normalizada en los CSV
`scripts/normalize_objetivos.py` reescribe las tres columnas de objetivo legítimo de `proyectos_clean.csv` y `leyes_clean.csv` para que cada celda sea una categoría de `objetivos-legitimos.md`. Es idempotente y tiene `--dry-run`.

- De 92 valores crudos se pasó a **19 categorías** (+9 valores sin mapear que se dejaron tal cual: `Libertad de trabajo`, `Dignidad`, `Desapariciones forzadas`, `Derecho a la verdad`, `Educación`, `Gasto estatal`, `COVID-20`, `Vida`).
- Decisión tomada con el usuario: `Seguridad nacional` y `Derechos de los niños` son **categorías propias**, no términos de Ciberseguridad, aunque el .md los liste ahí. Ciberseguridad queda solo con `Delitos informáticos` y `Seguridad digital`.
- El script hace round-trip byte-idéntico (CRLF, `QUOTE_MINIMAL`, sin BOM), así que el diff solo toca las celdas de objetivo.
- Si se agregan filas nuevas al CSV, volver a correrlo; los valores que no mapeen se reportan al final en vez de inventarles categoría.

**Ojo — los gráficos no leen estos CSV.** `observatorio_sunburst.json` y `observatorio_drilldown.json` cargan `static/charts/interactive/observatorio_database.json` (2163 filas, campo `objetivo`), y `objetivos_drilldown.json` trae los datos embebidos. Los CSV tienen 2746 filas, o sea que ese JSON es un snapshot viejo y **no hay script en el repo que lo genere**. Normalizar los CSV no cambia las visualizaciones.

---

## Convenciones importantes

| Cosa | Regla |
|------|-------|
| Hub de temas | Siempre `hub: temas/SLUG` — con prefijo `temas/` |
| Bloques disponibles | `destacado`, `ultimas_noticias_analisis`, `publicaciones`, `eventos` |
| `issues` | Etiquetas temáticas para filtros: `Erosión democrática`, `Plataformas`, `Regulación y tecnología`, `Violencias`. (El antiguo `Empresas y DDHH` se subsumió en `Plataformas`; su tema `temas/empresas-y-derechos-humanos` redirige a `temas/plataformas` vía alias.) |
| `content_type` | Campo de formato del post. Valores usados: `blog`, `mesa`, `boletin` |
| JS del observatorio | Está en `static/data/observatory-hub.js` (no en `assets/`) |
| CSS del observatorio | `assets/css/components/observatory-hub.css` |

---

## Tareas pendientes
_(actualizar a medida que se completen)_

- [ ] Verificar visualmente que el panel Mesas funciona bien en el build de Hugo.
- [ ] Decidir si agregar las mismas mesas al equivalente EN (`content/en/`).
- [ ] Traducir "Objetivos legítimos" al EN (`content/en/observatorio-legislativo/legitimate-aims.md`).
- [ ] Decidir dónde van los 9 valores de objetivo legítimo sin mapear (ver sección 5).
- [ ] Regenerar `observatorio_database.json` / `objetivos_drilldown.json` desde los CSV si se quiere que los gráficos reflejen la normalización (hoy son snapshots desacoplados y no hay generador).
