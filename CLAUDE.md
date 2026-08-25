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
Las tres columnas de objetivo legítimo de `proyectos_clean.csv` y `leyes_clean.csv` quedaron con una categoría de `objetivos-legitimos.md` por celda. De 92 valores crudos se pasó a **19 categorías**.

- Lo hace el paso 2 de `actualizar_observatorio.py` (taxonomía en `TAXONOMIA`, variantes en `ALIAS`).
- Decisión tomada con el usuario: `Seguridad nacional` y `Derechos de los niños` son **categorías propias**, no términos de Ciberseguridad, aunque el .md los liste ahí. Ciberseguridad queda solo con `Delitos informáticos` y `Seguridad digital`.
- Quedaron 9 valores sin lugar en la taxonomía, que se dejan tal cual y se reportan en cada corrida: `Libertad de trabajo`, `Dignidad`, `Desapariciones forzadas`, `Derecho a la verdad`, `Educación`, `Gasto estatal`, `COVID-20`, `Vida`.
- La escritura del CSV es round-trip byte a byte (CRLF, comillas mínimas, sin BOM), así que el diff solo toca las celdas de objetivo.

### 6. Actualización mensual: `scripts/actualizar_observatorio.py`
**Un solo comando** hace todo el circuito planilla → CSV → JSON de gráficos:

```
python3 scripts/actualizar_observatorio.py
```

Pasos, en orden (los tres tienen que correr juntos, ver el acoplamiento en la sección 7):

1. **Descarga** las planillas de Google como CSV a `static/data/`.
2. **Normaliza** la columna «Objetivo legítimo» de los CSV según la taxonomía de `objetivos-legitimos.md`.
3. **Genera** `observatorio_database.json`, los datos embebidos de `objetivos_drilldown.json`, el rango de años de `observatorio_drilldown.json` y `ai_database.json`.

Opciones: `--sin-descarga` (usa los CSV de disco), `--solo-descarga`, `--dry-run`, `--todos-objetivos`.

**Falta configurar la descarga.** El diccionario `GOOGLE_SHEETS` arriba del script está vacío; hasta que se complete con los ids y gids, el paso 1 avisa y sigue con los CSV que ya están en disco. Son dos planillas: una con proyectos y leyes, otra con las normas de IA. Tienen que ser visibles con el link, porque el endpoint gviz no manda credenciales. Antes de pisar un CSV el script compara encabezados y cantidad de filas contra el archivo actual y avisa si algo se cayó (pestaña equivocada, filtro puesto en la planilla).

Detalles que importan:
- El filtro de años estaba clavado en `max: 2025`; con datos de 2026 las 411 filas nuevas quedaban invisibles. El script ajusta `yearMin`/`yearMax` al rango real.
- Las filas sin año se emiten **sin la clave `anio`**. Si se emite `null`, `vega-scripts.html` hace `Number(null) === 0` y el panel muestra «Rango temporal: 0 - 2026».
- Normaliza las cuatro capas del sunburst. `objetivo` usa la taxonomía; `impacto`/`estado`/`tipo` solo colapsan variantes de mayúsculas y acentos quedándose con la grafía más frecuente.
- Por defecto `objetivos_drilldown` cuenta **solo el objetivo primario**, como el snapshot original. Con `--todos-objetivos` cuenta las tres columnas (4986 filas en vez de 2721). Ojo: con el default `Desinformación` no aparece nunca, porque solo figura como objetivo secundario.
- El mapeo `ai_clean.csv` → `ai_database.json` está en `CAMPOS_IA` (se reconstruyó a partir del archivo anterior; `dataset` sale de la columna `Tipo`, `tipo` sale de `Origen`).
- Es idempotente. Reemplaza a `normalize_objetivos.py` y `regenerate_charts.py`, que se borraron.

Pendiente de limpiar en la planilla (el script lo reporta al correr): `impacto` tiene valores que no son Limita/Promueve (`SI`, `NO`, `**`, y una frase larga), y `tipo` tiene 59 valores distintos.

