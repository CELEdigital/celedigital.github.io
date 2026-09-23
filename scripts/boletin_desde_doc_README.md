El código se corre contra la plantilla, que se baja como .md desde Google Docs. 

usage: boletin_desde_doc.py [-h] --mes MES [--salida SALIDA] [--dry-run] entrada

Convierte el documento de Drive del boletín en el .md del sitio.

positional arguments:
  entrada          El documento exportado desde Google Docs como Markdown (.md).

options:
  -h, --help       show this help message and exit
  --mes MES        Mes del boletín, en formato AAAA-MM (ej. 2026-07).
  --salida SALIDA  Dónde escribir. Por defecto, en content/es/observatorio-legislativo/.
  --dry-run        Imprime el resultado por pantalla en vez de escribir el archivo.

El .md que sale siempre hay que leerlo antes de publicar: el script ahorra la transcripción, no la
revisión.