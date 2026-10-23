---
sidebar_position: 1
---

# Installation guide — Adjutant AI

**App version:** 2.5.9
**Last updated:** 2026-09-22

This guide walks a Splunk administrator through deploying **AI User
Assistent for Splunk** on a fresh customer environment and getting the
app to a working, licensed, multi-tenant state.

## 0. Prerequisites

### Splunk platform

- **Splunk Enterprise 9.4.x – 10.4.x** — single search head, search head
  cluster, or **Splunk Cloud (Victoria)** with admin REST access. Validated on
  **9.4.8, 10.2.4 and 10.4.1**. **9.3.x is no longer supported** — the floor was
  raised on 2026-08-06.
- **KV Store must be available.** This is not a soft dependency: every
  collection in the app lives in KV Store and **there is no degraded mode
  without it**. The
  app probes `kvStoreStatus` at startup and, if it is `disabled` or `failed`,
  posts a Splunk system banner rather than failing quietly.
- **Python 3.9 or 3.13.** The app is pure Python with no binary modules, and
  every handler and input declares `python.version = python3`. `inputs.conf`
  also carries `python.required`, which is what 10.x reads and which takes
  precedence; `python.version` is kept because `python.required` does not exist
  in the 9.x spec at all, so a 9.x search head falls back to it. One file, both
  platforms. (Splunk Cloud vetting *requires* `python.required` — AppInspect's
  `check_scripted_inputs_python_required` fails an app without it.)

> **Expected on 9.x:** one cosmetic `Invalid key: python.required` warning per
> input stanza in `splunkd.log`. It is harmless and is the accepted cost of
> staying Cloud-compatible. Do not "fix" it by removing the key.

> **The version range has one machine-readable source of truth**:
> `default/data/platform_compatibility.json`. The `app.conf` comment block, the
> `python.required` declarations, the runtime guard and the Splunkbase
> declaration are all **derived** from it, and CI
> (`scripts/check_compatibility.ts`) fails the build when they disagree. If you
> need to know what is supported, read that file — not prose, including this
> prose. (The range cannot live in `app.manifest`: it has no version-*range*
> field, only `targetWorkloads` / `supportedDeployments`.)
>
> Running outside the range is **stated, not blocked** — the app tells the
> operator and carries on.

> **On Splunk 10.** The two changes that break most apps do not bite here.
> Simple XML `version="1.0"` stops loading on 10.4 (jQuery 2 removed) — the app's
> host view and every dashboard it *generates* already emit `version="1.1"`, and
> a validator rejects anything that does not. The deprecated SplunkJS / Web
> Framework path is not used at all: the SPA is injected by vanilla JS and bundles
> its own React, so it is decoupled from whatever the platform ships. There are no
> CherryPy controllers and no Mako templates.
>
> **KV Store is the thing to check before upgrading Splunk itself**, not after.
> Splunk 10.4 ships MongoDB 8.0 and has **removed the pre-7 binaries**, so a
> direct 4.x/6.x → 8.0 migration is unsupported. Migrate KV Store *first*, on your
> existing Splunk version, then upgrade. This app stores everything in KV Store,
> so this is not a detail you can defer.

### Artefact and access

- The downloaded `.spl` (or `.tar.gz`) artefact for the version you're
  installing. The version below is **2.5.9**; substitute as needed.
- A web-browsing client that can reach the Splunk SH on port `8000`
  (HTTPS by default).
- At least one of: an Anthropic API key (for the bootstrap LLM),
  *or* credentials for whichever LLM provider you intend to put in
  front of users (see the supported-LLM matrix).
- (Optional, recommended) An SMTP relay configured under
  Splunk's **Settings → Server settings → Email settings**, so the
  license-expiry alert can send mail.

## Deployment model (read before installing)

**Core design principle — read this before adding any nav links.**

Adjutant AI is a **single-page React application that has no use-cases
of its own.** It is a *host shell*. Every piece of functionality an
end user experiences inside it — which prompt playbooks appear, which
LLMs they can call, which tools the LLM may use, where saved searches
/ dashboards / alerts / MLTK models are written — is fully derived
from two inputs:

1. **The Splunk app the user opened the Workbench from** (the calling
   app, resolved at page-load time via `@splunk/splunk-utils`'s
   `getApp()`), and
2. **The Splunk roles that user holds.**

From that pair the Workbench resolves an Organisation + Business Unit
(configured on the **Orgs & BUs** tab) and renders an experience that
is specific to that calling app / customer / tenant / team.

**It is therefore neither necessary nor recommended for end users to
navigate to the `itmip_ai_splunk_assistent_app` tile directly.** The
entire purpose of this app is to deliver an **AI assistant *inside
other apps, for other users*** — Search, ITSI, Enterprise Security,
your custom SOC apps, MSP customer apps. Treat
`itmip_ai_splunk_assistent_app` itself as installation and admin
plumbing; treat each *calling* app as the actual home of the assistant
from the end user's perspective.

The expected deployment pattern is therefore:

1. **Install Adjutant AI once** on the Search Head (replicated by SHC
   bundle replication / KVStore replication where applicable).
