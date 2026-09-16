#!/usr/bin/env bash
# Builds the SwarmOps Cloud academic documents.
#
#   docs/academic/build.sh [--schema-dsn-container NAME]
#
# 1. Renders every PlantUML diagram to PNG and SVG (diagrams/out).
# 2. Optionally re-exports the schema from a running MariaDB container and
#    regenerates the data dictionary and entity-relationship diagrams.
# 3. Converts each Markdown document in en/ and fa/ to Word and PDF
#    (dist/en, dist/fa). Persian PDFs use xepersian with the Vazirmatn font and
#    the ltr-runs filter, which keeps Latin phrases in reading order.
#
# Requirements: pandoc 3, XeLaTeX with xepersian, Java, python3.
# PLANTUML_JAR and VAZIRMATN_DIR point at the PlantUML jar and at Vazirmatn's
# fonts/ttf directory; both are downloaded when unset.
set -euo pipefail

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cache="${ACADEMIC_CACHE_DIR:-${TMPDIR:-/tmp}/swarmops-academic}"
schema_container=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --schema-dsn-container) schema_container="$2"; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

for command in pandoc xelatex java python3; do
  command -v "$command" >/dev/null 2>&1 || { echo "$command is required" >&2; exit 1; }
done
kpsewhich xepersian.sty >/dev/null || { echo "the xepersian LaTeX package is required" >&2; exit 1; }

mkdir -p "$cache"
if [[ -z "${PLANTUML_JAR:-}" ]]; then
  PLANTUML_JAR="$cache/plantuml-1.2026.8.jar"
  [[ -s "$PLANTUML_JAR" ]] || curl -fsSL -o "$PLANTUML_JAR" https://github.com/plantuml/plantuml/releases/download/v1.2026.8/plantuml.jar
fi
if [[ -z "${VAZIRMATN_DIR:-}" ]]; then
  VAZIRMATN_DIR="$cache/vazirmatn/fonts/ttf"
  if [[ ! -s "$VAZIRMATN_DIR/Vazirmatn-Regular.ttf" ]]; then
    curl -fsSL -o "$cache/vazirmatn.zip" https://github.com/rastikerdar/vazirmatn/releases/download/v33.003/vazirmatn-v33.003.zip
    unzip -oq "$cache/vazirmatn.zip" -d "$cache/vazirmatn"
  fi
fi

if [[ -n "$schema_container" ]]; then
  echo "== exporting the schema from $schema_container"
  query() { docker exec "$schema_container" mariadb -uroot -p"${MARIADB_ROOT_PASSWORD:-devroot}" -N -B -e "$1"; }
  query "SELECT c.TABLE_NAME, c.ORDINAL_POSITION, c.COLUMN_NAME, c.COLUMN_TYPE, c.IS_NULLABLE, COALESCE(c.COLUMN_KEY,''), COALESCE(c.COLUMN_DEFAULT,''), c.EXTRA,
    COALESCE((SELECT CONCAT(k.REFERENCED_TABLE_NAME,'.',k.REFERENCED_COLUMN_NAME) FROM information_schema.KEY_COLUMN_USAGE k WHERE k.TABLE_SCHEMA=c.TABLE_SCHEMA AND k.TABLE_NAME=c.TABLE_NAME AND k.COLUMN_NAME=c.COLUMN_NAME AND k.REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1),'')
    FROM information_schema.COLUMNS c JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME AND t.TABLE_TYPE='BASE TABLE'
    WHERE c.TABLE_SCHEMA='swarmops' ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION" > "$here/generated/schema-columns.tsv"
  query "SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='swarmops' ORDER BY TABLE_NAME, CONSTRAINT_NAME" > "$here/generated/schema-foreign-keys.tsv"
  query "SELECT TABLE_NAME, CONSTRAINT_NAME, CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='swarmops' ORDER BY TABLE_NAME, CONSTRAINT_NAME" > "$here/generated/schema-checks.tsv"
fi
python3 "$here/tools/schema_docs.py"

echo "== rendering diagrams"
mkdir -p "$here/diagrams/out"
java -Djava.awt.headless=true -jar "$PLANTUML_JAR" -tpng -o "$here/diagrams/out" "$here"/diagrams/*.puml
java -Djava.awt.headless=true -jar "$PLANTUML_JAR" -tsvg -o "$here/diagrams/out" "$here"/diagrams/*.puml

fa_header="$cache/fa-header.tex"
sed "s#VAZIRMATN_DIR#${VAZIRMATN_DIR%/}#g" "$here/templates/fa-header.tex" > "$fa_header"

common=(--standalone --toc --number-sections --metadata=lang:en)
latex=(--pdf-engine=xelatex -V documentclass=article -V classoption=titlepage -V papersize=a4 -V geometry:margin=2.4cm
  -V fontsize=11pt -V lof -V lot -V colorlinks -V linkcolor=blue -V urlcolor=blue -V toccolor=black)

build() {
  local lang="$1" source="$2"
  local name inputs
  name="$(basename "$source" .md)"
  inputs=("$source")
  if [[ "$name" == 05-database-design ]]; then
    inputs+=("$here/generated/data-dictionary-$lang.md")
  fi
  mkdir -p "$here/dist/$lang"
  if [[ "$lang" == fa ]]; then
    pandoc "${inputs[@]}" --standalone --toc --number-sections --resource-path="$here/$lang" \
      --lua-filter="$here/filters/ltr-runs.lua" -M dir=rtl -M lang=fa-IR -o "$here/dist/$lang/$name.docx"
    pandoc "${inputs[@]}" --standalone --toc --number-sections --resource-path="$here/$lang" \
      --lua-filter="$here/filters/ltr-runs.lua" -H "$fa_header" "${latex[@]}" -o "$here/dist/$lang/$name.pdf"
  else
    pandoc "${inputs[@]}" "${common[@]}" --resource-path="$here/$lang" -o "$here/dist/$lang/$name.docx"
    pandoc "${inputs[@]}" "${common[@]}" --resource-path="$here/$lang" "${latex[@]}" -o "$here/dist/$lang/$name.pdf"
  fi
  echo "built dist/$lang/$name.docx and .pdf"
}

for lang in en fa; do
  [[ -d "$here/$lang" ]] || continue
  for source in "$here/$lang"/[0-9][0-9]-*.md; do
    [[ -f "$source" ]] || continue
    build "$lang" "$source"
  done
done
