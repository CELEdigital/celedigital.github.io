# CELEdigital — Guía de asignación de contenidos

## 1. El sistema de `placements`

El mecanismo principal para que un post aparezca en un hub o sección es el array `placements` en el front matter. Cada entrada tiene tres campos:

| Campo    | Descripción                                        |
|----------|----------------------------------------------------|
| `hub`    | El hub/sección donde aparecerá el post             |
| `block`  | El bloque dentro de ese hub                        |
| `weight` | Orden de aparición (número menor = aparece primero)|

```yaml
placements:
  - hub: policy
    block: destacado
    weight: 1
  - hub: investigaciones
    block: ultimas_noticias_analisis
    weight: 2
```

Un post puede tener múltiples entradas en `placements` para aparecer en más de un hub o bloque al mismo tiempo.

---

## 2. Hubs disponibles

| `hub`             | Sección del sitio                     |
|-------------------|---------------------------------------|
| `policy`          | Hub de política                       |
| `investigaciones` | Hub de investigaciones                |
| `temas`           | Hub de temas (ES)                     |
| `topics`          | Hub de topics (EN)                    |

---

## 3. Bloques disponibles

Estos son los valores válidos para el campo `block`. Son los mismos para todos los hubs:

| `block`                    | Descripción                    |
|----------------------------|--------------------------------|
| `destacado`                | Sección destacada / featured   |
| `ultimas_noticias_analisis`| Últimas noticias y análisis    |
| `investigaciones`          | Bloque de investigaciones      |
| `eventos`                  | Bloque de eventos              |
| `blog`                     | Bloque de blog                 |

---

## 4. El campo `issues`

El campo `issues` es una lista de etiquetas temáticas que se usa para **filtrar contenido dentro de los bloques** cuando un hub tiene filtros configurados en su `_index.md`. No controla directamente dónde aparece el post, sino que sirve como metadato de clasificación temática.

```yaml
issues:
  - LDE
  - DDHH
  - Amenazas a la LDE
  - Privacidad y vigilancia
```

Valores comunes: `LDE`, `DDHH`, `Amenazas a la LDE`, `Privacidad y vigilancia`, `Gobernanza`, `IA`.

Si `issues` no está definido, el sistema hace fallback a `tags` y luego a `categories`.

---

## 5. Temas / Topics — cómo funcionan

**Los temas NO son taxonomías (tags) de Hugo. Son secciones del sitio** con su propia carpeta y archivo `_index.md`.

- Español: `/content/es/temas/<slug>/_index.md`
- Inglés: `/content/en/topics/<slug>/_index.md`

Un post **no se asigna a un tema mediante un campo especial**. Para que aparezca en la página de un tema, debe usar `placements` con `hub` igual a `temas/<slug>` (el prefijo `temas/` es obligatorio — así lo lee el partial `section-hub.html` que compara contra el `section_key` del `_index.md` del tema):

```yaml
placements:
- hub: temas/libertad-de-expresion
  block: ultimas_noticias_analisis
  weight: 1
```

> ⚠️ **Importante:** usar solo `hub: libertad-de-expresion` (sin `temas/`) NO funciona — el partial no lo reconocería.

Temas disponibles (ES) y sus slugs completos para `hub`:

| Slug completo para `hub`              | Slug EN equivalente                    |
|---------------------------------------|----------------------------------------|
| `temas/libertad-de-expresion`         | `topics/freedom-of-expression`         |
| `temas/derechos-humanos`              | `topics/human-rights`                  |
| `temas/gobernanza`                    | `topics/governance`                    |
| `temas/amenazas`                      | `topics/threats`                       |
| `temas/inteligencia-artificial`       | `topics/artificial-intelligence`       |
| `temas/privacidad-y-vigilancia`       | `topics/privacy-and-surveillance`      |

---

## 6. El campo `tags`

`tags` es el sistema de taxonomía estándar de Hugo. Se usa para mostrar etiquetas en la página individual del post. No controla la ubicación en hubs, pero sí es el fallback de `issues` para filtros.

```yaml
tags:
  - institucional
```

---

## 7. `hub_filters` — filtros a nivel de hub

Los hubs pueden tener filtros definidos en su `_index.md` para que solo ciertos `issues` aparezcan en determinados bloques. Se configura así en el `_index.md` del hub:

```yaml
hub_filters:
  ultimas_noticias_analisis:
    issues_any:
      - LDE
      - DDHH
```

Esto es independiente del `placements` del post. Afecta tanto a los ítems curados (con `placements`) como a los automáticos.

---

## 8. Ejemplo completo de front matter

```yaml
---
title: "Título del post"
date: '2024-01-15'
author:
  - Nombre Apellido
description: "Descripción breve."
image: "/img/nombre-imagen.jpg"
translationKey: "clave-compartida-con-version-en-otro-idioma"
tags:
  - institucional
issues:
  - LDE
  - DDHH
placements:
  - hub: policy
    block: destacado
    weight: 1
  - hub: temas/libertad-de-expresion
    block: ultimas_noticias_analisis
    weight: 2
---
```

---

## 9. Resumen rápido de decisiones