2. **Embed it into the apps your users already live in.** For each
   Splunk app that should expose the assistant, edit that app's
   `data/ui/nav/default.xml` to add a nav-menu entry that opens
   `…/app/<calling_app>/Adjutant AI`. The Workbench dashboard is
   shareable across apps — the only thing that matters is which app
   namespace the URL is opened *from*.
3. **Configure Organisations and Business Units** on the **Orgs & BUs**
   tab so that `(calling app, user roles)` resolves cleanly to an
   `(Org, BU)` pair for every user who should see the assistant.
4. **Restrict `itmip_ai_splunk_assistent_app` in the launcher — this is a
   manual step you must perform.**

   > **Check this on any environment you have already deployed.** As shipped,
   > `metadata/default.meta` grants `access = read : [ * ]` and `default/app.conf`
   > sets `is_visible = 1`, so **the app tile is visible to every Splunk user
   > until you restrict it**. Confirm it on the environment itself rather than
   > assuming it was done at install time.

   Admins still need direct access — that is where Playbooks, Scheduled Ask,
   Tokens & Costs, Orgs & BUs, License, Backups, Tools, Models and Settings
   live — but exposing the bare app tile to end users defeats the host-shell
   design and bypasses the per-tenant namespace isolation described below.

   To restrict it, set the visibility in `metadata/local.meta` (and/or
   `local/app.conf` `is_visible = 0`) and reload:

   ```ini
   # metadata/local.meta
   []
   access = read : [ admin, sc_admin ], write : [ admin, sc_admin ]
   ```

   Note that this hides the **tile**, not the app's dashboards: several nav
   views (ITSI RCA, AI Activity, LLM Health, Automation Outcomes, Pipeline
   Knobs, Resource Consumption) are readable by any user by design. The Outcome
   Ledger, Behaviour (OCSF) and Fraud Readiness views are already restricted to
   `admin` / `sc_admin` in `default.meta`.

Two operational consequences flow directly from this design:

- **Knowledge objects land in the calling app's namespace.** When a
  user opens the Workbench from app *X*, saved searches / dashboards /
  alerts / MLTK models created during their session are written to app
  *X*, owned by the calling user. Same engine, but Splunk's existing
  namespace model gives you per-app isolation for free. The same user
  opening the Workbench from app *Y* writes future artefacts into
  app *Y* instead — no admin action required.
- **Org / BU is resolved automatically** from `(calling Splunk app,
  user roles)`. End users don't pick a tenant — you configure
  Organisations (by `app_patterns`) and Business Units (by role
  patterns / user lists) once, and Adjutant AI picks the first
  matching pair on each page load. Users who match no Org see a
  greyed-out app and an admin-configurable "ask your Splunk team"
  message (`[ui] unassigned_message` in
  `local/itmip_ai_workbench.conf`).

In practice this means step 7 (Configure Orgs & BUs) is the gate
between "the app is installed" and "the app is *useful*" for any
non-admin user. Add nav entries to the apps that should have the
assistant, then configure at least one Org + BU that covers those
apps' users.

## 1. Install the app

```bash
# As an admin on the Splunk Search Head:
$SPLUNK_HOME/bin/splunk install app /path/to/itmip_ai_splunk_assistent_app.tar.gz -auth admin:<password>
```

Or via Splunk Web → **Apps → Manage Apps → Install app from file**.

Restart Splunk fully (not just splunkweb) so the persistent REST
handlers register:

```bash
$SPLUNK_HOME/bin/splunk restart
```

> **SHC:** push the tarball through the deployer; members will
> restart automatically when the bundle is applied. Verify each member
> reports the same `version = 1.4.1` in `default/app.conf` after the
> rolling restart.

## 1b. What the install actually creates

Useful when you are reviewing the app before deploying it, or explaining its
footprint to a platform team. Counts are for 2.5.9.

| | Count | Notes |
|---|--:|---|
| KV Store collections | **76** | `default/collections.conf`. Everything the app knows lives here — see the KV Store prerequisite in §0. |
| Persistent REST handlers | **55** | `default/restmap.conf`, all `scripttype = persist`. Registered **only on restart**. |
| Scripted / modular inputs | **13** | All `disabled = false`, all `passAuth = admin`. See below. |
| Saved searches | **7** | All shipped **disabled** — five agent-queue alerts and two example playbooks. Nothing schedules itself. |
| Seed files | **7** | 90 playbooks, 52 skills, 31 catalogue models, 1 Org (`DFLT`), 1 BU (`DFLT_DFLT`), plus two intentionally empty. |
| Custom roles / capabilities | **0** | There is no `authorize.conf`. The app uses stock roles plus per-object ACLs in `metadata/default.meta`. |
| `indexes.conf` | **none** | Deliberate — a static index definition fails Cloud vetting, and operators should own sizing and retention. You create the indexes (§1c). |

### The 13 inputs

Ten write to `_internal`; only the licence monitor writes to `main`. Most are
**inert until you turn something on**, which is why a fresh install is quiet.