### 8. Slider de años compartido
Un único control arriba de Visualizaciones filtra por año **los cinco gráficos y las dos tablas** a la vez. Antes cada explorador traía su propio par de sliders y solo se filtraba a sí mismo.

Piezas:
- **`observatory-hub.html`** pinta el control (`.year-range`): **una sola pista con dos pulgares**, Desde a la izquierda y Hasta a la derecha, más los botones Aplicar y Ver todo. Los límites salen de `meta.json`, que escribe el script.
- **`vega-scripts.html`** guarda todas las vistas en `vistas[]` y empuja `yearMin`/`yearMax` a las que las tengan, más un evento `documentation:years` para las tablas.
- **Los specs**: los sunburst (Vega crudo) llevan dos señales y un dataset `filtrado` intercalado entre `source` y los tres agregados; `objetivos_drilldown` lleva params + un filtro y su data embebida ahora incluye `anio`; a los dos drilldown se les sacó el `bind` para que no dibujen sus sliders viejos.
- **`documentation.js` / `documentation-ai.js`** escuchan `documentation:years`.

**Los sliders no aplican solos: hace falta apretar Aplicar.** Mientras hay cambios pendientes el control toma la clase `year-range--pendiente` y el estado dice «Sin aplicar: X–Y». Dos razones: con 150 años de rango, recalcular en cada paso del arrastre trababa los cinco gráficos, y así se puede fijar Desde y Hasta antes de que se recalcule nada.

**El doble pulgar, y por qué esta vez sí.** El primer intento superponía los dos `<input type=range>` nativos sobre la misma pista. Con el rango 1874–2026 en ~840px un año son ~5px: los dos pulgares (16px) se pisaban en el extremo derecho y era imposible agarrar el que uno quería. Parecía que el gráfico no respondía, pero el slider nunca cambiaba de valor. **Esa idea sigue prohibida**: dos `<input type=range>` superpuestos no sirven, porque el que decide cuál agarrás es el hit-testing del navegador y ahí gana el z-order.

La versión actual (`initYearRangeSlider` en `observatory-hub.js`) no usa inputs superpuestos: los pulgares son divs con `role="slider"` y quien elige cuál responde es `elegirPulgar()`:
- fuera del rango no hay ambigüedad (a la izquierda de Desde mueve Desde, a la derecha de Hasta mueve Hasta);
- adentro gana el más cercano;
- **si los dos valores coinciden devuelve `null`** y la decisión se difiere hasta el primer movimiento del arrastre: para la izquierda es Desde, para la derecha es Hasta. Esto es lo que arregla el caso que mató a la versión vieja — con los dos pulgares apilados en 2026, arrastrar hacia la izquierda vuelve a abrir el rango. Verificado con arrastres reales del mouse.

Los dos `<input type=range>` **siguen existiendo, ocultos** (`.year-range__native`, `tabindex="-1"`, `aria-hidden`): son el contrato con `conectarSliderDeAnios()` en `vega-scripts.html`, que lee `.min`/`.max`/`.value` y escucha `input`. El control custom los escribe y emite `input`; el resto de la cadena no cambió. Por eso también hubo que agregar el `dispatchEvent("input")` en el handler de **Ver todo**: escribía `.value` a mano y los pulgares se quedaban donde estaban.

Teclado en cada pulgar: flechas ±1, PageUp/PageDown ±10, Home/End a los extremos. El `RADIO = 9` del JS tiene que seguir igual al margen negativo del pulgar en el CSS, o los extremos quedan corridos.

Tres cosas que costaron y conviene no re-romper:
1. El panel del sunburst leía `view.data("source")` (sin filtrar). Ahora lee `"filtrado"`.
2. Ese panel **no puede repintarse desde `addSignalListener`**: cuando el listener corre, el dataflow todavía no recalculó los datasets derivados y el panel queda un paso atrás. Se repinta desde `view.__repintarPanel()` después de que resuelve `runAsync()`.
3. El rango vive en `state.years`, **fuera de `state.external`**: `applyExternalFilters` reconstruye ese objeto entero en cada clic sobre un gráfico y se llevaba puesto el rango.

