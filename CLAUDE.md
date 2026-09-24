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

### 9. Boletines: el editorial va en el cuerpo, los bullets van como datos
Un boletín es **un solo `.md`** en `content/es/observatorio-legislativo/`. La
cronología país por país vive en el front matter (`paises` → `entradas`), no en
el cuerpo, porque cada bullet es siempre el mismo registro: fecha, tipo,
expediente, link, texto y hasta 3 etiquetas. Como texto suelto las etiquetas no
se pueden filtrar ni traducir y las fechas se tipean a mano.

**El detalle completo está en la sección 10 de `notas_sitio_web_cele.md`.** Lo
que conviene tener presente acá:

- `{{< boletin-paises >}}` **no lleva parámetros**: lee `.Page.Params.paises` de
  su propia página. Por eso no hubo que tocar `single.html` — importa, porque
  ese layout lo usan ~700 páginas.
- El cálculo está en `partials/func/boletin-entradas.html`, que usan la versión
  web y la de email. Si tocás una sola de las dos plantillas, se desincronizan.
- Cada shortcode nuevo tiene su `.email.html` en tablas con estilos inline. En
  esas plantillas, **las pilas de fuentes van sin comillas** (`Fira Sans, Arial,
  …`): con comillas el sanitizador de Go descarta la declaración entera y
  escribe `font-family:ZgotmplZ` en el correo. Mismo motivo que en
  `observatorio-mes.email.html`.
- `exp` se **verifica** contra los CSV, no se lee de ahí. Se prueba la forma
  escrita y la misma sin la etiqueta inicial, porque cada país guarda el
  expediente distinto: Brasil `PL 4113/2026`, Perú `32716` pelado y en una
  columna que se llama `N° de ley`. Sin esa tolerancia, escribir «Ley 32716»
  —que es lo natural— daba un aviso falso.
- Las 17 etiquetas están en `data/etiquetas.yaml`. **No son** la columna
  «Objetivo legítimo» de la matriz (19 categorías, en `objetivos-legitimos.md`).
  Comparten temas, clasifican cosas distintas: no unificarlas sin decidirlo.
- En el CMS los campos cuelgan del ancla `&boletines_fields`, así que existen
  sólo en las colecciones de boletines (ES y EN). No agregarlos a `*posts_fields`.
- `scripts/boletin_desde_doc.py` convierte el documento de Drive del mes al
  `.md`. Reporta lo que no pudo resolver y lo marca con `TODO`; el resultado hay
  que leerlo antes de publicar.

### 10. Dominio propio: `celeup.org`
El sitio se publica en **https://celeup.org** (custom domain configurado en
GitHub Pages; el repo sigue llamándose `celedigital.github.io` y GitHub redirige
las URLs viejas de `celedigital.github.io` al dominio nuevo).

Qué se tocó:
- `config.toml` → `baseURL = "https://celeup.org/"`. De ahí salen canonical,
  sitemap, robots.txt y los links absolutos de las plantillas `.email.html`
  (`single.email.html` arma `$base` con `site.BaseURL`).
- `static/CNAME` → `celeup.org`. Con deploy vía Actions el dominio vive en la
  configuración del repo, no en este archivo, pero se deja como red de seguridad
  por si alguna vez se vuelve a publicar desde una rama.
- `.github/workflows/hugo.yml` → el build es `hugo --minify` a secas. **Se sacó
  el `--baseURL "${{ steps.pages.outputs.base_url }}/"`**: mientras GitHub no
  termina de emitir el certificado del dominio propio, esa salida puede venir
  como `http://`, y el sitio se publicaba con canonical y sitemap en http.
- Los dos posts `sexta-edicion-del-taller-regional-...` (ES y EN) tenían un link
  absoluto a `celedigital.github.io`; ahora apuntan a `celeup.org`.

Lo que **no** se cambia: `repo: CELEdigital/celedigital.github.io` y
`site_domain: celedigital.netlify.app` en `static/admin/config.yml`. El primero
es el nombre del repositorio y el segundo es el proxy de OAuth de Netlify para el
CMS — ninguno de los dos es el dominio del sitio, y tocarlos rompe el login del
admin.


