---
sidebar_position: 2
---

# Admin manual — Adjutant AI (formerly AI Workbench)

**App version:** 1.8.0 — **role model and tab inventory refreshed for 2.5.9**
**Last updated:** 2026-09-22
**Audience:** Splunk users holding `admin`, `splunk_admin` **or** `sc_admin`
on the search head where this app is installed. Those three are the whole
list — `bin/itmip_llm_common.py` `ADMIN_ROLES` is the single source of truth,
and `src/services/splunkContext.ts` mirrors it.

> **⚠️ If you administer Splunk Cloud, read this first.**
>
> `sc_admin` is the administrator role on Splunk Cloud — customers are not
> granted `admin` at all — and this manual has always said `sc_admin` belongs
> here. **Until 2.5.9 the UI did not agree.** The server accepted `sc_admin`
> everywhere (every handler gate, and all 100 `write :` ACLs in
> `metadata/default.meta`), but the browser checked only `admin` and
> `splunk_admin`, so a Cloud administrator passed every server-side check and
> was still shown the **end-user** app: no Playbooks, Skills, Knowledge, Input
> Sources, Scheduled Ask, Tokens & Costs, Orgs & BUs, Tools, Models, Audit,
> License or Backups tab. Two screens even said *"You need admin or sc_admin
> role"* to someone holding `sc_admin`.
>
> It also affected tenancy: the browser could class a Cloud admin as
> **unassigned** and grey the whole app out while splunkd considered them
> assigned — which reads as a broken install rather than a role problem.
>
> **Fixed in 2.5.9**, and pinned by `tests/python/test_admin_roles_mirror.py`
> so the two halves cannot drift apart again. **On any earlier build**, the
> workaround is to grant `admin` alongside `sc_admin`.

> **A note on this manual's currency.** The role model and the tab inventory
> below are correct for **2.5.9**. The rest of the document was last given a
> full pass at **1.8.0**, so individual sections may lag — where a subject has
> its own document (Tools, Models, Scheduled Ask, stateless operation,
> licensing), that document is newer and wins.

> **About this app — read first.** Adjutant AI is a *host shell*: a
> single-page React app that has **no use-cases of its own**. Every
> piece of functionality it offers — which playbooks appear, which
> LLMs are reachable, which tools the LLM may call, where saved
> searches / dashboards / alerts land — is fully derived from
> **(a) the Splunk app the user opened it from** and **(b) the Splunk
> roles that user holds**. End users should reach the assistant from
> within Search / ITSI / Enterprise Security / your custom or MSP
> customer apps via a nav-menu entry — they should **not** be pointed
> at the `itmip_ai_splunk_assistent_app` tile directly. The whole
> point of the Workbench is to deliver an AI assistant *inside other
> apps, for other users*, with all generated knowledge objects landing
> in those apps' namespaces. See
> [the installation guide, Deployment model](./installation.md)
> and the **Multi-tenant namespace model** section below for the full
> rationale.

This document covers **only** the parts of the app that an admin sees
that an end user doesn't. For everything an end user sees — the Ask
tab, History, Settings, attaching references, picking playbooks, the
guardrail behaviour — read [the user manual](../user/user-manual.md) first.

Keep this manual in lock-step with the shipped app; update it any
time an admin-visible feature changes.

## Multi-tenant namespace model — design assumption

Adjutant AI is designed to be **embedded in the navigation menu of
every Splunk app it serves**, not consumed as a standalone tile. The
expected install pattern:

1. Drop the app on the Search Head (and KVStore replication peers).
2. For each app that should expose the assistant — Search, ITSI,
   Enterprise Security, custom SOC apps, MSP customer apps —
   edit that app's `data/ui/nav/default.xml` to add a nav entry that
   opens the Adjutant AI dashboard.
3. **The calling app becomes the namespace.** When a user opens
   Adjutant AI from app *X*, every saved search / dashboard / alert /
   MLTK model the LLM creates is written into app *X*'s namespace,
   owned by the calling user. Switching to app *Y* and re-opening
   the same Workbench writes future artefacts into app *Y* instead.
4. **Adjutant AI resolves Org + BU automatically** from `(callingApp,
   userRoles)` against the Organisations + Business Units you
   configure on the Orgs & BUs tab. The user never picks Org/BU
   themselves — it's a property of "where they opened the assistant
   from + which roles they hold".
5. **Users who don't resolve into any Org see a greyed-out app + an
   admin-configured "ask your Splunk team" message** — they cannot
   accidentally fall into DFLT/DFLT and start running tools without
   tenancy. The message text comes from
   `[ui] unassigned_message` in `local/itmip_ai_workbench.conf`
   (default is generic; you should customise it with your actual
   contact instructions).

Design rationale: the Workbench is one app, but the customer
experience is "AI assistant *in* my SOC app", "AI assistant *in* my
ITSI app", "AI assistant *for* my MSP customer's tenant" — all
served by the same engine without operators having to remember which
namespace they're in. Splunk's namespace model handles the
artefact-routing for free; the Org/BU model handles per-tenant
playbook and tool visibility on top of it.

## Quick reference — what's admin-only

Listed in the order they appear in the tab bar, so you can read along with the
screen. **16 tabs in total**; the 13 below are admin-only, and Ask, Settings and
Help are shared with end users.

| Tab | Purpose |
|-----|---------|
| Playbooks | CRUD on use-case playbooks; promote draft → operational; clone across Org/BU; visibility scoping; **edit each playbook's `includes_skills` list (0.9.6+)**; **see user-authored private playbooks from 0.9.7+** (filter not yet in UI — they appear mixed with system playbooks). 90 ship as seeds. |
| Skills (0.9.6+) | CRUD on the **Skills layer** — reusable "do-it-correctly" prose blocks that playbooks reference. Sits between Playbooks and Tools. 52 ship as seeds. See the tools and playbooks overview, §3.5. |
| Knowledge | Manage knowledge entries + connectors. Live-platform connectors read the running instance's `searchbnf.conf` (command syntax) and installed visualizations to ground SPL/viz generation (1.4.0). Seven sub-tabs: Connectors, Static rules, Curated entries, Learned Knowledge, Integration State, Integration Runs, Mappings. See the knowledge-layer guide. |
| Input Sources | The sources a playbook or integration may read from. |
| Scheduled Ask *(2.x)* | Put a playbook on a timer, via **+ New scheduled ask**. Two kinds: **"Scheduled Job — run a Playbook, deliver a result"** (needs the `scheduled_job` capability, Professional+) and **"Scheduled Integration — read a source, write a target"** (needs the **`ai-integration`** named feature). The integration branch is chosen by the type **or** by the bound Playbook's `integration` tag, so it cannot be booked as a cheaper Job by relabelling. See the Scheduled Ask and memory guide and the AI Driven Integration guide. |
| Tokens & Costs | Cost / token analytics, multi-group comparison, over-time charts. Greyed unless licence ≥ Professional. |
| Orgs & BUs | Multi-tenant CRUD. Cap-enforced by licence. |
| Tools | Four sub-tabs since 2.5.9: **Built-in tools** (enable/disable, per-tool metadata overrides — **182** of them), **Custom tools** (the custom-tools guide), **MCP servers** (registration, tool import, and per-tool expand + run for debugging), **ServiceNow** (the ServiceNow guide). Credentials for MCP and ServiceNow are settable **from the UI** — no backend trip to rotate one. **Full details in the tool catalogue.** |
| Audit (1.3.0+) | Per-Org audit search / timeline / consent + governance log / CSV export. **Greyed unless licence ≥ Enterprise (moved from Professional in 1.4.1).** |
| License | Activate / validate / remove the Cryptolens licence; manage expiry-warning recipients. |
| Backups | Browse daily KVStore snapshots, inspect manifest + verification + referenced-credentials inventory per backup, trigger an out-of-schedule backup, and run a 3-step dry-run + acknowledge + commit **restore** (0.9.0+). Greyed unless licence ≥ Professional. |
| Models *(2.5.9)* | The model + price catalogue, where each price came from, discovery run history, **Refresh from providers**, per-row **Set price** and manual model registration. **This moved out of Settings in 2.5.9** — older screenshots show it there. Authoring needs `model_catalog_overrides` (Enterprise); the catalogue and run history are visible to any admin. See [the LLM model catalogue](./llm-model-catalog.md). |
| Settings *(shared, with extras)* | Same surface as the user manual, plus central-scope LLMs, the connection **wizard** (**+ Add LLM**, **Edit** and **Open in wizard** are admin-only and are **not rendered at all** for anyone else), and the Customer authorisation hook toggle. |

**Help** is the one tab everybody has, admin or not, and it renders outside the
main panel — so it still works when the app is greyed out, which is when a user
most needs to report a problem.

End-user controls that admins also have:

- Asking questions, History (always enabled for admins since the
  licence-gating is on `effective_tier == "personal"` which doesn't
  apply to admin-served features), Settings for personal LLMs.

## Per-feature licensing (v1.4.1)

Up to 1.4.0 the licence tier gated a coarse handful of things (Orgs/BUs
caps, Tokens & Costs, audit). **1.4.1 replaces that with a per-feature
capability matrix.** Each feature declares the **minimum tier** it needs;
the server resolves the active tier to a full `{capability: bool}` map and
both refuses gated calls server-side **and** tells the frontend which
tabs / sections / playbooks to grey out. The split is deliberate:

