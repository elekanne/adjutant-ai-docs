---
sidebar_position: 7
---

# Tools — Adjutant AI

**App version:** 2.7.0
**Last updated:** 2026-09-22
**Audience:** Splunk admins managing which tools the assistant may use, and how
they are scoped per Org and Business Unit.

---

## Tools vs Skills vs Agents: choosing the right layer

Adjutant AI has three distinct layers that shape what the LLM does
on your behalf. Knowing which layer to touch when you want to change
behaviour is the difference between a 30-second admin edit and an
hour of doomed prompt-tweaking.

**The kitchen analogy** (since the layers map well to cooking):

| Layer | What it is | Kitchen analogue | Lives in | Touch it when… |
|---|---|---|---|---|
| **Tool** | An executable function the LLM can call (e.g. `splunk_run_search`, `splunk_create_dashboard_xml`). Granular by design: 196 built-in (incl. the SSE security-content tools and the agent authoring tools), plus your custom HTTP tools and MCP-imported tools. | Ingredient or utensil | the app's built-in catalogue + the **Tools** tab | …you need a new *capability* the LLM doesn't have yet (talk to a new system, persist a new artifact kind). |
| **Skill** | A reusable *prose rule* the LLM must follow ("no emojis in dashboards", "MLTK models follow the `aiworkbench` naming pattern", "a proof dashboard shows the artifact working"). Pure text, no code. Pulled in front of the agent's prompt at prompt-fetch time. | Recipe-for-correctness: "always sear before braising" | `itmip_ai_skills` KVStore (NEW in 0.9.6) + the **Skills** tab | …a *cross-cutting rule* applies to 3+ agents and you want it to live in one place. |
| **Agent** | A governed agent, with every action gated and logged: a specific use-case flow (workflow phases, form inputs, artifact naming for this exact task). Picks which skills it includes via the `includes_skills` field. | The meal plan: "Thursday night: chicken piccata" | `itmip_ai_use_cases` KVStore + the **Agents** tab | …you want to add or refine a *specific* end-user task, with its own questions and its own output shape. |

**Concrete rule of thumb:**

- *"All my dashboards should use a colourblind-safe palette"* → that's
  a **skill** edit. Find `viz-best-fit`, add the rule to its body.
  Every agent that already includes `viz-best-fit` picks it up
  for free; you don't need to touch any agent.
- *"My new use case is 'help users debug their syslog ingestion'"* →
  that's an **agent**. Create a new agent, declare its
  `includes_skills: ["feed-health-verdict", "spl-perf-priorities",
  "spl-validation-loop", "metric-vs-event-index-aware"]`, write the
  workflow.
- *"I have a ServiceNow CMDB that the LLM should be able to query"*
  → that's a **tool**. Create a custom HTTP tool (or register an
  MCP server) — see [Custom tools](#custom-tools) below.

For the full architecture diagram + the 53-skill default catalogue,
see [the tools and agent templates overview, §3.5](./tools-and-playbooks.md).

---

## What you see on the Tools tab

The tab has four sections, top-to-bottom:

1. **Filter bar** — free-text search + multi-select tag/category
   filters. Built-in and custom tools are listed together; filters
   apply across both.
2. **Built-in tool table** — every tool the dispatcher exposes to the
   LLM out of the box (`splunk_run_search`,
   `splunk_create_dashboard_xml`, `splunk_ai_command`,
   `splunk_route_tools`, …). One row per tool.
3. **Custom tools** — admin-authored HTTP tools (since 0.4.0).
4. **MCP servers** — registered upstream MCP server connections and
   the tools imported from them (since 0.7.0).

Every row shows the tool's name, a short description (the same string
the LLM sees, truncated for the table), tag pills, category pills,
and admin-only action buttons.

---

## Tool routing — minimum-budget by default

A run does NOT broadcast the entire tool catalogue to the LLM
on every question — that would balloon prompt tokens and confuse
smaller models. Instead the dispatcher:

1. Looks at the active agent (if any). The agent can declare
   `allowed_tools`, `denied_tools`, `tool_tag_filters`,
   `tool_category_filters` — those scope what the LLM is offered.
