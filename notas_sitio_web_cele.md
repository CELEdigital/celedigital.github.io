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