- **Professional = operations** (the things a working ops team does).
- **Enterprise = security + integrations + governance + reliability**
  (the things a SOC / platform team and a procurement / compliance team
  scrutinise).

The matrix is server-authoritative and **fail-closed**: if the licence
state is in any doubt (expired, node-lock mismatch, vendor unreachable)
the effective tier collapses toward Personal and the gated features
disappear. Source of truth: `CAPABILITY_MIN_TIER` in
`bin/itmip_llm_license_tier.py`, emitted on
`GET /services/itmip_llm/license` as `capabilities`.

### Which feature needs which tier

| Capability | Min tier | What it covers |
|---|---|---|
| `spl_generation`, `dashboard_generation` (Simple XML + Studio), `alert_generation` | **Personal** | Core authoring — every tier, including the free single-user trial. |
| `byok`, `multi_llm` | **Personal** | Bring-your-own-key and the multi-provider LLM picker — all tiers. |
| `knowledge_layer`, `skills_layer`, `template_authoring` | **Personal** | Knowledge / Skills / playbook authoring — all tiers. |
| `ml_generation` | **Professional+** | MLTK `fit` workflows + CDTSM training/model promotion. |
| `history` | **Professional+** | Persisted Ask history. |
| `tokens_costs` | **Professional+** | Tokens & Costs analytics tab. |
| ~~`in_splunk_awareness`~~ *(deprecated 1.7.1)* | **All tiers** *(was Professional+)* | TrackMe feed-health + the `_internal` / Cribl ingestion-health **checks** — moved to all tiers in 1.7.1 (bounded only by Splunk role + index ACL). ES / ITSI **read**-context tools are gated by `security_workflows` (Enterprise), not this key. |
| `backups` | **Professional+** | Backups tab (daily snapshot browse + restore wizard). |
| `data_onboarding` | **Professional+** | Data Foundation **authoring**: config-package builder, props/transforms validators, Data Quality Score (**Live — shipped 1.5.0**). *(The ingestion-health **check** tools moved to all tiers in 1.7.1 — see `in_splunk_awareness` above.)* |
| `platform_ops` | **Professional+** | *Reserved — platform-operations playbooks / tools.* |
| `security_workflows` | **Enterprise+** | ES / ITSI / ATT&CK-hunt playbooks + ES / ITSI / SSE tools. |
| `mcp_servers` | **Enterprise+** | MCP server registration + tool import + invoke. |
| `custom_http_tools` | **Enterprise+** | Admin-authored custom HTTP tools. |
| `iam_gateway_hook` | **Enterprise+** | Customer authorisation hook (server-side dynamic headers). |
| `audit_logging` | **Enterprise+** | Audit tab + per-Org audit index config **(moved from Professional in 1.4.1)**. |
| `governance_logging` | **Enterprise+** | Governance change log (playbook/tool/MCP/LLM-config changes). |
| `reliability_llm_ops`, `ai_activity_dashboard`, `llm_health_dashboard`, `multi_model_orchestration` | **Enterprise+** | *Reserved — LLM reliability/observability roadmap.* |
| `multi_deployment` | **MSP** | Multiple Orgs across deployments. |

### Named licensable features (v1.5.0+) — the second gating dimension

Alongside the tier capabilities above, a **second** gate exists: *named
features* carried in the Cryptolens `cryptolens_features` data object. A
named feature is granted only when **both** conditions hold:

- **access = edition-min AND feature-present** — the effective edition
  reaches the feature's minimum (`FEATURE_MIN_EDITION` in
  `bin/itmip_llm_license_tier.py`) **and** the feature is actually present
  on the license.

Presence is checked with dotted **`HasFeature(license, "a.b")`** notation
(replicated in pure Python), so a parent feature and its children are
addressable independently.

| Named feature | Min edition | Gates |
|---|---|---|
| `socplaybooks` | **Enterprise** | Backend Ask-service SECURITY playbook content (composes with `security_workflows`). |
| `opsrunbooks` | **Professional** | Operations playbook content. |
| `servicenow` (+ children `incidents` / `problems` / `events` / `changes` / `csdm`) | **Professional** | The **ServiceNow integration** — all REST tools / knowledge / playbooks + ITSM playbooks. The integration uses the flat parent today; the children are reserved for finer granularity. See the ServiceNow guide. |
| `servicenow-mcp` | **Professional** | The ServiceNow **MCP transport** — a deliberate carve-out reachable at Professional **without** the Enterprise `mcp_servers` capability (a *generic* non-ServiceNow MCP server still requires Enterprise). Enforced by `servicenow_mcp_allowed()`. |

ServiceNow **tools** carry a `min_feature` tag (hidden unless the Org both
holds the feature **and** has an active connection —
"visible-only-when-configured"); ServiceNow **playbooks** carry a parallel
`required_feature` gate (server-enforced, fail-closed). As with tier
capabilities, downgrade **hides, never deletes**. Full reference:
the licensing reference, §7.1.

### What an admin / user actually sees when a feature is gated

The frontend greys the relevant tab / section / playbook tile and shows an
upsell hint. **A greyed tab or playbook is a licence gate, not a bug.** If a
gated call is reached anyway (direct REST, a stale UI), the server returns a
**403** with a plain message, e.g.:

- `MCP server integrations require an Enterprise license.`
- `Custom HTTP tools require an Enterprise license.`
- `The customer IAM gateway hook requires an Enterprise license.`
- `Machine-learning workflows require a Professional or higher license.`
- `Audit logging requires a Professional+ license.` *(the cap itself moved
  to Enterprise in 1.4.1 — `_apply_audit_fields` refuses to set an audit
  index without the `audit_logging` capability)*

Security / ES / ITSI / hunt **playbooks** below Enterprise, and ML
**playbooks** below Professional, simply do not render in the Ask-tab
picker (the same `dependent_apps` / capability filter that hides
app-missing playbooks).

### Downgrade behaviour — nothing is deleted

A downgrade (Enterprise → Professional, Pro → Personal, or an expiry that
flips the *effective* tier) **hides or refuses** the now-out-of-tier
features — it never deletes data. Saved MCP servers, custom tools, audit
config, history, and KVStore rows all survive; they reappear intact the
moment the licence is restored or upgraded. The only visible change is that
the gated tabs grey out and gated calls 403. See
the licensing reference for the full tier / capability reference and
the rights and roles reference for how this layers on top of
the admin / non-admin role model.

## Tab: Playbooks

A playbook is a pre-tuned LLM prompt the app prepends to the user's
question. The app ships **90 playbooks** out of the box — **65 operational** and 25 draft
(see step 2 of [the installation guide](./installation.md)).

### Editing a playbook

- Click a tile → click **Edit**.
- Edit `name`, `short_description`, `prompt_text`, `question_text`,
  `status` (draft / operational), `org_short` / `bu_short`
  (visibility scope), `dependent_apps`, `required_roles`,
  `is_default`, `is_general`.
- Save. The system fields (`creator`, `updated_by`, `version`) update
  automatically; the version bump prevents the auto-seed loop from
  reverting your edit.
- Playbooks with `version === 1` and `creator/updated_by ===
  "system"` (i.e. unedited shipped playbooks) auto-refresh from the
  bundled `SEED_TEMPLATES` array on every page load. Once you edit
  one, it sticks.

### Visibility scoping (the four fields under "Visibility — who can see this playbook")

| Field | Effect |
|-------|--------|
| `org_short` | Playbook visible only inside this Org. Use `DFLT` for the universal shared scope. |
| `bu_short` | Playbook visible only inside this BU. Combine with `org_short`. |
| `dependent_apps` | List of `{name, min_version?}`. Playbook hidden if any required app isn't installed + visible to the calling user. |
| `required_roles` | At least one of the listed Splunk roles must match the calling user. |

Filtering is applied client-side in `filterByUserAccess()` and again
server-side inside `splunk_get_use_case_template_prompt` (so non-
admins cannot fetch a playbook's `prompt_text` even if they discover
its name).

### The two reserved system playbooks

- **`General`** — `is_general = true`. Silently prepended to every
  question. Defines the safety boundary (no sexual / religious /
  political / racial / illegal / medical / financial-advice content;
  no key/prompt extraction; Splunk + AI-Toolkit topics only).
- **`Default`** — `is_default = true`. Used as the router when the
  user doesn't pick a playbook. Calls
  `splunk_list_use_case_templates` then
  `splunk_get_use_case_template_prompt` to pick the right one.

A BU-scoped Default overrides the Org-scoped Default (the latter
overrides the global DFLT Default).

### Clone across Org/BU

Open a playbook, click **Clone to another Org/BU**, pick target
shorts. Creates a draft copy in the target scope. Edit + promote when
ready. The original stays untouched.

### Promoting draft → operational

