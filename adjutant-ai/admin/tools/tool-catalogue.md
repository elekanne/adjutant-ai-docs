---
sidebar_position: 7
---

# Tool catalogue

**App version:** 2.7.5
**Last updated:** 2026-10-28
**Audience:** Splunk admins managing which tools the assistant may use, and how
they are scoped per Org and Business Unit.

---

## Tools, skills, agent templates and knowledge: choosing the right layer

Adjutant AI has four layers that shape what the assistant does on your
behalf. Knowing which layer to touch when you want to change behaviour is
the difference between a 30-second admin edit and an hour of prompt
tweaking.

| Layer | What it is | Lives in | Touch it when |
|---|---|---|---|
| **Tool** | A function the assistant can call, for example `splunk_run_search` or `splunk_xml_publish`. 196 are built in (including the Splunk Security Essentials tools and the agent authoring tools), plus your custom HTTP tools and the tools imported from MCP servers. | The app's built-in catalogue and the **Tools** tab | You need a new *capability*: talk to a new system, or create a new kind of object. |
| **Skill** | A reusable rule the assistant must follow ("no emojis in dashboards", "AI Toolkit models follow the `aiworkbench` naming pattern", "a proof dashboard shows the artifact working"). Plain text, no code, placed in front of the agent template's prompt. See [Skills](./skills.md). | The `itmip_ai_skills` KV store collection and the **Skills** tab | A rule applies to several agent templates and should live in one place. |
| **Agent template** | A governed task: its steps, its form inputs, the names of what it creates, its tools and the skills it includes (`includes_skills`). Every action is gated and logged. | The `itmip_ai_use_cases` KV store collection and the **Agents** tab | You want to add or refine one end-user task, with its own questions and its own output. |
| **Knowledge** | Reference material the assistant pulls when it needs it: rules, curated entries, command and visualization notes, the configuration specification, the CIM models and the facts it has learned. See [Knowledge layer](./knowledge-layer.md). | Knowledge connectors and the **Knowledge** tab | The assistant needs to know something about your environment or your practices. |

**Rules of thumb:**

- *"All my dashboards should use a colourblind-safe palette"*: that is
  a **skill** edit. Find `viz-best-fit` and add the rule to its body.
  Every agent template that includes `viz-best-fit` picks it up; you do
  not touch any agent template.
- *"My new use case is 'help users debug their syslog ingestion'"*:
  that is an **agent template**. Create a new agent, declare its
  `includes_skills: ["feed-health-verdict", "spl-perf-priorities",
  "spl-validation-loop", "metric-vs-event-index-aware"]` and write the
  workflow.
- *"Alerts from product X live in one index, and the assistant should
  know"*: that is **knowledge**. Add a curated entry in
  **Knowledge > Curated entries**.
- *"I have a ServiceNow CMDB that the assistant should be able to query"*:
  that is a **tool**. Use the ServiceNow integration, create a custom HTTP
  tool, or register an MCP server (see [Custom tools](#custom-tools)
  below).

The [skills page](./skills.md) documents all 53 skills, and the
[tools and agent templates overview](./tools-and-playbooks.md) shows how
the layers are assembled into one prompt.

---

## What you see on the Tools tab

The tab has four sections, top to bottom:

1. **Filter bar**: free-text search and multi-select tag and category
   filters. Built-in and custom tools are listed together; filters
   apply across both.
2. **Built-in tool table**: every tool the app offers the assistant
   out of the box (`splunk_run_search`, `splunk_xml_publish`,
   `splunk_ai_command`, `splunk_route_tools` and the rest). One row per tool.
3. **Custom tools**: admin-authored HTTP tools.
4. **MCP servers**: registered MCP server connections and the tools
   imported from them.

Every row shows the tool's name, a short description (the same string
the LLM sees, truncated for the table), tag pills, category pills,
and admin-only action buttons.

---

## Tool routing: a small set by default

A run does not send the whole tool catalogue to the model on every
question; that would inflate prompt tokens and confuse smaller models.
Instead the app:

1. Looks at the active agent template, if any. An agent template can
   declare `allowed_tools`, `denied_tools`, `tool_tag_filters` and
   `tool_category_filters`, which scope what the model is offered.
