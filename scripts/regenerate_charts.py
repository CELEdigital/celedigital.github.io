# -*- coding: utf-8 -*-
"""Regenera los JSON que alimentan los gráficos del Observatorio desde los CSV.

Los gráficos NO leen `proyectos_clean.csv` / `leyes_clean.csv`: leen copias en
`static/charts/interactive/`. Este script vuelve a generarlas, que es lo que hay
que correr cada vez que se actualizan los CSV (una vez por mes).

Toca tres archivos:
  · observatorio_database.json  — un registro por norma; lo consumen el sunburst
                                  y el explorador jerárquico.
  · objetivos_drilldown.json    — datos embebidos (País/Objetivo/dataset) dentro
                                  del spec; se reemplaza solo el bloque de datos.
  · observatorio_drilldown.json — solo se ajustan los topes del filtro de años.

Normaliza además las cuatro capas de análisis del sunburst:
  · objetivo  -> categorías de objetivos-legitimos.md (vía normalize_objetivos)
  · impacto / estado / tipo -> se colapsan las variantes que solo difieren en
    mayúsculas o acentos, quedándose con la grafía más frecuente. Sin esto, los
    gráficos muestran «Propiedad Intelectual» y «Propiedad intelectual» como dos
    categorías distintas.

Antes de generar corre `normalize_objetivos.py` sobre los CSV. No es opcional:
el filtro cruzado de `documentation.js` compara el valor que emite el gráfico
contra la columna del CSV, así que si el JSON queda normalizado y el CSV no,
hacer clic en una porción del sunburst no devuelve ninguna fila.

Uso:
    python3 scripts/regenerate_charts.py [--dry-run] [--all-objetivos] [--skip-csv]

    --all-objetivos  cuenta también los objetivos secundarios (columnas 2 y 3)
                     en objetivos_drilldown. Por defecto solo el primario, que
                     es como venía el snapshot anterior.
    --skip-csv       no toca los CSV (solo si ya se corrió el normalizador).
"""
import csv, json, sys, collections, pathlib, importlib.util, unicodedata, re

REPO = pathlib.Path(__file__).resolve().parent.parent
CHARTS = REPO / "static/charts/interactive"
DB_JSON = CHARTS / "observatorio_database.json"
OBJ_JSON = CHARTS / "objetivos_drilldown.json"
DRILL_JSON = CHARTS / "observatorio_drilldown.json"

_spec = importlib.util.spec_from_file_location(
    "normalize_objetivos", pathlib.Path(__file__).parent / "normalize_objetivos.py")
_norm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_norm)

# columna del CSV -> campo del JSON, por dataset
SOURCES = [
    ("Proyectos", "static/data/proyectos_clean.csv", {
        "norma": "N° de expediente",
        "estado": "¿Estado parlamentario?",
        "objetivos": ["Objetivo legítimo",
                      "Otros objetivos legítimos (2)",
                      "Otros objetivos legítimos (3)"],
    }),
    ("Leyes", "static/data/leyes_clean.csv", {
        "norma": "N° de ley",
        "estado": "¿Sigue vigente?",
        "objetivos": ["Objetivo legítimo",
                      "Objetivo legítimo (2)",
                      "Objetivo legítimo (3)"],
    }),
]
COMMON = {"pais": "País", "tipo": "Tipo", "link": "Link", "resumen": "Extracto",
          "impacto": "¿Limita o promueve el discurso?"}


