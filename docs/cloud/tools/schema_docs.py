#!/usr/bin/env python3
"""Render the data dictionary and entity-relationship diagrams from the schema.

Inputs are tab-separated exports of information_schema made by build.sh
(schema-columns.tsv, schema-foreign-keys.tsv, schema-checks.tsv). Outputs are
Markdown data dictionaries and PlantUML ER diagrams, so the documents always
describe the schema the migrations actually create.
"""
import collections
import csv
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GENERATED = ROOT / "generated"
DIAGRAMS = ROOT / "diagrams"

COMMERCE = ["users", "user_sessions", "product_categories", "plans", "plan_features", "wallets",
            "wallet_transactions", "orders", "order_items", "projects", "usage_records", "invoices",
            "invoice_lines", "support_tickets", "ticket_messages"]

PURPOSE = {
    "agent_ca": "The single certificate authority that signs machine-agent client certificates; its key is sealed.",
    "agent_claims": "Install-first claim codes an agent presents before an administrator approves it.",
    "agent_enrollment_tokens": "One-time enrollment tokens (stored as hashes) for dashboard-generated install commands.",
    "agents": "Enrolled pull agents and their certificate serials.",
    "application_database_credentials": "Sealed credentials an application uses for each managed database engine.",
    "application_database_env": "Environment variable names through which database credentials reach an application.",
    "application_databases": "Managed database engines an application depends on.",
    "application_env": "An application's environment variables; values are sealed.",
    "application_health_command": "The ordered arguments of an application's custom health command.",
    "application_outcomes": "The latest start outcome of each application.",
    "applications": "Applications SwarmOps renders and deploys, with their image, port and resource limits.",
    "audit_events": "Append-only record of every operator and customer action.",
    "audit_event_details": "Key-value details of an audit event.",
    "command_events": "Timeline of state changes and evidence for each command.",
    "command_locks": "Named locks serialising commands that must not run concurrently.",
    "command_outputs": "Sealed output streams captured from a command's execution.",
    "command_payloads": "Sealed input payload of a command.",
    "commands": "The durable command queue: action, target, state, attempts, leases and failure details.",
    "core_authority": "The single row holding the authority epoch and the active core.",
    "core_handoffs": "Planned movements of authority between core members.",
    "core_members": "Known core instances and their roles.",
    "database_credentials": "Sealed administrative credentials of managed database engines.",
    "dependency_bindings": "Declared network dependencies between routed services.",
    "dns_credential_versions": "Versions of DNS provider credentials; secrets are sealed.",
    "dns_records": "DNS records SwarmOps manages at providers.",
    "invoice_lines": "One line per project per invoice: hours and amount.",
    "invoices": "Monthly, tax-inclusive invoices; total equals subtotal plus tax.",
    "order_items": "What an order asks for, with the prices copied at the time of ordering.",
    "orders": "Customer orders and their review.",
    "plan_features": "Marketing features listed for a plan.",
    "plans": "The products: CPU, memory, disk, hourly price and monthly cap.",
    "product_categories": "Groups of plans shown in the storefront.",
    "projects": "Applications created by confirmed orders, with their billing state.",
    "route_certificate_domains": "Domains covered by a gateway certificate.",
    "route_certificates": "Certificates observed on the gateway.",
    "route_hosts": "Host names and aliases of a route.",
    "route_runtime": "The gateway's observed runtime state of a route.",
    "route_runtime_entry_points": "Entry points a route is observed on.",
    "route_runtime_errors": "Errors the gateway reports for a route.",
    "routes": "Declared routes: protocol, scope, TLS, target port and health check.",
    "routing_clusters": "Per-cluster gateway settings and cutover plans (JSON documents).",
    "routing_domains": "Domains a cluster may route.",
    "schema_migrations": "Applied schema migrations with their checksums.",
    "server_agent_events": "History of machine-agent health observations per server.",
    "server_keys": "Sealed SSH or API keys of saved servers.",
    "servers": "Saved servers, their connection details and last observed agent and Swarm health.",
    "service_route_declarations": "How each service participates in routing.",
    "source_connections": "Git provider connections; tokens are sealed.",
    "source_private_hosts": "Private Git hosts allowed for source deployments.",
    "source_settings": "The single row of source-to-deploy settings.",
    "support_tickets": "Customer support conversations.",
    "ticket_messages": "Messages within a support ticket.",
    "usage_records": "One charged hour of one project; UNIQUE(project, hour) prevents double billing.",
    "user_sessions": "Storefront sessions: token hash, CSRF token, expiry and revocation.",
    "users": "Customer and administrator accounts with bcrypt password hashes.",
    "wallet_transactions": "The append-only wallet ledger with idempotency keys.",
    "wallets": "One prepaid wallet per user; the cached balance is never negative.",
}

LABELS = {
    "en": {"title": "Data dictionary", "column": "Column", "type": "Type", "null": "Null", "key": "Key",
           "default": "Default", "ref": "References", "checks": "Check constraints", "fks": "Foreign keys",
           "on_delete": "On delete", "constraint": "Constraint", "referenced": "Referenced table",
           "intro": "Generated from the live schema created by migrations 0001 to 0009. Key: PRI primary, UNI unique, MUL indexed.",
           "commerce": "Commerce tables", "platform": "Platform tables", "yes": "yes", "no": "no"},
    "fa": {"title": "فرهنگ داده", "column": "ستون", "type": "نوع", "null": "تهی‌پذیر", "key": "کلید",
           "default": "پیش‌فرض", "ref": "ارجاع", "checks": "قیدهای CHECK", "fks": "کلیدهای خارجی",
           "on_delete": "هنگام حذف", "constraint": "قید", "referenced": "جدول مرجع",
           "intro": "این بخش از طرح‌واره‌ی واقعی ساخته‌شده با مهاجرت‌های 0001 تا 0009 تولید شده است. کلید: PRI اصلی، UNI یکتا، MUL نمایه‌شده.",
           "commerce": "جدول‌های تجارت", "platform": "جدول‌های سکو", "yes": "بله", "no": "خیر"},
}


