---
sidebar_position: 9
---

# Knowledge layer

**App version:** 2.7.5
**Last updated:** 2026-10-28
**Audience:** Splunk admins who decide what reference knowledge the assistant may use, and who want
to know what the assistant reads and what it leaves behind in Splunk.

The knowledge layer is the reference material the assistant can consult while it works: search
command notes, visualization notes, the Splunk configuration specification, the installed CIM
models, admin-written rules and entries, and the facts it has learned about your environment. It
sits beside the three other building blocks:

| Building block | What it is | Guide |
|---|---|---|
| Tool | A function the assistant can call | [Tool catalogue](./tool-catalogue.md) |
| Skill | A reusable rule the assistant must follow | [Skills](./skills.md) |
| Agent template | A governed task: its steps, its tools and its skills | [Tools and agent templates](./tools-and-playbooks.md) |
| Knowledge | Reference material the assistant pulls when it needs it | this page |

This page also names the [knowledge objects the assistant creates in
Splunk](#knowledge-objects-in-splunk), because the tool, skill and agent template pages link here for
both: the knowledge a piece uses, and the knowledge it creates.

---

## How the assistant reads knowledge

The assistant pulls knowledge on demand. Nothing is pasted into every prompt, so knowledge costs
tokens only on the turns that use it. Reading happens in three steps, each a tool:

1. **Route.** `splunk_route_knowledge` takes the request and a coarse intent and scores every
   operational connector against its cached description. It returns a short list of connectors
   with a score and a reason, plus the connectors it skipped and why. Routing is deterministic: no
   model call, so no extra place for prompt injection.
2. **Search.** `splunk_search_knowledge` asks the chosen connectors in parallel and merges the
   answers. Each connector gets up to 3 seconds. Results are de-duplicated per connector and
   source, then ranked by score times connector weight, with connector priority breaking ties.
   The default is 10 results, and at most 25.
3. **Fetch.** `splunk_get_knowledge_entry` returns one entry in full: the guidance, any SPL with
   its rationale, the facets and the references. Every fetched entry passes an injection scan.
   Fetching an entry can also [unlock tools](#knowledge-unlocks-tools).

The three tools are **universal**: they are offered on every agent template, including templates
that otherwise restrict their tools, unless an admin disables them for an Org or Business Unit
(see [Turning knowledge off](#turning-knowledge-off)). The base instructions ask the assistant to
route first whenever a task depends on your environment, product or organisation. One route call
returns an empty list when nothing is relevant, and the assistant carries on.

A fourth tool, `splunk_report_knowledge_use`, records whether a fetched entry was used. It writes
a [telemetry event](#telemetry) and nothing else.

Agent templates for security work also carry the skill
[`consult-security-knowledge-first`](./skills.md#consult-security-knowledge-first), which asks for a
fuller route, search and fetch before the assistant drafts a detection or an answer, and asks it to
cite each entry it used.

Every connector call runs as the app, not as the person asking. Org and Business Unit scoping is
applied by the connector: a person sees shared rows plus the rows of their own Org and Business
Unit, and nothing from another tenant. A person who is not assigned to an Org and Business Unit
gets no knowledge at all.

Where people see it: the Console's **Knowledge used** tab shows what a run read, and History shows
a **Knowledge sources** row for each answer.

---

## Connectors

A connector is one source of knowledge. 2.7.5 ships eight. All of them are built in, shared with
every Org, and available on every licence tier.

| Connector | Reads | Entry kinds | On Splunk Cloud |
|---|---|---|---|
| [static-library](#static-library) | Admin and shipped trigger rules | `trigger-rule` | Yes |
| [local-curated](#local-curated) | Admin and shipped curated entries | Any [curated kind](#entry-kinds) | Yes |
| [conf-searchbnf](#conf-searchbnf) | The instance's search command grammar, plus shipped notes | `command-note` | Yes |
| [conf-visualizations](#conf-visualizations) | The instance's visualizations and their example dashboards, plus shipped notes | `visualization-spec` | Yes |
| [conf-spec](#conf-spec) | The `.conf.spec` files of the running Splunk | `conf-spec-note` | No, skipped |
| [cim-data-models](#cim-data-models) | The installed CIM data models | `cim-model` | Only when the CIM add-on files are readable; skipped otherwise |
| [servicenow-cmdb](#servicenow-cmdb) | The ServiceNow CSDM class map shipped with the app | `data-model-note`, `reference-article` | Yes |
| [studio-capability](#studio-capability) | Shipped notes on Dashboard Studio per Splunk version | `studio-capability` | Yes |

A connector that cannot run on an instance reports itself unavailable and is skipped without an
error. The Connectors tab shows each connector's health.

### static-library

Trigger rules. A rule has regular-expression patterns and a piece of guidance. The assistant
checks the patterns against the request, its drafted SPL or its intent, and applies the guidance
when one matches. The patterns are evaluated by the model, never on the server, so a rule cannot
cost the server time. Stored in the KV store collection `itmip_knowledge_static_rules`. The app
ships 21 rules. Admins add and edit rules in **Knowledge > Static rules**.

### local-curated

Curated entries: knowledge with no other source, such as agreed tuning notes, lessons from past
incidents, agent steps and reference articles. An entry can carry SPL with its rationale,
response guidance, MITRE techniques, data sources and [assigned tools](#knowledge-unlocks-tools).
Stored in the KV store collection `itmip_ai_knowledge_entries`. The app ships 24 entries. Admins add
and edit entries in **Knowledge > Curated entries**.

### conf-searchbnf

Search command grammar, read live from the instance, so it matches the Splunk version and the apps
you actually run, including commands that apps add. On top of that sits a shipped set of notes
for common commands (`bin`, `eval`, `rex`, `stats`, `transaction`, `tstats`): what each is good
for, common mistakes and gotchas. The notes are stored in `itmip_command_notes` and are the same for
every tenant, because what a command's arguments mean does not differ by tenant.

### conf-visualizations

The visualizations installed on the instance, with working SPL and options harvested from the
example dashboards their apps ship, and a match quality for how close the example is to what was
asked. A shipped overlay, `itmip_viz_knowledge`, explains parameters whose meaning is not obvious from
their names. The overlay is shared with every tenant.

### conf-spec

The authoritative configuration attributes of the running Splunk (props, transforms, inputs,
indexes, fields, tags, eventtypes and others), read from the `.conf.spec` files on disk. This
keeps onboarding configuration to attribute names that exist. Splunk Cloud does not let an app
read these files, so there the connector is skipped. The tools `splunk_validate_props_conf`,
`splunk_validate_transforms_conf` and `splunk_compute_data_quality_score` read the same
specification directly.

### cim-data-models

The CIM data models installed with the Splunk Common Information Model add-on, with each dataset's
fields and tags, including what it inherits from its parent datasets. CIM mapping and coverage
work therefore follows the CIM version you run. Skipped when the add-on is not installed or its
files cannot be read. The tool `splunk_audit_cim_coverage` reads the same models directly.

### servicenow-cmdb

The ServiceNow CSDM map: logical class names, the physical `cmdb_ci_*` tables behind them, choice
and state codes, encoded-query grammar and relationship traversal. It gives the assistant the
schema rather than leaving it to guess. The map ships with the app and is the same for everyone.
The connector is always available; the ServiceNow tools that use it need the ServiceNow
integration (see [the ServiceNow guide](../integrations/servicenow.md)).

### studio-capability

Which Dashboard Studio visualizations, data sources, inputs and event handlers are valid in each
Splunk version band (8.2, 9.1, 9.3 and 10.0). Splunk publishes no Studio schema, so this is a
shipped overlay, `itmip_studio_knowledge`, rather than a live read. A fetch matches your Splunk
version to a band and says how close the match is. The overlay is shared with every tenant.

---

## Entry kinds

Every entry has a kind. Curated entries use this list; the editor shows the label.

| Kind | Label | Typical content |
|---|---|---|
| `detection` | Detection | A detection with its SPL and rationale |
| `analytic-story` | Analytic story | A group of detections around one threat |
| `tuning-note` | Tuning note | How to tune a detection or search for your data |
| `lesson-learned` | Lesson learned | What an incident or a failed change taught you |
| `data-model-note` | Data model note | How a data model or source is shaped here |
| `playbook-step` | Agent step | One step of a response procedure |
| `reference-article` | Reference article | Background the assistant should know |
| `threat-intel` | Threat intel | Context on a threat or indicator |
| `compliance-mapping` | Compliance mapping | Which control a search or dashboard supports |

The other connectors return their own kinds: `trigger-rule`, `command-note`,
`visualization-spec`, `conf-spec-note`, `cim-model` and `studio-capability`. The ServiceNow map
returns `data-model-note` and `reference-article`.

---

## Learned knowledge

Learned knowledge is what the assistant writes itself. It is kept apart from the connectors, in
a KV store collection per Org, `itmip_ai_memory_<org>`, and read and written with the tool
`splunk_memory`.

- **Learned facts.** Durable facts about your environment, for example which index holds a given
  feed. The assistant stores a fact for its Business Unit, unconfirmed, and can use it straight
  away. A Business Unit reads its own facts first, then its Org's. A person confirms, edits,
  deletes or promotes a fact to the whole Org in **Knowledge > Learned Knowledge**. The server
  decides the scope from the caller; a scope passed by the model is ignored.
- **Integration state.** The point an integration has read up to. The model can read it but
  cannot write it.

This is the only knowledge the assistant creates. No tool lets the model write a rule, a curated
entry, a shipped note or a skill.

---

## Who reads and who writes

| Knowledge | Read by | Written by |
|---|---|---|
| [Trigger rules](#static-library) | `splunk_route_knowledge`, `splunk_search_knowledge`, `splunk_get_knowledge_entry` | Admins in **Knowledge > Static rules**; the app's shipped rules; a content pack import |
| [Curated entries](#local-curated) | The same three tools | Admins in **Knowledge > Curated entries**; the app's shipped entries; a content pack import |
| [Command notes](#conf-searchbnf), [visualization notes](#conf-visualizations), [Studio notes](#studio-capability) | The same three tools | The app's shipped notes only |
| [Configuration specification](#conf-spec) | The same three tools; `splunk_validate_props_conf`, `splunk_validate_transforms_conf`, `splunk_compute_data_quality_score` | Nobody; it is the running Splunk's own |
| [CIM models](#cim-data-models) | The same three tools; `splunk_audit_cim_coverage` | Nobody; it is the installed CIM add-on |
| [ServiceNow CSDM map](#servicenow-cmdb) | The same three tools | Nobody; it ships with the app |
| [Learned facts](#learned-knowledge) | `splunk_memory` | `splunk_memory` (unconfirmed); people in **Knowledge > Learned Knowledge** |
| [Telemetry](#telemetry) | The knowledge layer health dashboard; your own searches | `splunk_report_knowledge_use` and the three reading tools |

Every knowledge collection can be read by any Splunk role and changed only by admins. Which rows a
person's assistant sees is decided by the connector, by Org and Business Unit.

---

## Knowledge unlocks tools

A curated entry can name **assigned tools**. When the assistant fetches that entry, those tools
become available for the rest of the conversation, even on an agent template that did not offer
them, and the entry's response guidance tells the assistant how to use them.

This is the governed way to use a broad tool narrowly. A tool imported from an MCP server can often
query anything; an entry can allow it for one purpose, for example "for alerts from product X, query
`index=<product_x_alerts>` with the assigned tool, and no other index".

Guard rails:

- Pick tools from the list in the editor; the list holds only tools that exist (built in, custom
  and MCP).
- Only tools enabled for the caller's Org and Business Unit, and allowed by the licence, can be
  unlocked.
- A tool the agent template denies is never unlocked.

The app ships six entries with assigned tools, among them the TrackMe feed health panel recipe and
the Cribl and Edge Processor data quality entries.

---

## Knowledge objects in Splunk

Besides the knowledge it reads, the assistant creates and changes knowledge objects in Splunk. A
tool that creates one returns a link, shown as **Created in Splunk**. This section names each
kind; the [tool catalogue](./tool-catalogue.md#knowledge-each-tool-uses-or-creates) says which tool creates
which.

### Saved searches and alerts

Saved searches (reports) and scheduled alerts, created in the app the person works in, or in
another app they choose. Before saving, the app checks the search against your data. Since 2.7.5
the app also decides the faster form of a search that filters on a search-time field, and says in
the result which form it saved and why.

### Dashboards

Simple XML and Dashboard Studio dashboards. Since 2.7.5 a Simple XML dashboard published with the
dashboard builder gets a **Data quality** row at the top, added by the app: a note with the result
of the ingestion health check and a **Newest event per index** table. Dashboards that read only
lookups, REST or metrics get no such row, and a republish replaces the row rather than adding a
second one.

### Lookups

- `adjutant_proof_<dashboard>.csv`: a proof snapshot of a dashboard's data, at most 10,000 rows. It is
  readable by anyone who can open the dashboard; it is not private.
- AI Toolkit models are stored by Splunk as lookup files. Sharing a model globally changes the
  permissions of that file so every app can use the model.

### KV store collections

The assistant writes to these app collections:

| Collection | What it holds | Written by |
|---|---|---|
| `itmip_ai_memory_<org>` | [Learned facts](#learned-knowledge) | `splunk_memory` |
| `itmip_ai_use_cases` | Agents a person created or changed through the assistant (private to them) | `splunk_create_user_template`, `splunk_update_user_template` |
| `itmip_ai_mappings_<org>` | Draft integration mapping specifications; a person promotes a draft | `splunk_mapping` |
| `itmip_llm_mltk_models` | A record of each AI Toolkit model shared globally | `splunk_share_mltk_model_globally` |
| `itmip_rca_runs`, `itmip_rca_candidates` | ITSI root cause analysis results | `itsi_run_rca` |
| `itmip_netpol_*`, `itmip_network_policy_*` | Firewall policy artifacts, parses, snapshots and stored current state | the `network-policy` tools |

### Records in other apps

Some tools change records that belong to another app rather than knowledge objects: Enterprise
Security notables and investigation notes, ITSI episodes, TrackMe acknowledgements, priorities and
maintenance windows, and ServiceNow incidents, events, CMDB records and security incidents. The
[tool catalogue](./tool-catalogue.md#knowledge-each-tool-uses-or-creates) lists which tool changes which.

### What the assistant does not create

Builder steps before publish (`splunk_xml_*` and `splunk_builder_*`, except the publish tools) only
change a draft in the browser. `splunk_generate_conf_package` returns a downloadable package and
changes nothing in Splunk. `splunk_validate_full_range` only runs searches.

---

## Managing knowledge

The **Knowledge** tab is visible to admins only. It has four sub-tabs:

- **Connectors**: each connector's status and health, with **Check now** and **Check all**.
  **Show tuning** adds the weight, priority, threshold and size columns and the **Test routing**
  pane.
- **Static rules**: add, edit and delete trigger rules. **Try the rule** runs the patterns against
  sample text in your browser.
- **Curated entries**: add, edit and delete curated entries, including their assigned tools.
- **Learned Knowledge**: confirm, edit, delete or promote what the assistant learned.

Things to know when you edit:

- **New rows belong to an Org and Business Unit.** The editor asks for both; rows shared with
  every Org are the shipped ones.
- **Status.** A rule or entry is Operational or Draft. In 2.7.5 a Draft row is still served to
  the assistant, so do not save guidance you are not ready for it to use.
- **Shipped rows.** The app refreshes its shipped rules, entries and notes every five minutes, but
  only rows nobody has edited. Editing a shipped row makes it yours and stops the refresh for it.
  Deleting a shipped row does not last: the next refresh puts it back. To neutralise a shipped
  row, edit it.
- **Content packs.** The **Content pack** card on the Backups tab imports and upgrades rules and
  entries, and can retire them. A retired row is not served.
- **Backups.** A KV store backup includes connectors, rules and entries. The shipped notes are not
  included, because the app restores them itself.

---

## Routing and tuning

Each operational connector gets a score for a request:

```
score = 0.50 x topic keyword overlap
      + 0.15 x intent match
      + 0.15 x facet match
      + 0.10 x baseline
      - 0.30 x anti-topic keyword overlap

slow connector:   score = score x 0.8 - 0.10
then:             score = score x weight
skipped when:     score < routing threshold
```

Curated entries are always considered for security intents. The per-connector settings are:

| Setting | Default | Effect |
|---|---|---|
| `weight` | 1.0 (0.85 for `servicenow-cmdb`) | Multiplies the router score and every search result's score |
| `priority` | 50 to 60, per connector | Breaks ties between results with the same score |
| `routing_threshold` | 0.3, lower for most built-ins | The minimum router score to be shortlisted |
| `is_slow_connector` | false (true for `servicenow-cmdb`) | Applies the slow-connector penalty; a search with no connector list leaves slow connectors out |

The Connectors tab shows these values under **Show tuning** but cannot change them. An admin
changes them with a POST to the `itmip_llm/knowledge/connectors` REST endpoint; a refresh of the
shipped connectors keeps the values you set. A value of zero is read as the default, so use a small
positive number instead.

**Test routing** routes a request you type, with an intent, and shows the shortlist with each
connector's score and reason, and the connectors it skipped. In 2.7.5 the MITRE technique and data
source fields of the pane do not change the scores.

---

## Telemetry

Every route, search, fetch, health check and use report writes a JSON event to `index=main` with
`sourcetype=ai_knowledge_metrics`. The `kind` field says which:
`ai_knowledge_route`, `ai_knowledge_search`, `ai_knowledge_fetch`, `ai_knowledge_probe`,
`ai_knowledge_describe`, `ai_knowledge_timeout` and `ai_knowledge_static_rule_match` (the use report,
for entries from any connector).

The app ships a dashboard, **Knowledge layer health** (`knowledge_layer_health`). It is not in the
app's menu; open it at `/app/itmip_ai_splunk_assistent_app/knowledge_layer_health`.

Was the assistant routing before searching?

```spl
index=main sourcetype=ai_knowledge_metrics kind=ai_knowledge_search
| spath
| eval routed=if(was_routed=="true" OR was_routed==true, "routed", "not routed")
| stats count by routed
```

Which connector is slowest?

```spl
index=main sourcetype=ai_knowledge_metrics kind=ai_knowledge_search
| spath
| where isnotnull(latency_ms)
| stats perc95(latency_ms) as p95_ms, count by connector
| sort -p95_ms
```

Which entries does the assistant use?

```spl
index=main sourcetype=ai_knowledge_metrics kind=ai_knowledge_static_rule_match
| spath
| stats sum(eval(used=="true" OR used==true)) as used_count, count as reports by source_id
| eval use_rate=round(used_count*100/reports,1)
| sort -reports
```

Did a fetched entry trip the injection scan?

```spl
index=main sourcetype=ai_knowledge_metrics kind=ai_knowledge_fetch injection_flagged=true
| stats count by connector, source_id
```

---

## Turning knowledge off

- **One connector:** set its `status` to `draft` through the REST endpoint above. Route and search
  then leave it out.
- **For an Org or Business Unit:** disable the knowledge tools for that Org or Business Unit in
  **Tools > Built-in tools > Manage tool**. A disabled tool is neither offered nor run.
- **Security content from Splunk Security Essentials** is not a connector. It comes through the
  `security-content` tools; disable those to withhold it.

Reasons to turn a connector off: it fails its health check for a long time, its searches are slow
enough to eat the 3 second budget, its fetches trip the injection scan, or a customer wants its
own knowledge source instead.