### 11. Prohibiciones e incentivos: mapa de bloques
El bloque (`layouts/partials/bans-nudges.html` + `static/data/bans-nudges.js` +
`assets/css/components/bans-nudges.css`) tiene un treemap **debajo de los
filtros**, entre la franja de distribución y la lista. Un control «Agrupar por»
elige qué se cuenta, y son dos vistas distintas:

- **Por jurisdicción** (la de entrada): regiones anidadas, **una celda por
  instrumento**, color por estado. Es el mapa de dónde está cada norma; un clic
  en una celda abre su ficha.
- **Por región, tipo, mecanismo, estado u origen de la definición**: **un bloque
  por categoría, sin celdas**. El área y el tono son la cantidad, y el bloque
  lleva el nombre y el total. Un clic aplica esa categoría como filtro y otro
  clic la saca. Cuenta, no lista.

Las dos dibujan el mismo array `visible`, así que los filtros y la agrupación se
combinan (Europa + agrupar por mecanismo = 5 bloques).

- Las dimensiones están en `DIMENSIONS`: cada una dice cómo agrupar, cómo se
  llama la categoría y qué `<select>` toca el clic. `tier` es la excepción:
  muestra los cuatro tipos de fuente pero el filtro tiene dos valores, así que
  `filterValue()` aplica el grupo (oficial / secundaria).
- El color de las vistas agregadas es una **rampa de la paleta del sitio**:
  crema `--base-bg` → amarillo `--cele-yellow` → ámbar quemado. Acá el color es
  la cantidad, no una categoría. La excepción es agrupar por estado, que usa la
  paleta semántica de siempre. Dos cosas decididas y no accidentales: el
  amarillo va en 0,62 y no en el medio, porque repartido en partes iguales la
  mitad de los bloques salían amarillo pleno y el mapa gritaba más que la
  página; y la rampa se queda en la familia cálida a propósito, porque verde,
  rojo y azul ya son estados en la franja que está justo arriba.
- La tinta o el blanco de la etiqueta salen de la **luminancia** del paso, con
  el corte en 0,25: es el punto donde las dos opciones empatan, o sea el mejor
  piso de contraste posible en una rampa continua (3,5:1 en el peor paso, con
  negrita y halo; 6:1 o más en todos los tamaños de bloque reales).
- El reparto lo hace `squarify()` (Bruls, Huizing & van Wijk): sin él los
  bloques salen como tiras. Las separaciones son huecos de superficie, no
  bordes: un borde sobre un bloque de 8px se come el bloque.
- **Las cajas tienen que ser `box-sizing: border-box`.** El script escribe el
  rectángulo exacto en `width`/`height`; con content-box el padding de la
  etiqueta la agranda 8px y el nombre se sale del bloque, encima del vecino.
- Las etiquetas se **miden**, no se estiman (`fitLabel`): primero baja el cuerpo
  hasta 9px, después saca la parte prescindible —el total en la vista anidada,
  el nombre en las agregadas— y recién ahí rota. Dos trampas ya pisadas: hay que
  mirar el desborde de los **hijos** del label, porque el nombre es un flex item
  que se encoge y desborda adentro; y de esos hijos hay que mirar **sólo el
  ancho**, porque el alto de una línea redondea para arriba y borraba etiquetas
  enteras que entraban perfecto.
- En la vista anidada la etiqueta se ancla en la celda más grande, no en el
  centro: centrada sobre dos celdas, el hueco que las separa cruza el texto y
  parece tachado.
- El tooltip necesita `.bn-map__tip[hidden] { display: none; }`, porque
  `display: grid` le gana a la regla del navegador para `[hidden]`.
- **No tiene leyenda propia**: la clave de colores de la vista anidada y de la
  de estados es la leyenda de la franja (`bn-strip-legend`), que queda justo
  arriba y además trae los totales.
