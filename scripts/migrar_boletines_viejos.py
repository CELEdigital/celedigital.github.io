#!/usr/bin/env python3
"""Pasa los boletines viejos (importados de WordPress) al formato nuevo.

    python3 scripts/migrar_boletines_viejos.py            # escribe ES y copia a EN
    python3 scripts/migrar_boletines_viejos.py --dry-run  # sólo reporta

Script de una sola vez. Los boletines de 2021 a febrero de 2026 llegaron al
sitio como un volcado del HTML de WordPress: un blob en base64 del mapa
interactivo, las tablas de totales y de temas desarmadas en renglones sueltos
(«ARGENTINA», «10», «BRASIL», «14»…) y la cronología como una tira de
`### **dd/mm**` sin los encabezados de país, que en WordPress eran pestañas y
se perdieron en la exportación. Las etiquetas quedaron pegadas al final de cada
párrafo en mayúsculas («… en línea. LIBERTAD DE EXPRESIÓN VIOLENCIA DE GÉNERO»).

Qué hace con cada archivo:

  1. Tira el blob, los totales y los porcentajes de temas: los reemplaza el
     shortcode `observatorio-mes`, que los calcula de los CSV.
  2. Convierte cada entrada en un registro de `paises` → `entradas`.
  3. Reconstruye el país de cada entrada. La cronología siempre siguió el orden
     alfabético de la matriz (Argentina, Brasil, …, Perú), así que alcanza con
     encontrar dónde empieza cada país: cada entrada vota por los países que
     sugieren sus enlaces (dominio, o que el link o el expediente estén en los
     CSV) y su texto, y una programación dinámica elige la asignación monótona
     que más votos junta. Las entradas sin ninguna pista quedan donde las
     ubica el orden; las que caen justo en un borde dudoso se reportan.
  4. Traduce las etiquetas viejas (texto libre, ~300 variantes) a los 17 slugs
     de data/etiquetas.yaml con la tabla ALIAS de abajo. Las que no tienen
     equivalente se descartan y se cuentan en el reporte.

Los boletines de febrero a mayo de 2021 tienen otro formato (listas con viñetas
bajo un encabezado por país, la fecha adentro de la prosa); también se
convierten, y las entradas cuya fecha no se puede leer del texto quedan sin
`fecha`.

Los archivos EN son copias idénticas de los ES (nunca se tradujeron), así que
se escribe el ES y se copia tal cual. Si un EN difiere del ES, no se toca.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from boletin_desde_doc import (  # noqa: E402
    RE_LINK,
    VERBOS_TIPO,
    elegir_link_de_expediente,
    escalar,
    leer_matriz,
    normalizar_exp,
    plegado_yaml,
    plegar,
)

RAIZ = Path(__file__).resolve().parent.parent
ES = RAIZ / "content" / "es" / "observatorio-legislativo"
EN = RAIZ / "content" / "en" / "observatorio-legislativo"

PAISES = ["Argentina", "Brasil", "Chile", "Colombia", "Ecuador",
          "Guatemala", "México", "Paraguay", "Perú"]

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

DESCRIPCION = ("Novedades de la actividad legislativa y regulatoria, decisiones "
               "judiciales y administrativas.")

# ── Etiquetas ─────────────────────────────────────────────────────────────
#
# Etiqueta vieja (plegada: sin acentos, minúsculas) → slug, o None para
# descartarla. Las variantes con errores de tipeo que aparecen en los
# archivos van también, para que el segmentador las reconozca como una unidad
# y no las parta en palabras sueltas.
#
# Criterio: se mapea cuando la etiqueta vieja cae claramente dentro de una de
# las 17. Desinformación, honor/difamación, acceso a internet, ciberseguridad y
# acoso no tienen casa en el vocabulario actual y se descartan (ver reporte).

ALIAS: dict[str, str | None] = {}


def _alias(slug: str | None, *nombres: str) -> None:
    for n in nombres:
        ALIAS[plegar(n)] = slug


_alias("libertad-de-expresion",
       "libertad de expresion", "libertad de expresión", "libertad",
       "libertad de informacion", "libertad de información",
       # Honor y difamación: son el caso clásico de conflicto con la libertad
       # de expresión y en el vocabulario nuevo no tienen etiqueta propia.
       "reputacion y honor", "honor y reputacion", "honor", "derecho al honor",
       "derecho a la honra", "buen nombre", "difamacion", "calumnia", "injuria",
       "calumnias e injurias", "calumnia e injuria", "imputaciones contra el honor",
       "delitos contra el honor", "acoso judicial", "persecucion judicial")
_alias("libertad-de-prensa",
       "libertad de prensa", "prensa", "libertad periodistica",
       "violencia contra periodistas", "violencia contra los periodistas",
       "violencia a periodistas", "violencia contra medios periodisticos",
       "proteccion de periodistas", "proteccion a periodistas",
       "seguridad periodistica", "secreto periodistico",
       "base de datos periodisticos", "datos periodisticos",
       "regulacion de medios", "medios de comunicacion", "medios digitales",
       "medios periodisticos", "medios", "pluralidad informativa",
       "derechos de las audiencias")
_alias("acceso-a-la-informacion",
       "acceso a la informacion", "acesso a la informacion",
       "acceso a informacion publica", "transparencia", "gobierno abierto",
       "derechos de informacion", "transparencia algoritmica",
       "transparencia publicitaria")
_alias("proteccion-de-menores",
       "proteccion de menores", "proteccion a menores",
       "proteccion de ninos, ninas y adolescentes", "proteccion infantil",
       "derechos de los ninos", "derechos de menores", "grooming",
       "pornografia infantil")
_alias("inteligencia-artificial",
       "inteligencia artificial", "nteligencia artificial", "regulacion de la ia",
       "regulacion ia", "deepfakes")
_alias("violencia-de-genero",
       "violencia de genero", "genero", "violencia politica",
       "paridad de genero", "igualdad de genero", "enfoque de genero")
_alias("discurso-de-odio",
       "discurso de odio", "discursos de odio", "discriminacion", "discrmiacion",
       "discrmiancion", "discrimiancion", "discrmination", "discrminacion",
       "no discrminacion", "igualdad y no discriminacion",
       "igualdad y no discrimiancion", "apologia", "negacionismo", "racismo",
       "apologia crimenes de lesa humanidad")
_alias("plataformas-digitales",
       "plataformas digitales", "plataformas difitales", "redes sociales",
       "moderacion de contenidos", "moderacion de contenido",
       "responsabilidad de intermediarios", "control de contenidos",
       "proveedores de redes sociales", "deplatforming",
       "regulacion de plataformas", "servicios digitales",
       "eliminacion de contenidos", "regulacion de contenidos",
       "regulacion de contenido")
_alias("censura", "censura")
_alias("privacidad",
       "privacidad", "privacidad digital", "datos personales",
       "proteccion de datos", "proteccion de datos personales",
       "proteccion datos informaticos", "vida privada", "intimidad",
       "derecho al olvido", "datos sensibles", "datos biometricos",
       "autodeterminacion informativa", "identidad digital", "datos digitales")
_alias("protesta",
       "derecho a la protesta", "protesta social", "protestas",
       "criminalizacion de la protesta", "criminalizacion de la movilizacion",
       "reunion y asociacion", "libertad de asociacion")
_alias("vigilancia",
       "vigilancia", "espionaje", "ciberpatrullaje", "inteligencia criminal",
       "tecnologias de vigilancia", "inteligencia y contrainteligencia",
       "inteligencia contrainteligencia", "sistema de inteligencia",
       "inteligencia")
_alias("propiedad-intelectual", "propiedad intelectual", "derechos de autor")
_alias("publicidad-oficial", "publicidad oficial", "comunicaciones oficiales")
_alias("defensa-del-consumidor",
       # «Publicidad» a secas es casi siempre publicidad comercial (apuestas,
       # sobre todo). El boletín de agosto de 2026 ya etiqueta así la
       # resolución sobre publicidad de juego en línea.
       "publicidad", "consumidor", "derechos del consumidor",
       "proteccion al consumidor", "proteccion de consumidores",
       "proteccion de los consumidores", "prevencion contra la ludopatia",
       "prevencion de ludopatia", "regulacion de apuestas", "comercio electronico",
       "fraude financiero")
_alias("electoral",
       "electoral", "elecciones", "libertad electoral", "libertad de electoral",
       "publicidad electoral", "desinformacion electoral", "reforma electoral",
       "procesos electorales", "voto electronico", "codigo electoral",
       "consulta popular", "derechos politicos", "violencia en linea")
_alias("accesibilidad", "accesibilidad", "discapacidad")

# Sin equivalente: se reconocen para no romper la segmentación, pero se tiran.
_alias(None,
       "desinformacion", "fake news", "acceso a internet", "conectividad",
       "neutralidad de red", "neutralidad de la red", "brecha digital",
       "inclusion digital", "inclusion", "internet", "telecomunicaciones",
       "ciberseguridad", "ciberdelitos", "ciberdelito", "ciberdelincuencia",
       "delitos informaticos", "crimen digital", "hostigamiento digital",
       "hostigamiento", "acoso", "acoso sexual", "acoso cibernetico", "ciberacoso",
       "amenazas", "violencia digital", "violencia", "imagenes no consentidas",
       "nuevas tecnologias", "tecnologias", "tecnologia", "regulacion",
       "regulacion de tecnologias", "regulacion de tecnologia",
       "regulacion tecnologica", "regulacion digital", "tecnologias de la informacion",
       "legislacion", "legislacion digital", "gobierno digital", "gobernanza digital",
       "transformacion digital", "derechos digitales", "derechos humanos digitales",
       "competencia digital", "alfabetizacion digital", "seguridad nacional",
       "seguridad", "orden publico", "terrorismo", "terrorismo de estado",
       "moral publica", "pornografia", "libertad de culto", "libertad de cultos",
       "libertad religiosa", "objecion de conciencia", "derechos humanos",
       "proteccion de derechos humanos", "proteccion de los derechos humanos",
       "proteccion derechos humanos", "defensa de los derechos humanos",
       "memoria", "memoria historica", "democracia", "codigo penal",
       "administracion de justicia", "acceso a la justicia",
       "procedimientos judiciales", "justicia", "cooperacion internacional",
       "identidad", "identidad de genero", "libertad sexual", "pandemia",
       "covid-19", "salud", "educacion sexual", "educacion sexual integral",
       "acceso a la educacion", "corrupcion", "inversiones", "actualidad",
       "derechos civiles", "deberes funcionarios publicos", "funcionarios publicos",
       "monumentos historicos", "derecho a la cultura", "militarizacion",
       "zonas restringidas", "fronteras", "sector publico",
       "infraestructuras criticas", "empleo", "compliance", "congreso",
       "agenda legislativa", "fondos publicos", "igualdad de los indigenas",
       "derechos de los indigenas", "participacion ciudadana", "interes publico",
       "proteccion laboral", "derechos fundamentales", "regulacion ia",
       "derechos laborales")

MAX_ETIQUETAS = 3

# Entradas revisadas a mano: sin pistas, o con pistas engañosas (un medio
# argentino que cubre Ecuador, etc.). (archivo, comienzo del texto plegado)
# → país. El comienzo alcanza con que sea único dentro del archivo.
FIJADAS = {
    ("marzo-2022-3", "**el gobierno anuncio un acuerdo"): "Argentina",
    ("agosto-2023-cloned", "la comision interamericana de derechos humanos [otorgo]"): "Ecuador",
    # «…que establece el control, la transparencia y la rendición de cuentas de
    # las organizaciones sin fines de lucro» es la ley de ONG de Paraguay
    # (AMR 45 es el código de Amnistía para Paraguay).
    ("agosto-2024", "amnistia internacional llamo a la"): "Paraguay",
    ("enero-2023", "el colegio de periodistas [rechaza]"): "Chile",
    ("junio-2022", "[la corte suprema revoco]"): "Argentina",
    ("junio-2022", "el actual congreso termino su ultimo periodo"): "Colombia",
    ("junio-2023", "se cerro el primer ano de trabajo del actual congreso"): "Colombia",
    ("junio-2024", "el gobierno lanzo una campana para que sea obligatoria"): "Argentina",
    ("noviembre-2025", "se presentaron diversas iniciativas con la intencion de sancionar"): "México",
}

# ── País: pistas ──────────────────────────────────────────────────────────

TLD = {".ar": "Argentina", ".br": "Brasil", ".cl": "Chile", ".co": "Colombia",
       ".ec": "Ecuador", ".gt": "Guatemala", ".mx": "México", ".py": "Paraguay",
       ".pe": "Perú"}

# Dominios genéricos (.com/.org) que en estos boletines son de un solo país.
DOMINIOS = {
    "clarin.com": "Argentina", "diariojudicial.com": "Argentina",
    "jota.info": "Brasil", "uol.com.br": "Brasil", "globo.com": "Brasil",
    "latercera.com": "Chile", "emol.com": "Chile", "ciperchile.cl": "Chile",
    "elespectador.com": "Colombia", "eltiempo.com": "Colombia",
    "semana.com": "Colombia", "congresovisible.uniandes.edu.co": "Colombia",
    "eluniverso.com": "Ecuador", "elcomercio.com": "Ecuador",
    "expreso.ec": "Ecuador",
    "prensalibre.com": "Guatemala", "plazapublica.com.gt": "Guatemala",
    "animalpolitico.com": "México", "eluniversal.com.mx": "México",
    "proceso.com.mx": "México", "jornada.com.mx": "México",
    "articulo19.org": "México", "r3d.mx": "México",
    "ultimahora.com": "Paraguay", "abc.com.py": "Paraguay",
    "ipys.org": "Perú", "larepublica.pe": "Perú", "elcomercio.pe": "Perú",
}

# Pistas en la prosa. Peso 1 cada una (los enlaces pesan 2): los textos a
# veces mencionan otro país de pasada.
PISTAS_TEXTO = {
    "Argentina": r"argentin|\bhcdn\b|de la nacion argentina|\bmill?ei\b|\bcsjn\b|kirchner|"
                 r"buenos aires|\brosario\b|la rioja|lopez murphy|larreta|bullrich|\byeza\b|"
                 r"\bcaba\b|\bmendoza\b|santa fe|politicas de genero y diversidad|"
                 r"boletin oficial de la republica argentina",
    "Brasil": r"brasil|\bstf\b|supremo tribunal federal|tribunal supremo federal|"
              r"\bbolsonaro\b|\blula\b|\bmoraes\b|\banatel\b|\banpd\b|\([a-z]+/[a-z]{2}\)|"
              r"diputad[oa] federal|\bsao paulo\b|\btse\b|rio de janeiro",
    "Chile": r"\bchile|\bboric\b|\bkast\b|\bcplt\b|valparaiso|carabineros",
    "Colombia": r"colombia|\bpetro\b|\bflip\b|camara de representantes|"
                r"corte constitucional\b|\bmintic\b|\bbogota\b|centro democratico|"
                r"inexequible|procuraduria general de la nacion|"
                r"departamento administrativo de seguridad|\bmedellin\b",
    "Ecuador": r"ecuador|ecuatorian|\bfundamedios\b|\bnoboa\b|\blasso\b|asamblea nacional|"
               r"\bquito\b|guayaquil|cotopaxi|pujili",
    "Guatemala": r"guatemal|\barevalo\b|giammattei|corte de constitucionalidad|"
                 r"soy502|ruben zamora|elperiodico",
    "México": r"mexic|\bmorena\b|\bamlo\b|lopez obrador|sheinbaum|\binai\b|"
              r"congreso de la union|instituto nacional de transparencia|diario oficial de la federacion|\bscjn\b|"
              r"\bpuebla\b|jalisco|nuevo leon|oaxaca|veracruz|chihuahua|sinaloa|"
              r"tamaulipas|michoacan|vinculacion a proceso|impuesto especial sobre produccion",
    "Paraguay": r"paragua|asuncion",
    "Perú": r"\bperu|peruan|\bboluarte\b|\banp\b|\bipys\b|el peruano|"
            r"consejo de la prensa peruana|\blima\b|\bcusco\b|arequipa|\bcallao\b",
}

PISTAS_RUTA = {
    "Argentina": r"argentin", "Brasil": r"brasil|brazil", "Chile": r"\bchile|chilen",
    "Colombia": r"colombia", "Ecuador": r"ecuador|ecuatorian", "Guatemala": r"guatemal",
    "México": r"mexic|/mx_", "Paraguay": r"paragua", "Perú": r"\bperu",
}

RE_ENCABEZADO_FECHA = re.compile(
    r"^#{2,4}\s*\**\s*(\d{1,2})\s*[/.]\s*(\d{1,2})\s*\**\s*(.*)$")
RE_FECHA_EN_LINEA = re.compile(r"\*\*\s*(\d{1,2})/(\d{1,2})\s*\*\*")
RE_PAIS_ENCABEZADO = re.compile(
    r"^(?:#{2,4}\s*)?\**\s*(argentina|brasil|chile|colombia|ecuador|guatemala|"
    r"mexico|paraguay|peru)\s*:?\s*\**\s*:?\s*$")

MAYUS = "A-ZÁÉÍÓÚÑÜÇÃÕÊÂ"
RE_PALABRA_MAYUS = re.compile(rf"[{MAYUS}][{MAYUS}0-9\-,]*|")


# ── Utilidades ────────────────────────────────────────────────────────────


def leer_csv_pais() -> tuple[dict[str, str], dict[str, str]]:
    """{link: país} y {expediente: país} de los CSV de la matriz."""
    por_link: dict[str, str] = {}
    por_exp: dict[str, str] = {}
    for nombre, col in (("proyectos_clean.csv", "N° de expediente"),
                        ("leyes_clean.csv", "N° de ley")):
        ruta = RAIZ / "static" / "data" / nombre
        if not ruta.exists():
            continue
        with ruta.open(encoding="utf-8-sig", newline="") as fh:
            for fila in csv.DictReader(fh):
                pais = (fila.get("País") or "").strip()
                if pais not in PAISES:
                    pais = {"Mexico": "México", "Peru": "Perú"}.get(pais, "")
                if not pais:
                    continue
                link = (fila.get("Link") or "").strip()
                if link:
                    por_link[link.rstrip("/")] = pais
                exp = (fila.get(col) or "").strip()
                if exp:
                    por_exp[exp] = pais
    return por_link, por_exp


def separar_cola(texto: str) -> tuple[str, list[str], list[str]]:
    """Separa la cola de etiquetas en mayúsculas del final del texto.

    Devuelve (texto sin la cola, slugs, etiquetas descartadas).
    """
    # Se recorre de atrás para adelante palabra por palabra (una regex con
    # cuantificadores anidados hacía backtracking catastrófico en párrafos
    # largos).
    texto = re.sub(r"(\s*#+)+\s*(?=[A-ZÁÉÍÓÚÑ]+(\s|$))", " ", texto).replace("\u200b", "")
    palabras = texto.rstrip().split(" ")
    k = len(palabras)
    while k > 0 and RE_PALABRA_MAYUS.fullmatch(palabras[k - 1]):
        k -= 1
    if k == len(palabras):
        return texto, [], []
    antes = " ".join(palabras[:k])
    cola = " ".join(palabras[k:]).strip()
    # Una sigla suelta al final («… informó la CNE») no es una etiqueta: tiene
    # que empezar con una palabra que el vocabulario conozca.
    plegada = plegar(cola).replace(",", " ")
    plegada = re.sub(r"\s+", " ", plegada).strip()
    nombres = sorted(ALIAS, key=len, reverse=True)
    if not any(plegada.startswith(n) for n in nombres):
        return texto, [], []

    slugs: list[str] = []
    descartadas: list[str] = []
    resto = plegada
    while resto:
        for n in nombres:
            if resto == n or resto.startswith(n + " "):
                slug = ALIAS[n]
                if slug is None:
                    descartadas.append(n)
                elif slug not in slugs:
                    slugs.append(slug)
                resto = resto[len(n):].strip()
                break
        else:
            palabra, _, resto = resto.partition(" ")
            descartadas.append(palabra)
            resto = resto.strip()
    return antes.rstrip(), slugs, descartadas


def pistas(texto: str, links: list[str], exp: str, por_link, por_exp) -> Counter:
    votos: Counter = Counter()
    for url in links:
        limpio = url.strip().rstrip("/")
        if limpio in por_link:
            votos[por_link[limpio]] += 3
            continue
        host = (urlparse(limpio).hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        for dom, pais in DOMINIOS.items():
            if host == dom or host.endswith("." + dom):
                votos[pais] += 2
                break
        else:
            for tld, pais in TLD.items():
                if host.endswith(tld):
                    votos[pais] += 2
                    break
    # El país en el dominio o la ruta del enlace («paraguaydigital.com»,
    # «elpais.com/mexico/…», «x.com/Mx_Diputados»).
    for url in links:
        partes = urlparse(url.strip())
        ruta = plegar((partes.hostname or "") + partes.path)
        for pais, patron in PISTAS_RUTA.items():
            if re.search(patron, ruta):
                votos[pais] += 1
    if exp and exp in por_exp:
        votos[por_exp[exp]] += 1
    plano = plegar(RE_LINK.sub(r"\1", texto))
    for pais, patron in PISTAS_TEXTO.items():
        if re.search(patron, plano):
            votos[pais] += 1
    return votos


def orden_de_paises(entradas: list[dict]) -> list[str]:
    """El orden en que aparecen los países en este boletín.

    No es fijo: hasta 2024 es casi siempre alfabético, pero desde 2025 Brasil
    va anteúltimo y Paraguay sube después de Chile. Se deduce de la mediana
    de la posición de las entradas con una pista fuerte (un enlace) de cada
    país, así que una entrada que menciona otro país de pasada no lo mueve.
    """
    posiciones: dict[str, list[int]] = {}
    for i, e in enumerate(entradas):
        if e["votos"]:
            pais, n = e["votos"].most_common(1)[0]
            if n >= 2:
                posiciones.setdefault(pais, []).append(i)
    mediana = {p: sorted(v)[len(v) // 2] for p, v in posiciones.items()}
    return sorted(mediana, key=lambda p: (mediana[p], PAISES.index(p)))


def asignar_paises(entradas: list[dict], orden: list[str]) -> list[str]:
    """Asignación monótona (en `orden`) que maximiza los votos.

    Cada país ocupa un tramo contiguo. Una entrada con pistas de un país
    distinto al de su tramo pierde: casi siempre es una mención de pasada
    («una ley similar a la argentina») o un medio que cubre varios países.
    """
    if not orden:
        return ["" for _ in entradas]
    n, k = len(entradas), len(orden)
    NEG = float("-inf")
    mejor = [[NEG] * k for _ in range(n)]
    desde = [[0] * k for _ in range(n)]
    for c in range(k):
        mejor[0][c] = entradas[0]["votos"].get(orden[c], 0)
    for i in range(1, n):
        prefijo, arg = NEG, 0
        for c in range(k):
            if c > 0 and mejor[i - 1][c - 1] > prefijo:
                prefijo, arg = mejor[i - 1][c - 1], c - 1
            if mejor[i - 1][c] >= prefijo:
                mejor[i][c], desde[i][c] = mejor[i - 1][c], c
            else:
                mejor[i][c], desde[i][c] = prefijo, arg
            mejor[i][c] += entradas[i]["votos"].get(orden[c], 0)
    c = max(range(k), key=lambda j: mejor[n - 1][j])
    camino = [c]
    for i in range(n - 1, 0, -1):
        c = desde[i][c]
        camino.append(c)
    return [orden[c] for c in camino[::-1]]


def fecha_de(dia: int, mes: int, anio_bol: int, mes_bol: int) -> str:
    """La cronología de un boletín trae el mes y, a veces, el anterior."""
    anio = anio_bol
    if mes - mes_bol > 2:  # boletín de enero con entradas de diciembre
        anio -= 1
    try:
        return date(anio, mes, dia).isoformat()
    except ValueError:
        return ""


RE_FECHA_PROSA = [
    re.compile(r"\b(\d{1,2})\s+de\s+(" + "|".join(MESES) + r")\b"),
    re.compile(r"\b(\d{1,2})/(\d{1,2})\b"),
    re.compile(r"\b(\d{1,2})\.(\d{1,2})\.\d{4}\b"),
]


def fecha_en_prosa(texto: str) -> tuple[int, int] | None:
    plano = plegar(RE_LINK.sub(r"\1", texto))[:160]
    for i, patron in enumerate(RE_FECHA_PROSA):
        m = patron.search(plano)
        if m:
            dia = int(m.group(1))
            mes = MESES.index(m.group(2)) + 1 if i == 0 else int(m.group(2))
            if 1 <= dia <= 31 and 1 <= mes <= 12:
                return dia, mes
    return None


# ── Parseo ────────────────────────────────────────────────────────────────


def partir(texto: str) -> tuple[list[str], str]:
    lineas = texto.split("\n")
    assert lineas[0] == "---"
    fin = lineas.index("---", 1)
    return lineas[1:fin], "\n".join(lineas[fin + 1:])


def es_ruido(parrafo: str) -> bool:
    """Restos de las tablas de WordPress y del mapa."""
    p = parrafo.strip()
    if not p:
        return True
    if re.fullmatch(r"[\d.,%\s\-–—]+", p):
        return True
    if re.fullmatch(r"\*\*[^*]+\*\*(\s*\d+\s*proyectos?)?", p, re.I):
        return True
    if p.isupper() and len(p) < 40:
        return True
    # Nombre de tema de la tabla de porcentajes («Acceso a la información»).
    if len(p) < 70 and not re.search(r"[.:;\[\]]", p):
        return True
    if re.search(r"[A-Za-z0-9+/]{120,}", p):
        return True
    if re.search(r"\d+([.,]\d+)?\s*%$", p) and len(p) < 90:
        return True
    # Tabla de temas de junio 2021: «PROPIEDAD INTELECTUAL 10% RESPONSABILIDAD 10% …»
    if len(re.findall(r"\d+\s*%", p)) >= 3:
        return True
    return False


def parrafos(texto: str) -> list[str]:
    bloques, actual = [], []
    for linea in texto.split("\n"):
        if linea.strip():
            actual.append(linea.strip())
        elif actual:
            bloques.append(actual)
            actual = []
    if actual:
        bloques.append(actual)
    salida = []
    for b in bloques:
        salida.append(" ".join(re.sub(r"^[*\-]\s+", "", l) if i else l
                               for i, l in enumerate(b)))
    return salida


RE_CIERRE = re.compile(r"^(agradecemos|ademas incluimos|equipo del observatorio)", re.I)


def entradas_con_fecha(cuerpo: str) -> tuple[list[dict], list[str], list[str]]:
    """Formato 2021–2026: `### **dd/mm**` y un párrafo (o varios)."""
    # julio-2024 trae todo en una sola línea con `**dd/mm**` intercalado.
    if not any(RE_ENCABEZADO_FECHA.match(l.strip()) for l in cuerpo.split("\n")):
        cuerpo = RE_FECHA_EN_LINEA.sub(lambda m: f"\n\n### {m.group(1)}/{m.group(2)}\n\n", cuerpo)
    lineas = cuerpo.split("\n")
    entradas: list[dict] = []
    preambulo: list[str] = []
    cierre: list[str] = []
    actual: list[str] | None = None

    def cerrar():
        if actual is None:
            return
        ps = parrafos("\n".join(actual["lineas"]))
        texto_ps = []
        for p in ps:
            if RE_CIERRE.match(plegar(p)):
                cierre.append(p)
            else:
                texto_ps.append(p)
        actual["texto"] = " ".join(texto_ps).strip()
        entradas.append(actual)

    for linea in lineas:
        # «### **24****/11**», «### **26/10 **»: la negrita de WordPress viene
        # partida de cualquier manera, así que se saca antes de comparar.
        m = RE_ENCABEZADO_FECHA.match(linea.replace("*", "").strip())
        if re.fullmatch(r"\s*#+\s*", linea):
            continue  # encabezados vacíos
        if m:
            cerrar()
            actual = {"dia": int(m.group(1)), "mes": int(m.group(2)),
                      "lineas": [m.group(3)] if m.group(3) else []}
            continue
        if actual is None:
            preambulo.append(linea)
        else:
            # Líneas `* ` de sub-viñetas: se aplanan dentro del párrafo.
            actual["lineas"].append(re.sub(r"^\s*\*\s+", "", linea) if linea.strip().startswith("* ") else linea)
    cerrar()
    return entradas, [p for p in parrafos("\n".join(preambulo)) if not es_ruido(p)], cierre


def entradas_con_vinetas(cuerpo: str) -> tuple[list[dict], list[str], list[str]]:
    """Formato de febrero–mayo 2021: `**País**` y viñetas."""
    # Algunos traen el primer país pegado al final del párrafo de apertura.
    cuerpo = re.sub(r"\s(\*\*(?:Argentina)\*\*)\s*$", r"\n\n\1\n", cuerpo, flags=re.M)
    entradas: list[dict] = []
    intro: list[str] = []
    cierre: list[str] = []
    pais = None
    for linea in cuerpo.split("\n"):
        s = linea.strip()
        if not s:
            continue
        m = RE_PAIS_ENCABEZADO.match(plegar(s))
        if m:
            pais = next(p for p in PAISES if plegar(p) == m.group(1))
            continue
        if s.startswith("* ") and pais:
            entradas.append({"pais": pais, "texto": s[2:].strip()})
        elif pais and entradas and not RE_CIERRE.match(plegar(s)) and not s.startswith("#"):
            entradas[-1]["texto"] += " " + s
        elif RE_CIERRE.match(plegar(s)):
            cierre.append(s)
        elif s.startswith("#"):
            titulo = s.lstrip("#").strip().strip("*").strip()
            if titulo and not plegar(titulo).startswith(("observatorio legislativo", "boletin mensual")):
                intro.append(f"## {titulo}")
        else:
            intro.append(s)
    return entradas, intro, cierre


# ── Conversión ────────────────────────────────────────────────────────────


def convertir(ruta: Path, matriz, por_link, por_exp, rep: list[str], stats: Counter) -> str | None:
    texto = ruta.read_text(encoding="utf-8")
    fm, cuerpo = partir(texto)
    if any(l.startswith("paises:") for l in fm):
        return None

    titulo = next((l for l in fm if l.startswith("title:")), "")
    m = re.search(r"(" + "|".join(MESES) + r")\s*(\d{4})", plegar(titulo))
    if not m:
        rep.append(f"{ruta.name}: no pude leer el mes del título.")
        return None
    mes_bol, anio_bol = MESES.index(m.group(1)) + 1, int(m.group(2))

    if any(RE_ENCABEZADO_FECHA.match(l.replace("*", "").strip()) for l in cuerpo.split("\n")) \
            or RE_FECHA_EN_LINEA.search(cuerpo):
        entradas, intro, cierre = entradas_con_fecha(cuerpo)
        con_fecha = True
    else:
        entradas, intro, cierre = entradas_con_vinetas(cuerpo)
        con_fecha = False

    if not entradas:
        rep.append(f"{ruta.name}: no encontré entradas.")
        return None
    matriz_set = set(matriz)

    for e in entradas:
        # WordPress dejó el espacio adentro del corchete: «el[ Proyecto](…)».
        e["texto"] = re.sub(r"(\S)?\[\s+", lambda m: (m.group(1) + " " if m.group(1) else "") + "[", e["texto"])
        e["texto"] = re.sub(r"\s+", " ", e["texto"]).strip()
        # Enlaces rotos de la exportación: queda el texto, sin el link.
        e["texto"] = re.sub(r"\[([^\]]*)\]\(about:blank\)", r"\1", e["texto"])
        texto_e, slugs, descartadas = separar_cola(e["texto"])
        e["texto"] = texto_e
        e["etiquetas"] = slugs[:MAX_ETIQUETAS]
        stats["etiquetas-descartadas"] += len(descartadas)
        for d in descartadas:
            stats["descartada:" + d] += 1
        if len(slugs) > MAX_ETIQUETAS:
            stats["recortadas-a-3"] += 1

        link, es_exp = elegir_link_de_expediente(e["texto"])
        e["url"] = link.group(2).strip() if link else ""
        e["exp"] = normalizar_exp(link.group(1), matriz) if es_exp else ""
        # `exp` está para que el build verifique contra la matriz. En los
        # boletines viejos muchos expedientes nunca entraron a la planilla, y
        # escribirlos igual dejaría cientos de avisos permanentes en cada
        # build, tapando los que importan. Sólo se escribe si está.
        if e["exp"] and e["exp"] not in matriz_set:
            e["exp"] = ""
        if link:
            ini, fin = link.span()
            e["texto"] = f"{e['texto'][:ini]}[{link.group(1)}]($url){e['texto'][fin:]}"

        e["tipo"] = ""
        for patron, valor in VERBOS_TIPO:
            if re.search(patron, plegar(e["texto"])):
                e["tipo"] = valor
                break

        if con_fecha:
            e["fecha"] = fecha_de(e["dia"], e["mes"], anio_bol, mes_bol)
        else:
            dm = fecha_en_prosa(e["texto"])
            e["fecha"] = fecha_de(dm[0], dm[1], anio_bol, mes_bol) if dm else ""
            if not e["fecha"]:
                stats["sin-fecha"] += 1

        links = [u for _, u in RE_LINK.findall(e["texto"].replace("$url", e["url"]))]
        e["votos"] = pistas(e["texto"], links, e["exp"], por_link, por_exp)

    if con_fecha:
        orden = orden_de_paises(entradas)
        camino = asignar_paises(entradas, orden)
        for i, (e, c) in enumerate(zip(entradas, camino)):
            e["pais"] = c
            # Una pista fuerte gana a la posición cuando la posición no tiene
            # ninguna: pasa con entradas que en el original estaban fuera de
            # lugar (Bullrich abriendo el boletín de octubre de 2022, antes
            # que el resto de Argentina).
            for (archivo, comienzo), pais in FIJADAS.items():
                if archivo in ruta.name and plegar(e["texto"]).startswith(comienzo):
                    e["pais"] = pais
                    e["fijada"] = True
                    stats["fijadas-a-mano"] += 1
            if e.get("fijada"):
                continue
            if e["votos"]:
                arriba, n = e["votos"].most_common(1)[0]
                if n >= 2 and not e["votos"].get(c):
                    rep.append(f"{ruta.name}: {e['fecha']} movida de {c} a {arriba} por sus pistas — "
                               f"«{plegar(e['texto'])[:70]}…»")
                    e["pais"] = arriba
                    stats["reubicadas"] += 1
            v = e["votos"]
            if v and v.most_common(1)[0][1] >= 2 and v.most_common(1)[0][0] != e["pais"] \
                    and v.get(e["pais"], 0) < v.most_common(1)[0][1]:
                rep.append(f"{ruta.name}: {e['fecha']} quedó en {e['pais']} pero las pistas dicen "
                           f"{v.most_common(1)[0][0]} — «{plegar(e['texto'])[:70]}…»")
                stats["contradicen"] += 1
            if not v:
                prev_ = entradas[i - 1]["pais"] if i else None
                sig = camino[i + 1] if i + 1 < len(camino) else None
                if prev_ != e["pais"] or (sig and sig != e["pais"]):
                    rep.append(f"{ruta.name}: {e['fecha']} sin pistas, en un borde entre países; "
                               f"lo dejé en {e['pais']} — «{plegar(e['texto'])[:70]}…»")
                    stats["borde-dudoso"] += 1
                stats["sin-pistas"] += 1

    stats["entradas"] += len(entradas)
    stats["archivos"] += 1

    # ── front matter ──
    salida_fm: list[str] = []
    i = 0
    while i < len(fm):
        linea = fm[i]
        if linea.startswith("description:"):
            bloque = [linea]
            while i + 1 < len(fm) and fm[i + 1].startswith("  "):
                i += 1
                bloque.append(fm[i])
            valor = " ".join(l.strip() for l in bloque)[len("description:"):].strip()
            if re.search(r"[A-Za-z0-9+/]{60,}", valor) or len(valor) > 400:
                salida_fm.append("description: " + DESCRIPCION)
            else:
                salida_fm.extend(bloque)
        else:
            salida_fm.append(linea)
        i += 1

    salida_fm.append("")
    salida_fm.append("paises:")
    vistos = list(dict.fromkeys(e["pais"] for e in entradas))
    for pais in vistos:
        del_pais = [e for e in entradas if e["pais"] == pais]
        if not del_pais:
            continue
        salida_fm.append(f"  - pais: {pais}")
        salida_fm.append("    entradas:")
        for j, e in enumerate(del_pais):
            if j:
                salida_fm.append("")
            primera = True

            def campo(txt):
                nonlocal primera
                salida_fm.append(("      - " if primera else "        ") + txt)
                primera = False

            if e["fecha"]:
                campo(f"fecha: {e['fecha']}")
            if e["tipo"]:
                campo(f"tipo: {e['tipo']}")
            if e["exp"]:
                campo(f"exp: {escalar(e['exp'])}")
            if e["url"]:
                campo(f"url: {escalar(e['url']) if ' ' in e['url'] else e['url']}")
            campo("texto: " + plegado_yaml(e["texto"], 10))
            if e["etiquetas"]:
                campo("etiquetas:")
                for s in e["etiquetas"]:
                    salida_fm.append(f"          - {s}")
        salida_fm.append("")
    while salida_fm[-1] == "":
        salida_fm.pop()

    # ── cuerpo ──
    partes: list[str] = []
    for p in intro:
        # La apertura genérica («Observatorio Legislativo CELE Novedades de…»)
        # repite la descripción y no dice nada.
        if plegar(p).startswith(("observatorio legislativo cele", "novedades de la actividad")) \
                and len(p) < 200:
            continue
        if re.match(r"^\*\*_?boletin mensual", plegar(p)):
            continue
        partes.append(p)
    partes.append(f'{{{{< observatorio-mes month="{anio_bol}-{mes_bol:02d}" >}}}}')
    partes.append("{{< boletin-paises >}}")
    for p in cierre:
        if plegar(p).startswith("ademas incluimos"):
            continue  # habla de un gráfico que ya no está
        partes.append(p)

    return "---\n" + "\n".join(salida_fm) + "\n---\n\n" + "\n\n".join(partes) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("archivos", nargs="*", help="sólo estos (nombre del .md en ES)")
    args = ap.parse_args()

    matriz = leer_matriz()
    por_link, por_exp = leer_csv_pais()
    rep: list[str] = []
    stats: Counter = Counter()

    rutas = sorted(ES.glob("boletin-mensual-*.md"))
    if args.archivos:
        rutas = [r for r in rutas if r.name in args.archivos]

    for ruta in rutas:
        nuevo = convertir(ruta, matriz, por_link, por_exp, rep, stats)
        if nuevo is None:
            continue
        gemelo = EN / ruta.name
        copiar_en = gemelo.exists() and gemelo.read_bytes() == ruta.read_bytes()
        if not args.dry_run:
            ruta.write_text(nuevo, encoding="utf-8")
            if copiar_en:
                gemelo.write_text(nuevo, encoding="utf-8")
        if gemelo.exists() and not copiar_en:
            rep.append(f"{ruta.name}: el EN difiere del ES, no lo toqué.")

    print("\n".join(rep))
    print()
    for clave in ("archivos", "entradas", "fijadas-a-mano", "reubicadas", "sin-pistas", "borde-dudoso", "contradicen",
                  "sin-fecha", "etiquetas-descartadas", "recortadas-a-3"):
        print(f"{clave:>24}: {stats[clave]}")
    print("\nEtiquetas descartadas más frecuentes:")
    for k, v in sorted(((k, v) for k, v in stats.items() if k.startswith("descartada:")),
                       key=lambda kv: -kv[1])[:25]:
        print(f"  {v:4}  {k[11:]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
