# -*- coding: utf-8 -*-
"""Normaliza las columnas «Objetivo legítimo» de los CSV del Observatorio.

Cada celda no vacía se reescribe con una de las categorías de
`content/es/observatorio-legislativo/objetivos-legitimos.md`. Los términos
sueltos de la taxonomía suben a su categoría; las variantes de mayúsculas,
acentos y redacción se resuelven vía ALIASES.

Dos decisiones que no salen del documento:
  - «Seguridad nacional» y «Derechos de los niños» figuran como términos de
    Ciberseguridad, pero se tratan como categorías propias (son 156 y 434
    filas; plegarlas dejaría a Ciberseguridad como un cajón de sastre).
  - Los valores sin lugar en la taxonomía se dejan tal cual y se reportan al
    final, para no inventar categorías.

Idempotente: correrlo dos veces no cambia nada. Uso:
    python3 scripts/normalize_objetivos.py [--dry-run]
"""
import csv, io, re, sys, unicodedata, collections, pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
FILES = ["static/data/proyectos_clean.csv", "static/data/leyes_clean.csv"]

# categoría -> términos que suben a ella
TAXONOMY = {
    "Discriminación, violencia y discursos de odio": [
        "Discriminación", "Violencia de género", "Violencia", "Discurso de odio",
        "Acoso", "Apología", "Derechos de las mujeres",
        "Instigación al suicidio y autolesión"],
    "Acceso a la información": ["Acceso a la información", "Transparencia"],
    "Libertad de expresión y derechos políticos": [
        "Libertad de expresión", "Libertad de prensa", "Libertad electoral",
        "Derecho a la protesta", "Derecho de reunión", "Seguridad ciudadana"],
    "Libertad de conciencia y de religión": ["Libertad de culto", "Libertad de conciencia"],
    "Honor y reputación": [
        "Honor y reputación", "Derecho al olvido", "Calumnia e injurias",
        "Derecho de rectificación o réplica"],
    "Privacidad y derechos ARCO": ["Privacidad", "Datos personales", "Identidad digital"],
    "DESC": [
        "Derechos laborales", "Discapacidad", "Derecho a la cultura",
        "Participación ciudadana", "Derechos de los pueblos indígenas",
        "Derechos de los terceros", "Salud", "Movimientos sociales", "Trabajo sexual"],
    "Propiedad intelectual": ["Derechos de autor", "Propiedad intelectual"],
    "Derechos del consumidor": ["Publicidad comercial"],
    "Moderación de contenidos y responsabilidad de intermediarios": [
        "Moderación de contenidos", "Responsabilidad de intermediarios",
        "Etiquetado", "Pornografía", "Regulación de medios"],
    "Inteligencia artificial": ["Regular la inteligencia artificial"],
    "Acceso a internet e infraestructura": [
        "Neutralidad de red", "Acceso a internet", "Telecomunicaciones"],
    "Ciberseguridad": ["Delitos informáticos", "Seguridad digital"],
    "Gobierno digital": [
        "Administración de justicia", "Gobierno digital", "Impulsar el contenido nacional"],
    "Moral pública": ["Orden público"],
    "Desinformación": [],
    "Publicidad oficial": [],
    "Seguridad nacional": [],       # categoría propia, no término de Ciberseguridad
    "Derechos de los niños": [],    # idem
}

# variantes que no aparecen literalmente en la taxonomía -> entrada de la taxonomía
ALIASES = {
    "violencia y discursos de odio": "Discriminación, violencia y discursos de odio",
    "no discriminacion": "Discriminación",
    "igualdad y no discriminacion": "Discriminación",
    "hostigamiento": "Acoso",
    "reputacion y honor": "Honor y reputación",
    "derecho a la intimidad": "Privacidad",
    "proteccion de datos personales": "Datos personales",
    "neutralidad de la red": "Neutralidad de red",
    "moderacion de contenido": "Moderación de contenidos",
    "regular la ia": "Regular la inteligencia artificial",
    "regulacion de tecnologias": "Regular la inteligencia artificial",
    "derechos de terceros": "Derechos de los terceros",
    "libertad de reunion y asociacion": "Derecho de reunión",
    "elecciones": "Libertad electoral",
    "derechos politicos": "Libertad de expresión y derechos políticos",
    "promocion de la cultura": "Derecho a la cultura",
    "salud publica": "Salud",
    "defensa del consumidor": "Derechos del consumidor",
    "derechos del consumidor derecho a la informacion": "Derechos del consumidor",
    "desc discapacidad": "Discapacidad",
    "desc salud": "Salud",
    "proteccion de menores": "Derechos de los niños",
    "telecomunicaciones acceso a internet e infraestructura": "Telecomunicaciones",
    "fake news": "Desinformación",
    "propaganda": "Desinformación",
    "opinion publica": "Desinformación",
    "delitos informaticos ciberseguridad por el objetivo declarado de combatir "
    "el uso fraudulento de sim": "Delitos informáticos",
}


def key(s):
    """Clave de comparación: sin acentos, sin puntuación, minúsculas."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


# clave -> categoría. Las categorías se cargan primero para que ganen
# frente a un término homónimo.
LOOKUP = {key(cat): cat for cat in TAXONOMY}
for cat, terms in TAXONOMY.items():
    for term in terms:
        LOOKUP.setdefault(key(term), cat)
for variant, target in ALIASES.items():
    assert key(target) in LOOKUP, f"alias apunta fuera de la taxonomía: {target}"
    LOOKUP.setdefault(variant, LOOKUP[key(target)])


def normalize(raw):
    """Devuelve (valor_normalizado, ok). Si no mapea, devuelve el original."""
    hit = LOOKUP.get(key(raw))
    return (hit, True) if hit else (raw.strip(), False)


def main(dry_run=False):
    changed_total = 0
    unmapped = collections.Counter()

    for rel in FILES:
        path = REPO / rel
        raw = path.read_bytes().decode("utf-8")
        rows = list(csv.reader(io.StringIO(raw, newline="")))
        header, body = rows[0], rows[1:]
        idxs = [i for i, h in enumerate(header) if "bjetivo" in h]
        assert idxs, f"{rel}: no hay columnas de objetivo legítimo"

        changed = 0
        for row in body:
            for i in idxs:
                if i >= len(row):
                    continue
                original = row[i]
                if not original.strip():
                    continue
                new, ok = normalize(original)
                if not ok:
                    unmapped[original.strip()] += 1
                if new != original:
                    row[i] = new
                    changed += 1

        buf = io.StringIO(newline="")
        csv.writer(buf, lineterminator="\r\n").writerows(rows)
        if not dry_run:
            path.write_bytes(buf.getvalue().encode("utf-8"))

        distinct = {row[i].strip() for row in body for i in idxs
                    if i < len(row) and row[i].strip()}
        print(f"{rel}: {changed} celdas reescritas, {len(distinct)} valores distintos")
        changed_total += changed

    if unmapped:
        print("\nSin lugar en la taxonomía (se dejaron tal cual):")
        for value, n in unmapped.most_common():
            print(f"  {n:3d}  {value}")
    print(f"\nTotal: {changed_total} celdas{' (dry-run)' if dry_run else ''}")


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