El script del punto 6 solo toca el `value` inicial de esas señales y la data embebida, así que volver a correrlo no deshace nada de esto (verificado: los specs quedan byte a byte iguales).

**Las dos tarjetas de totales también siguen el slider.** Antes eran un número fijo que Hugo calculaba contando filas del CSV. Ahora:
- `observatory-hub.html` calcula además un histograma año→cantidad por dataset (los cuatro: proyectos y leyes de LDE, proyectos y leyes de IA) con `partial "observatory-year-counts.html"`, y lo emite en `data-counts` junto con `data-total`.
- `observatory-hub.js` (`initYearCountCards`) escucha el mismo evento `documentation:years` que las tablas y resuelve el número sumando los baldes del rango.
- **Las filas sin año se suman siempre**, no solo con el filtro abierto. Es lo que hacen el sunburst (`!isValid(datum.anio)`) y la tabla (`Number.isFinite`); si se descartaran, la tarjeta diría menos que las filas listadas abajo. Son 3 filas en `proyectos_clean.csv`, 0 en el resto.
- El histograma sale de un regex y no de partir la línea por comas, porque el año está en la columna 1 en proyectos/leyes y en la 3 en IA. El patrón saltea los campos previos tolerando comillas. Verificado contra el módulo `csv` de Python: los cuatro histogramas dan exacto.
- No se dispara nada al cargar la página: hasta que no se aprieta Aplicar, las tarjetas muestran el total que pintó Hugo.

Al probar el slider desde la consola, ojo con el clamp de `leer()`: si se sube `Desde` por encima de `Hasta` sin foco en el input, la función lo revierte y el rango que se aplica no es el que uno cree. Mover primero `Hasta`.

### 7. De dónde saca los datos cada visualización
Auditado. Todo lo que está publicado sale de los CSV:

| Visualización | Fuente |
|---|---|
| Tarjetas de totales del hub | `readFile` de Hugo sobre los CSV |
| `observatorio_sunburst` + `observatorio_drilldown` | `observatorio_database.json` (generado) |
| `objetivos_drilldown` | datos embebidos en el propio spec (generados) |
| Tabla `documentation` | `fetch` de los CSV en runtime |
| `ia_sunburst` + `ia_drilldown` | `ai_database.json` (en sync con `ai_clean.csv`) |
| Tabla `documentation-ai` | `fetch` de `ai_clean.csv` |
| `observatorio-mes` (boletines) | `readFile` de Hugo sobre los CSV |

**Acoplamiento no obvio:** `documentation.js` filtra la tabla comparando el valor que emite el gráfico contra la columna del CSV. Es una comparación de strings, así que gráfico y CSV tienen que coincidir. Se agregó `fold()` en `documentation.js` (sin mayúsculas ni acentos) para que aguante el colapso de grafías que hace `regenerate_charts.py`; sin eso, clic en «Proyecto de ley» devolvía 971 filas cuando el gráfico decía 1573. `fold()` también mapea «Sin dato» a la celda vacía. Lo que `fold()` **no** salva es la falta de normalización de la taxonomía: por eso el normalizador de CSV no es opcional.

**Archivos muertos: borrados.** Se eliminaron `country_year_explorer.json`, `observatorio_sunburst_hierarchy.json` y los 13 `.svg` de `static/charts/`: ninguna página los referenciaba y traían el snapshot viejo. Están en el historial de git si hacen falta. Quedan solo los 7 archivos vivos de `static/charts/interactive/`.

El shortcode `chart` (`layouts/shortcodes/chart.html`) sigue existiendo pero ya no lo usa ninguna página y no queda ningún SVG. Si nunca se vuelve a usar, se puede borrar también.

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
- [ ] Limpiar en los CSV los valores de `¿Limita o promueve el discurso?` que no son Limita/Promueve (`SI`, `NO`, `**`).
- [ ] Decidir si `objetivos_drilldown` debería contar los objetivos secundarios (`--all-objetivos`).