| Input | Interval | What it does |
|---|--:|---|
| `itmip_llm_license_monitor.py` | 6h | Licence-expiry event. Silent until ≤30 days. |
| `itmip_llm_kvstore_backup.py` | 600s | Daily snapshot decision, manifest, credential inventory, verification. Routes via `receivers/simple` to your configured snapshot index. |
| `itmip_llm_agent_dispatcher.py` | **5s** | Backend Ask Service — claims queue rows and spawns runners. **Inert until `[agent_runner] enabled = 1`.** |
| `itmip_llm_feedback_collector.py` | 300s | Maps analyst dispositions back to a run. Inert unless enabled *and* `feedback_capture = 1`. |
| `itmip_llm_diagnosis.py` | 1h | Proactive pipeline-tuning recommendation email. |
| `itmip_llm_catalog_seed.py` | 300s | Seeds the model catalogue; gated on `SEED_VERSION`. |
| `itmip_llm_startup_seed.py` | 300s | **2.0.1** — eager seed of *all* managed collections at every splunkd start. Idempotent and missing-only. |
| `itmip_llm_model_discovery.py` | 6h | Live model/price sweep. No-ops below Professional. |
| `itmip_llm_mcp_register.py` | 300s | Registers this app's tools into Splunk's own MCP server. |
| `itmip_rca_auto.py` | 300s | Automatic ITSI RCA. No-op unless `[itsi_rca] auto_rca_enabled = true`. |
| `itmip_llm_health_sweep.py` | 6h | **2.5.0** — light connectivity probe for LLM configs. Off via `[llm_reliability] health_sweep_enabled = 0`. |
| `itmip_llm_expiry_alert.py` | 24h | Credential-expiry threshold crossings (30/14/7/3/1/0 days). No network. |
| `itmip_llm_stateless_boot.py` | **-1** | Runs **once per splunkd start**. Exits immediately when `[stateless] enabled = 0` (§12). |

### What needs a restart, and what does not

`app.conf` declares `reload.itmip_ai_workbench = simple`, so most
`itmip_ai_workbench.conf` changes take effect on `splunk reload app`. These do
**not**:

- **The install itself** — REST handlers and scripted inputs register only on
  a full `splunk restart`.
- Any `inputs.conf` edit.
- `[indexes]` snapshot/changes renames.
- `[kvstore_backup] enabled` — it gates the input's `disabled` flag.
- `[mcp_server]` enable.
- **Every `[stateless]` key** — the boot input runs once per splunkd start, so
  a restart *is* the mechanism.

## 1c. Indexes you must create

The app ships no `indexes.conf`, so **until these exist the writes are silently
dropped**. Create them via Settings → Indexes, your cluster master, or Cloud
index settings.

| Index | Default name | Used by |
|---|---|---|
| Snapshots | `itmip_snapshots` | KV Store backup. Name configurable in `[indexes]`. |
| Changes | `itmip_changes` | Continuous change log. Name configurable in `[indexes]`. |
| OCSF / behaviour | `adjutant_ai_ocsf` | Agent telemetry + the Behaviour (OCSF) dashboard. **Hard-coded in the `adjutant_ocsf` macro**, so this name is not configurable the way the other two are. |
| Per-Org audit | *(you choose)* | Audit logging, if you enable it (§9b). The app never creates indexes. |

## 2. First page-load bootstrap

> **Since 2.0.1 a browser is no longer required to seed.**
> `itmip_llm_startup_seed.py` materialises every managed collection at each
> splunkd start — idempotent, missing-only, and it **never clobbers an edited or
> user-authored row**. Headless and API-only deployments now come up seeded. The
> browser flow below still works and is still the easiest way to confirm.

Open the app once in the browser:

```
https://<splunk-sh>:8000/en-US/app/itmip_ai_splunk_assistent_app/Adjutant AI
```

The first load does several things automatically:

- Calls `/services/itmip_llm/setup` which seeds the KVStore
  collections from `default/data/seeds/*.json`. After this you have
  one default Organisation (`DFLT`), one default Business Unit
  (`DFLT_DFLT`), and the seeded use-case playbooks (**90** today; the
  **Playbooks** tab and
  [the tools and playbooks overview](./tools/tools-and-playbooks.md)
  are the source of truth for the current catalogue).
- Renders the **"Running on free License"** badge next to the app
  title. The Personal (free) tier is **single-user**: it binds to the
  first person who opens the app (the owner) and greys the app out for
  everyone else (the LLM proxy refuses their calls server-side) until a
  licence is activated. The owner is limited to 1 Org / 1 BU / no
  History / no Tokens & Costs / no audit logging until then (see
  step 4 and the licensing reference).

> **First-run tier note (per-feature licensing, 1.4.1).** A fresh install
> starts on the **Personal / free single-user tier**. To unlock more,
> activate a license in the **License** tab (step 4): **Professional**
> unlocks the *operations* capabilities (ML generation, History, Tokens &
> Costs, in-Splunk awareness / TrackMe + ES/ITSI read context, KVStore
> backups) and **Enterprise** unlocks *security, integrations &
> governance* (ES / ITSI / ATT&CK-hunt security workflows, MCP servers,
> custom HTTP tools, the corporate-IAM gateway hook, governance logging,
> and **audit logging — which is Enterprise as of 1.4.1**). Entitlement is
> resolved **per capability** from a server-authoritative, fail-closed
> matrix, so features unlock exactly at the tier they belong to. If a
> license later expires or is downgraded, over-tier features are **hidden
> or refused, never deleted** — re-activating restores them. Full matrix:
> the licensing reference.
- Synthesises an in-memory bootstrap Anthropic LLM configuration
  called `DFLT_DFLT_anthropic_central` so users can immediately start
  asking questions if you provide a key in step 5.