2. If no agent scope is set, the dispatcher exposes a small
   **essentials set** (~21 tools: core SPL/search, saved-search,
   dashboard, alert, ML-probe, plus the universal version / agent template /
   knowledge / router tools), **not** all 196. The model **discovers
   and unlocks** the rest on demand by calling `splunk_route_tools`:
   that tool now *adds* the tools it returns to the live advertised set
   for the rest of the conversation (it doesn't merely list them), so
   the model can call ES / ITSI / TrackMe / AI-Toolkit / Studio-builder /
   data-onboarding / MCP / custom tools immediately after routing to
   them. Knowledge entries unlock tools the same way (see
   the knowledge-layer guide, "knowledge unlocks tools").

That's why the LLM may say *"let me check what tools are available"*
mid-conversation — it's calling `splunk_route_tools` rather than
guessing.

**Why it matters (cost).** Each tool-loop turn re-sends the whole
advertised tool block. With all ~135 tools that was ~37 K input tokens
*per turn* — a 13-turn run could burn ~669 K input tokens (~$2). The
essentials default cuts the advertised block to a fraction of that, and
**Anthropic prompt caching** (on since 1.3.1) re-reads the still-static
prefix — tools + system prompt — from cache at ~10% of the input price
on every turn after the first. The Tokens & Costs tab surfaces the
`cache_read` / `cache_creation` split so you can see it working.

---

## Built-in tool catalogue

The dispatcher ships **196 built-in tools**. By source category
(a few tools carry two): `enterprise-security` 19 · `trackme` 19 ·
`servicenow` 17 · `itsi` 16 · `dashboards-simplexml` 15 ·
`dashboards-studio` 15 · `data-onboarding` 12 · `knowledge-objects` 12 ·
`network-policy` 13 · `fraud` 10 · `splunk-core` 9 · `ai-toolkit` 8 ·
`search` 8 · `knowledge` 5 · `security-content` 5 · `templates` 5 ·
`data-platform` 3 · `alerts` 2 · `dashboards-compiler` 2 ·
`visualizations` 2 · `metrics` 1 · `routing` 1.

> These numbers are checked against the shipped tool list on every build,
> so a tool added without a documentation update fails the build. They were last wrong by
> four tools and six categories, which is why the check exists: a stale
> catalogue reads exactly like an accurate one.

The friendly groupings below are **non-exhaustive examples** — the
**Tools** tab is the source of truth:

| Category | Examples |
|---|---|
| `search` | `splunk_run_search`, `splunk_term_check`, `splunk_metadata`, `splunk_walklex`, `splunk_typeahead`, `splunk_validate_full_range`, `splunk_run_saved_search_by_name` |
| `metadata` | `splunk_list_indexes`, `splunk_list_metrics`, `splunk_list_sourcetypes`, `splunk_list_sources`, `splunk_list_hosts`, `splunk_describe_sourcetype` |
| `dashboard` | **Simple XML (classic)**: `splunk_create_dashboard_xml` / `splunk_update_dashboard_xml` / `splunk_get_dashboard_xml` / `splunk_get_dashboard_panel_data` for hand-written XML, plus the **Simple XML builder family** (v1.4.0): `splunk_xml_create`, `splunk_xml_add_input`, `splunk_xml_add_panel`, `splunk_xml_update_panel`, `splunk_xml_remove_panel`, `splunk_xml_preview`, `splunk_xml_publish`. The model composes a dashboard via small typed calls (RAW SPL in, escaped XML out) so it never hand-writes the whole `<dashboard>` blob (no output-token truncation, no manual-escaping bugs), with per-panel `full_width`/`row` layout for shareable/printable evidence dashboards. **Dashboard Studio (JSON)** has its own builder family (`splunk_builder_create_dashboard`, `splunk_builder_add_time_picker`, `splunk_builder_add_dropdown`, `splunk_builder_add_data_source`, `splunk_builder_add_visualization`, `splunk_builder_position`, `splunk_builder_preview`, `splunk_builder_publish`) plus persistence (`splunk_create_dashboard_studio_json`, `splunk_update_dashboard_studio_json`, `splunk_get_dashboard_studio_json`, `splunk_check_studio_runtime`). The full pipeline (agent → builder → validation chain → on-disk artifact) and the known failure modes are documented in the Dashboard Studio guide. The Studio agent template currently ships as an agent template in preview (`draft`, since v0.9.5); see that doc's §10 for promotion criteria. |
| `alerting` | `splunk_create_alert`, `splunk_list_saved_searches`, `splunk_get_saved_search` |
| `mltk` | `splunk_share_mltk_model_globally`, `splunk_list_ml_models`, `splunk_check_ml_capabilities`, `splunk_proof_snapshot` — training and scoring are SPL (`fit` / `apply`) the assistant writes and runs through `splunk_run_search`, not separate tools |
| `es` (Splunk Enterprise Security) | `es_list_notables`, `es_get_notable`, `es_update_notable`, `es_add_investigation_note`, `es_list_correlation_searches`, `es_get_correlation_search` |
| `itsi` | `itsi_list_episodes`, `itsi_get_episode`, `itsi_update_episode`, `itsi_list_services`, `itsi_list_kpis`, `itsi_get_kpi`, `itsi_get_kpi_search` |
| `trackme` | `trackme_list_entities`, `trackme_get_entity`, `trackme_ack_entity`, `trackme_update_entity_priority`, `trackme_update_maintenance` |
| `security-content` (Splunk Security Essentials, 1.2.0) | `sse_check_prerequisites`, `sse_list_content`, `sse_get_detection`, `sse_enrich_id`, `sse_enrich_alert`: reach SSE's content catalogue + real detection SPL via SSE's `sseanalytics`/`sseidenrichment`/`sselookup` commands; only return content when SSE is installed and visible to the user. See [the tools and agent templates overview](./tools-and-playbooks.md) §4.17. |
| `data-onboarding` (Data Foundation, 1.5.0) | **Authoring (Professional+, `data_onboarding`):** `splunk_generate_conf_package` (draft a deployment-ready 4-app config package of props/transforms/inputs/tags/serverclass and return a downloadable `.tar.gz`), `splunk_validate_props_conf` / `splunk_validate_transforms_conf` (validate a stanza against the authoritative `*.conf.spec`), `splunk_compute_data_quality_score` (0–100 + A–F grade across Magic 8 / props / transforms / timestamps / line-breaking / CIM). **Ingestion-health CHECKS (all tiers as of 1.7.1):** `splunk_check_ingest_health` (per-sourcetype ingest/parse errors read from `_internal` as the system user) + `splunk_check_cribl_ingest_health` (the Cribl monitoring index) + `splunk_check_edge_processor_health` *(1.8.2: the Splunk Edge Processor operational-metrics index, `sourcetype=edge-metrics`, read via `\| mstats`; sibling of the Cribl check)*. No licence gate; bounded only by Splunk role + index ACL. See [the tools and agent templates overview](./tools-and-playbooks.md). |
| `servicenow` (ServiceNow integration, 1.7.0; **Professional + `servicenow`**) | 17 server-side tools — reads (`servicenow_get_incidents`/`_get_incident`/`_get_changes`/`_get_problems`/`_get_journal`, CMDB/CSDM `servicenow_cmdb_list_classes`/`_cmdb_get_records`/`_cmdb_describe_table`/`_cmdb_related`, generic `servicenow_table_get`), writes (`servicenow_create_incident`/`_update_incident`/`_create_event`/`_cmdb_upsert`), and SIR security incidents (`servicenow_get_security_incidents`/`_create_security_incident`/`_update_security_incident` on `sn_si_incident`, only when the Org sets `sir_enabled`). Configure under **Tools → ServiceNow**, not as a custom HTTP tool — see the callout under [Custom tools](#custom-tools) and [the ServiceNow guide](../integrations/servicenow.md). |
| `templates` | `splunk_list_use_case_templates`, `splunk_get_use_case_template_prompt`, `splunk_route_tools` |
| `network-policy` (firewall policy ingestion) | Thirteen tools, **three vendors**, one ordered chain — acquire, parse, normalise, then read. Everything from `firewall_policy_normalize` onward is **vendor-neutral**; only intake is vendor-specific. **Cisco:** `cisco_asa_config_collect` (import ASA config text; does **not** log in to a device), `cisco_device_configuration_acquire` (SSH to an **approved** device, fixed read-only command profile), `cisco_fmc_collect` (an FMC access-control collection, pre-fetched or live from a saved connection), `cisco_asa_config_parse`, `firewall_policy_normalize` (into the vendor-neutral canonical schema — this is where ASA and FMC become the same model), `firewall_rule_expand` (effective tuples, bounded with explicit truncation), `firewall_policy_diff` (change set between two **complete** snapshots), `firewall_policy_export` (a versioned JSON export a consumer reads without touching Adjutant's stores), `firewall_policy_store` (persist to index history and/or KV current state). **Fortinet:** `fortinet_config_collect` (import FortiOS `show full-configuration` text) and `fortinet_config_parse`, which produces the **same** vendor-neutral entities the ASA parser does, so a FortiGate snapshot is comparable to an ASA one by construction rather than by convention. **Palo Alto:** `panos_config_collect` (import PAN-OS `show config running` in **set format** — the default curly-brace output is a different grammar) and `panos_config_parse`, which records rather than flattens the two constructs the canonical model cannot express: App-ID narrowing and a negated address. Three of the thirteen are write tools needing an action grant — see [Runner-side tools](#runner-side-tools--the-gate-is-the-action-grant-not-the-tool-list). Two properties are worth knowing before you read a result: a **tuple is not proof of reachability**, and **deletions are computed by comparing two snapshots, never read from the device** — if either snapshot is incomplete, removals come back as `removed_unconfirmed` rather than as removals. |
| `fraud` | Ten tools, end to end. Readiness first (`splunk_audit_fraud_readiness`: which fraud use cases this estate can support **from real events**, matching sources by content signature rather than sourcetype name), then `fraud_risk_plan` (detects whether ES is installed rather than asking). Then the **two-tier** rule model that fraud actually needs: `fraud_generate_risk_rule` contributes weight for a resolved entity, `fraud_generate_notable_rule` accumulates it per entity over a window and requires two or more rule **families**. `fraud_risk_ring_scan` covers what accumulation structurally cannot: a ring is many entities sharing one value, not one entity across many events. Plus identity resolution (`fraud_canonicalize_identifiers`, `fraud_shared_attribute_pivot`, `fraud_velocity_travel`) and migration from the retiring Splunk fraud apps (`fraud_migration_discover`, `fraud_migrate_content`). Every generator returns reviewable SPL with `disabled=1`; nothing is enabled, scheduled or deployed. See [the tools and agent templates overview](./tools-and-playbooks.md) §4.22. |
| `dashboards-compiler` | `splunk_compile_dashboard` builds and publishes a dashboard from an **intermediate representation in one call**, owning base-search factoring, token binding, XML escaping and layout geometry. It replaces the whole `splunk_xml_*` sequence for agents carrying this category. `splunk_revise_dashboard` patches an already-published dashboard by `artifact_fingerprint`; only presentational and narrative fields are patchable and anything structural is refused by name. See [the tools and agent templates overview](./tools-and-playbooks.md) §4.23 and the Dashboard Studio guide. |
| `data-platform` | `splunk_mapping` — read and **author** integration mapping specs (source → transforms → destination). `operation=put` can only ever create a **draft**; a human promotes it under four-eyes in the **Mappings** tab. Lint runs server-side and rejects a bad spec with its findings. `operation=check_drift` compares a mapping's declared fields against the fields actually read. Plus `profiling_capabilities`, `profiling_build_profile`. |
| `knowledge` | `splunk_memory`: persistent memory per Org/BU, scoped server-side to the caller's Org/BU (a scope passed in arguments is ignored). Two record types: `learned_fact` (durable facts about this environment, stored **unconfirmed** until a human confirms them in the **Learned Knowledge** tab but usable immediately, with a BU→Org fallback on read) and `integration_state` (an integration's resume watermark per resource; advance it only **after** the data it covers is durably written). Plus the four knowledge-retrieval tools described in [the tools and agent templates overview](./tools-and-playbooks.md) §4.16. |

Every built-in is read-only by default — the small number of
write-capable tools (`splunk_create_dashboard_xml`,
`splunk_create_alert`, `es_update_notable`, `itsi_update_episode`,
`trackme_ack_entity`, `splunk_share_mltk_model_globally`, …) emit a
structured `{ok, kind, name, action, url}` result so the "Created in
Splunk" panel can show direct drilldown links.

### Click **Manage** to enable / disable per Org and BU

**Manage** opens the **Manage tool** dialog. It has two tabs, **Metadata** and **Availability**, and is left only
through **Cancel** or **Save changes**: a click beside it or Escape does nothing, so an edit is never lost by
accident. **Save changes** stays disabled until something changed, and a changed tab says **changed**.

On the **Availability** tab you can add per-Org / per-BU enable/disable
rules. The dispatcher's `isToolEnabled()` consults them when deciding
what to advertise to the LLM AND again at `executeTool()` time
(defence in depth: a call to a disabled tool is refused even if the
model asks for a tool it was never offered).

Most-specific rule wins:

`Org+BU` > `Org+*` > `*+BU` > `*+*` > implicit default (enabled).

Use cases:

- Disable `splunk_create_alert` for a BU that uses a separate
  alerting platform (PagerDuty, ServiceNow, …).
- Disable AI-Toolkit tools for non-ML BUs.
- Disable `splunk_run_saved_search_by_name` to keep an LLM from
  triggering long-running scheduled searches.
- Disable every `es_*` / `itsi_*` / `trackme_*` tool for an Org
  that doesn't have those apps installed.

### Per-tool metadata overrides

Every built-in tool ships with a tag list, a category list, and a
one-line short description built into the app. If
those defaults don't fit your environment you can override them on
the **Metadata** tab of the **Manage tool** dialog:

| Field | Behaviour |
|---|---|
| Tags | Multi-select. Adds/replaces the built-in tag list. |
| Categories | Multi-select. Adds/replaces the built-in category list. |
| Short description | Free text. Replaces the LLM-facing summary. |
| Short description (concise variant) | Free text, at most 120 characters. Used when Concise Mode is on. |

Overrides are persisted to the `itmip_tool_overrides` KVStore
collection (one row per `tool_name`). The runtime merges overrides on
top of the built-in defaults at app-load time. If all four fields
match the defaults the row is deleted (no orphan rows). **Reset to built-in
defaults** puts the built-in values back in the dialog, all four of them;
nothing is written until **Save changes**, which then removes the row. A small
**overridden** badge next to a tool's name in the table tells you
which rows have an active override.

---

## Custom tools

Beneath the built-in tool table is the **Custom tools** section. This
is where you teach the LLM about external systems — ServiceNow,
CMDBs, internal wikis, threat-intel APIs, anything that speaks HTTP.

> **ServiceNow has a dedicated, first-class integration (v1.7.0).** You no longer
> need to hand-author custom-HTTP tools for ServiceNow: Adjutant AI ships a built-in
> `servicenow` tool category (incidents, changes, problems, CMDB/CSDM with bounded
> relationship traversal, SIR security incidents, events), curated CSDM/code knowledge,
> a deterministic incident-description renderer, alert-driven agent templates with
> bi-directional write-back, and per-Org REST **or** MCP transport — gated at
> **Professional + the `servicenow` feature**. Configure it under **Tools → ServiceNow
> connections**. Full guide: **[the ServiceNow guide](../integrations/servicenow.md)**. Custom-HTTP tools remain
> the escape hatch for *other* external systems (and for a bespoke ServiceNow table).

### Authoring a tool

Click **+ Add custom tool**. The editor has six tabs: **General**, **Parameters**, **Request**, **Network**,
**Response and limits** and **Test**. It is left only through **Cancel** or **Create** (**Save changes** for an
existing tool). Each field is checked as you type, with the same rule and wording the server applies: a tab with
a problem says **has errors**, the problem is shown under its field, and the save button stays disabled and names
the tabs to fix. What the tabs hold:

1. **Identity** — `name` (lowercase, snake_case, becomes the
   function-name the LLM sees), `version` (semver), `title`,
   `description`. The description is the *only* prose the LLM sees —
   make it specific and tell the model when to call this tool.
2. **Scope** (on **General**) — `sharing` (`private` = owner Org+BU only, `app` =
   whole owner Org, `global` = every Org), and the owning Org / BU, chosen
   from your Organisations and Business Units under **Who may use this tool?**.
   Default is your own Org/BU. A private tool needs its Business Unit.
3. **Parameters** — a JSON Schema draft-07 object. Whatever
   properties you declare here become the arguments the LLM must
   supply when calling the tool. The schema reaches the LLM
   verbatim, so describe each property clearly.
4. **Implementation** — for 0.4.0+ the supported type is `http`.
   Fill in `method`, `url`, optional `query` and `headers` maps, the
   `auth` block (see §"Credential management" below), `timeout_seconds`,
   the required `allowed_hosts` allowlist and, for POST, PUT and PATCH, the
   **Request body** (JSON is sent as JSON, anything else as text). The
   optional `proxy_url` / `proxy_credential_ref` / `tls_ca_pem_ref` for
   environments behind a corporate egress (0.7.0+) are on the **Network** tab.
5. **Response shaping** — optional `jq` or `jsonpath` transform plus
   a `max_bytes` cap. Use this to strip noise out of large responses
   before they reach the LLM (an unfiltered ServiceNow incident
   payload is ~3 KB of fields the model doesn't need).
6. **Guardrails** — per-user `rate_limit_per_minute`,
   `cache_ttl_seconds`, and `redact_fields` for nested key scrubbing
   before the result is sent to the LLM.

### Template substitution

URL, query params, headers, and body all support `{{ argName }}`
substitution against the LLM's tool-call arguments. Substitution is
literal — no Python eval, no expressions, just direct value
replacement. A missing argument fails the call (the tool refuses to
go out with blanks).

### Allowed-hosts allowlist

Every HTTP tool must declare which hostnames it may reach. The
handler enforces the allowlist *after* template substitution, so a
parameter-driven URL like `https://{{ host }}/x` can't be redirected
to an arbitrary host by the LLM — only entries in `allowed_hosts`
are accepted at call time. RFC1918 / loopback hosts are refused
unless `implementation.allow_internal: true` is set.

### Credential management — three tiers

Tool definitions never contain secrets. Instead, the `auth` block
references secrets stored in Splunk's `storage/passwords` under realm
`itmip_llm_assistent_app`. v0.7.0 added a **credential model** so a
single tool definition can route per Org/BU or per user without
needing one tool definition per credential:

| credential_model | What it means | `credential_ref(_template)` example |
|---|---|---|
| `global` (default) | One secret for all callers. | `confluence_default` |
| `per_tenant` | Resolve to a different secret per caller's (Org, BU). The template uses `{org}` / `{bu}` placeholders, lowercased + stripped to `[a-z0-9_-]`. | `confluence_{org}_{bu}` resolves to `confluence_acme_ops` for caller in Org=ACME, BU=OPS. |
| `per_user` | Resolve to a different secret per caller's Splunk user. **Schema-only:** 2.7.0 has no runtime that mints these secrets. `per_user` tools are visible to the LLM, and a caller with no stored secret gets a structured `{ok:false, error:"no_user_credential", auth_url: null}` at invoke time. See [the custom tools guide](./custom-tools-authoring.md), §5. | `github_user_{user}` |

`per_tenant` tools whose template resolves to a credential that **does
not exist** in `storage/passwords` are dropped from the LLM's
advertised list — they're never visible-and-broken. The Tools tab
shows the resolution status next to each tool row.

#### Proxy + TLS CA

0.7.0 also added three optional `implementation` fields for
restricted-egress environments:

- `proxy_url` — explicit HTTP(S) proxy URL.
- `proxy_credential_ref` — name of a `storage/passwords` entry
  containing the proxy's basic-auth credentials.
- `tls_ca_pem_ref` — name of a `storage/passwords` entry containing
  a PEM bundle to use as the TLS CA store for this tool.

A shared outbound-HTTP builder
(`bin/itmip_llm_http_client.py::build_request`) honours all three —
the same builder backs the MCP client too, so a proxy or custom CA
configured for a custom tool also works for MCP servers using the
same env.

### Save and test

On the editor's **Test** tab, type a sample arguments JSON and click **Save and test**. It saves the tool
first, so the call runs what is on screen, keeps the dialog open, and shows the transformed response inline.
It is enabled only when every tab is valid. The full request goes through the same /invoke path
the LLM will use — what you see is exactly what the LLM will see.

### Import / Export

Tool definitions are pure JSON. Use **Export JSON** to download a
finished definition; paste it into another environment via **Import
JSON**. The importing Org/BU is set to the importer's resolved
Org/BU by default; edit afterwards if you want wider scope.

### Audit trail

Every `/invoke` call is logged to the `itmip_llm_custom_tool_calls`
KVStore collection with the user, tool, hash of the arguments,
status, error (if any), and duration. v0.7.0 added these fields:

- `credential_model` — `global` / `per_tenant` / `per_user`.
- `credential_ref_resolved` — the final `storage/passwords` name
  after template expansion (no secret value, just the name).
- `tool_kind` — `builtin` / `http_custom` / `mcp`.
- `mcp_server_id` / `mcp_upstream_name` — set only for MCP calls.

The `customer_auth_used` field (bool) records whether the IAM hook
ran on that call — useful for distinguishing fresh gateway calls
from cached responses or unauthenticated tools. Query from SPL with
`| inputlookup itmip_llm_custom_tool_calls`. The audit log is
admin-only.

### Reserved implementation types

The `implementation.type` field also reserves `splunk_search`,
`kvstore_lookup`, and `python`. These are recognised by the schema
validator but rejected at /invoke time with HTTP 501. Only `http`
runs.

---

## MCP servers

The **MCP servers** section under the Tools tab lets an admin
register upstream Model Context Protocol servers and import the
tools they expose. Without this, an admin would have to hand-author
one custom HTTP tool per upstream MCP-exposed function — tedious,
error-prone, and creates drift.

This implementation follows MCP spec **2025-11-25** with the
**Streamable HTTP** transport (legacy HTTP+SSE is supported as a
fallback for servers that emit `Content-Type: text/event-stream`).
`stdio` transport is explicitly rejected for security reasons.

### Workflow

1. **Register a server** — click **+ Add MCP server**. Fill in
   `name`, `endpoint_url`, optional `description`, and the
   **Authentication** block. Choose **Static** (a pre-obtained
   bearer/API key via the same three-tier credential model as custom
   tools) or **OAuth 2.1** (1.5.0+; see *OAuth 2.1 authentication*
   below). Optional `proxy_url`, `proxy_credential_ref`,
   `tls_ca_pem_ref`, `customer_auth_hook` toggle (see below).
2. **Test connection** — clicking **Test connection** issues a
   `tools/list` JSON-RPC request to the upstream, parses the
   response, and shows you the upstream's reported tools without
   importing them. Use this to validate the auth + network path
   before any tool reaches the catalogue.
3. **Import tools** — pick a subset from the listed tools to import.
   Each import becomes a row in `itmip_mcp_tools` with an
   `exposed_name` (defaults to the upstream name, edit if you want a
   shorter/clearer LLM-facing label), `description_addendum`
   (prepended to the upstream description before the LLM sees it),
   `short_description`, `category`, `tags`. The runtime exposes
   imported tools to the LLM via the same dispatcher path as built-
   in and custom tools.
4. **Refresh** — re-issues `tools/list` and compares upstream
   `description` + `inputSchema` against the imported snapshot.
   Drift is flagged on the row with an **upstream drift** badge;
   removed tools get an **upstream removed** badge and are
   auto-disabled. The admin then decides whether to re-import
   (acknowledges the drift) or unimport.

### Invocation

When the LLM calls an imported MCP tool, the dispatcher:

1. Looks up the `itmip_mcp_tools` row to get the `server_id`,
   `upstream_name`, and any per-tool guardrails.
2. Resolves the server's credential using the same three-tier
   resolver as custom tools.
3. Issues a `tools/call` JSON-RPC to the upstream over Streamable
   HTTP. SSE responses are parsed by walking every `data:` line and
   picking the first JSON-RPC frame whose id matches.
4. Returns the upstream's result to the LLM via the standard tool-
   result envelope.

### OAuth 2.1 authentication

For MCP servers that require OAuth (e.g. **ServiceNow Action Fabric /
MCP Server Console**), set **Authentication type = OAuth 2.1** in the
server editor. Adjutant AI is a **backend-mediated** OAuth client: the
browser is used only for the login/consent redirect; splunkd performs
the **authorization-code + PKCE** exchange and holds the tokens
(encrypted in `storage/passwords`, auto-refreshed, single-flight). The
browser never receives a token.

After saving, click **Connect** on the server card to authorise. Owner
modes: `per_user` (each user connects their own account), `shared` (one
Org/BU-shared admin connection), `service` (unattended service identity
— e.g. a ServiceNow integration user consented once). Unattended runs
use client-credentials when available, else the stored service token,
else fail closed (never a browser login). When the LLM invokes an
OAuth MCP tool, the dispatcher resolves a valid bearer from the OAuth
engine (refreshing if near expiry) instead of a static secret; a 401
triggers exactly one forced-refresh retry. **Full guide:
[the MCP OAuth guide](./mcp-oauth.md).**

### Customer auth hook for MCP

Same hook (`bin/customer_authorisation.py`) as LLM and custom-tool
flows, with a third `context["target_kind"] = "mcp"` discriminator.
Existing hooks that branch only on `"llm"` / `"tool"` continue to
work — they just don't mint headers for MCP (correct fail-closed
behaviour). See [the customer authorisation hook guide](../security/customer-authorisation-hook.md)
for the full contract.

### Audit

MCP invocations write to the SAME `itmip_llm_custom_tool_calls`
collection as HTTP custom tools, with `tool_kind = "mcp"`,
`mcp_server_id`, and `mcp_upstream_name` populated. A single SPL
search across `| inputlookup itmip_llm_custom_tool_calls` therefore
returns a unified view of every dispatcher invocation regardless of
underlying transport.

---

## Working with PEM files — TLS CAs, self-signed certs, dev-mode skip

Three places in Adjutant AI reach outbound HTTPS endpoints that may
present a private CA or self-signed cert:

- **Custom HTTP tools** (this tab → *Custom HTTP tools* sub-section)
- **MCP servers** (this tab → *MCP servers* sub-section)
- **LLM configurations** (*Settings* tab → *LLM configurations*),
  but only in `splunk_proxy` call mode — `browser_direct` uses the
  browser's OS trust store

All three use the same dispatcher pattern, the same `tls_ca_pem_ref`
storage model (LLM uses a slightly different `tls_ca_pem` inline blob
rather than a `storage/passwords` reference, set via file-upload in
the editor), and the same dev-mode TLS-skip escape hatch described
below. The dispatcher trusts only the system store by default
(whatever's bundled with the Splunk Python runtime). This section is
recipe-driven: copy the snippets, change the paths, you're done.

> **Splunk Cloud restriction.** The dev-mode TLS-skip checkbox is
> **HIDDEN on Splunk Cloud** for all three surfaces — and refused at
> dispatch time regardless of what's stored in KVStore — by design.
> Cloud admins have no business disabling TLS verification on
> outbound calls; the platform's compliance posture forbids it. The
> rest of this section (proper CA PEMs) applies to Cloud just fine.

### When does this even matter?

- The upstream uses a **corporate / internal CA** that's not in
  Mozilla's public root store (most enterprises).
- The upstream is **a Splunk dev box on `localhost` / `*.local`** —
  splunkd ships with a self-signed cert that no system trust store
  knows about. This is the most common case for testing the bundled
  **Splunk MCP Server** app.
- You're running against an upstream behind a **TLS-intercepting
  proxy** that re-signs traffic with the corporate CA.

If your upstream presents a publicly-trusted cert (Let's Encrypt, a
commercial CA), you can skip this entire section — leave **TLS CA
ref** blank.

### Step 1 — get the PEM

The single most reliable approach: ask the live server. It can't
disagree with itself.

```bash
# Capture whatever cert chain the server is actually presenting
openssl s_client -connect upstream.example.com:443 \
  -showcerts </dev/null 2>/dev/null \
  | sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' \
  > /tmp/upstream_chain.pem

# Sanity-check what you grabbed
openssl x509 -in /tmp/upstream_chain.pem -noout -subject -issuer
# subject= /CN=upstream.example.com/O=Acme
# issuer= /CN=Acme Internal CA/O=Acme
```

If you'd rather use the bundled CA file directly (works for splunkd
when nothing's been re-generated):

```bash
cp $SPLUNK_HOME/etc/auth/cacert.pem /tmp/splunkd_chain.pem
```

For **generating** a fresh self-signed cert from scratch (rare — only
when you're standing up your own dev upstream):

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout /tmp/dev_key.pem -out /tmp/dev_cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
# /tmp/dev_cert.pem is the PEM to upload; the key stays with the server.
```

### Step 2 — store the PEM in Splunk's `storage/passwords`

Two rules: use **`--data-urlencode "password@/path/to/file"`** so the
newlines survive, and pick a short memorable **name** — you'll type
that name into the TLS CA ref field.

```bash
curl -k -u admin:<pw> \
  --data-urlencode "name=upstream_internal_ca" \
  --data-urlencode "realm=itmip_llm_assistent_app" \
  --data-urlencode "password@/tmp/upstream_chain.pem" \
  https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords
```

Verify it stored correctly. A PEM is typically ~1.5–3 KB; the
`clear_password` length tells you whether the upload survived:

```bash
curl -k -u admin:<pw> \
  "https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords/itmip_llm_assistent_app:upstream_internal_ca:?output_mode=json" \
  | python3 -c "import sys,json; p=json.load(sys.stdin)['entry'][0]['content']['clear_password']; print('length:', len(p), '— starts with:', repr(p[:30]))"
# length: 2433 — starts with: '-----BEGIN CERTIFICATE-----\nMI'
```

If the first 30 chars contain `%0A` instead of `\n`, the upload was
double-URL-encoded — re-do step 2 carefully.

### Step 3 — reference the name in the editor

In the **Edit MCP server** or **Edit custom HTTP tool** dialog:

- **TLS CA ref** → `upstream_internal_ca` (whatever you typed in
  step 2's `name=`).
- Save. Use **Test connection + list tools** (the MCP server's **Tools** tab) or **Save and test**
  (the custom tool's **Test** tab).

### Step 4 — proving the PEM works (before blaming the dispatcher)

If the test still fails with `CERTIFICATE_VERIFY_FAILED`, prove the
PEM independently using plain `curl`:

```bash
curl --cacert /tmp/upstream_chain.pem \
  https://upstream.example.com/some/endpoint
```

- **2xx response, no `-k`:** PEM is correct → check the dispatcher
  config (TLS CA ref field actually saved? right collection? right
  Org/BU scope?).
- **Same TLS error:** PEM doesn't match what's served, or the cert
  is a self-signed leaf that lacks the `CA:TRUE` basic constraint
  (OpenSSL won't promote it to a trust anchor). Re-grab via
  `openssl s_client` (step 1), or — see next section — flip on
  dev-mode skip if this is a local-machine test.

### The dev-mode escape hatch

Splunk's stock self-signed cert often lacks the basic constraints
OpenSSL needs to treat it as a trust anchor, which means even a
correctly-uploaded PEM can still fail validation. For
**local-development testing only**, **all three editors** (MCP
server, custom HTTP tool, LLM configuration) expose the same
checkbox:

> ⚠ **Skip TLS certificate verification (dev only)** — disables
> hostname check + CA validation.

When ticked, the dispatcher behaves like Node's
`NODE_TLS_REJECT_UNAUTHORIZED=0`: any certificate is accepted.

**Splunk Cloud:** the checkbox is **HIDDEN entirely on Cloud** in
all three editors, and the dispatcher **refuses** the flag at call
time regardless of what's in KVStore. Detection is via
`/services/server/info`'s `instance_type` field (cached for the
splunkd process lifetime via `bin/itmip_llm_guid.is_splunk_cloud`).

**Audit visibility:**

- MCP + custom HTTP tools — every call writes `tls_verify_skipped:
  true` into the audit row (`itmip_llm_custom_tool_calls`):

  ```spl
  | inputlookup itmip_llm_custom_tool_calls
  | where tls_verify_skipped = true
  | stats count by tool_name, user, mcp_server_id
  ```

- LLM proxy — writes one `splunkd.log` line per affected call,
  prefixed `itmip_llm_proxy: tls_verify_skipped=true endpoint=...
  config=... user=...`. (The LLM proxy doesn't have its own KVStore
  audit collection; token-count telemetry goes to the index via
  `itmip_llm_usage_log.py`.)

  ```bash
  grep "tls_verify_skipped=true" $SPLUNK_HOME/var/log/splunk/splunkd.log
  ```

When the Cloud-gate refuses the flag, the dispatcher also logs a
single `refusing tls_skip_verify on Splunk Cloud` warning per call
so admins see exactly why it didn't take effect.

A red warning banner in the editor reinforces that this is dev-only
behaviour. **Switch it back off and supply a proper TLS CA ref
before any non-dev use.**

### Updating an existing entry

`storage/passwords` POST refuses duplicate names. To **update** the
PEM (e.g. cert rotated upstream), POST to the entry URL directly —
note the trailing `:` for the empty user segment:

```bash
curl -k -u admin:<pw> -X POST \
  --data-urlencode "password@/tmp/upstream_chain.pem" \
  "https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords/itmip_llm_assistent_app:upstream_internal_ca:"
```

### Worked example — Splunk MCP Server on localhost with self-signed cert

This is the recipe most readers will need. Full sequence:

```bash
# 1. Grab the live cert from your local splunkd
openssl s_client -connect localhost:8089 -showcerts </dev/null 2>/dev/null \
  | sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' \
  > /tmp/splunkd_chain.pem

# 2. Store it
curl -k -u admin:<pw> \
  --data-urlencode "name=splunkd_self_signed_ca" \
  --data-urlencode "realm=itmip_llm_assistent_app" \
  --data-urlencode "password@/tmp/splunkd_chain.pem" \
  https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords

# 3. Sanity-check curl trusts it
curl --cacert /tmp/splunkd_chain.pem \
  https://localhost:8089/services/server/info -H "Authorization: Bearer <token>"
```

In the **MCP server** editor: TLS CA ref → `splunkd_self_signed_ca`.
If step 3 worked but the editor's Test connection still fails, the
cert is a constraints-missing self-signed leaf — tick **Skip TLS
certificate verification** as a fallback and you're moving.

---

## Custom tools / MCP behind an IAM gateway

If a custom tool or MCP server needs to reach a target fronted by a
corporate IAM gateway (WebEAM, Ping, Okta-as-reverse-proxy,
AzureAD, internal SAML proxy) that accepts only short-lived tokens
minted by a client-credentials flow, static credentials aren't
enough — those tokens expire. Tick the **"Use customer auth hook for
IAM-gated targets"** checkbox in the editor. With it on, the
dispatcher calls `bin/customer_authorisation.py` once per `/invoke`
and merges the returned headers onto the outbound request.

This is the SAME hook the LLM proxy uses for IAM-gated LLM endpoints,
so a single customer-edited `local/bin/customer_authorisation.py`
can serve all three flows (LLM / custom tool / MCP). The hook
receives a `context["target_kind"]` discriminator
(`"llm"` / `"tool"` / `"mcp"`) plus call-specific fields. See the
docstring at the top of the hook file and
[the customer authorisation hook guide](../security/customer-authorisation-hook.md) for
the full contract.

Composition rules:

- The IAM hook layer composes WITH `auth.type`. Both run; if both
  set the same header key (e.g. `Authorization`), the hook wins.
  Use this for the common compound case "static `X-Api-Key` for the
  target app + IAM-minted `Authorization` for the gateway in front
  of it".
- A hook failure is a hard refusal — the dispatcher will never fall
  back to an unauthenticated upstream call. The failure surfaces to
  the LLM as `{ok: false, error: "customer_auth hook failed: <msg>"}`
  so the LLM can retry intelligently.
- Cache hits do NOT re-run the hook (response is served from the
  per-(tool, args) cache). The audit row's `customer_auth_used`
  field distinguishes fresh gateway calls from cache hits.
- The cache key follows the tool's credential model. With the `global`
  model it is (tool, args) and is **not** scoped per user or per Org;
  with `per_tenant` it is (tool, Org, BU, args); with `per_user` it is
  (tool, user, args). If a `global` tool's hook attaches user-specific
  identity (for example a per-user OAuth token), set
  `guardrails.cache_ttl_seconds = 0` on the tool to disable caching.

The **IAM** pill next to a tool's name in the Tools tab indicates
the hook is enabled for that tool.

To iterate on your hook locally without going through Splunk Web,
run it directly with Splunk's bundled Python — the `__main__` block
at the bottom of `customer_authorisation.py` calls the hook with an
LLM-flow stub, a tool-flow stub, and an MCP-flow stub and prints
the returned headers.

---

## Runner-side tools — the gate is the action grant, not the tool list

Two tools exist that you will **not** find on the **Tools** tab, cannot
enable or disable per Org/BU, and will not see in the 196 counted above.
They are advertised by the **unattended integration runner** to a
scheduled integration, not by the interactive dispatcher:

| Tool | Advertised when | What it does |
|---|---|---|
| `splunk_writer` | the integration contract resolves to a non-empty **output allowlist** | Lands a batch of records into one Splunk destination: `kvstore` (idempotent upsert via key fields), `index_hec`, `index_spool` or `index_metric`. Destinations are restricted to the contract's allowlist and the tool cannot widen it. The writer never creates indexes. |
| `network_input_source_discover` | the Org has the network-policy surface | Proposes input sources from what an approved device reports about its neighbours (CDP/LLDP on IOS and NX-OS, security contexts on a multi-context ASA, managed device records from FMC). Writes rows with status `proposed`, **no credential and no adapter**: it can never add, approve or credential a source. |

### Which field actually decides what a scheduled integration can do

`allowed_tools` and `allowed_actions` are different fields answering
different questions, and the distinction matters most on the unattended
path:

- **`allowed_tools`** shapes what the **interactive** dispatcher
  advertises to the model — see [Tool routing](#tool-routing--minimum-budget-by-default).
  The unattended runner builds its own tool list from the integration
  contract instead, so an agent's `allowed_tools` does not narrow an
  unattended run.
- **`allowed_actions`** on the integration contract is the control over
  **writes**, on both paths. It is default-deny and checked immediately
  before dispatch: a write tool whose action is not granted is refused,
  not merely hidden.

So when you are reasoning about what a scheduled integration can do, read
its `allowed_actions`. Five tools carry an action that must be granted
there; the read-only tools in the chain are bounded by licence capability
and Org/BU scope instead:

| Action | Effect if granted |
|---|---|
| `cisco_fmc_collect` | opens an authenticated HTTPS session to a firewall manager |
| `cisco_device_configuration_acquire` | opens an SSH session to an approved device |
| `network_input_source_discover` | writes `proposed` source rows |
| `firewall_policy_store` | persists a snapshot to an index and/or KV current state |
| `splunk_writer` | lands records into a destination on the contract's allowlist |

The writer's `write_mode` accepts `upsert` and `append` only. There is
deliberately no whole-collection replace: removing records is a separate,
explicitly scoped operation, so a batch that arrives short cannot delete
what it did not carry.

### Where the three integration surfaces sit

The two tools above plus `splunk_mapping` and `splunk_memory` are the
four tools a scheduled integration actually runs on, and only the last
two are also reachable interactively:

| Surface | Interactive (Tools tab) | Unattended runner |
|---|---|---|
| `splunk_mapping` — the contract | yes (`data-platform`) | yes, advertised to every integration |
| `splunk_memory` — watermarks and learned facts | yes (`knowledge`) | yes, advertised to every integration |
| `splunk_writer` — landing records | **no** | only with an output allowlist |
| `network_input_source_discover` | **no** | Orgs with the network-policy surface |

A scheduled integration run is one ordered plan, not a conversation: read
the mapping, read the watermark, acquire, normalise, land through the
writer, read back, and only then advance the watermark. The order is the
point — a watermark advanced before the read-back has confirmed the write
is a resume point past data that was never stored.

---

## KVStore footprint

Tool-related data lives in these KVStore collections (see
[the admin manual](../admin-manual.md#backup--restore) and
for the backup story):

| Collection | Purpose |
|---|---|
| `itmip_tool_assignments` | Per-Org/BU enable/disable rules for built-in tools. |
| `itmip_tool_overrides` | Per-tool tag / category / short_description overrides. |
| `itmip_llm_custom_tools` | Admin-authored HTTP custom-tool definitions. |
| `itmip_mcp_servers` | Registered upstream MCP server connections. |
| `itmip_mcp_tools` | Imported MCP-exposed tools. |
| `itmip_llm_custom_tool_calls` | Unified audit log for custom-tool AND MCP invocations. |

All of these are covered by the v0.8.0 daily KVStore backup. Tool
credentials and proxy/TLS-CA blobs live in `storage/passwords` and
are tracked separately by the §5.1 referenced-credentials inventory.

---

## Where to go next

- End-user view of how the LLM uses tools → [the user manual](../../user/user-manual.md).
- The broader admin surface → [the admin manual](../admin-manual.md).
- IAM hook contract → [the customer authorisation hook guide](../security/customer-authorisation-hook.md).