- El reparto depende del ancho: hay un `ResizeObserver` que lo rehace. Al
  probarlo desde la consola, ojo con que en una pestaña en segundo plano no
  corren ni `requestAnimationFrame` ni el observer, y parece que estuviera roto;
  y con que el LiveReload de `hugo server` puede recargar la página en medio de
  un script y dar lecturas incoherentes.
- `static/data/bans_nudges.json` lo genera `build_bans_nudges_site.py` en otro
  proyecto: no editarlo a mano. El partial, el JS y el CSS sí son del sitio.

### 12. Hub del Taller: flyer, fecha, subtítulo y subsecciones
El hub `/taller/` (`layouts/partials/workshop-hub.html`) lee del front matter de
`content/es/taller/_index.md` (y su espejo `content/en/workshop/_index.md`):

| Campo | Qué es |
|---|---|
| `flyer` | Ruta dentro de `static/` (hoy `/flyers/placa2026.jpg`). Si queda vacío, no se dibuja nada |
| `flyer_alt` | Texto alternativo del flyer; si falta, usa el título |
| `location` | Lugar. Se imprime **antes** de la fecha, como «lugar \| fecha» |
| `event_date` | Fecha (y hora) de la edición en curso. **No usar `date`**: es un campo reservado de Hugo |
| `subtitle` | Lema de la edición. Lleva el subrayado rojo del sitio |

El header quedó como en el resto de los hubs: columna de texto (título, fecha,
subtítulo, description) y la ilustración de `image` a la derecha.

**El flyer no va adentro del header.** Es un `<figure>` suelto entre
`</header>` y las subsecciones, así que cae debajo de la franja crema y justo
arriba de «Agenda», a ancho completo (tope 62rem). Ya se probó meterlo en el
header, debajo del título: ahí queda encajonado en la columna de texto y, para
que ocupe el ancho, hay que sacarlo —y sacar el `<h1>`— del
`div.section-hub__header-text` y hacerlos filas propias del grid, lo que además
obliga a repetirles a mano el padding lateral de los breakpoints de 900px y
600px. No hace falta: fuera del header no necesita nada de eso.

Debajo del header hay dos subsecciones fijas, **Agenda** y **Participantes**,
antes de la barra de años. El cuerpo de cada una sale de un parámetro del mismo
`_index.md` (`agenda` y `participantes`; en EN, `agenda` y `participants`) y
acepta markdown. Si el parámetro está vacío, la sección igual se dibuja con el
texto «Próximamente.» / «Coming soon.» — son placeholders a propósito, no un
bug.

La barra de años lleva encima un **`<h1>` «Ediciones anteriores»** / «Past
editions» (clases `section-hub__title workshop-hub__editions-title`). Lleva la
tipografía del título del hub y la **misma franja crema a ancho completo que el
header** (`#f6f2e9`, con un filete de 6px en `--cele` arriba; mismo truco de márgenes negativos y mismos breakpoints de
900px y 600px), para que marque el corte entre la edición en curso y el
archivo. Es un `h1` a pedido, así que la página tiene dos: el título de la
sección y éste. Agenda y Participantes siguen siendo `h2`. Quedó envuelta junto con él en un `section.workshop-hub__editions`
para que el título y la barra compartan el espaciado en vez de separarse con el
`gap: 2rem` del grid del hub. Envolverla es inofensivo: `workshop-hub.js` busca
los links y los paneles con `querySelectorAll` sobre `.workshop-hub` entera, no
sobre el padre de la barra (verificado: el toggle de años sigue andando).

Ojo con dos cosas:
- La lista de subsecciones está codificada en `$infoBlocks` dentro del partial,
  con el nombre del parámetro y el título por idioma. Agregar una tercera es
  sumar una entrada ahí.
- Esto es el **hub**, no las ediciones. Cada año sigue leyendo su propio
  `subtitle`/`description` desde `workshop-subhub-content.html`; ese camino no
  se tocó.

El CSS está arriba de `assets/css/components/workshop-hub.css`.