## 3. (Optional) Change the macro index

The app ships with two SPL macros, both pointing at `index=main`:

| Macro | Used by |
|-------|---------|
| `ai_assistant_metrics_index` | Tokens & Costs tab |
| `ai_assistant_license_index` | License expiry-warning saved alert |

If your customer routes the app's events into a dedicated index (very
common in production), create `local/macros.conf` on the search head
with overrides:

```ini
# $SPLUNK_HOME/etc/apps/itmip_ai_splunk_assistent_app/local/macros.conf
[ai_assistant_metrics_index]
definition = index=ai_assistent (sourcetype=ai_assistant_usage OR sourcetype=claude_assistant_usage)
iseval = 0

[ai_assistant_license_index]
definition = index=ai_assistent sourcetype=itmip_llm_license
iseval = 0
```

And edit `local/inputs.conf` to point the license-monitor scripted
input at the same index:

```ini
[script://$SPLUNK_HOME/etc/apps/itmip_ai_splunk_assistent_app/bin/itmip_llm_license_monitor.py]
index = ai_assistent
```

Restart Splunk after editing `inputs.conf`.

## 4. Activate the license
1. Sign in to Splunk Web as an `admin` — or, on Splunk Cloud, as `sc_admin`.

   > **Fixed in 2.5.9 — `sc_admin` now gets the admin UI.** It previously did
   > not. The backend accepted it, and so did every `write :` ACL in
   > `metadata/default.meta`, but the frontend checked only `admin` and
   > `splunk_admin`. A Splunk Cloud administrator therefore passed every
   > server-side check and was still shown the non-admin UI — including no
   > License tab to activate the licence with — which reads as a broken install
   > rather than a role problem.
   >
   > **On any earlier build**, grant `admin` alongside `sc_admin` as a
   > workaround. The three roles are now mirrored between the backend and the
   > browser, and pinned by a test that fails the build if the two halves
   > diverge again.
2. Open the app → **License** tab (admin-only).
3. Note the **Environment GUID** the tab shows — that's what gets
   passed as `MachineCode` to the licensing vendor. Source is one of
   `instance` / `shcluster` / `idx_cluster_cm` / `cloud` depending on
   topology.
4. Paste the 25-character license key into **Activate a new license**
   and click **Activate**. The browser calls the vendor's HTTPS
   endpoint directly (works even if the Splunk SH has no internet
   egress), then ships the signed response back to the SH for
   encrypted storage in `storage/passwords`.
5. Confirm the tier in the **Current license** card matches what you
   bought (Professional / Enterprise / MSP) and that the header badge
   reads the matching edition (`Professional Edition` / `Enterprise
   Edition` / `MSP Enterprise Edition`, or `Running on a Proof of Value
   License` / `Not-for-Resale License` for PoV / NFR). MSPs can rebrand
   the MSP badge via `itmip_ai_workbench.conf [branding] msp_badge_label`.

**MSP customers** running one key across multiple Splunk environments:
repeat step 4 on each environment using the same key. The vendor
tracks the activations centrally up to `maxNoOfMachines`; each SH then
stores its own copy of the response and validates against its local
GUID.

## 5. Configure your first real LLM

The bootstrap `DFLT_DFLT_anthropic_central` row in **Settings → LLM
configurations** is ready as soon as you supply an API key.

### 5.1 Use the wizard — it is not the same as filling in a form

Since 2.5.x, **Add connection** opens a staged **connection wizard** rather than
a blank form: *Choose an AI service* → *Enter connection details* → *Test
connection* → *Review and create*. Do not hand-edit a configuration when the
wizard will do it; the wizard is where the diagnosis lives.

The test is a **ten-rung ladder**, and each rung tells you what it is waiting on
— "Finding the server" (a DNS answer), "Checking the secure connection",
"Asking what sign-in it wants", "Signing in", "Finding models that work",
"Asking a first question", "Testing Splunk actions". A stall names its own cause
instead of producing one red box.

Three things worth knowing before you use it:

- **One budgeted action (~22 s) per request**, because Splunk Web abandons a
  request at `splunkdConnectionTimeout` (30 s). The wizard therefore progresses
  in steps rather than running the whole ladder in one call — that is by design,
  not slowness.
- **Nothing in the wizard writes** until you finish, and **no secret is held
  between calls** — the credential arrives with each request and is dropped.
  Drafts live in `itmip_llm_wizard_drafts`.
- **"Finding models that work" is evidence, not a gate.** A provider that
  publishes no model list is not a failure.

There are **nine provider kinds**: Anthropic, OpenAI, Azure OpenAI, Gemini,
Groq, Bedrock, OpenRouter, Ollama, and `openai_compatible` — the escape hatch for
vLLM, LiteLLM, LM Studio, TGI, llama.cpp, SGLang, your own gateway, or a Splunk
AI Tier BYOLLM endpoint. See
[the LLM model catalogue](./llms/llm-model-catalog.md) for the models and prices, and
the connection-wizard guide for what each rung proves.

### 5.2 Two call modes — pick per LLM

- **`browser_direct`** — works for Anthropic, Ollama, OpenRouter. The
  browser talks straight to the provider's API. Lowest latency,
  supports streaming. Blocked by CORS for OpenAI / Azure / Groq /
  Gemini / Bedrock.