In v0.3.0 **every shipped playbook is already operational** out of
the box. Drafts you create get promoted by editing them and switching
the status field to `operational`. (Earlier versions had a 4-eyes
rule; that's been removed.)

### `includes_skills` (0.9.6+)

Every playbook now carries an ordered list of skill names in
`includes_skills`. At LLM prompt-fetch time the runtime concatenates
each skill's body in front of the playbook's own prompt body — that's
how a rule like "no emojis in dashboards" or "MLTK models must follow
the `aiworkbench` naming pattern" is enforced across the playbooks that
need it without copy-pasting prose. Skill names autocomplete from the
seeded skills + any custom skills you've created. The `general-output-style`
skill is silently injected by the runtime for every operational
playbook that is not General or Default — do **not** list it
explicitly, that would inject it twice.

See [Tab: Skills](#tab-skills-096) below for skill CRUD details and
the tools and playbooks overview, §3.5
for the full 24-skill default catalogue plus the architecture diagram.

## Tab: Skills (0.9.6+)

Skills are reusable "do-it-correctly" prose blocks that playbooks
inject into the LLM prompt at fetch time. They factor cross-cutting
rules out of individual playbooks so each rule lives in exactly one
place.

**What admins do here:**

- **List** every skill — title, tags, dependent_apps, status,
  "used by N playbooks" column (count of playbooks whose
  `includes_skills` references this skill). Hover over the column
  to see the playbook names.
- **View** any skill's body in a read-only modal.
- **Edit** the title, body, tags, categories, applies_when,
  `dependent_apps`, `dependent_tools`, status, tenant scope. The
  skill **name is immutable** once a skill exists — playbooks
  reference it by name and renaming would break the reference.
- **Create** a new skill — body cap 4000 characters; rejected
  server-side past that.
- **Soft-delete** (set `status=deleted`) — playbooks that still
  reference the deleted skill surface a one-line "skill X dropped:
  status=deleted" note in their assembled prompt. The LLM sees the
  note and can adjust narrative rather than pretending the dropped
  rule ran.
- **Hard-delete** — only allowed on already soft-deleted rows;
  drops the KVStore row entirely.

**Lifecycle**: identical to playbooks. The 24 default skills are
seeded on first load with `creator=system`, `updated_by=system`,
`version=1`. Once you edit one, `version > 1` and the auto-refresh
on the next app upgrade leaves your edit alone. To revert to the
shipped default, soft-delete + hard-delete the row and let the
seeder recreate it.

**Tenant scope**: same as playbooks. `DFLT / DFLT` skills are
visible to every caller. Narrower scopes are visible to matching
callers + admins. See
the rights and roles reference, §7.4b.

**Skill dependencies**:

- `dependent_apps` — skill is silently dropped when an app is missing.
  E.g. `feed-health-verdict` carries `dependent_apps=[{name: "trackme"}]`
  and disappears from prompts in environments where TrackMe is not
  installed. The dropped-note tells the LLM why.
- `dependent_tools` — skill is silently dropped when a named tool is
  disabled for the resolved tenant. Used for skills that materially
  depend on a specific tool being callable.

> **Anti-pattern**: do not write rules into skill bodies that should
> live in playbook prompts. Skills are for *cross-cutting* rules —
> things three or more playbooks would otherwise repeat. A rule only
> one playbook uses belongs in that playbook's `prompt_text`, not in
> a skill.

## Authoring & promotion model (0.9.7+)

End users can now author their own private playbooks via a
conversational Ask-tab flow (no YAML / JSON editing). The
companion sharing-and-promotion model adds a four-step ladder
on every playbook + skill — `private | bu | org | global` —
with admin-gated promotion.

### The sharing ladder

```
  global  ← visible to all users in all Orgs (Splunk admin to promote)
    ↑
   org    ← visible to all users in one Org   (Org admin to promote)
    ↑
   bu     ← visible to all users in one BU    (BU admin to promote)
    ↑
 private  ← visible only to owner_user
```

Promote = move up. Demote = move down. Each step requires authority
on the **target** scope. End users author into `private` only; the
server forces `sharing=private` + `owner_user=<caller>` on every
write through `splunk_create_user_template`. Admins promote
privately-authored playbooks up the ladder via the Playbooks tab.

### End-user authoring flow (Ask tab)

Two new system playbooks ship out-of-the-box, both with
`sharing=global`, `creator=system`:

- **Create user playbook** — the end user describes a use case in
  plain English; the LLM composes a playbook and calls
  `splunk_create_user_template`.
- **Update user playbook** — the end user names one of their own
  private playbooks and a paragraph of what should change; the LLM
  composes a patch and calls `splunk_update_user_template`.

Both go through a Python REST handler that enforces:

1. **Policy** (`end_users_may_author_templates` — defaults to
   `true`; the `itmip_authoring_policies` collection that lets you
   disable it per Org / BU is **deferred to a follow-up**, so this
   knob is effectively always-on in 0.9.7).
2. **Quota** — 25 private playbooks per user. Hard-coded default;
   per-Org override will land with the policy collection.
3. **Name uniqueness** — within `(owner_user)`, the handler appends
   `_v2` / `_v3` on collision rather than failing.
4. **Field shapes** — `name` matches `[a-z][a-z0-9_]*`,
   `short_description` ≤ 200 chars, `prompt_text` ≤ 8000 chars,
   `question_text` ≤ 2000 chars, user-facing fields ASCII-only (no
   emojis).
5. **Skill-reference visibility** — every skill in
   `includes_skills` must exist AND be visible to the caller AND
   `status=operational`. Unknown / invisible skills fail the call
   with a structured `errors[]` envelope the LLM can read + retry.
6. **Forbidden-content scan** — the prose-bearing fields cannot
   contain literals like `sharing=global`, `owner_user=...`,
   `is_default=true`, `is_general=true`, `creator: system`, or
   admin-role-elevation patterns. Hard reject (the LLM rephrases
   and retries within its 3-attempt loop).
7. **Server-forced fields** — `sharing=private`, `owner_user`,
   `owner_org_short`, `owner_bu_short`, `creator`, `updated_by`,
   `updated_at`, `version=1`, `is_default=false`,
   `is_general=false`, `status=operational`, `required_roles=[]`,
   `dependent_apps=[]` are all overridden regardless of LLM
   input. Override attempts surface in the response as
   `attempted_override_fields[]` AND in the audit row.

### Audit log — `itmip_authoring_changes`

Every create / update — success **or** failure — emits one row to
this admin-only KVStore collection. Query from SPL:

```spl
| inputlookup itmip_authoring_changes
| sort - timestamp
| table _time, action, by_user, object_name, attempted_override_fields, errors
```

Fields:

| Field | Meaning |
|---|---|
| `action` | `create` / `update` (promote / demote / delete land with the admin-endpoints follow-up) |
| `object_name` | the playbook's name |
| `object_key` | the KVStore `_key` (empty on validation-rejected rows that never persisted) |
| `owner_user` | always the caller for create + update on private rows |
| `by_user` | the actor (same as owner_user for end-user flows) |
| `tenant_org` / `tenant_bu` | resolved at action time |
| `authoring_mode` | `llm_mediated` for the new flow; `direct` is reserved for admin direct-edit when those endpoints land |
| `attempted_override_fields` | JSON-encoded list of server-forced field names the LLM tried to set, plus `forbidden_content_in_<field>:...` markers for prose-level injection attempts |
| `errors` | JSON-encoded list of validation-failure messages, when applicable |

A user whose audit rows are frequently flagged with
`attempted_override_fields` is either pasting prompt-injection
content into the question_text inputs OR being targeted by the
content they're querying. Either way it's worth a follow-up
conversation.

### What's deferred to a follow-up release

The MVP slice ships the **end-user authoring** path end-to-end.
The matching admin surface — promote / demote menus, scope filter
on the Playbooks tab, an Authoring policies settings page — is
deferred. Today, admins who want to promote a user-authored private
playbook to a wider scope can edit the row directly via the
Playbooks tab's existing Edit modal:

1. Open the user-authored playbook in the Edit modal.
2. Change `org_short` / `bu_short` to the desired scope (the
   `sharing` field will follow at read time via the dual-read
   mapper — see the tools and playbooks overview, §2).
3. Save. The row's `sharing` field is now derived to match the new
   tenant scope.

This is a clumsy workaround for one release. Proper admin promote /
demote endpoints, with a full authority matrix, land in 0.9.8.

## Tab: Tokens & Costs

Available only when the licence ≥ Professional **and** the bootstrap
Anthropic key is stored centrally (so per-question telemetry is
written to the index).

### What's shown

- One card per selected group-by axis. The chip selector at the top
  lets you pick one or more of: App, User, Model, Provider, Org, BU,
  LLM configuration name.
- Each card has:
  - A stacked-area chart of cost over time (timechart spans auto-
    sized to the time range).
  - A table of token in / out / cache-read / cost-USD totals grouped
    by the axis.

### Where the data comes from

- Macro `ai_assistant_metrics_index` resolves by default to
  `index=main (sourcetype=ai_assistant_usage OR
  sourcetype=claude_assistant_usage)`. Customers in production
  typically override the macro in `local/macros.conf` to point at a
  dedicated index — see step 3 of
  [the installation guide](./installation.md).
- Events are written by the `/services/itmip_llm/usage_log`
  persistent handler (called by the React app at the end of every
  Ask turn). Rate-limited to **120 writes/min/user** to prevent
  charts being skewed by spam.
- Cost is computed at write time using the per-model pricing in
  `src/services/llm/providers.ts`. Updating the pricing in the
  bundle won't retro-update historical events; you'll see a step in
  the cost chart at the deploy point.

### Known gaps

- **Personal-scope LLM configs produce no telemetry** by design
  (privacy / no-key-attribution trade-off). The panel header notes
  this. To get full attribution, route everyone through
  central-scope LLMs.
- The legacy v0.1 sourcetype `claude_assistant_usage` is still
  included in the macro so old events remain queryable; it'll be
  retired in v0.4.

## Tab: Orgs & BUs

Multi-tenant Org / BU CRUD with **licence-aware caps**. The banner
at the top of the page shows your current limits:

| Tier | Orgs | BUs / Org |
|------|-----:|----------:|
| Personal | 1 | 1 |
| Professional | 1 | 3 |
| Enterprise | 1 | ∞ |
| MSP | ∞ | ∞ |

### Creating an Org

**+ Add Org** → pick a 1-4 char short (e.g. `ACME`), a name, a
description, **App patterns** (chip multi-select; supports wildcards
like `acme_*`), and **Role patterns** (chip multi-select; supports
wildcards like `acme_*_user`).

The dropdowns are seeded from your live Splunk inventory
(`/services/apps/local`, `/services/authorization/roles`,
`/services/authentication/users`).

A user's active **Org** is resolved per page load: the first Org
whose `app_patterns` matches the URL's current Splunk app AND whose
`role_patterns` intersects the user's roles wins.

### Creating a BU

Inside an Org, click **+ BU** → pick a 1-4 char short, a name,
optional **Extra roles** (added to the Org's role match), optional
**Extra users** (explicit user-name allow-list).

### Cap enforcement

Both UI and server enforce caps:

- Browser disables **+ Add Org** / **+ BU** when at cap.
- `POST /services/itmip_llm/tenancy` (the wrapper handler all writes
  go through) refuses with **403** when at cap. The browser surfaces
  the message verbatim ("License 'professional' allows up to 3 BU(s)
  per Org; 'ACME' already has 3.").
- An admin who bypasses the UI and POSTs directly to the KVStore
  collection CAN exceed the cap. Splunk's KVStore ACL is `admin /
  power write` so removing the escape hatch entirely isn't possible.
  The wrapper is the boundary for everyone using the app.

### Deletion behaviour

- `delete_org` cascades — every BU in that Org is also deleted, so
  no orphan rows.
- `delete_bu` removes only that one BU.
- Both operations are admin-only and idempotent (404 is treated as
  "already gone").

## Audit logging (v1.3.0)

> Full operator reference: the auditing guide.

Real audit logging records, per Org, **who sent what to which external LLM,
when, after what consent, and how often** — to a secured per-Org index — so
a disclosure of sensitive data to a public LLM is provably a *user action
after an explicit warning*, not an app fault.

> **Licence gate (updated 1.4.1):** audit logging — the per-Org **Audit
> logging** config section *and* the **Audit** tab — is now an
> **Enterprise+** feature (it sat at Professional through 1.4.0; the
> `audit_logging` capability moved to Enterprise in 1.4.1 alongside the
> other governance capabilities). Below Enterprise the config section is
> hidden and the Audit tab does not appear; server-enforced in
> `itmip_llm_tenancy._apply_audit_fields`, which refuses to set an audit
> index without the `audit_logging` capability and returns
> `Audit logging requires a Professional+ license.` on a direct call. See
> [Per-feature licensing (v1.4.1)](#per-feature-licensing-v141) above.

**What you, the admin, must do (because the app never creates indexes):**

1. **Provision an audit index per Org.** On-prem, define an internal index
   in your own `indexes.conf` (e.g. `[_itmip_audit_DFLT]`) with **retention
   > 24 months** (`frozenTimePeriodInSecs`). On Splunk Cloud, create a normal
   index via ACS (lowercase, no `kvstore` substring), set retention there.
   See the auditing guide, §4 for copy-paste stanzas.
2. **Enter the index name** in **Orgs & BUs → edit Org → Audit index**.
   *Mandatory for every new Org.* **DFLT is NOT auto-configured** — until you
   set it, DFLT does no real audit logging (a banner reminds you).
3. **Pick the content mode** (mandatory, no default): `metadata_only` /
   `prompt_hash` / `truncated_prompt` / `full_prompt`. This decides how much
   of the user's input is stored. **Choose per your DPIA** — `full_prompt` is
   the strongest evidence but the heaviest data-protection exposure
   (verbatim, possibly special-category, >24 months). Attachment *names* are
   always logged regardless. **Saving `full_prompt` requires ticking a DPIA
   acknowledgement** ("we have assessed lawful basis + retention"), which is
   itself recorded in the audit.
4. **(Optional) Define an auditor.** Create a Splunk role and grant it
   `srchIndexesAllowed` on that Org's audit index, then add its name to the
   Org's **Audit role patterns**. That user then sees the **Audit** tab for
   their Org only. Admins see all Orgs. Reads run as the user, so Splunk's
   index ACL is the real boundary.
5. **Choose enforcement.** `enforce` = fail-closed (no audit write ⇒ no LLM
   call) and **requires `splunk_proxy`** (browser_direct is disabled for the
   Org — this makes enforce genuinely bypass-proof). `best_effort` allows
   browser_direct but those turns are lower-assurance.

**Reading the audit:** the **Audit** tab — search by user / time / LLM /
playbook / wildcard over prompt+answer, with timeline, frequency, consent
log, governance log, and CSV export for legal hand-off.

**Honest limits to remember:** an internal `_` index is hidden from ordinary
users but **not** from a full admin; the integrity hash detects accidental
gaps, not a privileged-admin rewrite; only an off-box WORM/SIEM copy hardens
against that (optional, not built in). You are the data controller — set
retention, lawful basis and privacy notice per your DPIA.

## Backend Ask Service — agent_runner enablement (1.7.0)

> Full operator reference: the Backend Ask Service guide.

The **Backend Ask Service** lets you attach an operator-authored *playbook*
to a native Splunk alert, an ES correlation search (notable), or an ITSI
episode policy — or fire it via REST — so the trigger launches an
**unattended AI investigation** with no human in the loop. Each run executes
server-side in a bounded Python agent that gathers evidence, reaches a
validated structured verdict (the Investigation Result Contract), writes
back safely to the source object, and records the run in history + audit +
telemetry.

> **Ships DISABLED.** The engine is built and live-verified but the master
> switch is **`[agent_runner] enabled = 0`** out of the box. Nothing runs
> unattended until you deliberately enable it. The security playbook content
> additionally rides the **`socplaybooks` named feature (Enterprise)** and
> operations content the **`opsrunbooks` feature (Professional)** — see
> [Named licensable features](#named-licensable-features-v150--the-second-gating-dimension)
> above.

### Enabling the engine

The dispatcher modular input ticks on a poll interval but stays **inert**
until you turn it on. Enable it deliberately:

1. **Provision the telemetry index** (`itmip_ai_telemetry`) — the app ships
   no `indexes.conf`, so create it yourself (dev: `local/indexes.conf`;
   production: per your indexing policy). It holds the content-free
   pipeline-telemetry log.
2. **Set `email_admins`** (the (sc)admin escalation list for both-LLM-fail
   and backpressure events) and, if you use failover, **`llm_fallback_config_id`**.
3. **Set `[agent_runner] enabled = 1`** in `local/itmip_ai_workbench.conf`
   and **restart** splunkd.
4. The dispatcher then ticks every `poll_interval_seconds`, claims pending
   queue rows, and spawns at most `max_parallel` runner subprocesses
   cluster-wide.

To disable again, set `enabled = 0` (or remove the `local/` override) and
restart.

### Key `[agent_runner]` configuration knobs

All knobs live in `default/itmip_ai_workbench.conf [agent_runner]`; override
in `local/`. The selection below is the most operationally significant —
**see `README/itmip_ai_workbench.conf.spec` for the full schema** (~20 keys
including the runaway watchdog, LLM-failover, dedup, storm-detection and
per-Org history knobs).

| Knob | Default | What it controls |
|---|---|---|
| `enabled` | **0** | Master switch. Flip to 1 to run unattended (requires restart). |
| `max_parallel` | 2 | Max concurrent runners cluster-wide — the core platform-protection knob. A storm cannot spawn unbounded LLM processes. |
| `max_queue_depth` | 500 | Pending-row cap; beyond it the producer applies backpressure (logs + emails admins, never silent drop). |
| `poll_interval_seconds` | 5 | Dispatcher tick cadence. |
| `run_timeout_seconds` | 300 | Per-run wall-clock cap → `timed_out`, then retried/dead-lettered. Keep it above `llm_request_timeout_seconds`. |
| `max_turns` | 16 | Per-run tool-use turn ceiling. |
| `token_budget` | 200000 | Per-run token ceiling. |
| `runner_max_attempts` | 2 | Attempts before a failing run is **dead-lettered**. The knob that makes failure terminate — without it a crashing run would be retried forever. |
| `runner_max_memory_mb` | 2048 | Runner memory cap (RLIMIT_AS). Keeps the OOM killer away from splunkd: a runaway run fails instead of the platform. 0 disables. |
| `runner_max_cpu_seconds` | 120 | Runner **CPU**-time cap (RLIMIT_CPU) — not wall-clock; a run waiting on an LLM burns almost none. 0 disables. |
| `runner_nice` | 5 | Runner niceness, so unattended runs yield to interactive searches. |
| `llm_fallback_config_id` | (blank) | Ordered fallback LLM config(s) for primary→fallback failover. |
| `result_index` | main | Index for the safe structured-report write-back. |
| `email_admins` | (blank) | (sc)admin escalation list (both-LLM-fail, backpressure). |
| `telemetry_index` | itmip_ai_telemetry | Content-free pipeline-telemetry log. |

Runaway hard ceilings (`runner_max_llm_calls` / `runner_max_tool_calls`,
`runner_max_llm_calls_per_minute`, `runner_repeat_loop_limit`,
`runner_heartbeat_seconds` / `runner_stale_seconds`), SHC leadership
(`dispatcher_lease_ttl_seconds`), resilience (`dedup_mode`, `storm_detection` /
`storm_threshold`), and tenancy (`per_org_history`, `queue_mode`) are all
documented in the spec file and in
the Backend Ask Service guide, §8.

> **Why these knobs and not `limits.conf`:** Splunk's `limits.conf` governs *searches*.
> An Adjutant AI run is a separate `splunk cmd python3` subprocess that no `limits.conf`
> stanza constrains, so the app governs it directly — `max_parallel` caps how many exist,
> and the runner caps its own memory/CPU/priority at startup. See
> the Backend Ask Service guide, §5.1.

### Monitoring — two dashboards

Two app-nav dashboards are the daily drivers (they run in the app context
where the agent history lookup resolves):

- **Adjutant AI — Automation Outcomes** (`adjutant_ai_outcomes`) — *are the
  verdicts good?* Verdict distribution, runs-by-playbook, terminal-state mix,
  write-back outcomes, latency p50/p95, token cost, and the deferred/failed
  "needs attention" table. The analyst-agreement headline (with coverage
  beside it) activates with feedback capture.
- **Adjutant AI — Pipeline Knobs** (`adjutant_ai_knobs`) — *is the plumbing
  healthy and which knob to tune?* Every limit knob paired with its measured
  actual (latency↔timeout, depth↔`max_queue_depth`, runners↔`max_parallel`,
  tokens↔budget, deferrals / dead-letters / runaways, dedup suppressions,
  storm activity, tuning history). Enable `proactive_diagnosis_enabled` to be
  emailed a concrete recommendation when a knob nears its limit.

Pipeline telemetry is also queryable directly:
`index=itmip_ai_telemetry sourcetype=itmip:agent:telemetry`. See
the Backend Ask Service guide, §9–10 for the symptom →
knob-to-tune table.

### Triggering playbooks — event, scheduled, REST, and MCP (1.7.x)

A playbook (an operational use-case playbook) can be run unattended four ways — all go
through the **same** bounded, default-deny queue, so none gets more privilege than
an alert-triggered run. The engine must be **enabled** (`[agent_runner] enabled = 1`).

- **Event-triggered (entity-scoped).** Attach the **Adjutant AI: Run Investigation
  Playbook** alert action to any saved search / ES correlation search (Adaptive
  Response) / ITSI episode action. The triggering search's first result row (e.g.
  `host`, `user`) is captured as the run's *source_context*, so an **MLTK-outlier
  alert investigates that host**. Set the playbook name + (optionally) the bound
  fields + `allowed_actions` in the action's parameter form.
- **Scheduled (the morning health check).** A `cron_schedule` saved search whose
  result fires the alert action. Two **disabled** OOTB examples ship in
  `default/savedsearches.conf` (*Daily 08:00 health-check playbook*, *MLTK outlier →
  Investigation*): set `.param.playbook` to a real playbook, adjust the search, then
  `disabled = 0` + `enableSched = 1`.
- **REST.** `POST /services/itmip_llm/agent/run` (admin) — for an external scheduler.
- **MCP (interoperability hub, 1.7.x).** Other AI agents can drive your playbooks over MCP
  through four async fire-and-poll tools — `adjutantai_list_playbooks(org_bu)`,
  `adjutantai_start_playbook(org_bu, playbook_name)`, `adjutantai_get_playbook_status(org_bu, run_id)`
  and `adjutantai_get_playbook_results(org_bu, run_id)`. **OFF by default (1.7.1)** — set
  `[mcp_server] enabled = 1` in `itmip_ai_workbench.conf` and restart to turn it on. Two
  ways to reach the tools once enabled:
  - **Standalone Adjutant MCP server** — `POST /services/itmip_llm/mcp_server` (JSON-RPC
    2.0). Works on any Splunk. Authenticate with a standard Splunk **bearer/session token**.
  - **Inside Splunk's own MCP Server** (`/services/mcp`) — with `register_in_splunk_mcp = 1`
    the app auto-registers the four tools into `Splunk_MCP_Server` so they appear next to
    `splunk_get_info`. **Requires Splunk_MCP_Server 1.2+** (argument substitution); on 1.1.x
    the app holds back (logs to `sourcetype=itmip_llm_mcp_register`) and you use the
    standalone endpoint instead.
  **To expose a playbook, tag it `MCPready`** (Playbooks tab → edit → Tags) — only
  `MCPready` + Org/BU-visible playbooks are listable/runnable. Every call names the
  **Org/BU** (e.g. `TDDD/SFIT`) as a safeguard (non-admin → own tenant only). Running is
  **admin-only (v1)** and requires the Backend Ask Service enabled. Full setup + auth:
  **the MCP server guide**.

## Data Foundation (1.5.0)

The 1.5.0 **Data Foundation** surface gives data-onboarding teams three
admin-relevant capabilities, gated by the **`data_onboarding`** capability
(**Professional+**, now Live — see the licensing matrix above):

- **Config-package builder** — assembles the inputs / props / transforms /
  index definitions for a new data source as a deployable config package.
- **Ingest-health check** — verifies a source is actually landing as expected
  (volume, lag, parsing).
- **Data Quality Score** — a scored read of how well a source conforms
  (CIM / field extraction / timestamping), so onboarding gaps are visible.

These appear as playbooks / tools in the Ask flow when the `data_onboarding`
capability is unlocked; below Professional they do not render.

## Tab: Tools

The Tools tab is the catalogue of everything the LLM can call — built-
in Splunk tools (search, dashboards, ES / ITSI / TrackMe, MLTK), admin-
authored HTTP custom tools (since 0.4.0), and MCP server integrations
(since 0.7.0). It also lets you enable/disable tools per Org/BU,
override per-tool metadata (tags / category / short description), and
configure tenant-scoped credentials.

This is enough surface to warrant its own document — see
**the tool catalogue** for the full reference. Quick highlights:

- **Built-in tools** are scoped per Org/BU via `Manage` rules
  (`Org+BU` > `Org+*` > `*+BU` > `*+*` > implicit-enabled).
- **Per-tool metadata overrides** (0.7.0+) live in
  `itmip_tool_overrides`; the runtime merges overrides on top of
  the hard-coded defaults at app-load time.
- **Custom HTTP tools** (0.4.0+) — pure JSON definitions, secrets in
  `storage/passwords` realm `itmip_llm_assistent_app`, allowed-hosts
  allowlist enforced AFTER template substitution, three-tier
  credential model (`global` / `per_tenant` / `per_user`) since
  0.7.0, optional proxy + TLS-CA fields.
- **MCP servers** (0.7.0+) — register an upstream MCP server, test
  the connection, import a subset of tools, refresh to detect drift.
  Streamable HTTP transport with SSE fallback. `stdio` rejected.
  **OAuth 2.1 (1.5.0+)** — for OAuth-protected MCP servers (e.g.
  ServiceNow Action Fabric / MCP Server Console) choose
  **Authentication type = OAuth 2.1**, register the shown redirect URI
  in your IdP, save, then click **Connect** on the server card. The
  Splunk backend is the OAuth client/token holder (auth-code + PKCE
  interactive; client-credentials / stored service-token unattended);
  tokens are encrypted in `storage/passwords` and never reach the
  browser. Rides the same Enterprise `mcp_servers` gate. Full guide:
  the MCP OAuth guide.
- **ServiceNow connections** (1.7.0) — the dedicated ServiceNow integration
  (a built-in `servicenow` tool category: incidents, changes, problems,
  CMDB/CSDM with bounded relationship traversal, SIR security incidents,
  events). Add a per-Org connection under **Tools → ServiceNow connections**:
  pick the **transport** (direct REST or a ServiceNow MCP server), the
  instance URL / MCP server, the credential (`storage/passwords`, with the
  customer-auth hook for WebEAM-gated instances), the CSDM version, the CMDB
  **write allowlist** (default deny-all), the closed-incident policy, and —
  for a SecOps Org — `sir_enabled` + (explicitly) the security playbooks.
  **Test connection** validates auth + detects the release. All connectivity
  is server-side; credentials never reach the browser; ServiceNow can never
  block the assistant. Gated **Professional + `servicenow`** (MCP rides the
  `servicenow-mcp` carve-out). Full guide: **the ServiceNow guide**.
  *(Needs a splunkd restart to register the route + collection.)*
- **SSE security-content tools** (1.2.0) — a `security-content` tool
  category (`sse_check_prerequisites`, `sse_list_content`,
  `sse_get_detection`, plus two enrichment stubs) reaches Splunk
  Security Essentials' detection catalogue — including real detection
  SPL — via SSE's public `sseanalytics` / `sseidenrichment` / `sselookup`
  commands. They only return content when SSE (and, for some content,
  the ESCU app `DA-ESS-ContentUpdate`) is installed and visible to the
  calling user, and are scoped per Org/BU like any other built-in. The
  former `sse-bridge` knowledge connector was retired in their favour.
- **Simple XML dashboard builder tools** (1.4.0) — a `dashboards-simplexml`
  tool category of seven route-unlocked tools (`splunk_xml_create`,
  `splunk_xml_add_input`, `splunk_xml_add_panel`, `splunk_xml_update_panel`,
  `splunk_xml_remove_panel`, `splunk_xml_preview`, `splunk_xml_publish`,
  backed by `src/services/xmlBuilder.ts`). This is now the default path for
  multi-panel dashboards: the LLM composes the dashboard via small typed
  calls rather than emitting one large XML blob, so big dashboards no longer
  truncate or mis-escape, and each panel can set its own `full_width` / `row`
  layout.
- **Customer-auth hook for IAM-gated targets** — `target_kind` is
  `"llm"` / `"tool"` / `"mcp"`. See
  the customer authorisation hook guide.
- **Unified audit trail** in `itmip_llm_custom_tool_calls` covers
  custom HTTP tools AND MCP calls (`tool_kind` distinguishes them).

## Tab: License

Three cards.

### Current license

Shows the environment GUID, the active key (if any), tier,
effective_tier (downgraded if expired or node-lock mismatched),
badge, expiry date + days remaining, node-lock status, customer
name/email, and (when present) an **Activations** row listing every
machine the same key has been activated against.

Two buttons:

- **Re-validate** — re-calls Cryptolens (from the browser; falls
  back to a server-side call if the browser can't reach the vendor).
  Useful after the vendor extends an expiry.
- **Remove** — drops the stored response. The tier downgrades to
  Personal immediately. Asks for confirmation.

### Activate a new license

Paste the 25-character Cryptolens key, click **Activate**.

- The browser hits `api.cryptolens.io` directly so this works on
  air-gapped Search Heads.
- The browser POSTs the signed response back to splunkd which
  encrypts it in `storage/passwords`.
- The badge in the header updates immediately.
- For MSPs: repeat with the same key on each customer environment.
  Cryptolens tracks the activations centrally up to
  `maxNoOfMachines`.

### Expiry warning recipients

Add the email addresses that should be notified when the licence is
within 30 days of expiring. **Saving the list** creates (or updates)
a Splunk Enterprise saved alert named
`itmip_llm_license_expiry_warning`. Removing every recipient deletes
the alert.

How the alert fires:

1. `bin/itmip_llm_license_monitor.py` is a scripted input that runs
   every 6 hours (`default/inputs.conf`). Silent unless
   `expires_in_days ≤ 30`. When it fires, it emits one JSON event
   into the index pointed at by the `ai_assistant_license_index`
   macro.
2. The saved alert runs daily at 09:00 (cron `0 9 * * *`) and emails
   the recipient list if at least one expiry event landed in the
   last 7 days.

If you want to verify the pipeline before the threshold is crossed,
the saved-alert UI has a **Run now** button that dispatches an
immediate email if an event is in the index.

## Tab: Settings (admin-only extras)

Everything the user manual describes plus:

### Central-scope LLM configurations

You can create LLMs with `scope = central`. These appear in the LLM
picker for every user whose Org / BU / role intersects the config's
visibility, not just for the creator. Most enterprise installs run
this way so customers don't have to mint per-user API keys.

### TLS CA certificate (PEM)

For customers whose LLM endpoint presents a private corporate CA,
paste the PEM here. The Splunk proxy builds an `ssl.SSLContext` with
your `cadata=ca_pem` and passes it to `HTTPSHandler`. Browser-direct
mode ignores this — browsers use the OS trust store.

### Extra HTTP headers

Static key/value pairs added to every request. Use for header tokens
that don't expire (a static `X-Tenant-Id`, a customer-managed
gateway shared secret, etc.).

### Security confirmation prompt

Each LLM configuration carries a **"Show security confirmation before
sending"** checkbox. When on (the default for every new config),
users see a full-screen modal warning them that data is about to
leave the organisation:

- on the **first Ask** with that LLM in a browser session, AND
- every time the user **switches to** that LLM (so an admin's
  internal-LLM-then-external-LLM pivot can't slip past unnoticed).

Acknowledgement is per-LLM, per-session — a full page reload
re-prompts; the Ask tab's Clear button does **not** reset it.

The default warning is a Splunk-Enterprise-specific message that
lists every data class that may leave (question text, SPL, search
results, dashboard XML, alert config, Splunk metadata). The default
is in `src/services/llm/providers.ts` →
`DEFAULT_CONFIRM_EXTERNAL_MESSAGE` if you want to read or fork it.

You can override the message per LLM in the **Custom warning message
(optional)** field shown when the checkbox is on. Three placeholders
are substituted at render time:

- `{provider}` — provider kind label (e.g. "Anthropic", "OpenAI")
- `{endpoint_host}` — host portion of the LLM endpoint URL
- `{call_mode}` — `browser_direct` or `splunk_proxy`

Turn the checkbox off for trusted-network LLMs (on-prem Ollama,
private gateway, etc.) where the warning would just be noise. Leave
it on for everything cloud-hosted.

The bootstrap Anthropic config ships with the checkbox on.

### Customer authorisation hook (server-side dynamic headers)

Toggle on per LLM config — and only when `call_mode = splunk_proxy`,
since browsers can't run server-side Python. When the hook is enabled,
every outbound request runs through
`bin/customer_authorisation.py` (or your override at
`local/bin/customer_authorisation.py`) and merges the returned
headers in. Use this for endpoints behind WebEAM.Next, Ping, Okta,
AzureAD, internal SAML — anywhere static headers aren't enough
because tokens expire and have to be re-minted.

See the customer authorisation hook guide
for the full function contract, the WebEAM-style worked example,
storing credentials in `storage/passwords`, caching pattern, and
security model.

## Tab: Settings (the LLM picker — admin power user notes)

When you add a new LLM config:

| Field | Notes |
|-------|-------|
| Name | Auto-suggested as `<Org>_<BU>_<provider>_<scope>`. Override only if you have a strong reason. |
| Provider | Determines which adapter wraps the call. Picking the wrong one is the #1 cause of "401 / wrong-format response" errors. |
| Model | Dropdown auto-populates from `available_models` for the provider. Pricing + speed hint visible inline. Falls back to a custom-text input if your model isn't in the canonical list yet. |
| Endpoint | Auto-fills from `PROVIDER_DEFAULTS`. Edit for Azure (per-deployment) or for internal gateways. |
| Call mode | `browser_direct` (no CORS for OpenAI / Azure / Groq / Gemini / Bedrock) or `splunk_proxy` (works for all, hides keys on the SH). Bedrock must be `splunk_proxy`. |
| Scope | `central` (visible to everyone matching the Org/BU visibility filters) or `personal` (only the creator). |
| Server-side proxy | When call mode = `splunk_proxy`, optional `http://host:port` for an outbound HTTP proxy on the SH. |
| Extra role patterns | Comma-separated list. Roles outside the Org's role_patterns that should also see this LLM. |
| Extra user names | Comma-separated. Specific Splunk users to allow. |
| Default model | Per-config default the Ask tab uses unless the user picks another. |

After save, the modal asks for the **secret value** (API key, access
token, Bedrock access key id). It's stored in `storage/passwords`
under the realm `itmip_llm_assistent_app` and the name
`<llm_config_id>` — encrypted at rest by Splunk.

See the supported-LLM matrix for the per-provider
field mapping (endpoint shape, auth header name, CORS reality,
streaming support, recommended models).

## CDTSM (Cisco Deep Time Series Model) — admin setup (1.1.1)

CDTSM is Splunk AI Toolkit's pre-trained, generative time-series model
(feature preview, MLTK 5.7.3+). The assistant ships three playbooks that
drive it — **Smart Forecasting**, **Anomaly Detection**, **Predictive
Alerting**. It is an **integration, not a reimplementation**: the model
and the `apply CDTSM` command live in AI Toolkit; this app only
orchestrates them (3 seed playbooks + 1 skill + 1 read-only tool, all
frontend — **no new REST handler, KVStore collection, or egress**).
Architecture: the CDTSM forecasting guide §8.

**Unlike the other AI-Toolkit playbooks, CDTSM creates no models** — there
is nothing to share and nothing to clean up in the section below. Saved
searches follow `cdtsm_<purpose>_<thing>_aiworkbench_v<N>`.

### What you must provide

| Requirement | Splunk Cloud | On-premise (Enterprise) |
|---|---|---|
| AI Toolkit | `Splunk_ML_Toolkit >= 5.7.3` installed | same |
| Model host | Splunk-hosted GPUs (no setup) | a customer-run open-source **CTS server** |
| Caller capability | `list_tokens_scs` | n/a |
| Rate limit | ~50 req/min (beta, AI-Toolkit-managed) | your CTS server's capacity |

If MLTK is absent or < 5.7.3 the three playbooks simply do not appear in
the picker (they declare `dependent_apps = [{Splunk_ML_Toolkit, 5.7.3}]`).
**Predictive Alerting** additionally requires the caller to hold `power`
or `admin` (it creates a scheduled alert).

### On-premise setup (one time)

On-prem `apply CDTSM` silently falls back to the Cloud provider — and
fails — until MLTK is pointed at a local model server. Two halves, both
required:

1. **Run the open-source CTS server**
   (https://github.com/splunk/cisco-time-series-model) — a FastAPI service
   exposing `GET /health` and `POST /cdtsm/v1/ai/infer`.
2. **Point MLTK at it** in
   `$SPLUNK_HOME/etc/apps/Splunk_ML_Toolkit/local/mlspl.conf`:
   ```ini
   [CTSM]
   self_hosted_cdtsm_endpoint = http://<host>:8080/cdtsm/v1/ai/infer
   ```
3. **Store the server's bearer token** (it returns HTTP 401 otherwise) in
   `storage/passwords`, realm `aitk_fm_tokens`, name `CDTSM_AUTH_TOKEN`:
   ```bash
   curl -k -u admin https://localhost:8089/servicesNS/nobody/Splunk_ML_Toolkit/storage/passwords \
     -d realm=aitk_fm_tokens -d name=CDTSM_AUTH_TOKEN --data-urlencode password=<TOKEN>
   ```
   `--data-urlencode` matters — plain `-d` turns `+` into a space and
   corrupts the token. **No splunkd restart needed**; MLTK reads it at
   search time. Full runbook: the CDTSM forecasting guide §3–4.

### Verifying it

- Run the read-only **`splunk_check_cdtsm_availability`** tool (from the
  Ask tab) — it reports MLTK version, deployment kind, `list_tokens_scs`,
  and the on-prem endpoint config in one structured answer.
- Or prove the model directly in Search:
  `| inputlookup internet_traffic.csv | apply CDTSM bits_transferred forecast_k=384 show_input=f`
  → expect `predicted(bits_transferred)` + band columns. A Cloud-fallback
  error on-prem ⇒ the `[CTSM]` endpoint is unset; HTTP 401 ⇒ the token is
  missing/wrong.

### Operational notes

- Each forecast proof dashboard runs an extra short **backtest** search (a
  second `apply CDTSM` call with a holdback) to prove accuracy — factor it
  into the ~50 req/min beta budget; keep CDTSM scheduled searches off
  minute cadence.
- The playbooks pin a TrackMe feed-health header when TrackMe is installed
  and omit it cleanly when it is not.

## Auditing AI-Assistent-created MLTK models

The AI-Toolkit playbooks train models in the calling user's current
app and then call a privileged server-side handler
(`/services/itmip_llm/mltk_share`) to promote each model's lookup-
table-file to `owner=nobody, sharing=global`. This means:

- A normal `user` or `power` role can use the AI-Toolkit playbooks
  end-to-end without holding `admin_all_objects` — the privileged
  handler does the share on their behalf.
- The handler refuses any model name that doesn't match
  `^mltk_[a-z]+_[a-z0-9_]+_aiworkbench_v\d+$` (the literal `_aiworkbench_v<N>`
  suffix), so it cannot be used as a generic "promote-anything-globally"
  backdoor.
- Every successful share writes one row to the **`itmip_llm_mltk_models`**
  KVStore collection (read by `*`, write by `admin/sc_admin`).

### Find every AI-Assistent-created model on this SH

```spl
| inputlookup itmip_llm_mltk_models
| table model_name, host_app, created_by, created_at_epoch, template,
        description, last_shared_at
| eval first_created = strftime(created_at_epoch, "%Y-%m-%d %H:%M:%S")
| eval last_shared    = strftime(last_shared_at,   "%Y-%m-%d %H:%M:%S")
| sort -last_shared_at
```

### Tail the audit log

Promotions surface as structured lines in `$SPLUNK_HOME/var/log/splunk/splunkd.log`:

```
itmip_llm_audit action=mltk_share user=alice model=mltk_outlier_disk_temp_aiworkbench_v1 app=search promoted=1 failed=0
```

Grep / wire a saved alert:

```spl
index=_internal sourcetype=splunkd "itmip_llm_audit action=mltk_share"
| rex "user=(?<user>\S+) model=(?<model>\S+) app=(?<app>\S+) promoted=(?<promoted>\d+) failed=(?<failed>\d+)"
| stats count by user, app
```

### Cleanup: remove old AI-Assistent models

```spl
| inputlookup itmip_llm_mltk_models
| where created_at_epoch < relative_time(now(), "-90d@d")
| table model_name, host_app
```

Then for each row: delete the lookup-table-file via
`| rest /servicesNS/nobody/<host_app>/data/lookup-table-files/__mlspl_<model_name>.csv method=DELETE`
(repeat for `.mlmodel` / `.onnx`), and drop the registry row via
`| outputlookup` or the KVStore REST DELETE.

### Capability prerequisites

End users still need MLTK's own `apply_ml_command` /
`apply_ai_commander_command` capabilities to run `fit` / `apply` /
`ai`. The AI-Assistent share handler **does not** elevate those — it
only elevates ACL writes for files matching the `aiworkbench` pattern.
Grant the MLTK capabilities to the roles that should be able to
train models via the playbooks.

## Operational runbook

### Adding a new tenant

1. Org & BU first (Orgs & BUs tab).
2. Provision the central LLM config(s) for that Org / BU (Settings).
3. Clone or scope playbooks the new tenant should see (Playbooks).
4. (Optional) Disable tools the tenant shouldn't have (Tools).

### Licence renewal

1. License tab → **Re-validate** to confirm the vendor agrees the
   licence is still live.
2. If renewed (expiry pushed out), the badge updates automatically.
3. If the licence was upgraded (Pro → Enterprise → MSP), the
   tier-aware caps lift on the next page load.

### Switching LLM provider for an Org

Add the new LLM config first; mark it default if appropriate. Let
users transition; remove the old config when traffic has migrated.
Tokens & Costs preserves the historical attribution.

### Customer auth hook failure

If users start seeing **"customer_auth hook failed: …"** in their Ask
panel:

1. Tail `$SPLUNK_HOME/var/log/splunk/splunkd.log` for
   `customer_authorisation hook raised`.
2. Reproduce with the CLI tester:
   ```bash
   $SPLUNK_HOME/bin/splunk cmd python \
       $SPLUNK_HOME/etc/apps/itmip_ai_splunk_assistent_app/local/bin/customer_authorisation.py
   ```
3. Fix the corporate-IAM flow and reload the app.

### Macro override on a non-default index

See step 3 of [the installation guide](./installation.md).
Both macros (`ai_assistant_metrics_index`,
`ai_assistant_license_index`) must be overridden in lock-step with
`local/inputs.conf` and (if changed) the saved alert. Out-of-sync
overrides are the #1 cause of "Tokens & Costs shows no data" and
"licence-expiry alert never fires".

## Backup & restore

v0.8.0 ships an enterprise-grade backup subsystem with two
independent recovery tiers, both stored as normal Splunk indexed
events (i.e. inside Splunk's own durability domain — so a KVStore
wipe leaves them untouched).

### Indexes you must create (the app ships none)

The app deliberately ships **no `indexes.conf`** — a static index definition
fails Splunk Cloud vetting, and you should own index sizing/retention. Before
the backup subsystem can write, **create two EVENT indexes** (Settings →
Indexes, or on your index-cluster master):

| Suggested name | Holds | Suggested retention |
|---|---|---|
| `itmip_snapshots` | Daily snapshots, manifests, verification, diagnostic ticks | ~24 months |
| `itmip_changes` | One event per KVStore POST/DELETE on a tracked collection | ~60 days |

The names are **configurable** in `local/itmip_ai_workbench.conf` `[indexes]` —
the whole app (backup, change-log, restore, and the Backups tab) reads the
names from there, so one edit re-points everything:

```ini
[indexes]
snapshot_index = itmip_snapshots   # rename to your own index if desired
changes_index  = itmip_changes
```

If you rename an index here, **create the matching index** and restart/reload
Splunk. An invalid name silently falls back to the suggested default. (The
`itmip_snapshots`/`itmip_changes` names below are the suggested defaults.)

**Until the indexes exist, the app stays fully functional — only backups are
paused.** The Backups tab shows the live configured index names and a red
warning banner listing exactly which index is missing; the backup scripted
input no-ops with a warning in `splunkd.log`
(`snapshot index '<name>' does not exist — backups are PAUSED`), and the
change-log write is skipped best-effort with a matching log line. Nothing else
in the product is affected.

### What's covered automatically

| Tier | What gets written, when |
|---|---|
| **Continuous change log** (`changes_index`, default `itmip_changes`, ~60-day retention) | One event per successful POST/DELETE on every backed-up collection. Lets restore replay forward from a snapshot to any timestamp. |
| **Daily snapshot** (`snapshot_index`, default `itmip_snapshots`, 30/26w/24mo retention) | Full per-row snapshot of every critical-tier + user-personal collection. Manifest with SHA-256 per collection. Verification pass. Referenced-credentials inventory (Phase 9.3). |

Backed-up collections: `itmip_organisations`, `itmip_business_units`,
`itmip_llm_configs`, `itmip_tool_assignments`, `itmip_tool_overrides`,
`itmip_ai_use_cases`, `itmip_llm_custom_tools`, `itmip_mcp_servers`,
`itmip_mcp_tools`, `itmip_llm_license`, `itmip_llm_mltk_models`,
`itmip_user_history`. Explicitly excluded:
`itmip_llm_custom_tool_calls` (audit log — regeneratable, customers
can mirror via SPL if forensic durability is required).

### What is NOT covered by the KVStore backup

`storage/passwords` (LLM API keys, tool credentials, MCP credentials,
proxy credentials, TLS CA blobs, Cryptolens license blob) lives
outside KVStore by design. The v0.8.0 daily backup writes a
**referenced-credentials inventory** event that lists the names of
every credential referenced by the snapshotted configs, plus a
`present_at_backup_time` boolean per name. After a restore the admin
reads the inventory and re-populates secrets via Settings → Tool
credentials. Optional cleartext backup to a restricted index (Option
B in the design doc §5.2) is deferred to a later release —
`secrets_backup.mode = cleartext_restricted` in
`itmip_ai_workbench.conf` is currently a no-op with a warning.

`$SPLUNK_HOME/etc/auth/splunk.secret` should be backed up by the
infra team out-of-band — that's Splunk's own documented practice and
is the only thing that lets existing on-disk passwords be decrypted
after an SH replacement.

### Tuning knobs (install-time only)

All knobs live in **`default/itmip_ai_workbench.conf`
`[kvstore_backup]`**. NOT in `app.conf`, NOT exposed in the Web UI.
Override via `local/itmip_ai_workbench.conf` (self-hosted: deploy the
file via the deployer; Splunk Cloud: include `local/` in the uploaded
app bundle). No `server.conf` SHC replication shim is needed — bundle
replication handles distribution. Key knobs:

| Key | Default | Notes |
|---|---|---|
| `enabled` | `1` | Toggle requires Splunk restart. |
| `daily_time` | `02:00` | Local time HH:MM. |
| `emission_mode` | `best_effort` | or `mandatory` (zero-loss audit). |
| `retention_critical_days` | `30` | Daily-snapshot window. |
| `retention_critical_weekly_weeks` | `26` | Sunday backups kept ~6mo. |
| `retention_critical_monthly_months` | `24` | 1st-of-month backups kept ~2yr. |
| `retention_history_days` | `14` | `itmip_user_history` retention. |
| `secrets_backup.mode` | `inventory_only` | Option A. Option B (`cleartext_restricted`) reserved. |

See `README/itmip_ai_workbench.conf.spec` for the full schema.

### Auditing the backup

```spl
index=itmip_snapshots sourcetype=itmip:kvstore:manifest
| sort - _time
| head 30
| table _time, backup_id, app_version, collections{}.name, collections{}.row_count, verification.ok
```

A failed verification (`verification.ok = false`) fires no automatic
alert in 0.8.0 — wire one via the Splunk alert framework against the
sourcetype `itmip:kvstore:verification`.

### Restoring (0.9.0+)

The **Backups** tab has a full three-step restore wizard. From any
backup row click **Restore…** (or open Detail and click **Restore
from this backup…**):

1. **Pick collections.** Defaults to all 12 backed-up collections;
   uncheck any you want to leave alone. The panel also surfaces the
   current restore lock state and offers a "Break stale lock"
   button when an old restore was abandoned >15 min ago.
2. **Dry-run preview.** Click **Run dry-run** to compute the diff
   (inserts / updates / deletes / unchanged per collection) against
   the live KVStore. No writes happen yet. Pay attention to the
   "snapshot has no rows — committing will WIPE this collection"
   warning: a missing collection in the chosen snapshot will be
   emptied by the commit. If that's not what you want, deselect
   that collection.
3. **Acknowledge + commit.** Tick the *"I understand this will
   overwrite the current KVStore contents"* checkbox. The
   **Restore** button activates. The commit runs synchronously:
   per-collection it (a) dumps current rows to the snapshot index
   as a forensic rollback aside (`sourcetype=itmip:kvstore:pre_restore`),
   (b) deletes every live row, (c) inserts target rows preserving
   `_key`, (d) verifies row count + SHA-256 vs the snapshotted
   state. The result table shows per-collection target/restored/
   verified pills + error drill-downs.

A successful commit also writes a `sourcetype=itmip:kvstore:restore`
audit event to the snapshot index. To find every restore an admin
has ever run:

```spl
index=itmip_snapshots sourcetype=itmip:kvstore:restore
| sort - _time
| table _time, user, backup_id, committed, collections{}.name, collections{}.verified
```

**Restore never touches `storage/passwords`.** Credentials are NOT
re-populated by a restore — admins re-enter LLM API keys via
**Settings → LLM configurations**, custom tool credentials via the
custom tool editor, and MCP server credentials via the MCP server
editor. The Detail modal's Referenced credentials inventory tells
you exactly which credentials each restored config needs and where
to enter each one.

**Lock behaviour.** Only one restore runs at a time across the SH.
The single-row sentinel `itmip_kvstore_restore_lock` collection
holds the lock; it auto-releases on commit completion (success or
verification failure) and is considered stale after 15 minutes.
Stale-lock break is admin-initiated from the wizard.

**Restore CLI / REST.** The same engine is reachable from
`POST /services/itmip_llm/kvstore_admin/restore` with body
`{backup_id, collections?, dry_run: bool, acknowledge?: bool}`.
Admin only. Refuses commit without `acknowledge=true`. See
`bin/itmip_llm_kvstore_restore.py` for the engine and the
TROUBLESHOOTING doc §8 for symptom-driven help.

### Legacy / older instructions

Pre-0.8.0 installs used `splunk export kvstore` or
`tools/export_kvstore_seeds.sh` for ad-hoc snapshots. Those still
work but are no longer the recommended path — the indexed backup
above runs daily, verifies itself, and survives KVStore corruption.

Restoring **only the app** (e.g. moving installs) still requires
re-activating the Cryptolens licence against the new SH's GUID —
the encrypted blob is GUID-bound at the vendor side.

## Content packs (1.7.1)

A **content pack** is one portable, versioned, integrity-checked file
(`adjutant-content-pack-v<YYYY.MM.DD>.<N>.itmipcontent`) that delivers
corrected or improved **content** — skills, knowledge (static rules +
curated entries), and playbooks — **without a full app release**. It
lets a maintainer ship a fix to you in minutes instead of waiting for
the next Splunkbase build. The deep dive (version scheme, integrity
model, build CLI for maintainers) lives in
the content-packs guide; this section is what an admin
does to *import* one.

### Importing a pack

Everything happens on the **Backups** page → the **Content pack** card.
It shows the **currently installed pack version** ("which content are
you on?") so you always know your baseline.

1. **Choose the `.itmipcontent` file** the maintainer sent you (deliver
   it however you like — it carries an integrity hash, so a tampered or
   truncated pack is refused on import).
2. **Preview (dry-run).** Click **Preview** to see exactly what *would*
   happen per item — nothing is written yet. This is the same
   classification you'll get on apply (next section), so you can spot a
   large *skipped — customer-modified* count before committing.
3. **Run a backup first.** Rollback for a content-pack import is the
   ordinary KVStore backup/restore subsystem (above). The import does
   **not** auto-snapshot, so before you **Apply**, trigger an on-demand
   backup (or confirm the daily one ran) so you have a clean restore
   point — the card reminds you. If an import ever goes wrong, restore
   the affected content collections from that backup.
4. **Apply.** The import verifies the pack hash, then upgrades **only**
   the items you have **not** modified and reports the rest. Your Org/BU
   scoping, ownership, sharing, tool/playbook assignments and `_key`s are
   **always preserved** — a re-scoped item is never treated as
   "modified" and is never blanked.

### Reading the import report

Every item is classified into exactly one of six statuses:

| Status | Meaning |
|---|---|
| **upgraded** | the item was un-modified, so the pack's new content was applied |
| **unchanged** | already at the pack's version — nothing to do |
| **skipped (customer-modified)** | you had edited this item, so the pack **left it exactly as you have it** — never overwritten |
| **added** | a new item the pack introduced that wasn't installed before |
| **retired** | the pack set the reversible `retired` tag (see below) |
| **failed** | the item could not be applied (with a reason) |

The run is reported as **"fully successful" only when there are no
*skipped* and no *failed* items** — i.e. the pack landed completely and
nothing needs your attention. When there is outfall, the **skipped +
failed** rows are downloadable as a **CSV**
(`id, type, name, status, current_item_version, pack_item_version,
reason, org_bu`), so you can see precisely what was **not**
auto-upgraded and reconcile those by hand (typically: re-apply your
local edit on top of the new vendor content, or accept the vendor
version). Every import also writes one governance-audit event with the
per-status counts.

### How "retire" works

A pack can **retire** an item. Retire is **not a delete** — it sets a
reversible **`retired` tag** and the item **stays installed**. A retired
item is **hidden** from the normal user lists (Playbooks / Skills /
Knowledge) **and inert**: it is not selectable, runnable, advertised, or
injected into prompts, and it is also dropped from the inbound MCP
playbook list/run. To bring it back, an **admin / sc_admin removes the
`retired` tag** — the item is usable again immediately. (Because the tag
is part of the item's content, re-enabling it makes the item
"customer-modified", so a later pack won't silently re-retire it — it
surfaces as *skipped — customer-modified* instead.)

> **Who can do this.** Content-pack import (and build/status) is
> **admin / sc_admin only** — the REST endpoint is admin-gated
> server-side and the state collection is admin read/write. A non-admin
> user never sees the import UI and never sees retired items.

## Where to go next

- Content packs (versioned content delivery, integrity model, maintainer build CLI) → the content-packs guide.
- Tool catalogue, custom tools, MCP servers → the tool catalogue.
- Dashboard Studio (JSON) pipeline + known failure modes → the Dashboard Studio guide. Studio template currently ships as **draft** (v0.9.5) — that doc covers why and what needs to land for promotion.
- End-user concerns → [the user manual](../user/user-manual.md).
- New install → [the installation guide](./installation.md).
- Something is broken → the troubleshooting guide.
- Customer corporate-SSO setup → the customer authorisation hook guide.
- Per-provider LLM matrix → the supported-LLM matrix.