def fold(s):
    """Clave sin acentos ni mayúsculas, para agrupar variantes de grafía."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


def canonical_spellings(values):
    """{clave plegada: grafía más frecuente} para una lista de valores crudos."""
    counts = collections.defaultdict(collections.Counter)
    for v in values:
        if v.strip():
            counts[fold(v)][v.strip()] += 1
    return {k: c.most_common(1)[0][0] for k, c in counts.items()}


def read_csv(rel):
    with open(REPO / rel, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def build():
    raw = []
    for dataset, rel, cfg in SOURCES:
        for row in read_csv(rel):
            raw.append((dataset, cfg, row))

    # grafías canónicas para las capas que no tienen taxonomía propia
    spell = {f: canonical_spellings([r[COMMON[f]] for _, _, r in raw])
             for f in ("tipo", "estado", "impacto") if f in COMMON}
    spell["estado"] = canonical_spellings([r[c["estado"]] for _, c, r in raw])

    records, drill = [], []
    unmapped = collections.Counter()
    years = []

    for dataset, cfg, row in raw:
        year_raw = (row.get("Año") or "").strip()
        anio = int(year_raw) if year_raw.isdigit() else None
        if anio is not None:
            years.append(anio)

        objetivos = []
        for col in cfg["objetivos"]:
            v = (row.get(col) or "").strip()
            if not v:
                continue
            norm, ok = _norm.normalize(v)
            if not ok:
                unmapped[v] += 1
            objetivos.append(norm)

        def clean(field, value):
            value = (value or "").strip()
            return spell[field].get(fold(value), value) if value else ""

        rec = {
            "pais": (row.get("País") or "").strip(),
            "anio": anio,
            "dataset": dataset,
            "norma": (row.get(cfg["norma"]) or "").strip(),
            "tipo": clean("tipo", row.get("Tipo")),
            "estado": clean("estado", row.get(cfg["estado"])),
            "objetivo": objetivos[0] if objetivos else "",
            "impacto": clean("impacto", row.get(COMMON["impacto"])),
            "link": (row.get("Link") or "").strip(),
            "resumen": (row.get("Extracto") or "").strip(),
        }
        # Sin año se omite la clave: el panel de vega-scripts.html filtra con
        # Number.isFinite, y Number(null) es 0 -> mostraría «Rango temporal: 0».
        if anio is None:
            del rec["anio"]
        records.append(rec)

        wanted = objetivos if ALL_OBJETIVOS else objetivos[:1]
        for o in wanted:
            drill.append({"País": (row.get("País") or "").strip(),
                          "Objetivo legítimo": o,
                          "dataset": dataset})

    # los objetivos que no mapean quedan verbatim; al menos se colapsan sus
    # variantes de mayúsculas (p. ej. «Dignidad» / «DIGNIDAD»)
    obj_spell = canonical_spellings([r["objetivo"] for r in records]
                                    + [d["Objetivo legítimo"] for d in drill])
    for r in records:
        if r["objetivo"]:
            r["objetivo"] = obj_spell.get(fold(r["objetivo"]), r["objetivo"])
    for d in drill:
        d["Objetivo legítimo"] = obj_spell.get(
            fold(d["Objetivo legítimo"]), d["Objetivo legítimo"])

    return records, drill, unmapped, years


def write_json(path, payload, dry_run):
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if not dry_run:
        path.write_text(text, encoding="utf-8")
    return len(text)


def main(dry_run=False, skip_csv=False):
    if not skip_csv:
        print("— normalizando los CSV —")
        _norm.main(dry_run=dry_run)
        print("— regenerando los gráficos —")

    records, drill, unmapped, years = build()

    write_json(DB_JSON, records, dry_run)
    print(f"observatorio_database.json : {len(records)} registros")

    # objetivos_drilldown: se cambia solo el bloque de datos, el spec queda igual
    spec = json.loads(OBJ_JSON.read_text(encoding="utf-8"))
    keys = list(spec.get("datasets", {}))
    assert len(keys) == 1, f"esperaba 1 dataset embebido, hay {len(keys)}"
    spec["datasets"][keys[0]] = drill
    write_json(OBJ_JSON, spec, dry_run)
    print(f"objetivos_drilldown.json   : {len(drill)} filas "
          f"({'todos los objetivos' if ALL_OBJETIVOS else 'solo el primario'})")

    # el filtro de años del explorador se queda corto cuando entran datos nuevos
    drillspec = json.loads(DRILL_JSON.read_text(encoding="utf-8"))
    lo, hi = min(years), max(years)
    touched = []
    for param in drillspec.get("params", []):
        if param.get("name") in ("yearMin", "yearMax"):
            before = (param["bind"]["min"], param["bind"]["max"])
            param["bind"]["min"], param["bind"]["max"] = lo, hi
            param["value"] = lo if param["name"] == "yearMin" else hi
            if before != (lo, hi):
                touched.append(f"{param['name']}: {before} -> {(lo, hi)}")
    if not dry_run:
        DRILL_JSON.write_text(
            json.dumps(drillspec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"observatorio_drilldown.json: rango de años {lo}-{hi}"
          + (f"  [{'; '.join(touched)}]" if touched else "  (sin cambios)"))

    layers = {f: len({r[f] for r in records if r[f]})
              for f in ("objetivo", "impacto", "estado", "tipo")}
    print("\nvalores distintos por capa:", ", ".join(f"{k}={v}" for k, v in layers.items()))

    if unmapped:
        print("\nObjetivos sin lugar en la taxonomía (quedaron tal cual):")
        for v, n in unmapped.most_common():
            print(f"  {n:3d}  {v}")
    impacto_raro = sorted({r["impacto"] for r in records
                           if r["impacto"] and fold(r["impacto"]) not in
                           {"limita", "promueve", "limita/promueve"}})
    if impacto_raro:
        print("\nValores de impacto fuera de Limita/Promueve (revisar en el CSV):")
        for v in impacto_raro:
            print(f"       {v}")
    if dry_run:
        print("\n(dry-run: no se escribió nada)")


if __name__ == "__main__":
    ALL_OBJETIVOS = "--all-objetivos" in sys.argv
    main(dry_run="--dry-run" in sys.argv, skip_csv="--skip-csv" in sys.argv)