- **`splunk_proxy`** — works for every provider. The browser POSTs
  to a server-side proxy on the SH which forwards the request. Use
  this when CORS blocks the browser path or when you don't want LLM
  API keys to leave the SH.

See the supported-LLM matrix for the full provider
matrix (endpoints, auth headers, CORS behaviour, streaming support,
recommended models).

## 6. (Optional) Customer authorisation hook

If the customer's LLM endpoint sits behind a corporate IAM gateway
(WebEAM.Next, Ping, Okta, AzureAD, internal SAML…) the static
"Extra HTTP headers" field on the LLM config isn't enough — short-lived
tokens need to be refreshed per request. Toggle **Customer
authorisation hook** on the LLM config and edit
`local/bin/customer_authorisation.py` with the customer's login flow.

See [the customer authorisation hook guide](./security/customer-authorisation-hook.md)
for the function contract, the WebEAM-style worked example, the
credentials-from-storage-passwords pattern, and caching guidance.

## 7. (Optional) Configure Orgs & BUs

By default everything lives in `DFLT/DFLT`. To split usage by
customer-internal team or business line:

1. **License → Orgs & BUs** tab (admin-only).
2. **+ Add Org** with a 1-4 char short, a name, the Splunk app
   patterns this Org covers, and the role patterns it accepts.
3. **+ BU** per Org with a 1-4 char short, optional extra-role
   patterns, and optional extra-user names.

Per-tier limits (the **License** tab tells you which apply):

| Tier | Orgs | BUs/Org | Users | Audit logging (1.4.1) |
|------|-----:|--------:|-------|------------------------|
| Personal (free) | 1 | 1 | **1 (owner-bound)** | — |
| Professional | 1 | 3 | ∞ | — |
| Enterprise | 1 | ∞ | ∞ | ✓ |
| MSP | ∞ | ∞ | ∞ | ✓ |

The **+ Add Org** / **+ BU** buttons disable at cap; server-side
enforcement at `/services/itmip_llm/tenancy` is the authoritative
boundary. The free tier is genuinely **single-user** (bound to the
first owner; others greyed + proxy 403), and **audit logging is an
Enterprise feature as of 1.4.1** (it moved up from Professional under
the per-feature capability matrix). A licence downgrade *hides* over-cap
content, it never deletes it — see the licensing reference.

## 8. (Optional) Per-tenant tool gating

The **Tools** tab (admin-only) lists every Claude/LLM tool the
dispatcher exposes. Toggle individual tools on or off per
Org / BU / wildcard. Most specific rule wins.

Typical reasons to disable a tool:

- The customer doesn't want the LLM to read lookups in a specific BU.
- A regulated team forbids `splunk_create_alert`.
- ML-toolkit tools are noise for non-AI BUs.

## 9. (Optional) License-expiry alerting

When you save email recipients under **License → Expiry warning
recipients**, the app auto-creates a Splunk Enterprise saved alert
called `itmip_llm_license_expiry_warning`. It searches the
`ai_assistant_license_index` macro (step 3) for expiry events and
emails everyone on the list when the license is within 30 days of
expiring. Removing every recipient deletes the alert.

The expiry-event scripted input
`bin/itmip_llm_license_monitor.py` runs every 6 hours and is
silent until `expires_in_days ≤ 30`.

## 9b. (Optional) Real audit logging (Enterprise as of 1.4.1; 1.3.0)

If you need a legally-defensible record of who sent what to which LLM
(and who changed playbooks / tools / MCP / LLM configs), configure
per-Org audit logging. As of 1.4.1 it is an **Enterprise** feature (the
`audit_logging` capability moved up from Professional under the
per-feature licensing matrix) and the app **never creates indexes** —
you provision the audit index yourself.

1. **Provision a secured audit index** per Organisation (on-prem:
   `indexes.conf`, ideally a `_`-prefixed internal index; Splunk Cloud:
   via ACS). Grant read only to admins and any per-Org auditor role.
2. **Orgs & BUs → edit Org → Audit logging:** set the **audit index**,
   choose a **content mode** (`metadata_only` / `prompt_hash` /
   `truncated_prompt` / `full_prompt` — pick per your DPIA; there is no
   maximal default), set **enforcement** (`enforce` = fail-closed and
   `splunk_proxy`-only / `best_effort`), and—if you choose
   `full_prompt`—tick the **DPIA acknowledgement**. Optionally name an
   **auditor role pattern**.
3. The server validates the index exists and is writable before saving
   (hard-required under `enforce`; allowed under `best_effort` so you
   can name the index before provisioning it).
4. Review captured turns on the **Audit** tab (admin + auditor role);
   export CSV for hand-off.

Full operator guide: [the auditing guide](./security/auditing.md).

## 10. Verification

A clean install should pass all of:

