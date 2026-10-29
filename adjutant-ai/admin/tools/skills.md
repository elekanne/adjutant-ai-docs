---
sidebar_position: 8
---

# Skills

**App version:** 2.7.5
**Last updated:** 2026-10-28
**Audience:** Splunk admins who decide what rules shape the assistant's work, and who edit
skills or agent templates.

A skill is a reusable rule the assistant must follow, written in plain text: "check that a field
exists before you use it", "a dashboard gets an ingestion health check", "never call an index a
sourcetype". A skill has no code. An agent template lists the skills it needs, and the app places
them in front of the agent template's own prompt, so one rule can serve many agent templates and
lives in one place.

For how skills relate to tools, agent templates and knowledge, see
[the tool catalogue](./tool-catalogue.md#tools-skills-agent-templates-and-knowledge-choosing-the-right-layer).

---

## How a skill reaches the assistant

When a person runs an agent template, the app assembles one prompt, in this order:

1. the base guardrails (the General agent template's prompt, for the person's Org and Business
   Unit), except on the General agent template itself;
2. [`general-output-style`](#general-output-style), on every agent template except General and
   Default;
3. the skills the agent template lists in `includes_skills`, in that order;
4. the agent template's own prompt.

A listed skill is left out, with a note to the assistant, when it does not exist, when its status
is neither Operational nor Draft, or when it is not visible to the person's Org and Business Unit.
When the Default agent template routes a request to another agent template, the app also leaves
out a skill whose required apps are not installed, and leaves out
[`dashboard-proof-required`](#dashboard-proof-required) and
[`alert-companion-dashboard`](#alert-companion-dashboard) when **Also build a proof dashboard** is
off.

Skills shape interactive runs. Unattended runs (alert-triggered and scheduled) use the agent
template's own prompt and the base guardrails, without skills.

## Editing skills

Skills are managed on the **Skills** tab. The table shows each skill's status and **Used by**:
how many agent templates list it (`general-output-style` reads "every agent (added
automatically)").

- The shipped skills are refreshed from the app on upgrade, but only while nobody has edited them.
  Editing a shipped skill makes it yours: it keeps your text and no longer follows the app.
- A skill body can be at most 4,000 characters when saved from the Skills tab. Some shipped skills
  are longer; to edit one of those, shorten it first.
- To change a rule for every agent template that uses it, edit the skill. To change which skills
  an agent template uses, edit the agent template's `includes_skills`.

## What each skill uses and creates

Each skill below has a short description written by hand, followed by facts generated from the
code:

- **Agent templates**: the shipped agent templates that include the skill.
- **Tools it steers**: the tools the skill names. The skill tells the assistant how to use them.
- **Knowledge it uses** and **Knowledge it creates**: derived from those tools, linking to the
  [knowledge layer](./knowledge-layer.md) section for what they read, and to the
  [knowledge objects in Splunk](./knowledge-layer.md#knowledge-objects-in-splunk) they create.

Titles and agent template names are quoted exactly as the app shows them.

<!-- generated:skills-summary (scripts/gen_knowledge_docs.ts; do not edit) -->
The app ships **53 skills**.

| Skill | Title in the app | Category | Status | Agent templates |
|---|---|---|---|---|
| [general-output-style](#general-output-style) | General output style rules | general | Operational | every one except General and Default |
| [spl-review-conduct](#spl-review-conduct) | How an SPL reviewer must behave | search | Operational | 1 |
| [spl-review-correctness](#spl-review-correctness) | Silent failure modes, anti-patterns and severity | search | Operational | 1 |
| [spl-review-rewrites](#spl-review-rewrites) | What to write instead | search | Operational | 1 |
| [spl-review-evidence](#spl-review-evidence) | Proving a rewrite is equivalent | search | Operational | 1 |
| [spl-perf-priorities](#spl-perf-priorities) | SPL performance priorities | search | Operational | 39 |
| [spl-validation-loop](#spl-validation-loop) | SPL validation + self-correct loop | search | Operational | 39 |
| [dashboard-xml-discipline](#dashboard-xml-discipline) | Simple XML dashboard discipline | dashboards | Operational | 22 |
| [dashboard-xml-validation-loop](#dashboard-xml-validation-loop) | Simple XML dashboard validation + render-check loop | dashboards | Operational | 23 |
| [dashboard-studio-versioning](#dashboard-studio-versioning) | Dashboard Studio version-awareness | dashboards | Draft | 1 |
| [dashboard-proof-required](#dashboard-proof-required) | Every artifact implies a proof dashboard | dashboards | Operational | 16 |
| [viz-best-fit](#viz-best-fit) | Visualization best-fit selection | dashboards, visualization | Operational | 17 |
| [alert-companion-dashboard](#alert-companion-dashboard) | Alerts never ship alone — companion dashboard mandatory | alerts | Operational | 3 |
| [ml-aiworkbench-naming-and-share](#ml-aiworkbench-naming-and-share) | MLTK aiworkbench naming + global share handler | ai-toolkit | Operational | 10 |
| [ml-data-readiness-precheck](#ml-data-readiness-precheck) | MLTK data-readiness pre-check | ai-toolkit | Operational | 7 |
| [ml-self-correct-budget](#ml-self-correct-budget) | MLTK self-correct loop (max 3 attempts per object) | ai-toolkit | Operational | 9 |
| [feed-health-verdict](#feed-health-verdict) | TrackMe feed-health pre-flight + explicit verdict | data-platform | Operational | 41 |
| [metric-vs-event-index-aware](#metric-vs-event-index-aware) | Metric vs event index awareness | search | Operational | 10 |
| [read-only-by-default-soc](#read-only-by-default-soc) | Read-only by default for SOC / SecOps work | security-soc | Operational | 11 |
| [read-only-by-default-itops](#read-only-by-default-itops) | Read-only by default for ITSI work | service-management | Operational | 9 |
| [data-vs-service-distinction](#data-vs-service-distinction) | Data broken vs service broken — the two-verdict rule | service-management, data-platform | Operational | 11 |
| [naming-collision-handling](#naming-collision-handling) | Knowledge object name-collision handling | knowledge-objects | Operational | 23 |
| [template-authoring-discipline](#template-authoring-discipline) | Agent authoring discipline | general, authoring | Operational | 2 |
| [prompt-injection-defense-on-authored-content](#prompt-injection-defense-on-authored-content) | Defense against prompt injection in authored content | general, authoring, security | Operational | 2 |
| [consult-security-knowledge-first](#consult-security-knowledge-first) | Consult the knowledge layer for security-flavoured tasks | security, knowledge, general | Operational | 20 |
| [cdtsm-discipline](#cdtsm-discipline) | Cisco Deep Time Series Model (CDTSM) discipline | ai-toolkit | Operational | 3 |
| [hunt-evidence-honesty](#hunt-evidence-honesty) | Hunt evidence honesty — zero-evidence and detection-tile colour rules | security-soc | Operational | 8 |
| [demo-dataset-time-reanchor](#demo-dataset-time-reanchor) | Demo dataset time re-anchoring — map relative windows onto a fixed dataset's active period | search | Operational | 1 |
| [conf-package-discipline](#conf-package-discipline) | Deployment-ready multi-app config package generation (4-app layout) | data-platform | Operational | 1 |
| [data-onboarding-readiness](#data-onboarding-readiness) | Onboarding-correctness preflight — is the data actually parsed right? | data-platform | Operational | 8 |
| [dashboard-ingestion-health](#dashboard-ingestion-health) | Mandatory data-ingestion health panel on every dashboard | dashboards, data-platform | Operational | 3 |
| [cribl-field-discovery](#cribl-field-discovery) | Discover Cribl metadata fields per index/sourcetype | data-platform | Operational | 1 |
| [edge-processor-discovery](#edge-processor-discovery) | Discover whether Splunk Edge Processor fronts a feed (and if a join key exists) | data-platform | Operational | 1 |
| [magic-8-compliance](#magic-8-compliance) | Magic 8 onboarding checklist + validate-and-score before handover | data-platform | Operational | 2 |
| [cim-coverage-audit](#cim-coverage-audit) | Interpreting the CIM Coverage Audit honestly | data-platform | Operational | 1 |
| [servicenow-structured-discipline](#servicenow-structured-discipline) | ServiceNow structured-data discipline | servicenow | Operational | 14 |
| [servicenow-incident-description-authoring](#servicenow-incident-description-authoring) | ServiceNow incident-description authoring | servicenow | Operational | 13 |
| [servicenow-tisc-enrichment](#servicenow-tisc-enrichment) | ServiceNow TISC threat-intel enrichment (detect-and-prefer) | servicenow, security-soc | Operational | 0 |
| [kpi-data-lineage](#kpi-data-lineage) | KPI data lineage — resolve the feed behind every KPI before trusting it | service-management, data-platform | Operational | 1 |
| [monitoring-self-health](#monitoring-self-health) | Monitoring self-health — is the KPI even being computed? | service-management, data-platform | Operational | 1 |
| [rca-probable-cause-language](#rca-probable-cause-language) | RCA language discipline — probable cause, evidence strength, honest uncertainty | service-management | Operational | 1 |
| [fraud-entity-resolution](#fraud-entity-resolution) | Resolving fraud entities before anything else | security-soc | Operational | 7 |
| [dashboard-ir-authoring](#dashboard-ir-authoring) | Dashboards as an IR, not as markup | dashboards | Operational | 2 |
| [fraud-dashboard-structure](#fraud-dashboard-structure) | Fraud dashboards — fixed structure, honest panels | security-soc, dashboards | Operational | 4 |
| [fraud-risk-scoring-discipline](#fraud-risk-scoring-discipline) | Fraud risk scoring — weighted, decomposable, RBA-aligned | security-soc | Operational | 4 |
| [detection-scope-fidelity](#detection-scope-fidelity) | Detection scope fidelity — match what they asked for, and prove the row | security-soc | Operational | 1 |
| [spl-stage-sampling](#spl-stage-sampling) | Explaining SPL from observed behaviour, not from the text | search-authoring | Operational | 1 |
| [spl-behaviour-vs-data](#spl-behaviour-vs-data) | When a search stopped working, decide whether it is the search or the data | search-authoring | Operational | 1 |
| [explain-dashboard-layout](#explain-dashboard-layout) | The explanation dashboard — fixed sections, and whose search is whose | search-authoring | Operational | 1 |
| [explain-dashboard-style](#explain-dashboard-style) | The explanation dashboard — house style, one look every run | search-authoring | Operational | 1 |
| [spl-cim-model-gaps](#spl-cim-model-gaps) | A CIM search can be perfect and still return nothing | search-authoring | Operational | 1 |
| [spl-inline-comment-rules](#spl-inline-comment-rules) | Commenting a search so it still runs | search-authoring | Operational | 1 |
| [spl-intent-coverage](#spl-intent-coverage) | Design the SPL from the request, and cover every part of it | search | Operational | 1 |
<!-- /generated:skills-summary -->

---

## The skills


### general-output-style

Sets the baseline output rules: plain English with markdown structure, SPL, XML, JSON and conf stanzas in fenced code blocks, no emojis or icons, no greetings or filler, and a "Created in Splunk" link whenever an object is saved. It forbids invented index, field, sourcetype, app or collection names: the assistant checks with a `splunk_list_*` tool first, confirms sourcetypes with `splunk_list_sourcetypes` and fields with `splunk_describe_sourcetype`, and never treats an example name from its own instructions as a value to emit. A refusal always comes with one Splunk-related alternative.

**When it applies:** It is added automatically to every agent template except the General and Default ones, so it is never listed by hand.

<!-- generated:skill:general-output-style (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** General output style rules
- **Category:** general. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** every agent template except General and Default (88 of 90)
- **Tools it steers:** `splunk_list_sourcetypes`, `splunk_describe_sourcetype`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:general-output-style -->

### spl-review-conduct

Governs how the assistant behaves when it reviews someone else's SPL: correctness first, performance second, readability third, and a rewrite that returns different results counts as a new search, not an improvement. It never invents fields, macros or lookups, never guesses a macro body, marks every assumption, calls out any behaviour change explicitly, and does not claim a speed-up it did not measure. If the search is already good it says so instead of manufacturing findings, and when intent is ambiguous it asks one focused question or presents both readings.

**When it applies:** Any agent template that reviews, critiques or rewrites SPL written by somebody else. The rules bind the reviewer, not the search.

<!-- generated:skill:spl-review-conduct (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** How an SPL reviewer must behave
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Improve an existing SPL
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-review-conduct -->

### spl-review-correctness

Makes the assistant run `splunk_review_spl` for the mechanical checks (anti-patterns, silent-failure checklist, field lineage) and report what it finds, with every finding graded Blocker, Should fix or Nice to have. The skill explains what those findings mean, such as silent truncation from `list()` and subsearch limits, `!=` versus `NOT` semantics, `dedup` versus `stats latest`, and numeric versus text sorting, and leaves the assistant the judgement calls the engine cannot make, such as whether `summariesonly=true` is acceptable for a given detection.

**When it applies:** When SPL is being reviewed for defects, on the basis that Splunk rarely errors and usually returns wrong data instead.

<!-- generated:skill:spl-review-correctness (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Silent failure modes, anti-patterns and severity
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Improve an existing SPL
- **Tools it steers:** `splunk_review_spl`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-review-correctness -->

### spl-review-rewrites

Tells the assistant what to write in place of common problem constructs, and in what order to review: correctness traps, then the foundation search, then expensive commands, then whether `tstats` fits, then command order, CIM hygiene and readability. It covers replacing `join`, `append`, `appendcols`, `transaction` and `map` with `stats`-based or lookup-based equivalents, using `tstats` for counts grouped only by indexed fields, moving filters before the first pipe, and treating `summariesonly=true` in a detection as a correctness decision rather than a performance one.

**When it applies:** When the assistant produces a rewrite of existing SPL. Every substitution has to be checked for semantic equivalence, because several are not drop-in replacements.

<!-- generated:skill:spl-review-rewrites (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** What to write instead
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Improve an existing SPL
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-review-rewrites -->

### spl-review-evidence

Requires proof before the assistant claims a rewrite is equivalent or faster. It uses `splunk_verify_equivalence`, which runs a row count, distinct-key count and checksum against both versions over one fixed time window, and reports the verdict as given: DIFFERENT means the rewrite is withdrawn or fixed, and a truncated run is never evidence. It measures over a bounded window, hands over the full-window check clearly marked as not yet run, and uses field-population, ingest-latency, acceleration-coverage and Job Inspector checks to support its claims.

**When it applies:** Any claim that a rewritten search is equivalent to, or faster than, the original.

<!-- generated:skill:spl-review-evidence (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Proving a rewrite is equivalent
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Improve an existing SPL
- **Tools it steers:** `splunk_verify_equivalence`, `splunk_run_search`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-review-evidence -->

### spl-perf-priorities

Gives the assistant a fixed order of performance priorities when it writes or rewrites SPL: an explicit `index=` and a tight time range, `tstats` for counts by indexed fields, `tstats` over an accelerated data model where one covers the question, filtering before transforming, dropping fields early, and avoiding `transaction`, large subsearches, `join` and wide `index=*` searches. When two priorities conflict, it states the trade-off in one sentence.

**When it applies:** Any agent template that generates or rewrites SPL.

<!-- generated:skill:spl-perf-priorities (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** SPL performance priorities
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 39: Build a SPL search; Improve an existing SPL; Build a Simple XML dashboard; Improve a Simple XML dashboard; Build a Dashboard Studio JSON dashboard; Build / improve an alert; Build / improve a report; Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; Data correlation helper; AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; AI Toolkit – Ask an external LLM about your Splunk data (`ai` command); Data troubleshooting helper; Investigation; ES — Triage a notable; ES — Investigate a user; ES — Investigate a host; ES — Investigate an IOC; ES — Phishing email triage; ES — Lateral movement check; ES — Detection coverage gap analysis; ES — Tune a noisy correlation search; ITSI — Diagnose service degradation; ITSI — Root-cause an episode; ITSI — Service health timeline; ITSI — KPI threshold review; ATT&CK Tactic Hunt — Technique Coverage Dashboard; Fraud Rule Builder; Behavioral Profile Builder
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-perf-priorities -->

### spl-validation-loop

Makes the assistant validate every search against the user's environment before saving or returning it, retrying up to three times and never delivering or saving SPL that fails. A search that is about to be saved relies on the create tool's own validation instead of a second `splunk_run_search` run, and nothing is saved through `splunk_create_saved_search` or `splunk_create_alert` without a passing validation. For detections, zero rows is not a pass: the assistant relaxes one constraint at a time to find where the rule stands, runs it over a window that covers evidence it already found, and never infers event order from multivalue positions.

**When it applies:** Any agent template that produces SPL the system will save or run against the user's data.

<!-- generated:skill:spl-validation-loop (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** SPL validation + self-correct loop
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 39: Build a SPL search; Improve an existing SPL; Build / improve an alert; Build / improve a field extraction; Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; Data correlation helper; Data enrichment helper; AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Stats vs ML decision helper; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; Audit & refresh an existing ML use case; Data troubleshooting helper; Investigation; ES — Triage a notable; ES — Investigate a user; ES — Investigate a host; ES — Investigate an IOC; ES — Phishing email triage; ES — Lateral movement check; ES — Detection coverage gap analysis; ITSI — Diagnose service degradation; ITSI — Root-cause an episode; ITSI — Service health timeline; ITSI — KPI threshold review; ATT&CK Tactic Hunt — Technique Coverage Dashboard; Fraud Rule Builder; Fraud Ring Mapper; Behavioral Profile Builder; Fraud Command Center
- **Tools it steers:** `splunk_run_search`, `splunk_list_indexes`, `splunk_get_lookup_sample`, `splunk_create_saved_search`, `splunk_create_alert`
- **Knowledge it uses:** none
- **Knowledge it creates:** [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts)
<!-- /generated:skill:spl-validation-loop -->

### dashboard-xml-discipline

Sets the rules for Simple XML dashboards: build with the `splunk_xml_*` builder (`splunk_xml_create`, `splunk_xml_add_input`, `splunk_xml_add_panel`, `splunk_xml_publish`) for anything beyond a one- or two-panel dashboard, except custom-visualisation dashboards, which are hand-written with `splunk_create_dashboard_xml`. It covers token discipline, raw HTML only inside HTML panels, keeping time range divided by span under 50,000 buckets, transforming base searches, uniform severity colours, a default time range, cross-panel drilldown that shows what was clicked, self-contained dashboards with no external CSS or JavaScript, and a "How to read this" panel on every dashboard. A TrackMe feed-health panel is added only when it is relevant and TrackMe confirms it tracks the indexes.

**When it applies:** Any agent template that produces Simple XML dashboard markup.

<!-- generated:skill:dashboard-xml-discipline (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Simple XML dashboard discipline
- **Category:** dashboards. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 22: Build a Simple XML dashboard; Improve a Simple XML dashboard; Build / improve an alert; Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; AI Toolkit – Ask an external LLM about your Splunk data (`ai` command); Investigation; ATT&CK Tactic Hunt — Technique Coverage Dashboard; Fraud Data Coverage Audit; Fraud Ring Mapper; Fraud Command Center
- **Tools it steers:** `splunk_xml_create`, `splunk_xml_add_input`, `splunk_xml_add_panel`, `splunk_xml_publish`, `splunk_create_dashboard_xml`, `splunk_xml_add_tab_group`, `splunk_xml_add_base_search`, `splunk_get_dashboard_panel_data`, `splunk_xml_set_color_tokens`, `trackme_health_for_indexes`
- **Knowledge it uses:** none
- **Knowledge it creates:** [dashboards](./knowledge-layer.md#dashboards)
<!-- /generated:skill:dashboard-xml-discipline -->

### dashboard-xml-validation-loop

Makes the assistant validate a Simple XML dashboard in two stages: a structural validation at publish, then a mandatory render check with `splunk_get_dashboard_panel_data` once per change. The render check's `response.ok` is the real success gate, fixes are capped at three combined attempts, and a dashboard that still fails is handed back as XML with an explanation instead of being delivered. It lists the common failures, such as orphan tokens, markup in plain-text fields, time clauses in post-process panels, missing custom visualisations and chart options that name fields the search does not produce.

**When it applies:** Any agent template that creates or updates a Simple XML dashboard.

<!-- generated:skill:dashboard-xml-validation-loop (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Simple XML dashboard validation + render-check loop
- **Category:** dashboards. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 23: Build a Simple XML dashboard; Improve a Simple XML dashboard; Build / improve an alert; Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; AI Toolkit – Ask an external LLM about your Splunk data (`ai` command); Audit & refresh an existing ML use case; Investigation; ATT&CK Tactic Hunt — Technique Coverage Dashboard; Fraud Data Coverage Audit; Fraud Ring Mapper; Fraud Command Center
- **Tools it steers:** `splunk_xml_publish`, `splunk_create_dashboard_xml`, `splunk_update_dashboard_xml`, `splunk_xml_update_panel`, `splunk_xml_create`, `splunk_get_dashboard_panel_data`, `splunk_list_visualizations`, `splunk_proof_snapshot`
- **Knowledge it uses:** none
- **Knowledge it creates:** [dashboards](./knowledge-layer.md#dashboards), [lookups](./knowledge-layer.md#lookups)
<!-- /generated:skill:dashboard-xml-validation-loop -->

### dashboard-studio-versioning

Makes Dashboard Studio work version-aware: the assistant calls `splunk_get_version` first, uses the studio-capability knowledge entry for the installed version band, and only uses features that version supports, falling back to a safe subset rather than improvising JSON. Studio dashboards are always built with the `splunk_builder_*` tools, never hand-written in chat, and publish failures get at most three fix attempts. This skill ships as a draft.

**When it applies:** Any Dashboard Studio (version 2 JSON) agent template.

<!-- generated:skill:dashboard-studio-versioning (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Dashboard Studio version-awareness
- **Category:** dashboards. **Status:** Draft.
- **Needs:** no other app
- **Agent templates:** 1: Build a Dashboard Studio JSON dashboard
- **Tools it steers:** `splunk_get_version`, `splunk_route_knowledge`, `splunk_search_knowledge`, `splunk_get_knowledge_entry`
- **Knowledge it uses:** [knowledge connectors](./knowledge-layer.md#how-the-assistant-reads-knowledge), [knowledge unlocks tools](./knowledge-layer.md#knowledge-unlocks-tools)
- **Knowledge it creates:** none
<!-- /generated:skill:dashboard-studio-versioning -->

### dashboard-proof-required

Requires that every saved artifact ends with a proof dashboard someone can open to see whether it actually does what was asked. The dashboard is built with the `splunk_xml_*` builder and carries a fixed panel set: a time picker (left out when every panel reads a proof snapshot), a headline KPI tile, a trend of the same metric, a detail table of recent rows, and an HTML panel explaining when the artifact fires and how to investigate. Alerts link to the dashboard in their description, and model-building agents add panels for training data, recent predictions and, for forecasts, holdback accuracy.

**When it applies:** Agent templates that create alerts, MLTK models, ES notable updates, ITSI episode actions or investigations.

<!-- generated:skill:dashboard-proof-required (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Every artifact implies a proof dashboard
- **Category:** dashboards. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 16: Build / improve an alert; AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; Investigation; Fraud Data Coverage Audit; Fraud Ring Mapper; Fraud Command Center
- **Tools it steers:** `splunk_xml_create`, `splunk_xml_add_input`, `splunk_xml_add_panel`, `splunk_xml_publish`
- **Knowledge it uses:** none
- **Knowledge it creates:** [dashboards](./knowledge-layer.md#dashboards)
<!-- /generated:skill:dashboard-proof-required -->

### viz-best-fit

Makes the assistant pick the chart that best fits the question. It first checks installed custom visualisations with `splunk_list_visualizations` and `splunk_get_visualization_docs`, consults the knowledge layer for a custom visualisation's data shape, adds a visible advisory when the installed version is older than documented, and never offers one that is not installed. Otherwise it follows a question-to-chart mapping (single value, line or area, bar, pie only up to five slices, scatter or heatmap, map), uses a colourblind-safe palette for neutral categories, and labels every chart axis.

**When it applies:** Any agent template that chooses a chart or panel type.

<!-- generated:skill:viz-best-fit (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Visualization best-fit selection
- **Category:** dashboards, visualization. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 17: Build a Simple XML dashboard; Improve a Simple XML dashboard; Build a Dashboard Studio JSON dashboard; Data visualization helper; AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; Investigation; ATT&CK Tactic Hunt — Technique Coverage Dashboard
- **Tools it steers:** `splunk_list_visualizations`, `splunk_get_visualization_docs`, `splunk_xml_set_color_tokens`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:viz-best-fit -->

### alert-companion-dashboard

Requires every scheduled alert to ship with a companion diagnostic dashboard, created first with the `splunk_xml_*` builder and render-checked before the alert exists. The alert is then created with `splunk_create_alert`, with a dashboard link in its description, a severity (default medium), a suppression period (default one hour) and the requesting user among the email recipients. If the dashboard cannot be built in three attempts, the alert is not created.

**When it applies:** Any agent template that creates a scheduled alert.

<!-- generated:skill:alert-companion-dashboard (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Alerts never ship alone — companion dashboard mandatory
- **Category:** alerts. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 3: Build / improve an alert; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Outlier ALERT + diagnostic dashboard
- **Tools it steers:** `splunk_xml_create`, `splunk_xml_add_input`, `splunk_xml_add_panel`, `splunk_xml_publish`, `splunk_get_dashboard_panel_data`, `splunk_create_alert`
- **Knowledge it uses:** none
- **Knowledge it creates:** [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts), [dashboards](./knowledge-layer.md#dashboards)
<!-- /generated:skill:alert-companion-dashboard -->

### ml-aiworkbench-naming-and-share

Makes every model an agent creates follow the `aiworkbench` naming pattern for the model and its training search, scoring search, dashboard and optional alert, because `splunk_share_mltk_model_globally` only promotes models whose name carries that suffix. It fixes the order after training: save the training search, run it, share the model globally, and only then create the scoring search. A proof dashboard never runs `apply` itself but reads a snapshot written by `splunk_proof_snapshot`.

**When it applies:** Any AI Toolkit agent template that fits a model. It depends on the Splunk AI Toolkit (MLTK) being installed.

<!-- generated:skill:ml-aiworkbench-naming-and-share (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** MLTK aiworkbench naming + global share handler
- **Category:** ai-toolkit. **Status:** Operational.
- **Needs:** Splunk_ML_Toolkit 5.0.0 or later
- **Agent templates:** 10: AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; AI Toolkit – Ask an external LLM about your Splunk data (`ai` command); Audit & refresh an existing ML use case
- **Tools it steers:** `splunk_share_mltk_model_globally`, `splunk_create_saved_search`, `splunk_run_saved_search_by_name`, `splunk_proof_snapshot`
- **Knowledge it uses:** none
- **Knowledge it creates:** [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts), [lookups](./knowledge-layer.md#lookups), [KV store collections](./knowledge-layer.md#kv-store-collections)
<!-- /generated:skill:ml-aiworkbench-naming-and-share -->

### ml-data-readiness-precheck

Makes the assistant run a short data-readiness summary with `splunk_run_search` before it trains any model: volume, distribution shape, seasonality, group cardinality, null fraction and, for classification, class balance. It refuses to train on too few events or too many groups, warns on too few groups, heavy null fractions or rare classes, and shows the summary to the user before designing the model.

**When it applies:** Any AI Toolkit agent template that fits a new model from data. It depends on the AI Toolkit being installed.

<!-- generated:skill:ml-data-readiness-precheck (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** MLTK data-readiness pre-check
- **Category:** ai-toolkit. **Status:** Operational.
- **Needs:** Splunk_ML_Toolkit 5.0.0 or later
- **Agent templates:** 7: AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Stats vs ML decision helper
- **Tools it steers:** `splunk_run_search`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:ml-data-readiness-precheck -->

### ml-self-correct-budget

Caps every model-related artifact (training search, scoring search, dashboard, alert) at three attempts. After the third failure the assistant stops and reports what it tried, what failed and a suggested manual fix, in a fixed format, and confirms it left no broken artifact behind.

**When it applies:** Any AI Toolkit agent template that creates training, scoring, dashboard or alert artifacts. It depends on the AI Toolkit being installed.

<!-- generated:skill:ml-self-correct-budget (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** MLTK self-correct loop (max 3 attempts per object)
- **Category:** ai-toolkit. **Status:** Operational.
- **Needs:** Splunk_ML_Toolkit 5.0.0 or later
- **Agent templates:** 9: AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; Audit & refresh an existing ML use case
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:ml-self-correct-budget -->

### feed-health-verdict

Makes the assistant check TrackMe feed health with `trackme_health_for_indexes`, `trackme_list_acks` and `trackme_list_maintenance` before drawing conclusions, and end every report with an explicit green, red or mixed feed-health verdict. Static or demo datasets are exempt: the assistant says in one line that feed health does not apply. On dashboards, a TrackMe panel is added only when the dashboard is about monitoring or data freshness and TrackMe confirms it tracks the indexes, using the ready-made SPL the tool returns and never `inputlookup` against TrackMe's private lookups.

**When it applies:** Diagnostic, SOC, ITSI and investigation agent templates when TrackMe is installed. If TrackMe is not installed, the assistant says so once and proceeds.

<!-- generated:skill:feed-health-verdict (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** TrackMe feed-health pre-flight + explicit verdict
- **Category:** data-platform. **Status:** Operational.
- **Needs:** trackme
- **Agent templates:** 41: Build / improve an alert; Data onboarding helper; Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; Data troubleshooting helper; Investigation; ES — Triage a notable; ES — Investigate a user; ES — Investigate a host; ES — Investigate an IOC; ES — Phishing email triage; ES — Lateral movement check; ES — Detection coverage gap analysis; ES — Daily SOC handoff summary; ES — Tune a noisy correlation search; ITSI — Automatic Root Cause Analysis; ITSI — Diagnose service degradation; ITSI — Root-cause an episode; ITSI — Service health timeline; ITSI — KPI threshold review; ITSI — Impact analysis; ITSI — Episode triage queue summary; ITSI — Entity health check; TrackMe — Morning data-health check; TrackMe — Empty-result investigator; TrackMe — ITSI KPI root-cause assistant; TrackMe — ES detection data-readiness check; TrackMe — Event-count anomaly deep dive; TrackMe — Onboard a new data source; ATT&CK Tactic Hunt — Technique Coverage Dashboard; Fraud Data Coverage Audit; Fraud Rule Builder; Fraud Ring Mapper; Fraud Alert Triage; Fraud Notable Triage (Enterprise Security); Benefits and Claims Triage; Behavioral Profile Builder; Fraud Command Center
- **Tools it steers:** `trackme_health_for_indexes`, `trackme_list_acks`, `trackme_list_maintenance`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:feed-health-verdict -->

### metric-vs-event-index-aware

Makes the assistant read each index's type from `splunk_list_indexes` before writing SPL, and use `mstats` or `mcatalog` for metric indexes instead of an event search that would return nothing. When it switches to metric syntax it tells the user why.

**When it applies:** Any agent template that takes an index name from the user or generates SPL that names an index.

<!-- generated:skill:metric-vs-event-index-aware (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Metric vs event index awareness
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 10: Build a SPL search; Improve an existing SPL; Explain a SPL search; Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; Data correlation helper; Data troubleshooting helper; Investigation; TrackMe — Empty-result investigator; ATT&CK Tactic Hunt — Technique Coverage Dashboard
- **Tools it steers:** `splunk_list_indexes`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:metric-vs-event-index-aware -->

### read-only-by-default-soc

Keeps SOC work read-only unless the user explicitly confirms a change: `es_update_notable` and `es_add_investigation_note` run only after a specific yes, and adaptive-response actions are listed with `es_list_adaptive_responses` but never invoked. Verdicts must be backed by quoted tool output, and single-entity investigations follow a six-part report: subject, entities, risk, feed health, verdict and recommended next step.

**When it applies:** Every Enterprise Security agent template. It depends on Splunk Enterprise Security being installed.

<!-- generated:skill:read-only-by-default-soc (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Read-only by default for SOC / SecOps work
- **Category:** security-soc. **Status:** Operational.
- **Needs:** SplunkEnterpriseSecuritySuite
- **Agent templates:** 11: ES — Triage a notable; ES — Investigate a user; ES — Investigate a host; ES — Investigate an IOC; ES — Phishing email triage; ES — Lateral movement check; ES — Detection coverage gap analysis; ES — Daily SOC handoff summary; ES — Tune a noisy correlation search; TrackMe — ES detection data-readiness check; ATT&CK Tactic Hunt — Technique Coverage Dashboard
- **Tools it steers:** `es_update_notable`, `es_add_investigation_note`, `es_asset_lookup`, `es_list_adaptive_responses`
- **Knowledge it uses:** none
- **Knowledge it creates:** [records in other apps](./knowledge-layer.md#records-in-other-apps)
<!-- /generated:skill:read-only-by-default-soc -->

### read-only-by-default-itops

Keeps ITSI work read-only: `itsi_update_episode` runs only after the user confirms the exact change. Every verdict separates "service broken" from "data broken", root-cause candidates are ranked with their supporting evidence, service-degradation analysis follows a fixed read-only order of ITSI tools and feed-health checks, and impact analysis only describes the current topology.

**When it applies:** Every ITSI agent template. It depends on ITSI being installed.

<!-- generated:skill:read-only-by-default-itops (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Read-only by default for ITSI work
- **Category:** service-management. **Status:** Operational.
- **Needs:** SA-ITOA
- **Agent templates:** 9: ITSI — Automatic Root Cause Analysis; ITSI — Diagnose service degradation; ITSI — Root-cause an episode; ITSI — Service health timeline; ITSI — KPI threshold review; ITSI — Impact analysis; ITSI — Episode triage queue summary; ITSI — Entity health check; TrackMe — ITSI KPI root-cause assistant
- **Tools it steers:** `itsi_update_episode`, `itsi_get_service`, `itsi_list_kpis`, `itsi_get_kpi_search`
- **Knowledge it uses:** none
- **Knowledge it creates:** [records in other apps](./knowledge-layer.md#records-in-other-apps)
<!-- /generated:skill:read-only-by-default-itops -->

### data-vs-service-distinction

Makes the assistant decide whether a red state is data-driven (the feed is late, stale or partly missing) or service-driven (the feed is healthy and the service is misbehaving), or mixed, and give an unambiguous verdict with a recommended action and owner for each case. If the evidence does not decide it, the assistant says so and names the specific check needed.

**When it applies:** Any agent template that interprets an ITSI red state or a TrackMe anomaly, when TrackMe is present (with or without ITSI).

<!-- generated:skill:data-vs-service-distinction (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Data broken vs service broken — the two-verdict rule
- **Category:** service-management, data-platform. **Status:** Operational.
- **Needs:** trackme
- **Agent templates:** 11: Investigation; ITSI — Automatic Root Cause Analysis; ITSI — Diagnose service degradation; ITSI — Root-cause an episode; ITSI — Service health timeline; ITSI — KPI threshold review; ITSI — Impact analysis; ITSI — Episode triage queue summary; TrackMe — Empty-result investigator; TrackMe — ITSI KPI root-cause assistant; TrackMe — Event-count anomaly deep dive
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:data-vs-service-distinction -->

### naming-collision-handling

Makes the assistant check whether a name is already taken before saving any named object (saved search, alert, dashboard, model, lookup), using the matching list or get tool. On a collision it asks the user to save under a new name, overwrite, or cancel, never overwrites silently, and re-checks a suffixed name before using it.

**When it applies:** Any agent template that saves an object under a name in the user's namespace.

<!-- generated:skill:naming-collision-handling (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Knowledge object name-collision handling
- **Category:** knowledge-objects. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 23: Build a SPL search; Improve an existing SPL; Explain a SPL search; Build a Simple XML dashboard; Improve a Simple XML dashboard; Build a Dashboard Studio JSON dashboard; Build / improve an alert; Data Source Onboarding (full); AI Toolkit – Smart outlier detection (single metric); AI Toolkit – Multi-field anomaly detection; AI Toolkit – Smart forecasting; AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting; AI Toolkit – Smart clustering; AI Toolkit – Smart prediction (categorical or numeric); AI Toolkit – Outlier ALERT + diagnostic dashboard; AI Toolkit – Bring your own ONNX model (score in Splunk); AI Toolkit – Score against an AWS SageMaker endpoint; AI Toolkit – Ask an external LLM about your Splunk data (`ai` command); Audit & refresh an existing ML use case; Create your own agent; ATT&CK Tactic Hunt — Technique Coverage Dashboard
- **Tools it steers:** `splunk_list_saved_searches`, `splunk_get_dashboard_xml`, `splunk_get_dashboard_studio_json`, `splunk_list_ml_models`, `splunk_list_lookups`, `splunk_update_dashboard_xml`, `splunk_update_saved_search`
- **Knowledge it uses:** none
- **Knowledge it creates:** [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts), [dashboards](./knowledge-layer.md#dashboards)
<!-- /generated:skill:naming-collision-handling -->

### template-authoring-discipline

Guides the assistant when it writes or updates an agent for a user: keep the agent small and procedural, ask only for the inputs needed, follow the catalogue's naming patterns, and reference skills by name instead of copying their content. If a needed rule does not exist as a skill, it stops and asks the user to have an admin add one. User-authored agents are always private and operational, never default or general, and the assistant refuses requests to build agents that bypass guardrails or validation.

**When it applies:** Agent templates that author or update other agents on behalf of a user (the create-your-own-agent and update-your-own-agent flows).

<!-- generated:skill:template-authoring-discipline (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Agent authoring discipline
- **Category:** general, authoring. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 2: Create your own agent; Update your own agent
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:template-authoring-discipline -->

### prompt-injection-defense-on-authored-content

Treats everything a user types into an agent-authoring flow as untrusted data. The assistant refuses attempts to widen sharing, change the owner, add or inline skills, bypass the General guardrail, require roles, or make an agent look system-built, states each refusal in one sentence, and still builds the legitimate rest of the request. It never copies suspicious text verbatim into the saved agent, and the server independently enforces the same rules.

**When it applies:** Agent templates where the user's input becomes the body of another saved prompt (the create-your-own-agent and update-your-own-agent flows).

<!-- generated:skill:prompt-injection-defense-on-authored-content (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Defense against prompt injection in authored content
- **Category:** general, authoring, security. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 2: Create your own agent; Update your own agent
- **Tools it steers:** `splunk_create_user_template`, `splunk_update_user_template`
- **Knowledge it uses:** none
- **Knowledge it creates:** [KV store collections](./knowledge-layer.md#kv-store-collections)
<!-- /generated:skill:prompt-injection-defense-on-authored-content -->

### consult-security-knowledge-first

Makes the assistant consult the knowledge layer before writing its own SPL for security work, in three steps: `splunk_route_knowledge`, then `splunk_search_knowledge` on the top connectors, then `splunk_get_knowledge_entry`, preferring to adapt a validated detection and citing its source. Tools unlocked by a knowledge entry are used only as that entry directs, Splunk Security Essentials content is reached through `sse_list_content` and `sse_get_detection`, entries flagged for injection are treated as untrusted, and adapted searches are still validated before saving.

**When it applies:** Enterprise Security and SOC agent templates, for security tasks such as investigating notables, designing or tuning detections, hunting and incident work. Knowledge is an aid, not a requirement: an empty shortlist means the assistant proceeds normally.

<!-- generated:skill:consult-security-knowledge-first (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Consult the knowledge layer for security-flavoured tasks
- **Category:** security, knowledge, general. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 20: Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; ES — Triage a notable; ES — Investigate a user; ES — Investigate a host; ES — Investigate an IOC; ES — Phishing email triage; ES — Lateral movement check; ES — Detection coverage gap analysis; ES — Daily SOC handoff summary; ES — Tune a noisy correlation search; TrackMe — ES detection data-readiness check; ATT&CK Tactic Hunt — Technique Coverage Dashboard; Fraud Data Coverage Audit; Fraud Rule Builder; Fraud Ring Mapper; Fraud Alert Triage; Fraud Notable Triage (Enterprise Security); Benefits and Claims Triage; Behavioral Profile Builder
- **Tools it steers:** `splunk_route_knowledge`, `splunk_search_knowledge`, `splunk_get_knowledge_entry`, `sse_list_content`, `sse_get_detection`, `sse_check_prerequisites`, `splunk_report_knowledge_use`, `splunk_create_saved_search`, `splunk_run_search`
- **Knowledge it uses:** [knowledge connectors](./knowledge-layer.md#how-the-assistant-reads-knowledge), [knowledge unlocks tools](./knowledge-layer.md#knowledge-unlocks-tools)
- **Knowledge it creates:** [telemetry events](./knowledge-layer.md#telemetry), [saved searches and alerts](./knowledge-layer.md#saved-searches-and-alerts)
<!-- /generated:skill:consult-security-knowledge-first -->

### cdtsm-discipline

Governs work with the pre-trained Cisco Deep Time Series Model, which has no training step and no model object. The assistant first confirms AI Toolkit 5.7.3 or later with `splunk_list_apps` and refuses if it is missing, never calls `splunk_share_mltk_model_globally`, uses the CDTSM naming pattern, respects the parameter constraints and the 24-hour detection window, and runs the scoring search once and snapshots it with `splunk_proof_snapshot` for the proof dashboard. That dashboard is hand-written with `splunk_create_dashboard_xml` around the AI Toolkit forecast or anomaly custom visualisation; a 401 at verify time is often a token-sharing problem (checked with `splunk_check_cdtsm_availability`) and does not stop delivery.

**When it applies:** The three CDTSM agent templates (forecasting, anomaly detection and predictive alerting), which use the pre-trained model rather than training-based MLTK.

<!-- generated:skill:cdtsm-discipline (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Cisco Deep Time Series Model (CDTSM) discipline
- **Category:** ai-toolkit. **Status:** Operational.
- **Needs:** Splunk_ML_Toolkit 5.0.0 or later
- **Agent templates:** 3: AI Toolkit – CDTSM Smart Forecasting; AI Toolkit – CDTSM Anomaly Detection; AI Toolkit – CDTSM Predictive Alerting
- **Tools it steers:** `splunk_list_apps`, `splunk_share_mltk_model_globally`, `splunk_create_dashboard_xml`, `splunk_run_search`, `splunk_proof_snapshot`, `splunk_list_visualizations`, `splunk_get_visualization_docs`, `splunk_check_cdtsm_availability`
- **Knowledge it uses:** none
- **Knowledge it creates:** [dashboards](./knowledge-layer.md#dashboards), [lookups](./knowledge-layer.md#lookups), [KV store collections](./knowledge-layer.md#kv-store-collections)
<!-- /generated:skill:cdtsm-discipline -->

### hunt-evidence-honesty

Stops hunt and coverage dashboards from showing a zero as good news: a tile with no evidence is never green, but neutral grey and labelled "No evidence in window", or dropped with a note. The assistant checks the real count before building a tile, broadens a too-narrow match once before accepting a zero, keeps red meaning bad across the whole dashboard, prefers distinct-count thresholds for noisy signals, and says plainly when a data source cannot support a technique.

**When it applies:** Hunt, coverage and detection-dashboard agent templates that build per-technique or per-detection tiles or panels from evidence counts.

<!-- generated:skill:hunt-evidence-honesty (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Hunt evidence honesty — zero-evidence and detection-tile colour rules
- **Category:** security-soc. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 8: ATT&CK Tactic Hunt — Technique Coverage Dashboard; Fraud Data Coverage Audit; Fraud Ring Mapper; Fraud Alert Triage; Fraud Notable Triage (Enterprise Security); Benefits and Claims Triage; Behavioral Profile Builder; Fraud Command Center
- **Tools it steers:** `splunk_run_search`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:hunt-evidence-honesty -->

### demo-dataset-time-reanchor

Prevents empty results on fixed-window demo or training datasets. The assistant checks with `splunk_list_lookups` whether an optional `demo_dataset_windows` registry exists, reads it with `splunk_get_lookup_sample` only if it does, and re-anchors a relative time range onto the dataset's active period only when the target index matches a row. It handles where the window goes on each surface (tool time window, saved-search macro, or an ISO 8601 default in a dashboard time input), and tells the user the re-anchoring happened; if the registry is absent or has no match, it honours the user's range as given.

**When it applies:** Any agent template that sets a dashboard or search time range and may run against a fixed-window demo, training or capture-the-flag dataset.

<!-- generated:skill:demo-dataset-time-reanchor (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Demo dataset time re-anchoring — map relative windows onto a fixed dataset's active period
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: ATT&CK Tactic Hunt — Technique Coverage Dashboard
- **Tools it steers:** `splunk_list_lookups`, `splunk_get_lookup_sample`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:demo-dataset-time-reanchor -->

### conf-package-discipline

Makes the assistant deliver onboarding configuration as a deployment-ready package of four apps (forwarder inputs, indexer index-time settings, search-head search-time settings, and deployment-server server classes), assembled with `splunk_generate_conf_package`. It keeps index-time and search-time settings on the right tier, self-checks the Magic 8 points, only uses attribute names it can stand behind, and ends with verification SPL to run after deployment. The tool does not install anything: the admin deploys the package.

**When it applies:** Any agent template that generates Splunk onboarding configuration (props, transforms, inputs, tags, serverclass) and delivers a deployable package.

<!-- generated:skill:conf-package-discipline (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Deployment-ready multi-app config package generation (4-app layout)
- **Category:** data-platform. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Data Source Onboarding (full)
- **Tools it steers:** `splunk_generate_conf_package`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:conf-package-discipline -->

### data-onboarding-readiness

Makes the assistant check that data is parsed correctly, not just arriving on time, by calling `splunk_check_ingest_health`, which reads Splunk's ingestion log as the system user and reports timestamp, truncation and line-breaking problems per sourcetype. The verdict is reported to the user early and plainly, and combined with TrackMe flow health and an upstream leg for Cribl (`splunk_check_cribl_ingest_health`) or Edge Processor (`splunk_check_edge_processor_health`) when those apply. Disagreement between legs is treated as a finding, overlapping signals for one incident are reported once, and an unconfigured or silent upstream check counts as unverified, never clean.

**When it applies:** Any agent template that builds time-based artifacts on a sourcetype (dashboards, alerts, time-based searches), and every onboarding or data-quality agent template. Legs whose tool is unavailable are skipped without blocking the request.

<!-- generated:skill:data-onboarding-readiness (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Onboarding-correctness preflight — is the data actually parsed right?
- **Category:** data-platform. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 8: Data onboarding helper; CIM Coverage Audit; Data Source Onboarding (full); Cribl Stream → Splunk data-quality check; Edge Processor → Splunk data-quality check; Investigation; Fraud Data Coverage Audit; Fraud Alert Triage
- **Tools it steers:** `splunk_check_ingest_health`, `splunk_check_cribl_ingest_health`, `splunk_check_edge_processor_health`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:data-onboarding-readiness -->

### dashboard-ingestion-health

Puts a data-ingestion health check at the top of dashboards that read index data. On the builder path, `splunk_xml_publish` adds the "Data quality" row itself (the ingestion-check verdict with counts and the newest event per index, a "No new data" banner, or "not checked" with the reason), and the assistant adds no ingestion section, banner or freshness panel of its own. That row covers only the Splunk-parse leg, so the assistant still adds, beside it, the TrackMe panel when `trackme_health_for_indexes` returns `tracked:true`, and a one-line note with the Cribl or Edge Processor verdict when the feed is fronted by one of them.

**When it applies:** Every dashboard-building agent template. On hand-written dashboards (`splunk_create_dashboard_xml` or `splunk_update_dashboard_xml`) and on the compiler path, the assistant builds the section itself: one "No new data" banner and nothing else for a static dataset (without calling an index static only because it has no recent events), or for a live index a section with the always-present Splunk leg (`splunk_check_ingest_health`, a freshness KPI and an ingestion-volume trend), TrackMe, Cribl or Edge Processor legs when they apply, and a one-line verdict note. A dashboard that reads only lookups gets no ingestion section.

<!-- generated:skill:dashboard-ingestion-health (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Mandatory data-ingestion health panel on every dashboard
- **Category:** dashboards, data-platform. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 3: Build a Simple XML dashboard; Improve a Simple XML dashboard; Investigation
- **Tools it steers:** `splunk_xml_publish`, `trackme_health_for_indexes`, `splunk_create_dashboard_xml`, `splunk_update_dashboard_xml`, `splunk_check_ingest_health`, `splunk_check_cribl_ingest_health`, `splunk_route_tools`, `splunk_xml_add_panel`, `splunk_check_edge_processor_health`
- **Knowledge it uses:** none
- **Knowledge it creates:** [dashboards](./knowledge-layer.md#dashboards)
<!-- /generated:skill:dashboard-ingestion-health -->

### cribl-field-discovery

Makes the assistant discover Cribl metadata fields from a live sample of the data and of the Cribl monitoring index instead of assuming field names. It looks for a field present on both sides to join on, and if there is none, or no Cribl fields exist on the data at all, it says so and falls back to whole-index signal rather than inventing a per-feed correlation.

**When it applies:** When a feed is, or may be, processed by Cribl Stream and the assistant needs to scope Cribl monitoring by pipeline or source, or decide whether a feed goes through Cribl at all.

<!-- generated:skill:cribl-field-discovery (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Discover Cribl metadata fields per index/sourcetype
- **Category:** data-platform. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Cribl Stream → Splunk data-quality check
- **Tools it steers:** `splunk_check_cribl_ingest_health`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:cribl-field-discovery -->

### edge-processor-discovery

Makes the assistant verify Splunk Edge Processor involvement instead of assuming it: it checks for a provenance field the customer may have added, confirms Edge Processor metrics are reaching Splunk, and reads metric names from live data. Without a stamped field it reports only whole-instance or whole-dataset signal, it distinguishes Edge Processor from Cribl, and when nothing is found it says so and falls back to the Splunk and TrackMe checks.

**When it applies:** When a feed is, or may be, processed by Splunk Edge Processor and the assistant needs to confirm its telemetry reaches Splunk, decide whether per-feed attribution is possible, or tell it apart from Cribl.

<!-- generated:skill:edge-processor-discovery (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Discover whether Splunk Edge Processor fronts a feed (and if a join key exists)
- **Category:** data-platform. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Edge Processor → Splunk data-quality check
- **Tools it steers:** `splunk_check_edge_processor_health`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:edge-processor-discovery -->

### magic-8-compliance

Makes every onboarding output state its status against the Magic 8 checklist: clear sourcetype, explicit line breaking, explicit timestamp extraction, key field extractions, CIM alignment, validation, documentation and monitoring. The assistant grounds attribute names in the conf-spec knowledge, validates stanzas with `splunk_validate_props_conf` and `splunk_validate_transforms_conf`, scores the result with `splunk_compute_data_quality_score`, and iterates on the weakest dimensions while the score is under 90. Real parsing is confirmed after deployment with `splunk_check_ingest_health`, and missing tools never block the work.

**When it applies:** Any agent template that generates or audits onboarding configuration (props and transforms) and needs it to be correct, not just plausible.

<!-- generated:skill:magic-8-compliance (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Magic 8 onboarding checklist + validate-and-score before handover
- **Category:** data-platform. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 2: CIM Coverage Audit; Data Source Onboarding (full)
- **Tools it steers:** `splunk_validate_props_conf`, `splunk_validate_transforms_conf`, `splunk_compute_data_quality_score`, `splunk_check_ingest_health`
- **Knowledge it uses:** [conf-spec](./knowledge-layer.md#conf-spec)
- **Knowledge it creates:** none
<!-- /generated:skill:magic-8-compliance -->

### cim-coverage-audit

Governs how the assistant reports the result of `splunk_audit_cim_coverage`: it narrates the deterministic result rather than computing its own. It audits a specific dataset, says what the search-head view cannot see, reports tagging and index-allowlist blockers before field mapping, reports both acceleration states without changing them, never rounds a partial field up, and presents remediation as validated, prefixed, search-head-deployable config that the operator deploys. Outcomes such as "CIM not installed" or "no data" are reported as they are, with "no data" pointed at `splunk_check_ingest_health`.

**When it applies:** Whenever `splunk_audit_cim_coverage` is run, or a user asks why CIM, a correlation search or an ITSI KPI is not working for a particular sourcetype.

<!-- generated:skill:cim-coverage-audit (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Interpreting the CIM Coverage Audit honestly
- **Category:** data-platform. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: CIM Coverage Audit
- **Tools it steers:** `splunk_audit_cim_coverage`, `splunk_check_ingest_health`
- **Knowledge it uses:** [cim-data-models](./knowledge-layer.md#cim-data-models)
- **Knowledge it creates:** none
<!-- /generated:skill:cim-coverage-audit -->

### servicenow-structured-discipline

Makes the assistant respect ServiceNow's structure instead of guessing: no invented tables, fields, query operators or choice codes, logical class names resolved by the tool, reads through named query patterns (with `servicenow_table_get` as a declared fallback), display values shown to users while system ids are kept for writes, and labels resolved to codes before writing. Relationship questions use bounded named traversals, which return a partial result with a note rather than hanging.

**When it applies:** Every ServiceNow agent template and every ServiceNow agent.

<!-- generated:skill:servicenow-structured-discipline (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** ServiceNow structured-data discipline
- **Category:** servicenow. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 14: ServiceNow CMDB Lookup & Enrichment; ServiceNow Incident / Event Raise; ServiceNow Incident from Splunk Alert; ServiceNow Incident from ITSI Episode; ServiceNow Incident from ES Notable; ServiceNow Closed-Incident: Create New; ServiceNow Closed-Incident: Reopen; ServiceNow Closed-Incident: Suppress; Security Incident from ES Notable; Security Incident from Splunk Alert; Security Incident from ITSI Episode; Security Closed-Incident: Create New; Security Closed-Incident: Reopen; Security Closed-Incident: Suppress
- **Tools it steers:** `servicenow_table_get`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:servicenow-structured-discipline -->

### servicenow-incident-description-authoring

Stops the assistant from writing the incident `description` text itself. It passes a structured content object (situation, business and technical impact, detected signal, likely cause, evidence, recommended actions, Splunk context, verdict and confidence) to `servicenow_create_incident` or `servicenow_update_incident`, and a fixed renderer produces plain-text output with a consistent section layout. Coded fields are passed as labels for the tool to resolve, and provenance goes into work notes automatically.

**When it applies:** Every ServiceNow agent template and agent that creates or updates incidents or security incidents.

<!-- generated:skill:servicenow-incident-description-authoring (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** ServiceNow incident-description authoring
- **Category:** servicenow. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 13: ServiceNow Incident / Event Raise; ServiceNow Incident from Splunk Alert; ServiceNow Incident from ITSI Episode; ServiceNow Incident from ES Notable; ServiceNow Closed-Incident: Create New; ServiceNow Closed-Incident: Reopen; ServiceNow Closed-Incident: Suppress; Security Incident from ES Notable; Security Incident from Splunk Alert; Security Incident from ITSI Episode; Security Closed-Incident: Create New; Security Closed-Incident: Reopen; Security Closed-Incident: Suppress
- **Tools it steers:** `servicenow_create_incident`, `servicenow_update_incident`
- **Knowledge it uses:** none
- **Knowledge it creates:** [records in other apps](./knowledge-layer.md#records-in-other-apps)
<!-- /generated:skill:servicenow-incident-description-authoring -->

### servicenow-tisc-enrichment

Makes the assistant enrich indicators from ServiceNow Threat Intelligence Security Center by preferring the local add-on lookup when it is present and populated, falling back to the live TISC adapter, and otherwise noting that no enrichment is available and lowering confidence. Only a core set of fields is guaranteed from the lookup, so optional fields such as MITRE ATT&CK phases are used when present and never invented. The worst-case threat score feeds the threat-reputation part of `compute_risk_score`.

**When it applies:** Security agents that enrich indicators when the organisation may have ServiceNow TISC. The assistant never installs the add-on.

<!-- generated:skill:servicenow-tisc-enrichment (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** ServiceNow TISC threat-intel enrichment (detect-and-prefer)
- **Category:** servicenow, security-soc. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** none; an admin can add it to an agent template or an agent
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:servicenow-tisc-enrichment -->

### kpi-data-lineage

Makes the assistant resolve which feed lies behind an ITSI KPI before trusting its value, preferring `itsi_run_rca` for the whole service tree and using `itsi_get_kpi_search` only to drill into one flagged KPI. It reads lineage from the base search rather than the KPI object, reports one of five confidence states, and caps feed trust at indeterminate for anything other than an exact lineage, saying so explicitly in the report.

**When it applies:** ITSI root-cause and service-degradation agent templates that must know which data feed backs a KPI. It depends on ITSI being installed.

<!-- generated:skill:kpi-data-lineage (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** KPI data lineage — resolve the feed behind every KPI before trusting it
- **Category:** service-management, data-platform. **Status:** Operational.
- **Needs:** SA-ITOA
- **Agent templates:** 1: ITSI — Automatic Root Cause Analysis
- **Tools it steers:** `itsi_run_rca`, `itsi_get_kpi_search`
- **Knowledge it uses:** none
- **Knowledge it creates:** [KV store collections](./knowledge-layer.md#kv-store-collections)
<!-- /generated:skill:kpi-data-lineage -->

### monitoring-self-health

Makes the assistant check whether a KPI's own search is still running on time (scheduler skips or lag, stale summary rows, scheduler pressure) before treating it as a service signal. A skipped shared base search is reported as one monitoring finding covering all its member KPIs, monitoring and data-quality findings are kept out of service-cause ranking, and a check that could not be completed is reported as unverified, not healthy.

**When it applies:** Any ITSI root-cause or service-degradation agent template, because a KPI can go stale when its own search stops running, independent of the data. It depends on ITSI being installed.

<!-- generated:skill:monitoring-self-health (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Monitoring self-health — is the KPI even being computed?
- **Category:** service-management, data-platform. **Status:** Operational.
- **Needs:** SA-ITOA
- **Agent templates:** 1: ITSI — Automatic Root Cause Analysis
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:monitoring-self-health -->

### rca-probable-cause-language

Pins the vocabulary for root-cause findings: "probable cause" by default, "root cause" only with a clear mechanism and several independent pieces of evidence, and evidence strength as strong, moderate, weak or insufficient rather than percentages. Correlation is not presented as causation, a change is only ranked as a cause when it touches the affected service's data or config path, and when the evidence does not decide the assistant returns indeterminate and names the signal that would decide it. Data-quality and monitoring findings are routed to their own owners and kept out of service-cause ranking.

**When it applies:** Any ITSI root-cause agent template that presents a ranked cause to a person. It depends on ITSI being installed.

<!-- generated:skill:rca-probable-cause-language (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** RCA language discipline — probable cause, evidence strength, honest uncertainty
- **Category:** service-management. **Status:** Operational.
- **Needs:** SA-ITOA
- **Agent templates:** 1: ITSI — Automatic Root Cause Analysis
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:rca-probable-cause-language -->

### fraud-entity-resolution

Makes the assistant normalise identifiers (email, phone, address) before counting or linking fraud entities, pivot from a suspect through the rarest shared attributes first, and report how rare each link is in this environment. It never gives a verdict from a single indicator, reports converging signals with a confidence level and what would disprove them, resolves entities before scoring, and says plainly when entity keys do not survive between the feeds involved.

**When it applies:** Fraud work that pivots from one account or identity to related ones, such as ring mapping, shared-attribute searches, new-account velocity, or profiling that must count actors rather than accounts.

<!-- generated:skill:fraud-entity-resolution (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Resolving fraud entities before anything else
- **Category:** security-soc. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 7: Fraud Data Coverage Audit; Fraud Rule Builder; Fraud Ring Mapper; Fraud Alert Triage; Fraud Notable Triage (Enterprise Security); Benefits and Claims Triage; Fraud Command Center
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:fraud-entity-resolution -->

### dashboard-ir-authoring

Changes how dashboards are built: the assistant writes a description of the dashboard and `splunk_compile_dashboard` produces, checks and publishes it in one call, owning escaping, tokens, layout, colour and publishing. The assistant owns the panels and their slots, uses self-contained panels unless several genuinely share a transforming base search, leaves the zero-row validation to the compiler, does not widen a query to make rows appear, fixes dashboards with `splunk_revise_dashboard` rather than recompiling, and includes a fixed proof panel set. Rendering is not verified in a browser, so the assistant says the dashboard was published, not that it was verified to render.

**When it applies:** Any agent that carries the dashboards-compiler tool category. For that agent it replaces the Simple XML dashboard discipline and validation-loop skills.

<!-- generated:skill:dashboard-ir-authoring (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Dashboards as an IR, not as markup
- **Category:** dashboards. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 2: Improve an existing SPL; Fraud Rule Builder
- **Tools it steers:** `splunk_compile_dashboard`, `splunk_revise_dashboard`
- **Knowledge it uses:** none
- **Knowledge it creates:** [dashboards](./knowledge-layer.md#dashboards)
<!-- /generated:skill:dashboard-ir-authoring -->

### fraud-dashboard-structure

Gives fraud dashboards a fixed, honest structure: tool verdicts are reproduced verbatim and in full, stored verdicts are read back from the readiness lookup, and a data-quality and feed-health panel is always present, with a row for every leg including those that do not apply. TrackMe is always checked when installed, evidence and analysis panels are grouped separately, empty panels are removed and the removal noted, and a methodology panel states the window, the user the searches ran as, and what lay outside that user's access.

**When it applies:** Whenever a dashboard is built as part of any fraud agent, such as a coverage audit, rule builder, ring mapper, triage or command centre.

<!-- generated:skill:fraud-dashboard-structure (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Fraud dashboards — fixed structure, honest panels
- **Category:** security-soc, dashboards. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 4: Fraud Data Coverage Audit; Fraud Rule Builder; Fraud Ring Mapper; Fraud Command Center
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:fraud-dashboard-structure -->

### fraud-risk-scoring-discipline

Makes fraud scoring weighted and decomposable: each detection adds a weighted contribution for a resolved entity, a separate rule raises the alert when the total and the spread across rule families cross a threshold, and every factor can be queried on its own. On an Enterprise Security estate it uses the native risk framework only, off ES it uses the same risk-based alerting vocabulary, and it follows the installed ES version's terminology. Thresholds are the customer's to tune, falling scores are checked against feed health, and rings are found by inverting the aggregation (`fraud_risk_ring_scan`) with rarity applied, not by lowering thresholds.

**When it applies:** Whenever the assistant generates or tunes anything that scores, accumulates or aggregates fraud signal: risk rules, risk factors, incident rules or a standalone risk ledger.

<!-- generated:skill:fraud-risk-scoring-discipline (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Fraud risk scoring — weighted, decomposable, RBA-aligned
- **Category:** security-soc. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 4: Fraud Rule Builder; Fraud Alert Triage; Fraud Notable Triage (Enterprise Security); Fraud Command Center
- **Tools it steers:** `fraud_risk_ring_scan`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:fraud-risk-scoring-discipline -->

### detection-scope-fidelity

Holds a detection to the scope the person asked for: every filter literal traces back to their request, any widening is proposed first or clearly named, and a rule is never loosened just to make it fire. The assistant keeps the original field that distinguishes event types, carries the evidence fields through to the output row, states which event it kept when a step matches several (and never reuses that collapsed result for totals), reads the output row back against the raw events, reconciles descriptions and titles with the final SPL, and flags a threshold that can never change.

**When it applies:** Whenever the assistant generates, widens or tunes a detection whose output a person will act on, such as sequence rules, risk rules, correlation searches and notable rules, from the first filter through to the handover text.

<!-- generated:skill:detection-scope-fidelity (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Detection scope fidelity — match what they asked for, and prove the row
- **Category:** security-soc. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Fraud Rule Builder
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:detection-scope-fidelity -->

### spl-stage-sampling

Makes the assistant explain an existing search from what it actually does: it runs up to four prefixes of the pipeline (the base once, later cuts via `loadjob`) and quotes real row counts, field names and example values with the window they came from. It strips any command that writes data before sampling, stays within the user's time window, avoids real-time and unbounded searches, flags fields the SPL uses that never appear, locates where a broken search breaks, and labels anything it could not sample as explained from grammar only.

**When it applies:** Whenever the assistant explains, reviews or documents an existing SPL search that it can run. If the search cannot be run, it says so instead.

<!-- generated:skill:spl-stage-sampling (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Explaining SPL from observed behaviour, not from the text
- **Category:** search-authoring. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Explain a SPL search
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-stage-sampling -->

### spl-behaviour-vs-data

Makes the assistant decide whether a search that returns nothing or too little is at fault, or whether the data or the knowledge layer is. A feed verdict for every index the search touches is taken on every run, healthy-looking or not, using `trackme_health_for_indexes` where TrackMe is present and treating untracked indexes as unknown. When results look wrong it also checks that the data exists in the window, runs `splunk_check_ingest_health` while watching for heavy forwarders that do not forward their logs, and checks Cribl or Edge Processor with `splunk_check_cribl_ingest_health` and `splunk_check_edge_processor_health` when installed. These checks run on every licence tier, and static or demo datasets are exempt from the feed verdict with a stated reason.

**When it applies:** Whenever an existing search returns nothing, returns less than expected, or the user says it used to work.

<!-- generated:skill:spl-behaviour-vs-data (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** When a search stopped working, decide whether it is the search or the data
- **Category:** search-authoring. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Explain a SPL search
- **Tools it steers:** `splunk_check_ingest_health`, `splunk_check_cribl_ingest_health`, `splunk_check_edge_processor_health`, `trackme_health_for_indexes`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-behaviour-vs-data -->

### explain-dashboard-layout

Fixes the layout of the dashboard produced when the assistant explains a search, so readers can always tell the user's own search from the assistant's analysis. It has five sections in a fixed order (explanation, the user's search, derived analysis, data health, and links to take it further), each with a labelled divider; the user's-search section holds only the original and the commented version, both run live and never sharing a base search, and every derived panel title starts with "Derived:" in the explanation language. Derived panels use self-contained searches, the markup must be well-formed XML, and the dashboard is published private and render-checked with `splunk_get_dashboard_panel_data` before delivery.

**When it applies:** Every run of the explain-a-search agent template, when building or updating its output dashboard.

<!-- generated:skill:explain-dashboard-layout (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** The explanation dashboard — fixed sections, and whose search is whose
- **Category:** search-authoring. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Explain a SPL search
- **Tools it steers:** `splunk_get_dashboard_panel_data`
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:explain-dashboard-layout -->

### explain-dashboard-style

Gives the explanation dashboard one consistent look on every run: a fixed style block and class names for section dividers (green for the user's search, blue for derived analysis), numbered pipeline stages, observed numbers, and amber licence-gap notices. Status-style table columns are coloured automatically by the app, colours work in light and dark themes, and there are no emojis or icons.

**When it applies:** Every run of the explain-a-search agent template, whenever the assistant writes HTML panels or formats a table.

<!-- generated:skill:explain-dashboard-style (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** The explanation dashboard — house style, one look every run
- **Category:** search-authoring. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Explain a SPL search
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:explain-dashboard-style -->

### spl-cim-model-gaps

Makes the assistant check the CIM knowledge layer when a data-model, `tag=` or `eventtype=` search returns nothing: compare `summariesonly=true` and `false`, resolve the model's index allowlist with `splunk_get_macro`, confirm tags and eventtypes with `splunk_get_tag` and `splunk_get_eventtype`, and use `splunk_audit_cim_coverage` for field coverage, reading its whole answer rather than only the overall verdict. The audit needs the Professional tier (its generated remediation needs Enterprise); when it is refused on a search that genuinely uses CIM, the assistant puts a short factual block in the deliverable naming what was skipped and what the audit would return.

**When it applies:** Whenever a search touches a data model, a tag or an eventtype, especially when it returns less than expected. The first three checks run on every tier.

<!-- generated:skill:spl-cim-model-gaps (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** A CIM search can be perfect and still return nothing
- **Category:** search-authoring. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Explain a SPL search
- **Tools it steers:** `splunk_get_macro`, `splunk_get_tag`, `splunk_get_eventtype`, `splunk_audit_cim_coverage`
- **Knowledge it uses:** [cim-data-models](./knowledge-layer.md#cim-data-models)
- **Knowledge it creates:** none
<!-- /generated:skill:spl-cim-model-gaps -->

### spl-inline-comment-rules

Makes the assistant produce a commented version of a search that still runs and returns exactly what the original did: native inline comments, one per stage on its own line, saying what the stage does and why, with sampled numbers where available. It proves nothing changed by running the commented version once and comparing schema and row count against the original's result, with three attempts before reporting honestly. Comments are plain ASCII, follow the user's explanation language, and never translate field, command, macro or index names.

**When it applies:** Whenever the assistant produces a commented version of an existing search as a deliverable the user will keep and run.

<!-- generated:skill:spl-inline-comment-rules (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Commenting a search so it still runs
- **Category:** search-authoring. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Explain a SPL search
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-inline-comment-rules -->

### spl-intent-coverage

Makes the assistant write a new search from the current request every time. An existing saved search with the same or a similar name decides only the name, and when the user chooses to overwrite, the assistant does not start from, copy or adjust the old search's SPL. Before saving it lists each part of the request (the measure, every filter the user named, the split, the index, sourcetype or source, and the time range) next to the clause that covers it, asks the user about anything it cannot cover instead of dropping it, and ends with one sentence stating plainly what the search counts.

**When it applies:** Any agent that writes a new search from a person's request and saves it, including when it overwrites an existing saved search. In `tstats` it filters only on indexed fields or `TERM()`, uses an event search for a search-time field (which would match nothing in `tstats`), and says so when `TERM()` changes the meaning of a filter to "events containing the word".

<!-- generated:skill:spl-intent-coverage (scripts/gen_knowledge_docs.ts; do not edit) -->
- **Title in the app:** Design the SPL from the request, and cover every part of it
- **Category:** search. **Status:** Operational.
- **Needs:** no other app
- **Agent templates:** 1: Build a SPL search
- **Tools it steers:** none named
- **Knowledge it uses:** none
- **Knowledge it creates:** none
<!-- /generated:skill:spl-intent-coverage -->