| Quiero que el post aparezca en...         | Usar                                      |
|-------------------------------------------|-------------------------------------------|
| El hub de policy                          | `hub: policy` en placements               |
| El hub de investigaciones                 | `hub: investigaciones` en placements      |
| La página de un tema específico           | `hub: temas/<slug>` en placements         |
| Primero en su sección                     | `weight: 1` (menor número = antes)        |
| Varias secciones a la vez                 | Múltiples entradas en `placements`        |
| Clasificado temáticamente (para filtros)  | Agregar valor a `issues`                  |
| Con etiqueta visible en la página         | Agregar valor a `tags`                    |

---

## 10. Boletines del Observatorio Legislativo

Un boletín se escribe en **un solo archivo** `.md` en
`content/es/observatorio-legislativo/`. El editorial va en el cuerpo; la
cronología país por país va en el front matter, como datos.

### Por qué los bullets van como datos y no como texto

Cada bullet es siempre el mismo registro: fecha, país, expediente, link, un
párrafo y hasta tres etiquetas. Escritos como Markdown suelto, las etiquetas
quedan siendo texto en mayúsculas —no se pueden filtrar ni traducir, y se
escriben distinto cada vez— y las fechas se tipean a mano, con los tres
formatos de fecha que usa la región. Como datos, nada de eso puede pasar.

### El front matter

```yaml
editorial_titulo: La identificación obligatoria como técnica regulatoria
editorial_bajada: >-
  De la verificación de edad al registro de líneas móviles: julio concentró…

paises:
  - pais: Argentina          # los 9 de la matriz, escritos igual que allá
    entradas:
      - fecha: 2026-07-02
        tipo: proyecto       # proyecto (default) | ley | decreto
        exp: 3226-D-2026     # se verifica contra los CSV al construir
        url: https://…
        texto: >-
          Se presentó el [Proyecto de Ley 3226-D-2026]($url), que crea…
        etiquetas:           # máximo 3, de data/etiquetas.yaml
          - discurso-de-odio
          - libertad-de-expresion

  - pais: Guatemala
    entradas: []             # publica «Sin novedades legislativas este mes»
```

- **`$url`** dentro de `texto` se reemplaza por el campo `url`. Evita repetir un
  link largo y obliga a que el enlace caiga sobre el número de expediente.
  Un bullet que enlaza varios expedientes escribe los demás con su URL entera.
- **`tipo`** sólo se nota cuando no es `proyecto`: las leyes y decretos llevan
  un sello. Marcar la excepción es lo que la hace visible al escanear.
- **`exp`** se **verifica**, no se lee: si no aparece en los CSV de la matriz,
  el build avisa pero publica igual. Una planilla atrasada nunca bloquea.

### El cuerpo

Sólo los párrafos del editorial, más tres shortcodes:

```
{{< aviso >}}…{{< /aviso >}}              recuadro (anuncio de mesa)
{{< observatorio-mes month="2026-07" >}}  totales del mes, desde los CSV
{{< boletin-paises >}}                    la cronología de arriba
```

`boletin-paises` no lleva parámetros: lee el front matter de su propia página.
Por eso ningún layout del sitio necesitó cambiar.

### Etiquetas

Las 17 viven en `data/etiquetas.yaml`, con su nombre en ES y EN. El .md escribe
el slug. **No es lo mismo que la columna «Objetivo legítimo» de la matriz**
(esa taxonomía está en `objetivos-legitimos.md` y tiene 19 categorías):
comparten temas pero clasifican cosas distintas, y conviene que sigan separadas.

### Desde el CMS

En `/admin/`, colección **Boletines**. Los campos nuevos —«Título del
editorial», «Bajada del editorial» y «El mes, país por país»— cuelgan del ancla
`&boletines_fields` de `static/admin/config.yml`, así que existen **sólo** en las
colecciones de boletines (ES y EN) y no aparecen en posts ni publicaciones.
Las etiquetas son un desplegable con las 17: nadie puede inventar una nueva ni
escribirla sin tilde.

En el editor de texto hay tres bloques: «Resumen Observatorio», «Cronología del
mes» y «Aviso». Se registran en `static/admin/index.html`.

### Desde el documento de Drive

```
python3 scripts/boletin_desde_doc.py borrador-julio.md --mes 2026-07
```

Toma el documento del mes exportado desde Google Docs con *Archivo → Descargar →
Markdown (.md)* y escribe el `.md` del sitio. Separa lo que se publica de lo que
no (el documento también es el manual y la lista de pendientes), convierte los
bullets en registros, traduce las etiquetas a slugs y normaliza los expedientes
contra la matriz. Lo que no puede resolver lo reporta al final y lo marca con
`TODO`: **el resultado siempre hay que leerlo antes de publicar**. Ahorra la
transcripción, no la revisión.

### El email

Cada shortcode tiene su variante `.email.html` en tablas con estilos inline,
porque el correo no carga la hoja de estilos. Si cambiás algo visual en
`assets/css/components/boletin.css`, fijate si corresponde llevarlo también
allá. La salida de email se genera con `outputs: [html, email]` y queda en
`…/boletin-julio-2026/email.html`.