```bash
# Persistent REST handlers reachable
curl -k -u admin:<pw> https://localhost:8089/services/itmip_llm/setup       -X POST
curl -k -u admin:<pw> https://localhost:8089/services/itmip_llm/use_cases   # seeded playbooks (90 as of 2.5.9)
curl -k -u admin:<pw> https://localhost:8089/services/itmip_llm/license     # has guid + tier
curl -k -u admin:<pw> https://localhost:8089/services/itmip_llm/tenancy -X POST \
    -d '{"action":"create_org","short":"TEST","name":"Test"}' \
    -H "Content-Type: application/json"

# KVStore contents
| rest /servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/collections/data/itmip_ai_use_cases
    | stats count by status     -> a mix of operational + draft rows
| rest /servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/collections/data/itmip_organisations
    | table short, name         -> at least one DFLT row
```

In the browser, confirm:

- The app title reads **"Adjutant AI"**.
- A license badge appears next to the title (free / PoV / NFR / no
  badge for plain Pro/Ent/MSP).
- The Ask tab loads the LLM dropdown and the playbook tiles.
- At least one playbook tile says **`Default`** (the router) and one
  is `General` (the guardrail) — both are operational seed playbooks.

### 10.1 Deeper checks

| Check | How |
|---|---|
| LLM connectivity | **Settings → the Status column** on each configuration, and the **Recheck** button. Rendering the page never touches the network; only Recheck does. A failed check **reports and never disables** a configuration. |
| Health endpoints | `POST /itmip_llm/health`, plus `/itmip_llm/ingest_health`, `/cribl_ingest_health`, `/edge_processor_health`, `/extraction_completeness`. |
| Dashboards | `Adjutant AI — LLM Health`, `— AI Activity`, `— Resource Consumption`, `— Pipeline Knobs` in the app nav. |
| Diagnostics | **Help → 🐞 Report an issue**. Produces an encrypted `.itmipdiag` package. See the support-bundle guide for exactly what it collects and redacts before you send one. |
| Stateless boot | Read `itmip_stateless_boot` — `state` is one of `restoring` / `ready` / `degraded` / `failed`, with a per-collection `snapshot_outcomes`. Then `aws s3 ls s3://<bucket>/<prefix>/<env_id>/_meta/boot/`. |

There are also **34 scripts in `tools/`** that are useful at install time and
that this guide never mentioned. The ones to know:

| Script | Proves |
|---|---|
| `verify_s3_store.py` | The bucket, credentials and policy work — **before** you enable stateless. |
| `verify_secrets_store.py` | The Secrets Manager path end to end, read and write. |
| `check_rest_exposure.sh` | No handler is exposed more widely than intended. |
| `check_seed_drift.sh` | Shipped seeds still match what the app expects. |
| `run_appinspect.py` | Cloud vetting, before you submit rather than after. |
| `load_demo_data.py` / `verify_demo_data.py` | A demo dataset, for a PoV environment. |

## 10.2 Upgrading

**Do the platform gate first.** If you are going to Splunk 10.4, migrate KV Store
to MongoDB engine 7 or 8 **before** the Splunk upgrade — the pre-7 binaries are
removed in 10.4 and a direct 4.x/6.x → 8.0 migration is unsupported. This app
keeps everything in KV Store, so this is not deferrable.

Then:

1. **Snapshot first.** The backup input runs daily, but take a deliberate one.
   The restore engine (`itmip_llm_kvstore_restore.py`) takes a global lock,
   copies aside, deletes, re-POSTs preserving `_key`, then **verifies counts and
   SHA and rolls back rather than leaving a half-restored collection**.
2. **Install over the top and restart.** Handlers and inputs re-register on
   restart only.
3. **Seeds re-merge themselves.** `itmip_llm_startup_seed.py` is idempotent and
   **missing-only — it never overwrites an edited or user-authored row**. The
   model catalogue is separately gated on `SEED_VERSION`.
4. **Shipped content comes via content packs**, not the seed job:
   auto-upgrade-unmodified, **skip customer-modified**, preserve tenancy,
   reversible retire. `plan` is a dry run that writes nothing. The pack carries
   an integrity hash, which **detects accidental gaps — corruption, a truncated
   transfer — not a deliberate rewrite**: the hash is unkeyed, so anyone who
   edits a pack can recompute it. Treat a pack as trusted only if its source is.
   See the content-packs guide.

**What bites on upgrade:**

- A playbook you **edited** is skipped by content-pack import — by design — so
  it will not pick up upstream fixes. That is the trade for not losing your
  changes; know which ones you have customised.
- If the indexes in §1c were never created, those writes have been dropped all
  along and an upgrade will not tell you.
- `[kvstore_backup] enabled` and `[indexes]` changes need a restart, not a
  reload.
- Two one-off migrations exist if you use those features:
  `itmip_llm_fraud_migrate.py` and `itmip_netpol_source_migrate.py`.

## 11. Day-2 operations

Refer to the role-specific manuals:

- **[the user manual](../user/user-manual.md)** — for the non-admin
  end-user. Covers the Ask tab, History, picking playbooks, attaching
  references.
- **[the admin manual](./admin-manual.md)** — for `admin` /
  `sc_admin`. Covers Playbooks, Tokens & Costs, Orgs & BUs, License,
  Settings, the v0.8.0 KVStore backup subsystem, and the v0.9.0
  restore wizard.
- **[the tool catalogue](./tools/tool-catalogue.md)** — built-in tool catalogue, per-Org/BU
  enable/disable, per-tool metadata overrides, custom HTTP tools,
  MCP server registration + import, customer-auth hook for IAM-
  gated targets.