2. If no agent template scopes the tools, offers a small
   **essentials set** of 25 tools (search, saved searches, lookups,
   dashboards, alerts, the AI Toolkit check, and the seven universal
   tools for the version, agent templates, tool routing and knowledge),
   not all 196. The model finds and **unlocks** the rest on demand by
   calling `splunk_route_tools`: the tools it returns are added to the
   offered set for the rest of the conversation, so the model can call
   Enterprise Security, ITSI, TrackMe, AI Toolkit, Dashboard Studio,
   data onboarding, MCP or custom tools straight after routing to them.
   A fetched knowledge entry can unlock tools the same way (see
   [knowledge unlocks tools](./knowledge-layer.md#knowledge-unlocks-tools)).

The seven universal tools (`splunk_get_version`,
`splunk_list_use_case_templates`, `splunk_get_use_case_template_prompt`,
`splunk_route_tools`, `splunk_route_knowledge`, `splunk_search_knowledge`
and `splunk_get_knowledge_entry`) are offered on every agent template,
even one that scopes its tools, unless an admin disables them for the
Org or Business Unit.

That is why the assistant may say *"let me check what tools are
available"* in the middle of a conversation: it is calling
`splunk_route_tools` rather than guessing.

**Why it matters (cost).** Each turn of the tool loop sends the whole
offered tool block again. With every tool offered, that block alone
can run to tens of thousands of input tokens per turn. The essentials
default cuts it to a fraction, and prompt caching (for providers that
support it) reads the unchanged prefix, tools and system prompt, from
cache at a fraction of the input price on every turn after the first.
The Tokens & Costs tab shows the `cache_read` and `cache_creation`
split so you can see it working.

---

## Built-in tool catalogue

The app ships **196 built-in tools**. By source category
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

Every built-in tool, by category (a tool with two categories is listed under both):

<!-- generated:tool-categories (scripts/gen_knowledge_docs.ts; do not edit) -->
| Category | Tools | Names |
|---|---|---|
| `ai-toolkit` | 8 | `splunk_check_cdtsm_availability`, `splunk_share_mltk_model_globally`, `splunk_check_ml_capabilities`, `splunk_proof_snapshot`, `splunk_list_ml_models`, `splunk_ai_command`, `profiling_capabilities`, `profiling_build_profile` |
| `alerts` | 2 | `splunk_create_alert`, `splunk_update_alert` |
| `dashboards-compiler` | 2 | `splunk_compile_dashboard`, `splunk_revise_dashboard` |
| `dashboards-simplexml` | 15 | `splunk_get_dashboard_xml`, `splunk_create_dashboard_xml`, `splunk_update_dashboard_xml`, `splunk_xml_create`, `splunk_xml_add_base_search`, `splunk_xml_update_base_search`, `splunk_xml_set_color_tokens`, `splunk_xml_add_tab_group`, `splunk_xml_add_input`, `splunk_xml_add_panel`, `splunk_xml_update_panel`, `splunk_xml_remove_panel`, `splunk_xml_preview`, `splunk_xml_publish`, `splunk_get_dashboard_panel_data` |
| `dashboards-studio` | 15 | `splunk_check_studio_runtime`, `splunk_list_studio_reference_stanzas`, `splunk_get_studio_reference_stanza`, `splunk_builder_create_dashboard`, `splunk_builder_add_time_picker`, `splunk_builder_add_dropdown`, `splunk_builder_add_data_source`, `splunk_builder_add_visualization`, `splunk_builder_position`, `splunk_builder_preview`, `splunk_builder_publish`, `splunk_get_dashboard_studio_json`, `splunk_create_dashboard_studio_json`, `splunk_update_dashboard_studio_json`, `splunk_get_dashboard_studio_panel_data` |
| `data-onboarding` | 12 | `splunk_generate_conf_package`, `splunk_check_ingest_health`, `splunk_audit_cim_coverage`, `splunk_get_props_conf`, `splunk_get_transforms_conf`, `splunk_check_sourcetype_exists`, `splunk_validate_props_conf`, `splunk_validate_transforms_conf`, `splunk_compute_data_quality_score`, `splunk_check_cribl_ingest_health`, `splunk_check_edge_processor_health`, `splunk_check_extraction_completeness` |
| `data-platform` | 3 | `splunk_mapping`, `profiling_capabilities`, `profiling_build_profile` |
| `enterprise-security` | 19 | `es_list_notables`, `es_get_notable`, `es_update_notable`, `es_get_notable_drilldown`, `es_get_risk_score`, `es_list_risk_events`, `es_list_risk_rules`, `es_threat_lookup`, `es_list_threat_sources`, `es_asset_lookup`, `es_identity_lookup`, `es_list_investigations`, `es_get_investigation`, `es_add_investigation_note`, `es_list_correlation_searches`, `es_get_correlation_search`, `es_cim_search`, `es_describe_cim_model`, `es_list_adaptive_responses` |
| `fraud` | 10 | `splunk_audit_fraud_readiness`, `fraud_risk_plan`, `fraud_generate_risk_rule`, `fraud_generate_notable_rule`, `fraud_risk_ring_scan`, `fraud_migration_discover`, `fraud_migrate_content`, `fraud_canonicalize_identifiers`, `fraud_shared_attribute_pivot`, `fraud_velocity_travel` |
| `itsi` | 16 | `itsi_list_services`, `itsi_get_service`, `itsi_get_service_health_history`, `itsi_list_kpis`, `itsi_get_kpi`, `itsi_get_kpi_search`, `itsi_list_entities`, `itsi_get_entity`, `itsi_list_episodes`, `itsi_get_episode`, `itsi_run_rca`, `itsi_update_episode`, `itsi_list_glass_tables`, `itsi_list_deep_dives`, `itsi_list_neaps`, `itsi_service_topology` |
| `knowledge` | 5 | `splunk_memory`, `splunk_route_knowledge`, `splunk_search_knowledge`, `splunk_get_knowledge_entry`, `splunk_report_knowledge_use` |
| `knowledge-objects` | 12 | `splunk_list_saved_searches`, `splunk_review_spl`, `splunk_get_saved_search`, `splunk_list_macros`, `splunk_get_macro`, `splunk_list_eventtypes`, `splunk_get_eventtype`, `splunk_list_tags`, `splunk_get_tag`, `splunk_create_saved_search`, `splunk_update_saved_search`, `splunk_run_saved_search_by_name` |
| `metrics` | 1 | `splunk_list_metrics` |
| `network-policy` | 13 | `cisco_asa_config_collect`, `cisco_fmc_collect`, `cisco_device_configuration_acquire`, `cisco_asa_config_parse`, `fortinet_config_collect`, `fortinet_config_parse`, `panos_config_collect`, `panos_config_parse`, `firewall_policy_normalize`, `firewall_rule_expand`, `firewall_policy_diff`, `firewall_policy_export`, `firewall_policy_store` |
| `routing` | 1 | `splunk_route_tools` |
| `search` | 8 | `splunk_review_spl`, `splunk_verify_equivalence`, `splunk_run_search`, `splunk_metadata`, `splunk_walklex`, `splunk_typeahead`, `splunk_validate_full_range`, `splunk_term_check` |
| `security-content` | 5 | `sse_check_prerequisites`, `sse_list_content`, `sse_get_detection`, `sse_enrich_id`, `sse_enrich_alert` |
| `servicenow` | 17 | `servicenow_get_incidents`, `servicenow_get_incident`, `servicenow_get_journal`, `servicenow_get_changes`, `servicenow_get_problems`, `servicenow_cmdb_list_classes`, `servicenow_cmdb_get_records`, `servicenow_cmdb_describe_table`, `servicenow_cmdb_related`, `servicenow_table_get`, `servicenow_create_incident`, `servicenow_update_incident`, `servicenow_create_event`, `servicenow_cmdb_upsert`, `servicenow_get_security_incidents`, `servicenow_create_security_incident`, `servicenow_update_security_incident` |
| `splunk-core` | 9 | `splunk_get_version`, `splunk_list_indexes`, `splunk_list_sourcetypes`, `splunk_describe_sourcetype`, `splunk_list_hosts`, `splunk_list_sources`, `splunk_list_lookups`, `splunk_get_lookup_sample`, `splunk_list_apps` |
| `templates` | 5 | `splunk_seed_status`, `splunk_list_use_case_templates`, `splunk_create_user_template`, `splunk_update_user_template`, `splunk_get_use_case_template_prompt` |
| `trackme` | 19 | `trackme_get_version`, `trackme_list_tenants`, `trackme_get_tenant`, `trackme_list_entities`, `trackme_get_entity`, `trackme_smart_status`, `trackme_get_entity_metrics`, `trackme_get_outliers`, `trackme_get_cim_compliance`, `trackme_list_cim_issues`, `trackme_get_workload_status`, `trackme_get_search_perf`, `trackme_list_acks`, `trackme_list_maintenance`, `trackme_get_identity_card`, `trackme_ack_entity`, `trackme_update_entity_priority`, `trackme_update_maintenance`, `trackme_health_for_indexes` |
| `visualizations` | 2 | `splunk_list_visualizations`, `splunk_get_visualization_docs` |
<!-- /generated:tool-categories -->

The **Tools** tab shows each tool's description. Notes on the categories
that need more than a name:

- **`dashboards-simplexml`**: hand-written XML (`splunk_create_dashboard_xml`,
  `splunk_update_dashboard_xml`), and the **builder**: the model composes a
  dashboard with small typed calls (`splunk_xml_create`, `splunk_xml_add_input`,
  `splunk_xml_add_base_search`, `splunk_xml_add_panel` and the rest) and publishes
  it with `splunk_xml_publish`, so it never writes the whole `<dashboard>` by hand.
  The builder steps change only a draft in the browser; only a publish writes to
  Splunk. See [How search and dashboard tools check your data](#how-search-and-dashboard-tools-check-your-data)
  for what a publish checks and adds.
- **`dashboards-studio`**: the Dashboard Studio builder (`splunk_builder_create_dashboard`,
  `splunk_builder_add_time_picker`, `splunk_builder_add_dropdown`,
  `splunk_builder_add_data_source`, `splunk_builder_add_visualization`,
  `splunk_builder_position`, `splunk_builder_preview`, `splunk_builder_publish`) and
  the JSON tools (`splunk_create_dashboard_studio_json`, `splunk_update_dashboard_studio_json`,
  `splunk_get_dashboard_studio_json`, `splunk_check_studio_runtime`). The Dashboard
  Studio agent template ships as a draft.
- **`dashboards-compiler`**: `splunk_compile_dashboard` builds and publishes a
  dashboard from an intermediate description in one call, and owns base-search
  factoring, token binding, XML escaping and layout. It replaces the whole
  `splunk_xml_*` sequence for agent templates that carry this category.
  `splunk_revise_dashboard` patches a published dashboard; only presentation and
  narrative fields can change, and anything structural is refused by name.
- **`ai-toolkit`**: training and scoring are SPL (`fit` and `apply`) that the
  assistant writes and runs with `splunk_run_search`, not separate tools.
  `splunk_proof_snapshot` saves a dashboard's proof data to a lookup that anyone who
  can open the dashboard can read; it is not private.
- **`security-content`** (Splunk Security Essentials): `sse_check_prerequisites`,
  `sse_list_content`, `sse_get_detection`, `sse_enrich_id` and `sse_enrich_alert`
  reach the Security Essentials content catalogue and its real detection SPL through
  its own search commands. They return content only when Security Essentials is
  installed and visible to the person asking.
- **`data-onboarding`**: authoring (`splunk_generate_conf_package` drafts a
  deployment-ready package of props, transforms, inputs, tags and serverclass and
  returns a download; `splunk_validate_props_conf` and `splunk_validate_transforms_conf`
  check a stanza against the configuration specification;
  `splunk_compute_data_quality_score` grades a source from 0 to 100) needs the
  `data_onboarding` capability. The ingestion health checks (`splunk_check_ingest_health`,
  `splunk_check_cribl_ingest_health`, `splunk_check_edge_processor_health`) work on
  every tier, bounded only by the person's Splunk role and index access.
- **`servicenow`** (needs the ServiceNow integration): 17 server-side tools: reads
  (incidents, changes, problems, journals, CMDB and CSDM classes and records with
  bounded relationship traversal, and any table), writes (incidents, events and CMDB
  records) and security incidents (only when the Org enables them). Configure it under
  **Tools > ServiceNow**, not as a custom HTTP tool; see [the ServiceNow guide](../integrations/servicenow.md).
- **`network-policy`**: thirteen tools for three vendors in one chain: acquire, parse,
  normalise, then read. From `firewall_policy_normalize` on, everything is
  vendor-neutral. Cisco: `cisco_asa_config_collect` (imports ASA configuration text;
  it does not log in to a device), `cisco_device_configuration_acquire` (SSH to an
  approved device with a fixed read-only command profile), `cisco_fmc_collect` (an FMC
  access-control collection) and `cisco_asa_config_parse`. Fortinet:
  `fortinet_config_collect` and `fortinet_config_parse`. Palo Alto: `panos_config_collect`
  (set format only) and `panos_config_parse`. Then `firewall_policy_normalize`,
  `firewall_rule_expand`, `firewall_policy_diff`, `firewall_policy_export` and
  `firewall_policy_store`. Two things to know before reading a result: a tuple is not
  proof of reachability, and deletions are computed by comparing two complete snapshots,
  never read from the device. Three of the thirteen need an action grant; see
  [Runner-side tools](#runner-side-tools-the-gate-is-the-action-grant-not-the-tool-list).
- **`fraud`**: readiness first (`splunk_audit_fraud_readiness` matches sources by
  content, not by sourcetype name), then `fraud_risk_plan`, the two-tier rule model
  (`fraud_generate_risk_rule` adds weight for a resolved entity,
  `fraud_generate_notable_rule` accumulates it per entity and needs two or more rule
  families), `fraud_risk_ring_scan` for rings, identity resolution
  (`fraud_canonicalize_identifiers`, `fraud_shared_attribute_pivot`,
  `fraud_velocity_travel`) and migration from the retiring Splunk fraud apps
  (`fraud_migration_discover`, `fraud_migrate_content`). Every generator returns SPL to
  review with `disabled=1`; nothing is enabled, scheduled or deployed.
- **`data-platform`**: `splunk_mapping` reads and drafts integration mapping
  specifications; a draft is promoted by a person in the **Mappings** tab. Plus
  `profiling_capabilities` and `profiling_build_profile`.
- **`knowledge`**: the three knowledge tools, `splunk_report_knowledge_use` and
  `splunk_memory`. See [Knowledge layer](./knowledge-layer.md).

Of the 196 tools, 144 only read, 46 write and 6 change privileged objects
(Enterprise Security notables and investigations, ITSI episodes, global AI Toolkit
model sharing, and two firewall tools). A tool that creates an object returns
`{ok, kind, name, action, url}`, so the **Created in Splunk** panel can link to it.
[Knowledge each tool uses or creates](#knowledge-each-tool-uses-or-creates) lists
what each of them leaves behind.

## How search and dashboard tools check your data

The search, save and publish tools check a search against your data before they
trust it. In 2.7.5:

- **The app chooses the form of a search.** When a saved search, an alert or a
  `splunk_run_search` call uses `tstats` with a filter on a field that exists only at
  search time, the app no longer refuses it. It compares the exact event search with
  the faster `TERM()` form over a recent window. When both find the same events, it
  uses the faster form; otherwise it uses the exact search. The result says in one or
  two sentences which form was used and why. This applies to `splunk_create_saved_search`,
  `splunk_update_saved_search`, `splunk_create_alert`, `splunk_update_alert` and
  `splunk_run_search`. The assistant does not ask you to choose a technique.
- **Event listings stop early.** With `purpose: "answer"` (the default), a
  `splunk_run_search` that lists raw events over more than an hour, with no volume
  figure, lists the first 50 matching events and stops. The result says it did not
  count the total. Counts and other aggregations, `exact: true` and windows of an hour
  or less are not affected. Checks before saving use `purpose: "explore"`.
- **Rare events are found first.** When a search filters on `field=value` and the value
  is one indexed word, the proof uses `TERM(value)` to find where the events are, then
  checks from 5 minutes before the first hit to 5 minutes after the last. When the first
  window holds more than a million events, the proof starts with the last 5 minutes. An
  empty window widens: 5 minutes, then 1 hour, then 24 hours, then the full range.
- **Each dashboard panel finds its own window.** `splunk_get_dashboard_panel_data`
  widens each empty panel on its own, from 1 hour to 24 hours to the full range, and
  reports where it found rows or every window it tried. A panel over a small index is
  read without sampling; an index pattern such as `web_*` counts toward the volume, but
  a bare `*` or an excluded index does not.
- **Publishing is faster.** A publish runs its validation searches and panel checks up to
  four at a time, waits for an identical check already running instead of starting it
  again, and polls search jobs more often at first.
- **A Simple XML dashboard gets a Data quality row.** `splunk_xml_publish` adds a
  **Data quality** row at the top: a note with the ingestion health result per sourcetype
  (counts only) and a **Newest event per index** table that runs as the viewer. When an
  index had no event in 24 hours, a "No new data" banner replaces the table. When the
  check cannot run, the note says "not checked" and why, and the publish goes ahead.
  Dashboards that read only lookups, REST or metrics get no row, and a republish
  replaces the row rather than adding a second one. Hand-written XML, the compiler and
  Dashboard Studio do not add it.

## Knowledge each tool uses or creates

<!-- generated:tool-knowledge (scripts/gen_knowledge_docs.ts; do not edit) -->
50 of the 196 built-in tools read the knowledge layer or create something in Splunk. Every other tool reads Splunk and leaves nothing behind.

| Tool | Category | Effect | Knowledge it uses | Knowledge it creates |
|---|---|---|---|---|
| `splunk_memory` | knowledge | write | [learned facts](./knowledge-layer.md#learned-knowledge) | [learned facts](./knowledge-layer.md#learned-knowledge) |
| `splunk_mapping` | data-platform | write | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `cisco_asa_config_collect` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `cisco_fmc_collect` | network-policy | write | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `cisco_device_configuration_acquire` | network-policy | privileged | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `cisco_asa_config_parse` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `fortinet_config_collect` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `fortinet_config_parse` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `panos_config_collect` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `panos_config_parse` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `firewall_policy_normalize` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `firewall_policy_export` | network-policy | read | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `firewall_policy_store` | network-policy | privileged | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `splunk_create_dashboard_xml` | dashboards-simplexml | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_update_dashboard_xml` | dashboards-simplexml | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_xml_publish` | dashboards-simplexml | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_compile_dashboard` | dashboards-compiler | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_revise_dashboard` | dashboards-compiler | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_builder_publish` | dashboards-studio | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_create_dashboard_studio_json` | dashboards-studio | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_update_dashboard_studio_json` | dashboards-studio | write | none | [dashboards](./knowledge-layer.md#dashboards) |
| `splunk_create_saved_search` | knowledge-objects | write | none | [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts) |
| `splunk_update_saved_search` | knowledge-objects | write | none | [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts) |
| `splunk_share_mltk_model_globally` | ai-toolkit | privileged | none | [lookups](./knowledge-layer.md#lookups), [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `splunk_create_user_template` | templates | write | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `splunk_update_user_template` | templates | write | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `splunk_route_knowledge` | knowledge | read | [knowledge connectors](./knowledge-layer.md#how-the-assistant-reads-knowledge) | none |
| `splunk_search_knowledge` | knowledge | read | [knowledge connectors](./knowledge-layer.md#how-the-assistant-reads-knowledge) | none |
| `splunk_get_knowledge_entry` | knowledge | read | [knowledge connectors](./knowledge-layer.md#how-the-assistant-reads-knowledge), [knowledge unlocks tools](./knowledge-layer.md#knowledge-unlocks-tools) | none |
| `splunk_report_knowledge_use` | knowledge | write | none | [telemetry events](./knowledge-layer.md#telemetry) |
| `splunk_proof_snapshot` | ai-toolkit | write | none | [lookups](./knowledge-layer.md#lookups) |
| `splunk_create_alert` | alerts | write | none | [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts) |
| `splunk_update_alert` | alerts | write | none | [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts) |
| `es_update_notable` | enterprise-security | privileged | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `es_add_investigation_note` | enterprise-security | privileged | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `itsi_run_rca` | itsi | write | none | [KV store collections](./knowledge-layer.md#kv-store-collections) |
| `itsi_update_episode` | itsi | privileged | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `trackme_ack_entity` | trackme | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `trackme_update_entity_priority` | trackme | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `trackme_update_maintenance` | trackme | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `splunk_audit_cim_coverage` | data-onboarding | read | [cim-data-models](./knowledge-layer.md#cim-data-models) | none |
| `splunk_validate_props_conf` | data-onboarding | read | [conf-spec](./knowledge-layer.md#conf-spec) | none |
| `splunk_validate_transforms_conf` | data-onboarding | read | [conf-spec](./knowledge-layer.md#conf-spec) | none |
| `splunk_compute_data_quality_score` | data-onboarding | read | [conf-spec](./knowledge-layer.md#conf-spec) | none |
| `servicenow_create_incident` | servicenow | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `servicenow_update_incident` | servicenow | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `servicenow_create_event` | servicenow | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `servicenow_cmdb_upsert` | servicenow | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `servicenow_create_security_incident` | servicenow | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
| `servicenow_update_security_incident` | servicenow | write | none | [records in other apps](./knowledge-layer.md#records-in-other-apps) |
<!-- /generated:tool-knowledge -->

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
is where you teach the LLM about external systems: ServiceNow,
CMDBs, internal wikis, threat-intel APIs, anything that speaks HTTP.

> **ServiceNow has a dedicated, first-class integration (v1.7.0).** You no longer
> need to hand-author custom-HTTP tools for ServiceNow: Adjutant AI ships a built-in
> `servicenow` tool category (incidents, changes, problems, CMDB/CSDM with bounded
> relationship traversal, SIR security incidents, events), curated CSDM/code knowledge,
> a deterministic incident-description renderer, alert-driven agent templates with
> bi-directional write-back, and per-Org REST **or** MCP transport, gated at
> **Professional + the `servicenow` feature**. Configure it under **Tools → ServiceNow
> connections**. Full guide: **[the ServiceNow guide](../integrations/servicenow.md)**. Custom-HTTP tools remain
> the escape hatch for *other* external systems (and for a bespoke ServiceNow table).

### Authoring a tool

Click **+ Add custom tool**. The editor has six tabs: **General**, **Parameters**, **Request**, **Network**,
**Response and limits** and **Test**. It is left only through **Cancel** or **Create** (**Save changes** for an
existing tool). Each field is checked as you type, with the same rule and wording the server applies: a tab with
a problem says **has errors**, the problem is shown under its field, and the save button stays disabled and names
the tabs to fix. What the tabs hold:

1. **Identity**: `name` (lowercase, snake_case, becomes the
   function-name the LLM sees), `version` (semver), `title`,
   `description`. The description is the *only* prose the LLM sees:
   make it specific and tell the model when to call this tool.
2. **Scope** (on **General**): `sharing` (`private` = owner Org+BU only, `app` =
   whole owner Org, `global` = every Org), and the owning Org / BU, chosen
   from your Organisations and Business Units under **Who may use this tool?**.
   Default is your own Org/BU. A private tool needs its Business Unit.
3. **Parameters**: a JSON Schema draft-07 object. Whatever
   properties you declare here become the arguments the LLM must
   supply when calling the tool. The schema reaches the LLM
   verbatim, so describe each property clearly.
4. **Implementation**: for 0.4.0+ the supported type is `http`.
   Fill in `method`, `url`, optional `query` and `headers` maps, the
   `auth` block (see §"Credential management" below), `timeout_seconds`,
   the required `allowed_hosts` allowlist and, for POST, PUT and PATCH, the
   **Request body** (JSON is sent as JSON, anything else as text). The
   optional `proxy_url` / `proxy_credential_ref` / `tls_ca_pem_ref` for
   environments behind a corporate egress (0.7.0+) are on the **Network** tab.
5. **Response shaping**: optional `jq` or `jsonpath` transform plus
   a `max_bytes` cap. Use this to strip noise out of large responses
   before they reach the LLM (an unfiltered ServiceNow incident
   payload is ~3 KB of fields the model doesn't need).
6. **Guardrails**: per-user `rate_limit_per_minute`,
   `cache_ttl_seconds`, and `redact_fields` for nested key scrubbing
   before the result is sent to the LLM.

### Template substitution

URL, query params, headers, and body all support `{{ argName }}`
substitution against the LLM's tool-call arguments. Substitution is
literal: no Python eval, no expressions, just direct value
replacement. A missing argument fails the call (the tool refuses to
go out with blanks).

### Allowed-hosts allowlist

Every HTTP tool must declare which hostnames it may reach. The
handler enforces the allowlist *after* template substitution, so a
parameter-driven URL like `https://{{ host }}/x` can't be redirected
to an arbitrary host by the LLM; only entries in `allowed_hosts`
are accepted at call time. RFC1918 / loopback hosts are refused
unless `implementation.allow_internal: true` is set.

### Credential management: three tiers

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
advertised list, so they are never visible-and-broken. The Tools tab
shows the resolution status next to each tool row.

#### Proxy + TLS CA

0.7.0 also added three optional `implementation` fields for
restricted-egress environments:

- `proxy_url`: explicit HTTP(S) proxy URL.
- `proxy_credential_ref`: name of a `storage/passwords` entry
  containing the proxy's basic-auth credentials.
- `tls_ca_pem_ref`: name of a `storage/passwords` entry containing
  a PEM bundle to use as the TLS CA store for this tool.

A shared outbound-HTTP builder
(`bin/itmip_llm_http_client.py::build_request`) honours all three;
the same builder backs the MCP client too, so a proxy or custom CA
configured for a custom tool also works for MCP servers using the
same env.

### Save and test

On the editor's **Test** tab, type a sample arguments JSON and click **Save and test**. It saves the tool
first, so the call runs what is on screen, keeps the dialog open, and shows the transformed response inline.
It is enabled only when every tab is valid. The full request goes through the same /invoke path
the LLM will use: what you see is exactly what the LLM will see.

### Import / Export

Tool definitions are pure JSON. Use **Export JSON** to download a
finished definition; paste it into another environment via **Import
JSON**. The importing Org/BU is set to the importer's resolved
Org/BU by default; edit afterwards if you want wider scope.

### Audit trail

Every `/invoke` call is logged to the `itmip_llm_custom_tool_calls`
KVStore collection with the user, tool, hash of the arguments,
status, error (if any), and duration. v0.7.0 added these fields:

- `credential_model`: `global` / `per_tenant` / `per_user`.
- `credential_ref_resolved`: the final `storage/passwords` name
  after template expansion (no secret value, just the name).
- `tool_kind`: `builtin` / `http_custom` / `mcp`.
- `mcp_server_id` / `mcp_upstream_name`: set only for MCP calls.

The `customer_auth_used` field (bool) records whether the IAM hook
ran on that call, which is useful for distinguishing fresh gateway calls
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
one custom HTTP tool per upstream MCP-exposed function: tedious,
error-prone, and creates drift.

This implementation follows MCP spec **2025-11-25** with the
**Streamable HTTP** transport (legacy HTTP+SSE is supported as a
fallback for servers that emit `Content-Type: text/event-stream`).
`stdio` transport is explicitly rejected for security reasons.

### Workflow

1. **Register a server**: click **+ Add MCP server**. Fill in
   `name`, `endpoint_url`, optional `description`, and the
   **Authentication** block. Choose **Static** (a pre-obtained
   bearer/API key via the same three-tier credential model as custom
   tools) or **OAuth 2.1** (1.5.0+; see *OAuth 2.1 authentication*
   below). Optional `proxy_url`, `proxy_credential_ref`,
   `tls_ca_pem_ref`, `customer_auth_hook` toggle (see below).
2. **Test connection**: clicking **Test connection** issues a
   `tools/list` JSON-RPC request to the upstream, parses the
   response, and shows you the upstream's reported tools without
   importing them. Use this to validate the auth + network path
   before any tool reaches the catalogue.
3. **Import tools**: pick a subset from the listed tools to import.
   Each import becomes a row in `itmip_mcp_tools` with an
   `exposed_name` (defaults to the upstream name, edit if you want a
   shorter/clearer LLM-facing label), `description_addendum`
   (prepended to the upstream description before the LLM sees it),
   `short_description`, `category`, `tags`. The runtime exposes
   imported tools to the LLM via the same dispatcher path as built-
   in and custom tools.
4. **Refresh**: re-issues `tools/list` and compares upstream
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
Org/BU-shared admin connection), `service` (unattended service identity,
for example a ServiceNow integration user consented once). Unattended runs
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
work; they just don't mint headers for MCP (correct fail-closed
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

## Working with PEM files: TLS CAs, self-signed certs, dev-mode skip

Three places in Adjutant AI reach outbound HTTPS endpoints that may
present a private CA or self-signed cert:

- **Custom HTTP tools** (this tab → *Custom HTTP tools* sub-section)
- **MCP servers** (this tab → *MCP servers* sub-section)
- **LLM configurations** (*Settings* tab → *LLM configurations*),
  but only in `splunk_proxy` call mode; `browser_direct` uses the
  browser's OS trust store

All three use the same dispatcher pattern, the same `tls_ca_pem_ref`
storage model (LLM uses a slightly different `tls_ca_pem` inline blob
rather than a `storage/passwords` reference, set via file-upload in
the editor), and the same dev-mode TLS-skip escape hatch described
below. The dispatcher trusts only the system store by default
(whatever's bundled with the Splunk Python runtime). This section is
recipe-driven: copy the snippets, change the paths, you're done.

> **Splunk Cloud restriction.** The dev-mode TLS-skip checkbox is
> **HIDDEN on Splunk Cloud** for all three surfaces, and refused at
> dispatch time regardless of what's stored in KVStore, by design.
> Cloud admins have no business disabling TLS verification on
> outbound calls; the platform's compliance posture forbids it. The
> rest of this section (proper CA PEMs) applies to Cloud just fine.

### When does this even matter?

- The upstream uses a **corporate / internal CA** that's not in
  Mozilla's public root store (most enterprises).
- The upstream is **a Splunk dev box on `localhost` / `*.local`**:
  splunkd ships with a self-signed cert that no system trust store
  knows about. This is the most common case for testing the bundled
  **Splunk MCP Server** app.
- You're running against an upstream behind a **TLS-intercepting
  proxy** that re-signs traffic with the corporate CA.

If your upstream presents a publicly-trusted cert (Let's Encrypt, a
commercial CA), you can skip this entire section and leave **TLS CA
ref** blank.

### Step 1: get the PEM

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

For **generating** a fresh self-signed cert from scratch (rare: only
when you're standing up your own dev upstream):

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout /tmp/dev_key.pem -out /tmp/dev_cert.pem \
  -days 365 -nodes -subj "/CN=localhost"
# /tmp/dev_cert.pem is the PEM to upload; the key stays with the server.
```

### Step 2: store the PEM in Splunk's `storage/passwords`

Two rules: use **`--data-urlencode "password@/path/to/file"`** so the
newlines survive, and pick a short memorable **name**: you will type
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
  | python3 -c "import sys,json; p=json.load(sys.stdin)['entry'][0]['content']['clear_password']; print('length:', len(p), 'starts with:', repr(p[:30]))"
# length: 2433 starts with: '-----BEGIN CERTIFICATE-----\nMI'
```

If the first 30 chars contain `%0A` instead of `\n`, the upload was
double-URL-encoded; redo step 2 carefully.

### Step 3: reference the name in the editor

In the **Edit MCP server** or **Edit custom HTTP tool** dialog:

- **TLS CA ref** → `upstream_internal_ca` (whatever you typed in
  step 2's `name=`).
- Save. Use **Test connection + list tools** (the MCP server's **Tools** tab) or **Save and test**
  (the custom tool's **Test** tab).

### Step 4: proving the PEM works (before blaming the dispatcher)

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
  `openssl s_client` (step 1), or (see the next section) flip on
  dev-mode skip if this is a local-machine test.

### The dev-mode escape hatch

Splunk's stock self-signed cert often lacks the basic constraints
OpenSSL needs to treat it as a trust anchor, which means even a
correctly-uploaded PEM can still fail validation. For
**local-development testing only**, **all three editors** (MCP
server, custom HTTP tool, LLM configuration) expose the same
checkbox:

> ⚠ **Skip TLS certificate verification (dev only)**: disables
> hostname check + CA validation.

When ticked, the dispatcher behaves like Node's
`NODE_TLS_REJECT_UNAUTHORIZED=0`: any certificate is accepted.

**Splunk Cloud:** the checkbox is **HIDDEN entirely on Cloud** in
all three editors, and the dispatcher **refuses** the flag at call
time regardless of what's in KVStore. Detection is via
`/services/server/info`'s `instance_type` field (cached for the
splunkd process lifetime via `bin/itmip_llm_guid.is_splunk_cloud`).

**Audit visibility:**

- MCP + custom HTTP tools: every call writes `tls_verify_skipped:
  true` into the audit row (`itmip_llm_custom_tool_calls`):

  ```spl
  | inputlookup itmip_llm_custom_tool_calls
  | where tls_verify_skipped = true
  | stats count by tool_name, user, mcp_server_id
  ```

- LLM proxy: writes one `splunkd.log` line per affected call,
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
PEM (e.g. cert rotated upstream), POST to the entry URL directly;
note the trailing `:` for the empty user segment:

```bash
curl -k -u admin:<pw> -X POST \
  --data-urlencode "password@/tmp/upstream_chain.pem" \
  "https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords/itmip_llm_assistent_app:upstream_internal_ca:"
```

### Worked example: Splunk MCP Server on localhost with self-signed cert

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
cert is a constraints-missing self-signed leaf, so tick **Skip TLS
certificate verification** as a fallback and you're moving.

---

## Custom tools / MCP behind an IAM gateway

If a custom tool or MCP server needs to reach a target fronted by a
corporate IAM gateway (WebEAM, Ping, Okta-as-reverse-proxy,
AzureAD, internal SAML proxy) that accepts only short-lived tokens
minted by a client-credentials flow, static credentials aren't
enough: those tokens expire. Tick the **"Use customer auth hook for
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
- A hook failure is a hard refusal: the dispatcher will never fall
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
run it directly with Splunk's bundled Python: the `__main__` block
at the bottom of `customer_authorisation.py` calls the hook with an
LLM-flow stub, a tool-flow stub, and an MCP-flow stub and prints
the returned headers.

---

## Runner-side tools: the gate is the action grant, not the tool list

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
  advertises to the model; see [Tool routing](#tool-routing-a-small-set-by-default).
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
| `splunk_mapping`: the contract | yes (`data-platform`) | yes, advertised to every integration |
| `splunk_memory`: watermarks and learned facts | yes (`knowledge`) | yes, advertised to every integration |
| `splunk_writer`: landing records | **no** | only with an output allowlist |
| `network_input_source_discover` | **no** | Orgs with the network-policy surface |

A scheduled integration run is one ordered plan, not a conversation: read
the mapping, read the watermark, acquire, normalise, land through the
writer, read back, and only then advance the watermark. The order is the
point: a watermark advanced before the read-back has confirmed the write
is a resume point past data that was never stored.

---

## KVStore footprint

Tool-related data lives in these KV store collections (see
[the admin manual](../admin-manual.md#backup--restore) for backups):

| Collection | Purpose |
|---|---|
| `itmip_tool_assignments` | Per-Org/BU enable/disable rules for built-in tools. |
| `itmip_tool_overrides` | Per-tool tag / category / short_description overrides. |
| `itmip_llm_custom_tools` | Admin-authored HTTP custom-tool definitions. |
| `itmip_mcp_servers` | Registered upstream MCP server connections. |
| `itmip_mcp_tools` | Imported MCP-exposed tools. |
| `itmip_llm_custom_tool_calls` | Unified audit log for custom-tool AND MCP invocations. |

All of these are covered by the daily KV store backup. Tool
credentials and proxy and TLS CA files live in `storage/passwords` and
are not part of the KV store backup.

---

## Where to go next

- How a person sees the assistant use tools: [the user manual](../../user/user-manual.md).
- The rules the assistant follows: [Skills](./skills.md).
- What the assistant reads and creates: [Knowledge layer](./knowledge-layer.md).
- The broader admin surface: [the admin manual](../admin-manual.md).
- The IAM hook contract: [the customer authorisation hook guide](../security/customer-authorisation-hook.md).

