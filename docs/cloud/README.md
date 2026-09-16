# SwarmOps Cloud — academic documents

The university project documentation for SwarmOps Cloud: a SQL-backed
platform-as-a-service with a customer storefront and an administration
console, built on SwarmOps. Every document exists in English (`en/`) and
Persian (`fa/`), as Markdown sources and as Word and PDF files in `dist/`.

| # | Document | Contents |
|---|---|---|
| 01 | Project Proposal | Problem, objectives, scope, method, schedule, risks |
| 02 | Software Requirements Specification | ISO/IEC/IEEE 29148 structure, use cases, traceability |
| 03 | C4 Architecture Model | Context, containers, components, code, dynamic and deployment views |
| 04 | Software Architecture Document | arc42 views, runtime scenarios, cross-cutting concepts, risks |
| 05 | Database Design | Conceptual to physical model, normalisation, constraints, query plans, data dictionary |
| 06 | API Reference | Storefront and commerce administration endpoints |
| 07 | Test Plan and Report | Strategy, results on MariaDB and MySQL, end-to-end run, defects |
| 08 | User Manual | Customers and administrators, with screenshots |
| 09 | Installation and Operations Guide | Development, production install, upgrade, backup, troubleshooting |

The architecture decision behind the storage change is
[ADR-0008](../adr/ADR-0008-sql-controller-state.md).

## Layout

| Path | What it holds |
|---|---|
| `en/`, `fa/` | Markdown sources |
| `diagrams/*.puml` | C4-PlantUML, sequence, state, use-case, Gantt and generated ER diagram sources; rendered to `diagrams/out/` |
| `screenshots/` | Pages of the running application, captured by `tools/screenshots.mjs` |
| `generated/` | Schema exports and the data dictionaries produced by `tools/schema_docs.py` |
| `filters/ltr-runs.lua` | Keeps Latin phrases, code and references in reading order inside Persian text |
| `templates/fa-header.tex` | XeLaTeX preamble for Persian PDFs (xepersian with Vazirmatn) |
| `dist/` | Built `.docx` and `.pdf` files |

## Building

```bash
docs/academic/build.sh --schema-dsn-container swarmops-mariadb
```

Requires pandoc 3, XeLaTeX with the `xepersian` package, Java and python3.
PlantUML and the Vazirmatn font (SIL Open Font License) are downloaded on
first use unless `PLANTUML_JAR` and `VAZIRMATN_DIR` point at local copies.
`--schema-dsn-container` re-exports the schema from a running development
database first; without it the committed exports in `generated/` are used.

Screenshots are re-captured against a running storefront and console with:

```bash
node docs/academic/tools/screenshots.mjs --base http://127.0.0.1:5284 \
  --customer-email … --customer-password … --operator-username admin --operator-password …
```