- **the licensing reference** — tier matrix, the single-user
  free tier, audit gating, and the downgrade-hides-never-deletes
  contract.
- **[the auditing guide](./security/auditing.md)** — operator guide for the per-Org
  real audit logging configured in step 9b.
- **the knowledge-layer guide** — the admin Knowledge
  tab and connectors (1.0.0+). SSE security content now flows through
  the `security-content` tools (1.2.0), not a connector.
- **the troubleshooting guide** — symptom-driven
  guide for install issues, KVStore problems, browser caches,
  backup/restore, SHC bundle replication, license activation,
  and the common Splunk gotchas this app hits.

Added since this guide was last revised — the subjects that did not exist at
1.4.1 and that an admin will go looking for:

| Doc | Covers |
|---|---|
| **the playbook catalogue** | Every shipped playbook and the use case it covers, with a verdict per run mode (interactive Ask, Scheduled Ask, MCP, AI Driven Integration). Start here when someone asks "what can it actually do". |
| **[the LLM model catalogue](./llms/llm-model-catalog.md)** | The nine providers, the 31 seeded models and their prices, how a model gets chosen, and how to add one the app has never heard of. |
| **the connection-wizard guide** | The four-step connection wizard and its ten-rung test ladder — what each rung proves and what a failure at it means. |
| **the AI Driven Integration guide** | Unattended integrations: the versioned mapping contract, watermarks, receipts, clearance and drift. |
| **the Scheduled Ask and memory guide** | Scheduled Ask — Jobs and Integrations — and the memory model behind them. |
| **[the stateless operation guide](./stateless.md)** | Running on a disposable search head (§12). Bucket policy, IAM, lifecycle, the lease, verification. |
| **[the MCP server guide](./tools/mcp-server.md)** / **[the MCP OAuth guide](./tools/mcp-oauth.md)** | Adjutant as an MCP *server* — exposing its tools to other agents — and the OAuth path. |
| **[the custom-tools guide](./tools/custom-tools-authoring.md)** | Custom HTTP tools: purpose, authoring, limits, and assigning them to playbooks. |
| **[the ServiceNow guide](./integrations/servicenow.md)** | ServiceNow ITSM/SIR connections and the tools they expose. |
| **the Outcome Ledger guide** | What the app claims it did, and whether it actually happened. |
| **the support-bundle guide** | The "Report an issue" diagnostic package — what it collects and what it redacts. |
| **the rights and roles reference** | Which Splunk roles see what, and which capabilities matter. |

### KVStore backup

A daily KVStore snapshot scripted input runs automatically once the
app is installed — default schedule 02:00 local time. Snapshots live in
the **snapshot index** (suggested `itmip_snapshots`, ~24-month retention),
with a continuous change log in the **changes index** (suggested
`itmip_changes`, ~60 days).

**You must create these two EVENT indexes — the app ships no `indexes.conf`**
(a static index definition fails Splunk Cloud vetting, and operators should own
index sizing/retention). Create them via Settings → Indexes (self-hosted) or on
your index-cluster master / Splunk Cloud index settings. Until they exist, the
backup writes are dropped.

The index **names are configurable** in `local/itmip_ai_workbench.conf`
`[indexes]` — the entire app (backup, change-log, restore, Backups tab) reads
the names from there:

```ini
[indexes]
snapshot_index = itmip_snapshots   # rename to your own index if you like
changes_index  = itmip_changes
```

If you rename them, create the matching indexes and restart/reload Splunk; an
invalid name falls back to the suggested default.

To tune retention, daily time, or emission mode, override values in
`local/itmip_ai_workbench.conf` `[kvstore_backup]`. The full schema
is in `README/itmip_ai_workbench.conf.spec`. No `server.conf`
required — bundle replication distributes the file identically to
every SHC member.

## 12. (Optional) Stateless operation — surviving a rebuilt instance

**Skip this section unless your search head is disposable.** Stateless operation
exists for one situation: an instance that gets **rebuilt from an image**, where
everything on local disk — KV Store included — is gone on the next boot. If your
search head keeps its disk, you do not need any of this, and turning it on buys
you nothing but moving parts.

The full guide is **[the stateless operation guide](./stateless.md)** (bucket policy, IAM, lifecycle
rules, the lease, verification). This section is the install-time summary: when
you need it, what it demands of the platform, and the smallest configuration that
works.

### 12.1 The prerequisite that decides it for you

> **Today this means AWS EC2. Not Azure, not on-prem, not a container without an
> instance role.**

The reason is a chicken-and-egg problem, not a missing feature. The only storage
provider implemented is `aws_s3`, and the only accepted `auth_mode` is
`instance_role` — because the credential that reaches the object store cannot
itself live in the store being restored. On EC2, the instance role breaks that
cycle; nothing else currently does. `auth_mode = access_key` is **refused at
boot**, and so is `provider = azure_blob`.

You will also need:

- An **S3 bucket** with **versioning on** (the restore depends on it), block-public-access
  on all four flags, a TLS-only bucket policy, and default encryption enabled.
- An **IAM instance role** scoped to the bucket and prefix.
- A **stable `environment_id`** you choose and write down — see below.

### 12.2 The minimum configuration

Two stanzas in `local/itmip_ai_workbench.conf`, then **restart Splunk**. The boot
runs once per splunkd start, so a restart is how any change here takes effect.

