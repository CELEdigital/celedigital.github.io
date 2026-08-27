#!/usr/bin/env python3
"""Convierte el documento de Drive del boletín mensual en el .md del sitio.

    python3 scripts/boletin_desde_doc.py borrador-julio.md --mes 2026-07

El documento de entrada es el que se arma cada mes en la carpeta «Actualidad
LATAM», exportado desde Google Docs con *Archivo → Descargar → Markdown (.md)*.
También funciona con la exportación a texto plano, aunque en ese caso se pierden
los enlaces y hay que completarlos a mano.

Qué hace:

  1. Separa lo que se publica de lo que no. El documento hace tres trabajos a la
     vez —es el boletín, es el manual para escribir el próximo y es la lista de
     pendientes—; acá sólo sobrevive el primero, más la sección «Temas que
     vienen creciendo», que está enterrada en las notas internas pero está
     escrita para un lector.
  2. Convierte cada bullet de país en un registro: fecha, tipo, expediente,
     link, texto y etiquetas.
  3. Traduce las etiquetas en mayúsculas a los slugs de data/etiquetas.yaml.
  4. Normaliza el número de expediente contra los CSV de la matriz, para que
     quede escrito igual que allá y la verificación del build sirva de algo.

Qué NO hace: no inventa. Todo lo que no puede resolver lo reporta al final y lo
deja marcado en el archivo con «TODO», así que el resultado siempre hay que
leerlo antes de publicar. La idea es ahorrar la transcripción, no la revisión.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ETIQUETAS_YAML = RAIZ / "data" / "etiquetas.yaml"
CSV_MATRIZ = [
    (RAIZ / "static" / "data" / "proyectos_clean.csv", "N° de expediente"),
    (RAIZ / "static" / "data" / "leyes_clean.csv", "N° de ley"),
]
DESTINO = RAIZ / "content" / "es" / "observatorio-legislativo"

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

# El conjunto está cerrado: son los nueve países de la matriz. Un encabezado de
# nivel 2 que no esté acá no abre un bloque de país (es el caso de «TEXTO
# EDITORIAL DE APERTURA», que también es un H2 en el documento).
PAISES = {
    "ARGENTINA": "Argentina",
    "BRASIL": "Brasil",
    "CHILE": "Chile",
    "COLOMBIA": "Colombia",
    "ECUADOR": "Ecuador",
    "GUATEMALA": "Guatemala",
    "MEXICO": "México",
    "MÉXICO": "México",
    "PARAGUAY": "Paraguay",
    "PERU": "Perú",
    "PERÚ": "Perú",
}

# Cómo empieza el bullet según el acto. El documento lo dice en el verbo y no en
# una etiqueta aparte, así que se deduce de ahí.
VERBOS_TIPO = [
    (r"\bse promulg", "ley"),
    (r"\bse sancion", "ley"),
    (r"\bse expidi", "decreto"),
    (r"\bse public.*\bdecreto\b", "decreto"),
]

# Palabras con las que el documento presenta un expediente y que la matriz no
# guarda. Se sacan del principio para quedarse con el número.
PREFIJOS_EXP = [
    "proyecto de ley estatutaria",
    "proyecto de ley",
    "proyecto",
    "iniciativa",
    "boletín",
    "boletin",
    "el",
    "la",
]


class Aviso(Exception):
    """Un problema que corta la conversión (a diferencia de los reportes)."""


# ── Utilidades ────────────────────────────────────────────────────────────


def plegar(texto: str) -> str:
    """Minúsculas, sin acentos y sin espacios de más, para comparar."""
    sin = unicodedata.normalize("NFKD", texto)
    sin = "".join(c for c in sin if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sin).strip().lower()


def leer_etiquetas() -> dict[str, str]:
    """{etiqueta plegada: slug} a partir de data/etiquetas.yaml.

    Se parsea a mano en vez de importar PyYAML para que el script corra sin
    instalar nada, igual que actualizar_observatorio.py. El archivo tiene una
    forma fija (slug, luego `es:` y `en:` indentados) y no hace falta más.
    """
    if not ETIQUETAS_YAML.exists():
        raise Aviso(f"No encuentro {ETIQUETAS_YAML}")

    mapa: dict[str, str] = {}
    slug = None
    for linea in ETIQUETAS_YAML.read_text(encoding="utf-8").splitlines():
        if not linea.strip() or linea.lstrip().startswith("#"):
            continue
        if not linea.startswith(" "):
            slug = linea.split(":")[0].strip()
            # El propio slug también sirve como clave: si alguien escribe la
            # etiqueta ya en formato slug, se acepta.
            mapa[plegar(slug.replace("-", " "))] = slug
        elif slug:
            clave, _, valor = linea.strip().partition(":")
            if clave in ("es", "en") and valor.strip():
                mapa[plegar(valor.strip())] = slug
    if not mapa:
        raise Aviso(f"{ETIQUETAS_YAML} no tiene ninguna etiqueta.")
    return mapa


def leer_matriz() -> list[str]:
    """Todos los números de expediente de los CSV, tal como están escritos."""
    expedientes: list[str] = []
    for ruta, columna in CSV_MATRIZ:
        if not ruta.exists():
            continue
        with ruta.open(encoding="utf-8-sig", newline="") as fh:
            for fila in csv.DictReader(fh):
                valor = (fila.get(columna) or "").strip()
                if valor:
                    expedientes.append(valor)
    return expedientes


# ── Parseo del documento ──────────────────────────────────────────────────


def limpiar(linea: str) -> str:
    """Deshace lo que agrega la exportación de Google Docs.

    El export escapa signos que en Markdown no significan nada (`\\!`, `\\-`),
    mete líneas con dos espacios como separador de párrafo, y a veces rompe un
    emoji dejando un byte suelto (la `ð` del calendario).
    """
    linea = linea.replace("\u00a0", " ")
    linea = re.sub(r"\\([!\-.*_()\[\]])", r"\1", linea)
    linea = re.sub(r"^[ðï¸\ufe0f\u200d]+\s*", "", linea)
    return linea.rstrip()


def partir_secciones(lineas: list[str]) -> tuple[list[str], list[tuple[str, list[str]]], list[str]]:
    """Devuelve (editorial, [(país, líneas)], seguimiento)."""
    editorial: list[str] = []
    paises: list[tuple[str, list[str]]] = []
    seguimiento: list[str] = []

    modo = "preludio"
    actual: list[str] | None = None

    for cruda in lineas:
        linea = limpiar(cruda)

        h1 = re.match(r"^#\s+(.*)$", linea)
        h2 = re.match(r"^##\s+(.*)$", linea)
        h3 = re.match(r"^###\s+(.*)$", linea)

        if h1:
            titulo = plegar(h1.group(1))
            # El primer H1 es el título del boletín; el siguiente abre las notas
            # internas y desde ahí no se publica nada más, salvo «Temas que
            # vienen creciendo», que se rescata aparte.
            if "boletin mensual" in titulo:
                continue
            modo = "notas"
            continue

        if h2:
            nombre = h2.group(1).strip()
            clave = plegar(nombre).upper()
            clave_directa = nombre.strip().upper()
            if clave_directa in PAISES or clave.upper() in PAISES:
                pais = PAISES.get(clave_directa) or PAISES[clave.upper()]
                actual = []
                paises.append((pais, actual))
                modo = "pais"
                continue
            if "editorial" in plegar(nombre):
                modo = "editorial"
                continue
            if modo == "notas" and "temas que vienen creciendo" in plegar(nombre):
                modo = "seguimiento"
                continue
            if modo == "seguimiento":
                modo = "notas"
            continue

        if modo == "editorial":
            if h3:
                editorial.append(f"### {h3.group(1).strip()}")
            else:
                editorial.append(linea)
        elif modo == "pais" and actual is not None:
            actual.append(linea)
        elif modo == "seguimiento":
            seguimiento.append(linea)

    return editorial, paises, seguimiento


def bloques_de_texto(lineas: list[str]) -> list[str]:
    """Agrupa líneas en párrafos, ignorando los separadores del export."""
    bloques: list[str] = []
    buffer: list[str] = []
    for linea in lineas:
        if not linea.strip():
            if buffer:
                bloques.append(" ".join(buffer).strip())
                buffer = []
            continue
        buffer.append(linea.strip())
    if buffer:
        bloques.append(" ".join(buffer).strip())
    return [b for b in bloques if b]


def separar_etiquetas(texto: str, vocabulario: dict[str, str]) -> tuple[list[str], list[str]]:
    """Convierte «PROTECCIÓN DE MENORES PLATAFORMAS DIGITALES» en slugs.

    En el documento las etiquetas van pegadas en una sola línea, sin separador:
    hay que reconocerlas por nombre. Se prueba siempre la etiqueta más larga
    primero, si no «LIBERTAD DE EXPRESIÓN» se comería el prefijo de
    «LIBERTAD DE PRENSA».
    """
    restante = plegar(texto)
    slugs: list[str] = []
    sin_reconocer: list[str] = []
    nombres = sorted(vocabulario, key=len, reverse=True)

    while restante:
        for nombre in nombres:
            if restante.startswith(nombre):
                slug = vocabulario[nombre]
                if slug not in slugs:
                    slugs.append(slug)
                restante = restante[len(nombre):].strip()
                break
        else:
            # Ninguna etiqueta calza acá: se descarta una palabra y se sigue,
            # anotándola para el reporte final.
            palabra, _, restante = restante.partition(" ")
            if palabra:
                sin_reconocer.append(palabra)
            restante = restante.strip()

    return slugs, sin_reconocer


def es_linea_de_etiquetas(bloque: str, vocabulario: dict[str, str]) -> bool:
    """¿Este párrafo es la línea de etiquetas de un bullet?

    Se apoya en la forma: en el documento las etiquetas van en mayúsculas, sin
    puntuación y sin enlaces. Exigir además que arranque con una etiqueta
    conocida evita confundirla con una oración corta en mayúsculas.
    """
    limpio = bloque.strip()
    if not limpio or "[" in limpio or "**" in limpio:
        return False
    if limpio != limpio.upper():
        return False
    if re.search(r"[.,;:?]", limpio):
        return False
    plegado = plegar(limpio)
    return any(plegado.startswith(n) for n in vocabulario)


def normalizar_exp(etiqueta_link: str, matriz: list[str]) -> str:
    """Deja el expediente escrito como lo escribe la matriz.

    El documento lo presenta en prosa («el Proyecto de Ley 3226-D-2026»,
    «el boletín 18442-07»), y cada país lo guarda distinto: Brasil con la sigla
    adelante («PL 4113/2026»), Perú pelado («32716»). Se busca el número en los
    CSV y, si aparece, se copia la forma de allá; así la verificación que hace
    el build al publicar compara peras con peras.
    """
    bruto = etiqueta_link.strip().strip("«»\"'")
    plegado = plegar(bruto)
    for prefijo in PREFIJOS_EXP:
        if plegado.startswith(prefijo + " "):
            bruto = bruto[len(prefijo):].strip()
            plegado = plegar(bruto)

    # El token con dígitos es el candidato a número de expediente.
    tokens = [t for t in bruto.split() if any(c.isdigit() for c in t)]
    if not tokens:
        return ""
    candidato = tokens[0].strip(",.;:()")

    for valor in matriz:
        if candidato == valor or candidato in valor.split():
            return valor
    for valor in matriz:
        if candidato in valor:
            return valor
    return candidato


def parsear_entradas(
    lineas: list[str],
    pais: str,
    anio: int,
    vocabulario: dict[str, str],
    matriz: list[str],
    reportes: list[str],
) -> list[dict]:
    """Convierte los bullets de un país en registros."""
    bloques = bloques_de_texto(lineas)
    entradas: list[dict] = []

    for bloque in bloques:
        if es_linea_de_etiquetas(bloque, vocabulario):
            if not entradas:
                reportes.append(f"{pais}: hay etiquetas sueltas antes del primer bullet.")
                continue
            slugs, sobrantes = separar_etiquetas(bloque, vocabulario)
            entradas[-1]["etiquetas"] = slugs[:3]
            if len(slugs) > 3:
                reportes.append(
                    f"{pais} / {entradas[-1]['fecha']}: {len(slugs)} etiquetas, "
                    f"me quedé con las 3 primeras ({', '.join(slugs[3:])} quedaron afuera)."
                )
            if sobrantes:
                reportes.append(
                    f"{pais} / {entradas[-1]['fecha']}: no reconocí «{' '.join(sobrantes)}» "
                    "como etiqueta; revisá data/etiquetas.yaml."
                )
            continue

        # «Sin novedades legislativas en julio.» — el país va igual, vacío.
        if re.match(r"^\*?\s*sin novedades", plegar(bloque)):
            continue

        fecha = re.match(r"^\*\*\s*(\d{1,2})/(\d{1,2})\s*\*\*\s*(.*)$", bloque)
        if not fecha:
            fecha = re.match(r"^(\d{1,2})/(\d{1,2})\s+(.*)$", bloque)
        if not fecha:
            reportes.append(f"{pais}: ignoré un párrafo que no arranca con fecha — «{bloque[:70]}…»")
            continue

        dia, mes, texto = int(fecha.group(1)), int(fecha.group(2)), fecha.group(3).strip()

        # El primer enlace del bullet es el del expediente: así lo pide el
        # manual («los enlaces van sobre el número de expediente»).
        link = re.search(r"\[([^\]]+)\]\(([^)]+)\)", texto)
        url = link.group(2).strip() if link else ""
        exp = normalizar_exp(link.group(1), matriz) if link else ""

        if link and url:
            # Se reemplaza sólo la primera ocurrencia: un bullet puede enlazar
            # varios expedientes (el paquete de Brasil enlaza cinco) y los demás
            # quedan escritos con su URL completa.
            texto = texto.replace(f"]({url})", "]($url)", 1)
        elif not link:
            url = ""
            texto = texto + "  <!-- TODO: falta el link -->"
            reportes.append(f"{pais} / {dia:02d}/{mes:02d}: el bullet no tiene enlace.")

        tipo = "proyecto"
        for patron, valor in VERBOS_TIPO:
            if re.search(patron, plegar(texto)):
                tipo = valor
                break

        entradas.append({
            "fecha": f"{anio}-{mes:02d}-{dia:02d}",
            "tipo": tipo,
            "exp": exp,
            "url": url,
            "texto": texto,
            "etiquetas": [],
        })

    for entrada in entradas:
        if not entrada["etiquetas"]:
            reportes.append(f"{pais} / {entrada['fecha']}: quedó sin etiquetas.")
        if not entrada["exp"]:
            reportes.append(f"{pais} / {entrada['fecha']}: no pude deducir el expediente.")

    return entradas


# ── Escritura del .md ─────────────────────────────────────────────────────


def plegado_yaml(valor: str, sangria: int) -> str:
    """Escribe un texto largo como escalar plegado (`>-`) legible.

    Se usa `>-` y no comillas porque los textos tienen `:`, `«»`, corchetes de
    enlaces y comillas: entrecomillarlos obligaría a escapar y quedarían
    ilegibles para quien después edite el archivo a mano o desde el CMS.
    """
    pad = " " * sangria
    palabras = re.sub(r"\s+", " ", valor).strip().split(" ")
    lineas: list[str] = []
    actual = ""
    for palabra in palabras:
        # Se corta sólo entre palabras, nunca adentro de una. Por eso una URL
        # —que no tiene espacios— nunca se parte, aunque pase de los 74; si se
        # partiera, el escalar plegado le metería un espacio en el medio al
        # unir las líneas y el enlace quedaría roto.
        if actual and len(actual) + len(palabra) + 1 > 74:
            lineas.append(actual)
            actual = palabra
        else:
            actual = f"{actual} {palabra}".strip()
    if actual:
        lineas.append(actual)
    cuerpo = "\n".join(pad + l for l in lineas)
    return ">-\n" + cuerpo


def escalar(valor: str) -> str:
    """Un valor corto de una línea, entrecomillado sólo si hace falta."""
    if valor == "":
        return "''"
    if re.search(r"^[\d\s]+$|[:#\[\]{}&*!|>'\"%@`]", valor) or valor.startswith("-"):
        return "'" + valor.replace("'", "''") + "'"
    return valor


def items_de_lista(lineas: list[str]) -> list[str]:
    """Los ítems de «Temas que vienen creciendo», uno por elemento.

    No se puede reusar bloques_de_texto() acá: esa función junta las líneas
    consecutivas en un párrafo, y en el documento los tres ítems de la lista van
    en líneas seguidas, sin renglón en blanco entre medio. Sin esto los tres
    terminaban pegados en un solo bullet.
    """
    items: list[str] = []
    for linea in lineas:
        texto = linea.strip()
        if not texto:
            continue
        if re.match(r"^[-*]\s+", texto):
            items.append(re.sub(r"^[-*]\s+", "", texto))
        elif items:
            # Continuación del ítem anterior partido en dos renglones.
            items[-1] = f"{items[-1]} {texto}"
    return [i for i in items if i]


def armar_md(mes: str, editorial: list[str], paises: list, seguimiento: list[str]) -> str:
    anio, num_mes = int(mes[:4]), int(mes[5:7])
    nombre_mes = MESES[num_mes - 1]
    etiqueta_mes = f"{nombre_mes.capitalize()} {anio}"
    ultimo = (date(anio + (num_mes // 12), (num_mes % 12) + 1, 1) - __import__("datetime").timedelta(days=1))

    bloques = bloques_de_texto([l for l in editorial if not l.startswith("###")])
    titulos = [l[4:].strip() for l in editorial if l.startswith("###")]
    ed_titulo = titulos[0] if titulos else ""
    ed_bajada = titulos[1] if len(titulos) > 1 else ""

    # El anuncio de la mesa va en negrita y suele ser el último párrafo del
    # editorial; se lo saca del cuerpo para envolverlo en el shortcode `aviso`.
    aviso = ""
    if bloques and bloques[-1].startswith("**") and bloques[-1].rstrip().endswith("**"):
        aviso = bloques.pop().strip()

    fm: list[str] = ["---"]
    fm.append(f"title: Boletín mensual Observatorio Legislativo | {etiqueta_mes}")
    fm.append(f"slug: boletin-{nombre_mes}-{anio}")
    fm.append(f"date: {ultimo.isoformat()}")
    fm.append(f"translationKey: boletin-{nombre_mes}-{str(anio)[2:]}")
    fm.append("description: Novedades de la actividad legislativa y regulatoria, decisiones")
    fm.append("  judiciales y administrativas.")
    fm.append("author:\n  - CELE")
    fm.append("content_type:\n  - boletin")
    fm.append("programs: policy")
    fm.append("type: posts")
    fm.append("featured: true")
    fm.append("outputs:\n  - html\n  - email")
    fm.append("newsletter_series: observatorio")
    fm.append("newsletter_number: ''")
    fm.append("tagline: Novedades de la actividad legislativa y regulatoria, decisiones judiciales y administrativas.")
    fm.append("image: /img/flavia-carpio-P3PFi8THbUs-unsplash-scaled.jpg")
    fm.append("tags: []")
    fm.append("")
    fm.append(f"editorial_titulo: {escalar(ed_titulo)}")
    fm.append("editorial_bajada: " + plegado_yaml(ed_bajada, 2))
    fm.append("")
    fm.append("paises:")

    for pais, entradas in paises:
        fm.append(f"  - pais: {pais}")
        if not entradas:
            fm.append("    entradas: []")
            fm.append("")
            continue
        fm.append("    entradas:")
        for i, e in enumerate(entradas):
            if i:
                fm.append("")
            fm.append(f"      - fecha: {e['fecha']}")
            fm.append(f"        tipo: {e['tipo']}")
            if e["exp"]:
                fm.append(f"        exp: {escalar(e['exp'])}")
            if e["url"]:
                fm.append(f"        url: {e['url']}")
            fm.append("        texto: " + plegado_yaml(e["texto"], 10))
            if e["etiquetas"]:
                fm.append("        etiquetas:")
                for slug in e["etiquetas"]:
                    fm.append(f"          - {slug}")
            else:
                fm.append("        etiquetas: []  # TODO: falta etiquetar")
        fm.append("")

    while fm and fm[-1] == "":
        fm.pop()
    fm.append("---")

    cuerpo: list[str] = [""]
    for bloque in bloques:
        cuerpo.append(bloque)
        cuerpo.append("")

    if aviso:
        cuerpo.append("{{< aviso >}}")
        cuerpo.append(aviso.strip("*").strip())
        cuerpo.append("{{< /aviso >}}")
        cuerpo.append("")

    cuerpo.append(f'{{{{< observatorio-mes month="{mes}" >}}}}')
    cuerpo.append("")
    cuerpo.append("{{< boletin-paises >}}")
    cuerpo.append("")

    items = items_de_lista(seguimiento)
    if items:
        cuerpo.append("## En seguimiento")
        cuerpo.append("")
        for item in items:
            # items_de_lista ya sacó el guion: volver a limpiar acá con
            # `^[-*]\s*` se comía el primer asterisco de un ítem que arranca en
            # negrita («**Protesta.**» quedaba como «*Protesta.**»).
            cuerpo.append(f"- {item}")
        cuerpo.append("")

    return "\n".join(fm) + "\n" + "\n".join(cuerpo)


# ── Entrada ───────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Convierte el documento de Drive del boletín en el .md del sitio.",
        epilog="El .md que sale siempre hay que leerlo antes de publicar: el script "
               "ahorra la transcripción, no la revisión.",
    )
    ap.add_argument("entrada", type=Path,
                    help="El documento exportado desde Google Docs como Markdown (.md).")
    ap.add_argument("--mes", required=True,
                    help="Mes del boletín, en formato AAAA-MM (ej. 2026-07).")
    ap.add_argument("--salida", type=Path,
                    help="Dónde escribir. Por defecto, en content/es/observatorio-legislativo/.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Imprime el resultado por pantalla en vez de escribir el archivo.")
    args = ap.parse_args()

    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", args.mes):
        raise Aviso(f"--mes tiene que ser AAAA-MM, recibí «{args.mes}».")
    if not args.entrada.exists():
        raise Aviso(f"No encuentro el archivo de entrada: {args.entrada}")

    vocabulario = leer_etiquetas()
    matriz = leer_matriz()
    if not matriz:
        print("  aviso: no pude leer los CSV de la matriz; los expedientes van sin normalizar.",
              file=sys.stderr)

    lineas = args.entrada.read_text(encoding="utf-8").splitlines()
    editorial, crudos, seguimiento = partir_secciones(lineas)

    if not crudos:
        raise Aviso(
            "No encontré ninguna sección de país. ¿Exportaste el documento como "
            "Markdown? Los países tienen que ser encabezados de nivel 2."
        )

    anio = int(args.mes[:4])
    reportes: list[str] = []
    paises = [
        (pais, parsear_entradas(lineas_pais, pais, anio, vocabulario, matriz, reportes))
        for pais, lineas_pais in crudos
    ]

    salida = armar_md(args.mes, editorial, paises, seguimiento)

    total = sum(len(e) for _, e in paises)
    print(f"  {len(paises)} países, {total} entradas")
    for pais, entradas in paises:
        marca = "—" if not entradas else str(len(entradas))
        print(f"    {pais:12} {marca}")

    if reportes:
        plural = "cosa" if len(reportes) == 1 else "cosas"
        print(f"\n  {len(reportes)} {plural} para revisar:")
        for r in reportes:
            print(f"    · {r}")

    if args.dry_run:
        print("\n" + "─" * 72)
        print(salida)
        return 0

    destino = args.salida
    if destino is None:
        nombre_mes = MESES[int(args.mes[5:7]) - 1]
        destino = DESTINO / f"boletin-mensual-observatorio-legislativo-{nombre_mes}-{anio}.md"
    destino.parent.mkdir(parents=True, exist_ok=True)

    if destino.exists():
        respuesta = input(f"\n  {destino.name} ya existe. ¿Lo piso? [s/N] ").strip().lower()
        if respuesta not in ("s", "si", "sí"):
            print("  No escribí nada.")
            return 1

    destino.write_text(salida, encoding="utf-8")
    try:
        mostrar = destino.relative_to(RAIZ)
    except ValueError:
        # --salida puede apuntar afuera del repo (es cómodo para probar).
        mostrar = destino
    print(f"\n  Escrito: {mostrar}")
    print("  Revisalo antes de publicar, sobre todo los TODO si quedó alguno.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Aviso as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
