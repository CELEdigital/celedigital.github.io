#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Actualiza todo el Observatorio, de la planilla de Google a los gráficos.

    python3 scripts/actualizar_observatorio.py

Hace, en orden:

  1. DESCARGA   las planillas de Google como CSV -> static/data/*.csv
  2. NORMALIZA  la columna «Objetivo legítimo» de los CSV según la taxonomía
                de content/es/observatorio-legislativo/objetivos-legitimos.md
  3. GENERA     los JSON que leen los gráficos

Los tres pasos tienen que correr juntos. El filtro cruzado de la tabla
(`documentation.js`) compara el valor que emite el gráfico contra la columna del
CSV, así que si se regenera el JSON sin normalizar el CSV (o al revés), hacer
clic en una porción del sunburst deja de devolver filas.

Opciones:
    --sin-descarga    saltea el paso 1 y trabaja con los CSV que ya están en
                      disco. Es lo que hay que usar mientras GOOGLE_SHEETS no
                      esté configurado.
    --solo-descarga   baja los CSV y no toca nada más.
    --dry-run         no escribe nada, solo informa.
    --todos-objetivos cuenta también los objetivos secundarios en
                      objetivos_drilldown (ver nota más abajo).

Reemplaza a normalize_objetivos.py y regenerate_charts.py.
"""
from __future__ import annotations

import argparse
import collections
import csv
import io
import json
import pathlib
import re
import sys
import unicodedata
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
DATA = REPO / "static/data"
CHARTS = REPO / "static/charts/interactive"


# ─────────────────────────────────────────────────────────────────────────────
# 1. DESCARGA
# ─────────────────────────────────────────────────────────────────────────────
# Dos planillas: una con proyectos y leyes, otra con las normas de IA.
# Para cada destino hace falta el id de la planilla y el gid de la pestaña.
#
#   id  : docs.google.com/spreadsheets/d/ ESTO /edit#gid=...
#   gid : ...#gid= ESTO   (la pestaña; la primera suele ser gid=0)
#
# La planilla tiene que ser visible con el link ("cualquiera con el enlace
# puede ver"): el endpoint gviz no manda credenciales.
GOOGLE_SHEETS = {
    # "proyectos_clean.csv": {"id": "PENDIENTE", "gid": "0"},
    # "leyes_clean.csv":     {"id": "PENDIENTE", "gid": "0"},
    # "ai_clean.csv":        {"id": "PENDIENTE", "gid": "0"},
}

EXPORT_URL = "https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:csv&gid={gid}"


def descargar(dry_run: bool) -> bool:
    """Baja cada pestaña configurada a su CSV. Devuelve False si no hay config."""
    if not GOOGLE_SHEETS:
        print("  GOOGLE_SHEETS está vacío: no hay planillas configuradas todavía.")
        print("  (completar el diccionario arriba, o correr con --sin-descarga)")
        return False

    for filename, cfg in GOOGLE_SHEETS.items():
        destino = DATA / filename
        url = EXPORT_URL.format(**cfg)
        with urllib.request.urlopen(url, timeout=120) as resp:
            crudo = resp.read().decode("utf-8")

        filas = list(csv.reader(io.StringIO(crudo, newline="")))
        if len(filas) < 2:
            raise SystemExit(f"{filename}: la planilla vino vacía ({len(filas)} filas)")

        # Se compara contra el CSV actual antes de pisarlo: una caída de filas
        # o un cambio de encabezados casi siempre es un error de la planilla
        # (pestaña equivocada, filtro puesto), no un dato nuevo.
        if destino.exists():
            previas = list(csv.reader(io.StringIO(
                destino.read_text(encoding="utf-8"), newline="")))
            if previas and previas[0] != filas[0]:
                nuevas = set(filas[0]) - set(previas[0])
                faltan = set(previas[0]) - set(filas[0])
                print(f"  ¡OJO! {filename}: cambiaron los encabezados")
                if nuevas:
                    print(f"        nuevas en la planilla: {sorted(nuevas)}")
                if faltan:
                    print(f"        ya no están: {sorted(faltan)}")
            caida = len(previas) - len(filas)
            if caida > 0:
                print(f"  ¡OJO! {filename}: {caida} filas menos que el CSV actual")

        if not dry_run:
            buf = io.StringIO(newline="")
            csv.writer(buf, lineterminator="\r\n").writerows(filas)
            destino.write_bytes(buf.getvalue().encode("utf-8"))
        print(f"  {filename}: {len(filas) - 1} filas")
    return True


# ─────────────────────────────────────────────────────────────────────────────
# 2. NORMALIZACIÓN DE OBJETIVOS LEGÍTIMOS
# ─────────────────────────────────────────────────────────────────────────────
# Espejo de content/es/observatorio-legislativo/objetivos-legitimos.md.
# Si se edita ese .md hay que editar esto también.
TAXONOMIA = {
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
    # El .md lista estas dos como términos de Ciberseguridad. Se tratan como
    # categorías propias: son 156 y 434 filas, plegarlas dejaría a
    # Ciberseguridad como un cajón de sastre.
    "Seguridad nacional": [],
    "Derechos de los niños": [],
}

# Variantes que no figuran literalmente en el .md -> entrada de la taxonomía.
ALIAS = {
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


def clave(s: str) -> str:
    """Clave de comparación: sin acentos, sin puntuación, en minúsculas."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def plegar(s: str) -> str:
    """Como clave() pero conservando la puntuación: solo pliega grafías."""
    s = unicodedata.normalize("NFD", (s or "").strip())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


# clave -> categoría. Las categorías se cargan primero para ganarle a un
# término homónimo (p. ej. «Seguridad nacional»).
BUSQUEDA = {clave(cat): cat for cat in TAXONOMIA}
for _cat, _terminos in TAXONOMIA.items():
    for _t in _terminos:
        BUSQUEDA.setdefault(clave(_t), _cat)
for _variante, _destino in ALIAS.items():
    assert clave(_destino) in BUSQUEDA, f"alias fuera de la taxonomía: {_destino}"
    BUSQUEDA.setdefault(_variante, BUSQUEDA[clave(_destino)])


def normalizar_objetivo(crudo: str) -> tuple[str, bool]:
    """(valor normalizado, mapeó). Si no mapea devuelve el original."""
    hit = BUSQUEDA.get(clave(crudo))
    return (hit, True) if hit else (crudo.strip(), False)


COLUMNAS_OBJETIVO = {
    "proyectos_clean.csv": ["Objetivo legítimo",
                            "Otros objetivos legítimos (2)",
                            "Otros objetivos legítimos (3)"],
    "leyes_clean.csv": ["Objetivo legítimo",
                        "Objetivo legítimo (2)",
                        "Objetivo legítimo (3)"],
}


def leer_csv_crudo(path: pathlib.Path) -> list[list[str]]:
    return list(csv.reader(io.StringIO(path.read_text(encoding="utf-8"), newline="")))


def escribir_csv_crudo(path: pathlib.Path, filas: list[list[str]]) -> None:
    """Round-trip byte a byte: CRLF, comillas mínimas, sin BOM."""
    buf = io.StringIO(newline="")
    csv.writer(buf, lineterminator="\r\n").writerows(filas)
    path.write_bytes(buf.getvalue().encode("utf-8"))


def normalizar(dry_run: bool) -> collections.Counter:
    sin_mapear: collections.Counter = collections.Counter()
    for filename, columnas in COLUMNAS_OBJETIVO.items():
        path = DATA / filename
        filas = leer_csv_crudo(path)
        encabezado, cuerpo = filas[0], filas[1:]
        idxs = [i for i, h in enumerate(encabezado) if "bjetivo" in h]
        if not idxs:
            raise SystemExit(f"{filename}: no encontré columnas de objetivo legítimo")

        cambios = 0
        for fila in cuerpo:
            for i in idxs:
                if i >= len(fila) or not fila[i].strip():
                    continue
                nuevo, ok = normalizar_objetivo(fila[i])
                if not ok:
                    sin_mapear[fila[i].strip()] += 1
                if nuevo != fila[i]:
                    fila[i] = nuevo
                    cambios += 1

        if not dry_run:
            escribir_csv_crudo(path, filas)
        distintos = {fila[i].strip() for fila in cuerpo for i in idxs
                     if i < len(fila) and fila[i].strip()}
        print(f"  {filename}: {cambios} celdas reescritas, {len(distintos)} valores distintos")
    return sin_mapear


# ─────────────────────────────────────────────────────────────────────────────
# 3. GENERACIÓN DE LOS JSON DE LOS GRÁFICOS
# ─────────────────────────────────────────────────────────────────────────────
FUENTES_LDE = [
    ("Proyectos", "proyectos_clean.csv", {
        "norma": "N° de expediente",
        "estado": "¿Estado parlamentario?",
        "objetivos": COLUMNAS_OBJETIVO["proyectos_clean.csv"],
    }),
    ("Leyes", "leyes_clean.csv", {
        "norma": "N° de ley",
        "estado": "¿Sigue vigente?",
        "objetivos": COLUMNAS_OBJETIVO["leyes_clean.csv"],
    }),
]

# ai_clean.csv -> ai_database.json (mapeo verificado contra el archivo anterior)
CAMPOS_IA = {
    "pais": "País", "anio": "Año", "norma": "Número", "tipo": "Origen",
    "estado": "Estado", "objetivo": "Tema", "impacto": "Test tripartito",
    "resumen": "Objeto", "autor": "Autor", "sanciones": "Incluye sanciones",
    "moderacion": "Regula moderación de contenido",
}


def grafias_canonicas(valores) -> dict[str, str]:
    """{grafía plegada: la más frecuente}. Para las capas sin taxonomía."""
    cuentas: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for v in valores:
        if (v or "").strip():
            cuentas[plegar(v)][v.strip()] += 1
    return {k: c.most_common(1)[0][0] for k, c in cuentas.items()}


def leer_dicts(filename: str) -> list[dict]:
    with open(DATA / filename, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def construir_lde(todos_objetivos: bool):
    crudas = [(ds, cfg, fila) for ds, fn, cfg in FUENTES_LDE for fila in leer_dicts(fn)]

    grafia = {
        "tipo": grafias_canonicas(f.get("Tipo") for _, _, f in crudas),
        "impacto": grafias_canonicas(
            f.get("¿Limita o promueve el discurso?") for _, _, f in crudas),
        "estado": grafias_canonicas(f.get(c["estado"]) for _, c, f in crudas),
    }

    registros, drill, anios = [], [], []
    sin_mapear: collections.Counter = collections.Counter()

    for dataset, cfg, fila in crudas:
        anio_txt = (fila.get("Año") or "").strip()
        anio = int(anio_txt) if anio_txt.isdigit() else None
        if anio is not None:
            anios.append(anio)

        objetivos = []
        for col in cfg["objetivos"]:
            v = (fila.get(col) or "").strip()
            if not v:
                continue
            norm, ok = normalizar_objetivo(v)
            if not ok:
                sin_mapear[v] += 1
            objetivos.append(norm)

        def limpio(campo, valor):
            valor = (valor or "").strip()
            return grafia[campo].get(plegar(valor), valor) if valor else ""

        reg = {
            "pais": (fila.get("País") or "").strip(),
            "anio": anio,
            "dataset": dataset,
            "norma": (fila.get(cfg["norma"]) or "").strip(),
            "tipo": limpio("tipo", fila.get("Tipo")),
            "estado": limpio("estado", fila.get(cfg["estado"])),
            "objetivo": objetivos[0] if objetivos else "",
            "impacto": limpio("impacto", fila.get("¿Limita o promueve el discurso?")),
            "link": (fila.get("Link") or "").strip(),
            "resumen": (fila.get("Extracto") or "").strip(),
        }
        # Sin año se omite la clave: vega-scripts.html filtra con
        # Number.isFinite, y Number(null) === 0 -> mostraría «Rango temporal: 0».
        if anio is None:
            del reg["anio"]
        registros.append(reg)

        for o in (objetivos if todos_objetivos else objetivos[:1]):
            fila_drill = {"País": reg["pais"], "Objetivo legítimo": o, "dataset": dataset}
            # el slider global filtra por año, así que el dato tiene que viajar
            if anio is not None:
                fila_drill["anio"] = anio
            drill.append(fila_drill)

    # Los objetivos que no mapean quedan verbatim; al menos se colapsan sus
    # variantes de mayúsculas («Dignidad» / «DIGNIDAD»).
    grafia_obj = grafias_canonicas([r["objetivo"] for r in registros]
                                   + [d["Objetivo legítimo"] for d in drill])
    for r in registros:
        if r["objetivo"]:
            r["objetivo"] = grafia_obj.get(plegar(r["objetivo"]), r["objetivo"])
    for d in drill:
        d["Objetivo legítimo"] = grafia_obj.get(
            plegar(d["Objetivo legítimo"]), d["Objetivo legítimo"])

    return registros, drill, sin_mapear, anios


def construir_ia():
    registros = []
    for fila in leer_dicts("ai_clean.csv"):
        tipo = (fila.get("Tipo") or "").strip()
        reg = {"pais": "", "anio": None, "dataset": "Proyectos" if
               plegar(tipo).startswith("proyecto") else "Leyes"}
        for jf, col in CAMPOS_IA.items():
            reg[jf] = (fila.get(col) or "").strip()
        anio_txt = reg["anio"] = (fila.get("Año") or "").strip()
        reg["anio"] = int(anio_txt) if anio_txt.isdigit() else None
        if reg["anio"] is None:
            del reg["anio"]
        registros.append(reg)
    return registros


def escribir_json(path: pathlib.Path, payload, dry_run: bool) -> None:
    if not dry_run:
        path.write_text(json.dumps(payload, ensure_ascii=False,
                                   separators=(",", ":")), encoding="utf-8")


def generar(todos_objetivos: bool, dry_run: bool) -> collections.Counter:
    registros, drill, sin_mapear, anios = construir_lde(todos_objetivos)

    escribir_json(CHARTS / "observatorio_database.json", registros, dry_run)
    print(f"  observatorio_database.json : {len(registros)} registros")

    # Solo se reemplaza el bloque de datos embebido; el spec queda igual.
    spec_path = CHARTS / "objetivos_drilldown.json"
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    claves = list(spec.get("datasets", {}))
    if len(claves) != 1:
        raise SystemExit(f"objetivos_drilldown: esperaba 1 dataset, hay {len(claves)}")
    spec["datasets"][claves[0]] = drill
    escribir_json(spec_path, spec, dry_run)
    modo = "todos los objetivos" if todos_objetivos else "solo el primario"
    print(f"  objetivos_drilldown.json   : {len(drill)} filas ({modo})")

    ia = construir_ia()
    escribir_json(CHARTS / "ai_database.json", ia, dry_run)
    print(f"  ai_database.json           : {len(ia)} registros")

    # El slider de años es uno solo para toda la sección Visualizaciones
    # (ver vega-scripts.html). Los specs ya no traen su propio control: los
    # límites viven acá, y el control los lee de meta.json.
    anios_ia = [r["anio"] for r in ia if "anio" in r]
    lo, hi = min(anios + anios_ia), max(anios + anios_ia)
    escribir_json(CHARTS / "meta.json", {"anioMin": lo, "anioMax": hi}, dry_run)
    print(f"  meta.json                  : años {lo}-{hi}")

    # Los specs arrancan con el rango completo; el control los mueve después.
    for nombre in ("observatorio_drilldown.json", "objetivos_drilldown.json",
                   "ia_drilldown.json", "observatorio_sunburst.json",
                   "ia_sunburst.json"):
        path = CHARTS / nombre
        spec = json.loads(path.read_text(encoding="utf-8"))
        tocado = False
        for p in spec.get("params", []) + spec.get("signals", []):
            if p.get("name") == "yearMin" and p.get("value") != lo:
                p["value"] = lo
                tocado = True
            if p.get("name") == "yearMax" and p.get("value") != hi:
                p["value"] = hi
                tocado = True
        if tocado and not dry_run:
            path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
        if tocado:
            print(f"  {nombre:27}: rango inicial -> {lo}-{hi}")

    capas = {c: len({r[c] for r in registros if r[c]})
             for c in ("objetivo", "impacto", "estado", "tipo")}
    print("  valores distintos por capa : "
          + ", ".join(f"{k}={v}" for k, v in capas.items()))

    raros = sorted({r["impacto"] for r in registros if r["impacto"]
                    and plegar(r["impacto"]) not in
                    {"limita", "promueve", "limita/promueve"}})
    if raros:
        print("\n  Impacto fuera de Limita/Promueve (revisar en la planilla):")
        for v in raros:
            print(f"    {v[:90]}")
    return sin_mapear


# ─────────────────────────────────────────────────────────────────────────────
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description="Actualiza el Observatorio: planilla -> CSV -> JSON de gráficos.")
    ap.add_argument("--sin-descarga", action="store_true",
                    help="usa los CSV que ya están en disco")
    ap.add_argument("--solo-descarga", action="store_true",
                    help="baja los CSV y no genera nada")
    ap.add_argument("--dry-run", action="store_true", help="no escribe nada")
    ap.add_argument("--todos-objetivos", action="store_true",
                    help="cuenta también los objetivos secundarios en el drilldown")
    args = ap.parse_args(argv)

    if not args.sin_descarga:
        print("1/3 Descargando las planillas")
        if not descargar(args.dry_run) and not args.solo_descarga:
            print("    -> sigo con los CSV que ya están en disco\n")
    else:
        print("1/3 Descarga salteada (--sin-descarga)")
    if args.solo_descarga:
        return 0

    print("\n2/3 Normalizando objetivos legítimos")
    normalizar(args.dry_run)

    print("\n3/3 Generando los JSON de los gráficos")
    sin_mapear = generar(args.todos_objetivos, args.dry_run)

    if sin_mapear:
        print("\nObjetivos sin lugar en la taxonomía (quedaron tal cual):")
        for v, n in sin_mapear.most_common():
            print(f"  {n:3d}  {v}")

    print("\nListo." + ("  (dry-run: no se escribió nada)" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