```ini
[stateless]
enabled         = 1
environment_id  = acme-acc          ; ^[a-z0-9][a-z0-9-]{1,62}$
provider        = aws_s3
bucket          = my-adjutant-bucket
region          = eu-west-1
prefix          = adjutant/        ; environment_id is appended to this
auth_mode       = instance_role    ; the only mode supported today

[kvstore_backup]
backup_sinks    = index,object_store
```

Two things in there are load-bearing:

**`environment_id` is declared, not discovered.** Not the instance id, not the
hostname, not the Splunk GUID — all three change when the instance is rebuilt,
which is the one thing this value must not do. It is also a prefix component, so
two environments can safely share a bucket.

**`backup_sinks` must contain `object_store`.** The boot refuses the
configuration if it does not, naming the key. That snapshot is what a wiped
instance restores *from*; `index` alone is the configuration that looks perfectly
healthy right up until you need it and discover there is nothing to restore.

### 12.3 Refusals are explicit, and that is deliberate

A bad value here is **named and refused at boot**, not quietly replaced with a
default — unlike `[indexes]`, where a fallback is harmless. A silent fallback in
this stanza would mean writing your state somewhere you did not choose.

| Key | Refused value | Why |
|---|---|---|
| `auth_mode` | `access_key` | See §12.1 — the credential cycle. |
| `provider` | `azure_blob`; `local_file` while enabled | Not built; `local_file` dies with the instance. |
| `sse` | `none` | Encryption comes from the bucket's default-encryption rule; declaring `none` is refused. |
| `fail_closed_on_restore_error` | `0` | The boot is fail-closed on every branch. Accepting `0` and ignoring it is how an operator finds out mid-incident that it never applied. |
| `watermark_write_mode` | anything but `synchronous` | A batched watermark can be lost on exactly the roll it exists to survive. |
| `allow_env_secrets` | `1` | Reserved; `env://` refs are refused. The key exists so the refusal is explicit rather than a silent miss. |

Other keys worth knowing at install time: `restore_on_start` (default `1`),
`readiness_gate` (`1` — refuses Scheduled Asks until the restore finishes),
`write_through` (`1` — object store first, and the caller fails if it refuses),
and `restore_timeout_seconds` (`600`; exceeding it is `degraded`, never a partial
restore).

### 12.4 Credentials that survive the rebuild (SL3)

By default, credentials live in Splunk's `storage/passwords` — which is on the
disk that the rebuild destroys. Point them at **AWS Secrets Manager** instead:

```ini
[stateless]
secrets_backend = aws_secrets_manager
secrets_prefix  = adjutant/
```

Then, anywhere the UI asks for a credential, give it a **reference** instead of a
value: `awssm://adjutant/my-env/anthropic-key`, optionally with `#field` to pick
one key out of a JSON secret and `@version` to pin a version. Splunk's own store
still works — `splunk://realm:name` — and remains the default.

| Key | Default | Effect |
|---|---|---|
| `secrets_backend` | `none` | `aws_secrets_manager` turns `awssm://` on. Nothing else in this block does anything while it is `none`. |
| `secrets_write` | `app` | `app` lets the UI store a credential; `operator` accepts only refs it can resolve and needs no write permission at all. **Neither can delete** — a rotation is a new version. |
| `storage_passwords_policy` | `allow` | `refuse` stops credentials resolving from Splunk's store. Refused at boot when `secrets_backend = none`, since that would leave no store at all. |
| `secret_cache_ttl_seconds` | `300` | How long a resolved secret is held in memory. Without it, every Ask makes an AWS round trip per credential. Dropped on rotation. |

The IAM policy for the instance role needs `secretsmanager:GetSecretValue` (and
`PutSecretValue` + `CreateSecret` if `secrets_write = app`), scoped to
`secrets_prefix`. `tools/verify_secrets_store.py` proves the whole path against
the real account before you trust it.

### 12.5 Proving it actually works

Do not accept a green boot as proof. The test that counts is: **enable it, let a
Scheduled Ask run, destroy the instance, rebuild it from the image, and check
that the watermark did not reset and the integration did not re-emit.** A restore
that quietly starts from zero looks identical to a healthy first run until
duplicates land downstream. [The stateless operation guide](./stateless.md), §13, has
the full verification, including
what to check in the bucket before Adjutant ever touches it.

## 13. Uninstall

```bash
$SPLUNK_HOME/bin/splunk remove app itmip_ai_splunk_assistent_app -auth admin:<pw>
$SPLUNK_HOME/bin/splunk restart
```

KVStore collections, `storage/passwords` entries, and the saved alert
created by the License tab are removed along with the app. The license
must be re-activated to re-install on a fresh environment if the same
key has hit its `maxNoOfMachines` cap.

> **Note on KVStore backup indexes.** `itmip_snapshots` and
> `itmip_changes` are NOT automatically deleted on uninstall —
> Splunk leaves indexes in place by design. If you want to reclaim
> the disk and you are sure you never need to restore, delete them
> manually with:
>
> ```bash
> $SPLUNK_HOME/bin/splunk clean eventdata -index itmip_snapshots
> $SPLUNK_HOME/bin/splunk clean eventdata -index itmip_changes
> ```
