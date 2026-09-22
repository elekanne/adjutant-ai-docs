---
sidebar_position: 1
---

# Domain Workspace — Administrator Manual

For the Splunk administrator who installs, configures, operates and
troubleshoots a Domain Workspace.

Every command here is run by you, on your own instance. The app makes no
outbound calls of its own.

---

## Contents

1. [What you are installing](#1-what-you-are-installing)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Configuration reference](#4-configuration-reference)
5. [Provisioning indexes](#5-provisioning-indexes)
6. [Roles and who sees what](#6-roles-and-who-sees-what)
7. [Publishing a Domain Model](#7-publishing-a-domain-model)
8. [The Inspector](#8-the-inspector)
9. [Drift](#9-drift)
10. [The health run](#10-the-health-run)
11. [Scheduled objects](#11-scheduled-objects)
12. [Data quality](#12-data-quality)
13. [Customer overlays](#13-customer-overlays)
14. [Proving the installation works](#14-proving-the-installation-works)
15. [The demo domain](#15-the-demo-domain)
16. [Search head clusters](#16-search-head-clusters)
17. [Licensing](#17-licensing)
18. [Security posture](#18-security-posture)
19. [Troubleshooting](#19-troubleshooting)
20. [Command reference](#20-command-reference)

---

## 1. What you are installing

Three apps, with distinct jobs. Keep the distinction clear — it explains most
of the operational behaviour below.

| App | Role |
| - | - |
| **Adjutant AI platform** (`itmip_ai_splunk_assistent_app`) | Carries every server-side component: the REST handler, tenancy, licensing, audit, the alert actions. **Required.** |
| **Domain Workspace engine** (`itmip_adjutantai_domain_workspace`) | The browser application and the configuration specs. **Ships no Domain Model.** |
| **A content app** | Carries one Domain Model: its seed document, its registry entry and its view. The bundled demo is `itmip_adjutantai_domainworkspace_demo`. |

The engine app contains no domain content and the content app contains no
engine code. That split is what lets a model be updated without an engine
release, and vice versa.

---

## 2. Prerequisites

| Requirement | Detail |
| - | - |
| **Splunk Enterprise 9.4 – 10.x** | Declared in the app manifest. Older versions are not supported. |
| **Licence** | Adjutant AI **Enterprise** tier. See §17. |
| **KVStore** | Running. The workspace stores sessions, receipts, evidence manifests and report state there. |
| **An evidence index** | Only if you want evidence snapshots. You create it; the app ships no `indexes.conf`. See §5. |
| **An audit index** | Only if you want the report ledger. Same. |
| **A data index** | Whatever your Domain Model reads from. |
| **Roles** | The roles your Domain Model names. See §6. |

**The app deliberately creates no indexes.** Storage and retention are your
policy, not the vendor's. Where an index is missing, the feature that needs it
refuses by name rather than failing quietly or inventing a destination.

---

## 3. Installation

1. Install the **platform app** and the **engine app** by your normal method —
   Splunk Web, `$SPLUNK_HOME/etc/apps`, or your deployment tooling.
2. Install a **content app** carrying a Domain Model.
3. Restart Splunk (both apps ship REST handlers and scripted inputs).
4. Confirm the workspace loads:

   ```
   https://<your-splunk>/en-GB/app/<content-app>/workspace
   ```

If the page loads and refuses with a named message, that is the product working
— read the message. §19 lists what each one means.

---

## 4. Configuration reference

Two configuration files, in two apps. Both are read **merged**, so a value set
through the REST configuration endpoint replicates across a search head cluster.

### 4.1 `adjutant_workspace.conf` — in the engine app

```ini
[demo_data]
default_index = ddd_cycles
```

| Setting | Meaning |
| - | - |
| `[demo_data] default_index` | The index the demo events are ingested into, and that the demo model's searches read. Default `ddd_cycles`. The index must already exist — ingest refuses otherwise and never creates one. |
| `[demo_source:<sourcetype>] index` | Optional per-sourcetype override, for splitting demo data across indexes. |

### 4.2 `itmip_ai_workbench.conf`, `[workspace]` stanza — in the platform app

| Setting | Type | Meaning |
| - | - | - |
| `evidence_index` | string | Where evidence snapshot rows are written. **Empty by default**; snapshots are refused by name until it points at an index that exists. A snapshot written nowhere is worse than one never taken, because only the second is visibly missing. |
| `service_account` | string | Splunk username the health run executes as. Its password must be in `storage/passwords` under realm `itmip_ai_service_account`. When set and unusable, the health run **refuses by name** — it never silently falls back to admin. Empty: the health run runs as the calling admin and records that honestly. |
| `field_probe_sample` | integer | How many recent events per sourcetype the health run samples when measuring field presence. Clamped 100–10000, default 1000. A share of 0 always means "absent in the sampled window", never a census. |
| `deploy_tier` | `customer_managed` \| `splunk_cloud` | Orders data-quality remediation proposals by what you can actually execute. Empty: detected from the instance, which is reliable — set it only for ambiguous deployments. |

### 4.3 Setting configuration across a cluster

Use the configuration REST endpoint rather than editing files on one member:

```bash
curl -k -u admin \
  https://<splunkd>:8089/servicesNS/nobody/itmip_adjutantai_domain_workspace/configs/conf-adjutant_workspace/demo_data \
  -d default_index=<your index>
```

**Never edit `default/` in place** — an app upgrade replaces it. Use `local/`
or the endpoint.

---

## 5. Provisioning indexes

Create these yourself, with retention set to your policy.

```ini
# indexes.conf — in an app you control, not in the product apps
[adjutant_evidence]
homePath   = $SPLUNK_DB/adjutant_evidence/db
coldPath   = $SPLUNK_DB/adjutant_evidence/colddb
thawedPath = $SPLUNK_DB/adjutant_evidence/thaweddb
frozenTimePeriodInSecs = 220752000   # 7 years — set to YOUR retention policy
```

Then point the workspace at it:

```ini
# itmip_ai_workbench.conf, in local/
[workspace]
evidence_index = adjutant_evidence
```

**Evidence outlives its source data by design.** That is the point of a
snapshot — the source events may age out, and the frozen evidence must not.
Set retention accordingly, and restrict the index's read ACL to the people
entitled to see sealed evidence.

---

## 6. Roles and who sees what

The **Domain Model** decides which roles open on which perspective, and which
may switch. The **roles themselves are yours to create** — a fresh instance has
none of them, which is why a brand-new account sees one perspective and cannot
switch.

Each perspective declares `entry_roles` (this is your home view) and
`switchable_roles` (you may switch into it). A viewer holding none of them is
not broken: they land on the model's business perspective with nowhere to
switch.

For the bundled demo model there is a helper that reads the roles **out of the
model** rather than hardcoding them:

```bash
# See what the model expects, change nothing
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py --dry-run

# Create any missing roles, with search access to the demo and evidence indexes
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py

# Also hand the suggested role to each demo account that exists
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py --assign

# Grant a specific user a specific role
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py \
    --grant alice=ddd_fraud_ops
```

Options: `--url`, `--user`, `--password-env`, `--index`, `--evidence-index`,
`--assign`, `--grant USER=ROLE[,ROLE]` (repeatable), `--dry-run`.

Roles take effect at the viewer's next page load. No restart.

**Authority is separate from visibility.** A role may open every perspective and
still not be a Splunk admin — in which case the Inspector opens, but
materialize, health refresh and overlay saves refuse it by name. That separation
is deliberate: seeing the administration surface is not permission to change the
model.

---

## 7. Publishing a Domain Model

**Import** happens automatically. When a viewer opens a workspace, the handler
reads the model registry, and imports the model's seed document if the stored
copy is absent or its version differs.

**The registry's `content_version` is the authority.** A model edited without
bumping that version is **not** re-imported — version-equal imports are never
repeated. When you change a model, bump the version in all three places that
must agree:

| File | Field |
| - | - |
| the model document | `model.content_version` |
| `domain_models.conf` | `content_version` |
| the content app's `app.conf` | `version` |

**Materialize** converts the model into Splunk objects. Run it from the
Inspector. It is a convergence: run it twice and the second run reports
everything `unchanged`, never a flattering "updated".

Statuses: `created`, `updated`, `unchanged`, `drifted`, `repaired`, `failed`.

---

## 8. The Inspector

The Inspector tab appears only on an administration perspective.

It lists every part of the model with its content hash, its layer (vendor or
customer), what it depends on and its measured verdict — with expandable SPL,
parameters and dependency detail.

From it you can:

| Action | Requires | Effect |
| - | - | - |
| **Materialize** | Splunk admin | Converge the model into saved searches and scheduled objects. |
| **Health refresh** | Splunk admin | Re-probe the estate, re-measure data quality and field presence, prune stale projections. |
| **Repair drift** | Splunk admin | Restore one hand-edited object to what the model declares. |
| **Save overlay** | Splunk admin | Edit a part of the model as customer content. See §13. |
| **Delete overlay** | Splunk admin | Revert to the untouched vendor version. |

---

## 9. Drift

**Drift is when a materialized Splunk object no longer matches the model.**
Somebody edited a `ds_*` saved search by hand, or deleted one.

The workspace **reports drift and leaves it in place.** It never silently
corrects you — your edit may have been deliberate, and overwriting it without
asking would be the wrong default. The Inspector shows the item as *drifted*,
and **Repair drift** is a button you press.

Enabling or disabling a scheduled object is **not** drift. That is your state,
and the workspace never touches it.

---

## 10. The health run

The health run re-measures what the model stands on:

- re-probes the estate — which indexes, sourcetypes, lookups, eventtypes and tags actually exist;
- re-resolves each panel's dependencies into verdicts (`available`, `degraded`, `blocked_not_onboarded`, `blocked_permission`, `unknown`);
- runs the data-quality measurement (§12);
- samples field presence for the model's bound fields;
- prunes stale cached projections.

**Run it manually** from the Inspector, or **enable the scheduled trigger**
(§11).

**Execution identity matters and is recorded.** With `service_account`
configured the run executes under that minted session. Without it, the run
executes as the calling admin. Either way, *who ran it* is recorded and shown on
the About tab — so a coverage figure can always be traced to the identity that
measured it.

---

## 11. Scheduled objects

Materialization creates three kinds of object:

| Object | Name | Shipped |
| - | - | - |
| Governed searches | `ds_<model>__<item>` | Enabled — these are what panels invoke. |
| Report triggers | `adw_rpt_<model>__<definition>` | **Disabled** |
| Health trigger | `adw_health_<model>` | **Disabled** |

**The scheduled ones ship disabled on purpose.** Putting load on your search
head is your decision, taken deliberately, not a side effect of installing an
app.

To enable one: Settings → Searches, reports and alerts → find the object →
enable. Or:

```bash
curl -k -u admin -X POST \
  https://<splunkd>:8089/servicesNS/nobody/<content-app>/saved/searches/adw_health_<model> \
  -d disabled=0
```

Schedules come from the model — for example a daily report at `0 6 * * *` and a
health run at `30 5 * * *`. Racing triggers are safe: two ticks of the same
report produce one run and an honest "skipped, overlap" for the other.

---

## 12. Data quality

The workspace measures something most monitoring does not see: **fields lost at
search time even though the raw event survived intact.**

Large events can exceed the effective extraction limit, so fields near the end
of the raw are never parsed. Nothing logs this. Ingest monitoring shows green.
The dashboard quietly loses a field on exactly the largest events.

The measurement:

- reads your **live effective limits** over REST — never shipped defaults;
- profiles raw-length distribution per source;
- for each declared critical field, compares extraction success for events under the limit against events over it, and checks whether the field is nonetheless present in the raw tail.

Verdicts: `extraction_truncated`, `ingest_truncated`, `at_risk`,
`limits_changed`, `not_applicable_index_time`.

**Remediation is ordered by what you can execute.** On a self-managed
deployment, raising the extraction limit leads. On Splunk Cloud it comes last,
with the honest note that it is a support request — proposing a remedy you
cannot perform wastes your time.

**The measurement refuses rather than guessing.** If the raw is already cut at
ingest, the correlation test would lie, so it is refused and recorded as
refused. If the effective limit cannot be read at all, the same. *Unknown is not
clean.*

---

## 13. Customer overlays

You can change parts of a vendor-supplied model without forking it. An overlay
is copy-on-write: the vendor's version is never mutated, your version is served
instead, and deleting the overlay reverts.

**SPL changes are refused by name.** An overlay may change presentation,
labelling and declarations — not the search behind a governed panel. That
boundary is what keeps the assurances meaningful.

Overlays survive a vendor model upgrade.

---

## 14. Proving the installation works

The product ships its own end-to-end test. It runs against a **live instance
over REST as a real user** — not mocks.

```bash
SPLUNK_PASSWORD='…' python3 bin/adw_selftest.py
```

Expect `30 checks, 0 failed` in version 0.2.0. The number of checks grows as
the product gains them, so a higher count on a later release is normal —
`0 failed` is the part that matters.

| Option | Purpose |
| - | - |
| `--url` | splunkd management URL (default `https://localhost:8089`). |
| `--user` | Splunk user to run as. |
| `--password-env` | Environment variable holding the password. Prompts if unset. |
| `--app` | The app hosting the model's binding. |
| `--model` | The Domain Model id to test. |
| `--goldens` | Path to `golden_answers.json` for exact-value comparison. |
| `--with-limited-viewer` | **Dev and demo instances only.** Creates a restricted role and user to prove per-viewer permission verdicts. Do not use in production. |

Among other things it proves that materialization converges, that drift is
reported and not corrected, that a forged receipt is refused, that a request
cannot widen a search's scope, that browser-supplied rows are refused as
evidence, and that report findings keep their identity across runs.

Run it after installation, after an upgrade, and whenever something looks wrong
— it localises a fault faster than reading logs.

---

## 15. The demo domain

The bundled demo is a fictitious bicycle retailer that also lends money. It
exists so you can see a working workspace before committing a model of your own.

**Set it up:**

```bash
# 1. Create the index the demo reads (yours to create)
#    e.g. ddd_cycles

# 2. Generate the events (deterministic, from a fixed seed)
python3 testdata/ddd_cycles_demo_data/generator/generate.py

# 3. Ingest them, and install the lookups and props
SPLUNK_PASSWORD='…' python3 bin/adw_demo_ingest.py \
    --data testdata/ddd_cycles_demo_data

# 4. Create the roles the model expects
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py --assign

# 5. Prove it
SPLUNK_PASSWORD='…' python3 bin/adw_selftest.py
```

`adw_demo_ingest.py` options: `--data` (required), `--url`, `--user`,
`--password-env`.

### The demo's defects are deliberate

Three things in the demo are **wired to be wrong**, because the product's job is
to catch them. Do not "fix" them:

1. **Extraction truncation** on the gateway feed — large events lose trailing fields past the limit, measured at around 4% of events.
2. **A feed that was never onboarded** — so a panel is honestly blocked, with the onboarding route, rather than empty.
3. **An ingest-truncated source** — on which the data-quality test refuses to run, because it would lie there.

One configuration detail matters: the gateway sourcetype needs a raised
`TRUNCATE` (the demo props set it). Without it, Splunk's default truncates at
ingest and the extraction demonstration becomes an ingestion one.

---

## 16. Search head clusters

- Model content lives in KVStore and replicates normally.
- Materialization writes through the **captain**, so objects replicate rather than landing on one member.
- Publishing takes a per-model lease; a second concurrent publisher is refused with a conflict rather than interleaving.
- Configuration set through the REST endpoint replicates; files edited on one member do not.

**Honest limitation:** captain routing and write verification are implemented
and unit-tested, but the two-member acceptance test has not been executed on a
real cluster. Treat a first cluster deployment as something to verify with the
self-test rather than assume.

---

## 17. Licensing

The Domain Workspace is an **Enterprise-tier capability** of Adjutant AI. The
platform is included in that tier, not a separate purchase.

- Enforcement is **server-side on every operation**, and **fail-closed**: any licence resolution error denies rather than grants.
- UI lock states are cosmetic. A direct REST call meets the same refusal.
- **A lapsed licence suspends access and retains all work.** Sessions, overlays, evidence, report items, claims and notes are untouched and return when the licence does.
- **Activation** contacts the licensing service once, from the administrator's browser by default — which is why air-gapped search heads work. **There is no runtime licence call**; every check afterwards reads a locally stored, signed licence.

Unlicensed, the workspace refuses with:

> The Domain Workspace requires the Enterprise 'interactive_ui' entitlement.

---

## 18. Security posture

| Property | Behaviour |
| - | - |
| **Search execution** | Every interactive search runs **as the viewer**, under their Splunk RBAC. Not as a service account, not through an owner-context shortcut. |
| **SPL assembly** | Searches are assembled **server-side** from typed parameters. The browser never builds SPL, and free text structurally cannot reach a search. |
| **Receipts** | A result becomes a record only if the job's actual search string matches a receipt the server issued to that user. A mismatch is refused and audited. |
| **Scope** | The index a governed search reads comes from server-side context. A request that tries to set it is refused by name. |
| **Evidence** | Computed by the server from the job. Rows, hashes or claims supplied by a browser are refused by name. |
| **Storage** | The workspace's KVStore collections are readable only by administrators; every legitimate read goes through the handler, which knows who is asking. |
| **Audit** | Every operation emits an audit event, refusals included. |
| **Egress** | The workspace app makes no outbound calls. No telemetry, no phone-home, no external fonts or scripts. |

**One thing to know:** output-side masking of sensitive fields is **not
implemented**. If your Domain Model surfaces identifiers such as account
numbers, they appear in panels, CSV exports, workbook exports and evidence
snapshots in full. Control that with index permissions and by what the model's
searches select — not by an assumption that the workspace redacts. Input-side
protection does exist: values marked sensitive are never accepted from a URL and
render masked in filter chips.

---

## 19. Troubleshooting

| Symptom | Cause | Fix |
| - | - | - |
| Page loads, then "The workspace could not start — HTTP 404" | The platform app is missing or its handler is not registered. | Install the platform app; restart Splunk. |
| "requires the Enterprise 'interactive_ui' entitlement" | Licence tier below Enterprise, expired, or node-lock mismatch. | Check the licence; expiry downgrades the effective tier. |
| Every panel shows **Blocked: no permission** | The viewer's roles cannot search the index. | Grant the role search access. Expected for a viewer with no model roles. |
| One panel shows **Blocked: `<feed>` is not onboarded** | That data is genuinely absent. | The message carries the onboarding route. |
| A panel shows **? Unverified** | The dependency check could not decide — typically an estate snapshot older than a feature, or an unresolvable macro. | Run a health refresh. |
| **Snapshot refused** | `[workspace] evidence_index` is unset or points at a missing index. | §5. |
| **Verify** says "could not read the evidence back" | The evidence is indexed but not yet searchable. | Wait a few seconds and retry. **This is not a mismatch.** |
| Report tab says the audit index is not configured | No audit index for this Org. | Configure one, or accept the ledger being unavailable — it says so honestly. |
| Health run refuses naming the service account | `service_account` is set but cannot be minted. | Fix the stored credential, or clear the setting to run as the calling admin. |
| Model changes do not appear | The registry `content_version` was not bumped. | §7 — version-equal imports are never repeated. |
| Stale interface after an upgrade | Browser cached the old bundle. | Hard reload. The loader cache-busts its manifest, so a normal reload usually suffices. |
| A `ds_*` search reads *drifted* | Someone edited it by hand. | **Repair drift** in the Inspector — or keep the edit, deliberately. |

### Where to look

- **Splunk log:** `index=_internal sourcetype=splunkd component=*itmip*`
- **Workspace audit events:** in your configured audit index — including refusals, which carry a named cause.
- **The self-test** (§14) localises a fault faster than log reading.

---

## 20. Command reference

All commands run from the engine app's directory.

```bash
# Prove the installation end to end
SPLUNK_PASSWORD='…' python3 bin/adw_selftest.py
SPLUNK_PASSWORD='…' python3 bin/adw_selftest.py --app <app> --model <model>
SPLUNK_PASSWORD='…' python3 bin/adw_selftest.py --goldens <path>/golden_answers.json

# Demo data
python3 testdata/ddd_cycles_demo_data/generator/generate.py
python3 testdata/ddd_cycles_demo_data/generator/verify.py
SPLUNK_PASSWORD='…' python3 bin/adw_demo_ingest.py --data testdata/ddd_cycles_demo_data

# Roles
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py --dry-run
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py --assign
SPLUNK_PASSWORD='…' python3 tools/setup_demo_roles.py --grant <user>=<role>

# Configuration across a cluster
curl -k -u admin \
  https://<splunkd>:8089/servicesNS/nobody/<app>/configs/conf-adjutant_workspace/demo_data \
  -d default_index=<index>

# Enable a scheduled object
curl -k -u admin -X POST \
  https://<splunkd>:8089/servicesNS/nobody/<app>/saved/searches/<name> \
  -d disabled=0
```

Every tool accepts `--url`, `--user` and `--password-env`, and prompts for a
password if none is supplied. **No tool takes a password on the command line**,
so credentials do not land in your shell history.