### 13. Boletines viejos migrados al formato nuevo
Los 61 boletines de febrero 2021 a febrero 2026 (ES, y sus copias EN, que eran
idénticas y lo siguen siendo) pasaron al formato de la sección 9 con
`scripts/migrar_boletines_viejos.py`. Es de una sola vez e idempotente: saltea
los archivos que ya tienen `paises`.

- Se tiraron el blob base64 del mapa y las tablas de totales/temas desarmadas;
  las reemplaza `{{< observatorio-mes >}}`. Slug, fecha, título y
  `translationKey` no se tocaron, así que las URLs siguen iguales.
- **El país de cada entrada se reconstruyó**: WordPress tenía los países en
  pestañas y se perdieron. Sale de dominios/rutas de los enlaces, links y
  expedientes de los CSV y pistas en el texto, más el hecho de que cada país es
  un tramo contiguo. El orden de países **no es fijo** (desde 2025 Brasil va
  anteúltimo), se deduce por archivo. Los casos dudosos revisados a mano están
  en `FIJADAS`.
- Las etiquetas viejas (~300 variantes en mayúsculas) se tradujeron a los 17
  slugs con `ALIAS`. Honor/difamación → libertad-de-expresion; publicidad
  comercial y ludopatía → defensa-del-consumidor. **Desinformación / fake news
  no tiene slug y se descartó** (~100 usos); igual acceso a internet,
  ciberseguridad, derechos humanos. Si se agrega `desinformacion` a
  `data/etiquetas.yaml`, se puede re-etiquetar volviendo a correr el script
  sobre la versión anterior de git.
- `exp` sólo se escribió cuando el expediente está en la matriz, para no llenar
  el build de avisos por normas que nunca entraron a la planilla.
- 42 entradas de febrero–junio 2021 no tienen `fecha` (el formato viejo la
  ponía en la prosa y no siempre con día): son los avisos «entrada sin
  `fecha`» del build.

---

## Convenciones importantes

| Cosa | Regla |
|------|-------|
| Dominio | `celeup.org` (custom domain de GitHub Pages). `baseURL` en `config.toml` + `static/CNAME`; el workflow ya no pisa el baseURL |
| Hub de temas | Siempre `hub: temas/SLUG` — con prefijo `temas/` |
| Bloques disponibles | `destacado`, `ultimas_noticias_analisis`, `publicaciones`, `eventos` |
| `issues` | Etiquetas temáticas para filtros: `Erosión democrática`, `Plataformas`, `Regulación y tecnología`, `Violencias`. (El antiguo `Empresas y DDHH` se subsumió en `Plataformas`; su tema `temas/empresas-y-derechos-humanos` redirige a `temas/plataformas` vía alias.) |
| `content_type` | Campo de formato del post. Valores usados: `blog`, `mesa`, `boletin` |
| Etiquetas de boletín | Slugs de `data/etiquetas.yaml` (17). Distintas de «Objetivo legítimo» |
| CSS de boletines | `assets/css/components/boletin.css` (registrado en `head.html`) |
| JS del observatorio | Está en `static/data/observatory-hub.js` (no en `assets/`) |
| CSS del observatorio | `assets/css/components/observatory-hub.css` |

---

## Tareas pendientes
_(actualizar a medida que se completen)_

- [ ] Traducir el boletín de julio 2026 al EN y cargar el de junio 2026.
- [ ] Verificar visualmente que el panel Mesas funciona bien en el build de Hugo.
- [ ] Decidir si agregar las mismas mesas al equivalente EN (`content/en/`).
- [ ] Traducir "Objetivos legítimos" al EN (`content/en/observatorio-legislativo/legitimate-aims.md`).
- [ ] Decidir dónde van los 9 valores de objetivo legítimo sin mapear (ver sección 5).
- [ ] Limpiar en los CSV los valores de `¿Limita o promueve el discurso?` que no son Limita/Promueve (`SI`, `NO`, `**`).
- [ ] Decidir si `objetivos_drilldown` debería contar los objetivos secundarios (`--all-objetivos`).