def read(name):
    with open(GENERATED / name, newline="", encoding="utf-8") as handle:
        return list(csv.reader(handle, delimiter="\t"))


def md(text):
    return str(text).replace("|", "\\|")


def dictionary(lang, columns, fks, checks, purpose_fa):
    label = LABELS[lang]
    tables = collections.OrderedDict()
    for row in columns:
        tables.setdefault(row[0], []).append(row)
    fk_by = collections.defaultdict(list)
    for table, name, referenced, rule in fks:
        fk_by[table].append((name, referenced, rule))
    ck_by = collections.defaultdict(list)
    for table, name, clause in checks:
        ck_by[table].append((name, clause))
    # The document that includes the dictionary supplies its heading.
    out = [label["intro"], ""]
    for heading, names in ((label["commerce"], [t for t in COMMERCE if t in tables]),
                           (label["platform"], [t for t in tables if t not in COMMERCE])):
        out += [f"## {heading}", ""]
        for table in names:
            purpose = purpose_fa.get(table) if lang == "fa" else None
            out += [f"### `{table}`", "", purpose or PURPOSE.get(table, ""), ""]
            out += [f"| {label['column']} | {label['type']} | {label['null']} | {label['key']} | {label['default']} | {label['ref']} |",
                    "|---|---|---|---|---|---|"]
            for _, _, column, ctype, nullable, key, default, extra, ref in tables[table]:
                default_text = default if default not in ("", "NULL") else ""
                if extra and "auto_increment" in extra:
                    default_text = "auto_increment"
                out.append(f"| `{md(column)}` | `{md(ctype)}` | {label['yes'] if nullable == 'YES' else label['no']} | {key} | {md(default_text)} | {('`' + ref + '`') if ref else ''} |")
            out.append("")
            if fk_by[table]:
                out += [f"**{label['fks']}:**", ""] + [f"- `{n}` → `{r}` ({label['on_delete']} {rule})" for n, r, rule in fk_by[table]] + [""]
            if ck_by[table]:
                out += [f"**{label['checks']}:**", ""] + [f"- `{n}`: `{md(c.replace('`', ''))}`" for n, c in ck_by[table]] + [""]
    return "\n".join(out) + "\n"


def entity(table, rows, full):
    lines = [f'entity "{table}" as {table} {{']
    keys = [r for r in rows if r[5] == "PRI"]
    for r in keys:
        lines.append(f"  * {r[2]} : {r[3]} <<PK>>")
    lines.append("  --")
    for r in rows:
        if r[5] == "PRI":
            continue
        if not full and not r[8]:
            continue
        marker = "*" if r[4] == "NO" else " "
        suffix = " <<FK>>" if r[8] else (" <<UQ>>" if r[5] == "UNI" else "")
        lines.append(f"  {marker} {r[2]} : {r[3]}{suffix}")
    lines.append("}")
    return lines


def erd(name, title, columns, include, full):
    tables = collections.OrderedDict()
    for row in columns:
        if row[0] in include:
            tables.setdefault(row[0], []).append(row)
    lines = [f"@startuml {name}", f"title {title}", "hide circle", "skinparam linetype ortho", "left to right direction" if not full else ""]
    for table, rows in tables.items():
        lines += entity(table, rows, full)
    seen = set()
    for table, rows in tables.items():
        for r in rows:
            if not r[8]:
                continue
            parent = r[8].split(".")[0]
            if parent not in tables or (parent, table, r[2]) in seen:
                continue
            seen.add((parent, table, r[2]))
            cardinality = "|o--o{" if r[4] == "YES" else "||--o{"
            lines.append(f"{parent} {cardinality} {table} : {r[2]}")
    lines.append("@enduml")
    return "\n".join(line for line in lines if line is not None) + "\n"


def main():
    columns = read("schema-columns.tsv")
    fks = read("schema-foreign-keys.tsv")
    checks = read("schema-checks.tsv")
    purpose_fa = {}
    fa_file = GENERATED / "table-purposes-fa.tsv"
    if fa_file.exists():
        purpose_fa = {row[0]: row[1] for row in read("table-purposes-fa.tsv") if len(row) > 1}
    for lang in ("en", "fa"):
        (GENERATED / f"data-dictionary-{lang}.md").write_text(dictionary(lang, columns, fks, checks, purpose_fa), encoding="utf-8")
    all_tables = sorted({row[0] for row in columns})
    (DIAGRAMS / "erd-commerce.puml").write_text(erd("erd-commerce", "Commerce schema (migrations 0008 and 0009)", columns, set(COMMERCE), True), encoding="utf-8")
    (DIAGRAMS / "erd-platform.puml").write_text(erd("erd-platform", "Platform schema (migrations 0001–0007): keys and relationships", columns, set(all_tables) - set(COMMERCE) - {"schema_migrations"}, False), encoding="utf-8")
    missing = [t for t in all_tables if t not in PURPOSE]
    print(f"tables={len(all_tables)} columns={len(columns)} fks={len(fks)} checks={len(checks)} missing_purpose={missing}")
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
