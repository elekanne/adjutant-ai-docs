---
sidebar_position: 15
---

# Auditing — what Adjutant AI logs, and how to configure real audit logging

**App version:** 2.5.9
**Last updated:** 2026-09-22
**Audience:** Splunk admins provisioning audit logging, and the auditors who read it.

Audit logging is an **Enterprise** feature. Below that tier an Org cannot be
given an audit index, so nothing is recorded beyond the usage telemetry in §2.

---

## 1. Purpose

Adjutant AI can send the content a user types — and the objects they attach — to a **third-party LLM outside your Splunk boundary**. Real audit logging exists so that, if a user discloses business- or personal-sensitive data to a public LLM, your organisation can prove **who** did it, **what** they sent, **to which LLM**, **when**, after **what consent**, and **how often**. The aim is to show a disclosure was a **user action taken after an explicit warning** — not a fault of the software.

This document covers (a) what is logged **today**, and (b) the **indexes you must provision** and the **choices you must make** to turn on the full audit.

> **Licence requirement (v1.4.1): real audit logging is an Enterprise feature.** It was Professional+ in 1.3.0–1.4.0; from v1.4.1 it is gated by the per-feature **capability matrix** as `audit_logging` = **Enterprise**. The gate is **automatic and server-authoritative**: the effective licence tier resolves to a `capabilities` map (`GET /services/itmip_llm/license`), and the audit write path is gated at **`bin/itmip_llm_tenancy.py`** (the audit gate). The **Audit tab auto-hides below Enterprise** in the UI, and the per-Org **Audit logging** config section (§6) is only offered when the tier includes `audit_logging`. Below Enterprise no audit events are written. (Downgrade hides/refuses — it never deletes already-written audit events in the index; those persist per the index's own retention.) See the architecture overview, §3.14 and the rights and roles reference, §2a for the matrix.

---

## 2. What Adjutant AI logs today

| Signal | Where | Retention | Notes |
|---|---|---|---|
| **Token & cost usage** | metrics index (macro `ai_assistant_metrics_index`, default `main`), `sourcetype=ai_assistant_usage` | operator-set | Fields: `ai_user`, `ai_model`, `ai_provider`, `ai_org`, `ai_bu`, `ai_llm_name`, `ai_app`. **No prompt/answer content, no playbook, no consent.** Surfaced in the **Tokens & Costs** tab. |
| **Conversation history** | `itmip_user_history` (KVStore) | user-deletable | Per-user: question text, playbook name, the LLM's reasoning, attachment names, artifacts. **The History tab is per-user — an admin cannot read another user's history through the app.** Writes are mirrored to `itmip_changes`. |
| **KVStore changelog** | `itmip_changes` index, `sourcetype=itmip:kvstore:change` | **60 days** | Every create/update/delete on tracked collections (playbooks, tools, MCP, configs, orgs, history, …) with `before`/`after`. Built for **KVStore restore**, not legal hold. |
| **Daily KVStore snapshots** | `itmip_snapshots` index | 24 months | Point-in-time backups. |
| **Custom / MCP tool calls** | `itmip_llm_custom_tool_calls` (KVStore) | — | `tool_name`, `user`, `status`, `duration`, args **hash**. **Built-in tools are not** individually logged. |
| **Playbook / skill authoring** | `itmip_authoring_changes` (KVStore) | — | create/update/promote/delete, by_user, by_role. |

**Gaps that real audit logging (v1.3.0) closes:** no admin-readable record of *who sent what to which LLM*; no prompt/answer content in a long-retention, access-controlled store; the **SECURITY CONFIRMATION acceptance is not persisted at all**; cost metrics carry no playbook; the richest record (`itmip_changes`) is only 60 days.

---

## 3. What real audit logging adds

A **per-Org audit index** receiving structured events (`sourcetype=itmip:ai:audit`, one JSON event per line). Event families:

| `event_type` | When | Answers |
|---|---|---|
| `llm_request` | **before** each LLM call (the disclosure) | who, which playbook, the user's answers/prompt (at the configured fidelity), attachment names, provider+model+endpoint host, consent timing+status, time |
| `llm_response` | on completion | the LLM's answer, tokens, cost, duration, outcome |
| `consent_acceptance` | when the user accepts the SECURITY CONFIRMATION | who accepted, when, which warning version, for which LLM |
| `governance_change` | on any playbook/tool/MCP/config/org change | who changed what (secrets redacted), before→after |
| `upload` | (future) when content is uploaded for a use case | filename, hash, bytes |
| `audit_config` | index bootstrap / health pings | excluded from all analytics |


---

## 4. Indexes you must provision (per Org)

**Adjutant AI never creates indexes.** You provision the index, then enter its name in the Org config (**Orgs & BUs → edit Org → Audit index**). The index name is **mandatory for every new Org**; **DFLT is not auto-configured** — until you set it, DFLT does no real audit logging.

### 4.1 On-prem (Splunk Enterprise)
Use an **internal** (underscore-prefixed) index per Org so it is excluded from default search:

```ini
# $SPLUNK_HOME/etc/.../indexes.conf  (operator-managed — NOT shipped by Adjutant AI)
[_itmip_audit_DFLT]
homePath   = $SPLUNK_DB/_itmip_audit_DFLT/db
coldPath   = $SPLUNK_DB/_itmip_audit_DFLT/colddb
thawedPath = $SPLUNK_DB/_itmip_audit_DFLT/thaweddb
# Retention > 24 months — set to your legal-retention policy. 26 months shown:
frozenTimePeriodInSecs = 67392000
```

> **Honest note on the `_` prefix:** an internal index is hidden from **ordinary users** and excluded from `index=*`. It is **not** hidden from a full `admin` — anyone with `admin`/`sc_admin` (or who can edit roles) can grant themselves access. The prefix is a sensible default restriction, not a guarantee against a privileged insider. For protection against a privileged-insider rewrite, forward the index off-box to a WORM store / external SIEM (optional; not required).
>
> **How writes reach an `_*` index (1.3.3+):** Splunk's HTTP event receiver (`receivers/simple`, HEC) **refuses** `_`-prefixed index names ("supplied index … missing"). So for an internal audit index the app writes events via `| collect` instead — the one writer that accepts internal indexes — which adds one lightweight search dispatch per event (audit volume is human-paced, so this is fine). A **normal** (non-`_`) index uses the faster synchronous `receivers/simple` path. Both index styles are fully supported; pick `_*` for automatic admin-only read, or a normal name + a role with `srchIndexesAllowed = <your index>` for the same effect. (Before 1.3.3 the writer only used `receivers/simple`, so an `_*` audit index silently received **no** data — check `index=_internal source=*itmip_llm_audit.log*` for any write failures.)
>
> **⚠️ `_*` audit index + `| collect` — coverage limit (fixed-honestly in 1.5.0).** `| collect`'s destination-index check uses the dispatching role's **own** `srchIndexesAllowed`, ignoring *imported* allowances. The `passSystemAuth` identity `splunk-system-user` has an **empty own** list (it gets `_*` only by import), so a system-token `| collect` into a `_*` index **silently mis-routes** the event to a fallback internal index **and still returns HTTP 200** — the data lands in the wrong place and never appears in the Audit tab (this was the cause of empty `outcome`/token columns before 1.5.0). The 1.5.0 writer now **verifies each event landed in the intended index** (it parses the collect result and reads the event back, instead of trusting the HTTP code), **falls back to the caller's own token** when the system token can't reach a `_*` index (so admins / granted auditor roles still write), and reports an honest `logged:false` (with a reason in `itmip_llm_audit.log`) rather than a false success. **Consequence:** with a `_*` audit index, only callers whose **own** role grants `_*` (admins, or an auditor role you grant `_*`) get their turns written; a regular non-admin's `browser_direct` turn reports `logged:false` (lost under `best_effort`, blocked under `enforce`). **To capture EVERY user's turns, set the Org's audit index to a normal (non-`_*`) index** — `receivers/simple` + the system token writes for all users regardless of their search-index ACL — and control *read* access with the index role ACL + the per-Org auditor role (role examples below).

### 4.2 Splunk Cloud
Customer `indexes.conf` and internal (`_`) indexes are not available. Create a normal index via **ACS / the Cloud index UI**, e.g. `itmip_audit_acme`, then enter that name in the Org config. Follow Cloud index naming: **lowercase**, **must not contain `kvstore`**, and set **retention on the index** (no `maxTotalDataSizeMB` in app conf). Restrict access by role (§5).

### 4.3 Retention
**Set retention to > 24 months** (your legal-retention policy; confirm the figure with counsel) **on the index** — on-prem via `frozenTimePeriodInSecs`, on Cloud via ACS. Adjutant AI cannot enforce retention; it relies on Splunk.

---

## 5. Access model — and defining an auditor

Reads run **as the logged-in user**, so **Splunk's native index ACL is the access boundary** — the Audit dashboard only ever shows what the user's role can already search.

- **`(sc)admin`** (`admin` / `splunk_admin` / Cloud `sc_admin`) can search every audit index → audit any Org.
- A **customer-defined auditor role** sees only the Org index(es) you grant it. **You** create the role (any name) and grant it search access; Adjutant AI does not invent it.

### 5.1 Create an auditor role (on-prem example)
```ini
# authorize.conf (operator-managed)
[role_aiworkbench_auditor_dflt]
srchIndexesAllowed = _itmip_audit_DFLT
srchIndexesDefault =
importRoles = user
# Internal indexes need explicit allow; this role gets ONLY the DFLT audit index.
```
On Cloud, create the equivalent role via the Roles UI / ACS and grant it the audit index.

### 5.2 Who can open the Audit tab

**Today the Audit tab is administrators only.** It appears when the caller holds
an admin role *and* the licence includes `audit_logging` (Enterprise). Below
Enterprise it is hidden from everyone, administrators included.

In the Org config you can also set **Audit role patterns**. That field is stored
and returned, and is intended to let a named auditor role open the tab — but
**per-Org auditor tab visibility is not yet implemented**, so setting it does not
currently give a non-admin the tab.

Until it is, give your auditor the Splunk role from §5.1 and let them query the
audit index directly with SPL. They will see exactly the data their role's index
permissions allow, which is the same boundary the tab would enforce.

---

## 6. Choosing the content mode (mandatory, per Org)

Each Org must pick **how much of the user's input** (their playbook answers, or the whole prompt when no playbook is used) is stored per turn. **Attachment/object names are always logged regardless of mode** (names only, never their content).

| Mode | Stores | Evidence strength | Data-protection exposure |
|---|---|---|---|
| `metadata_only` | user, model, playbook, timestamp — **no input body** | weakest | lowest |
| `prompt_hash` | SHA-256 of the input | prove a *suspected* text matches | low |
| `truncated_prompt` | first 200 chars + hash | partial | medium |
| `full_prompt` | the verbatim input + hash | strongest | **highest** |

> **There is no default — you choose per your DPIA.** `full_prompt` gives the strongest legal evidence but stores verbatim, un-redacted, potentially special-category personal data for >24 months. That is a significant data-protection posture and a lawful-basis/retention decision for your DPO and counsel — not a setting to max out by reflex. Adjutant AI deliberately does **not** pre-select `full_prompt`.

> **DPIA acknowledgement gate.** You **cannot save** an Org with `full_prompt` until you tick the **"We have assessed lawful basis + retention for storing full prompt content, per our DPIA"** checkbox. Ticking it is itself recorded in the audit (a `governance_change`), so there is a durable record that your organisation made the call. The lighter modes need no acknowledgement.

---

## 7. Running an audit

Open the **Audit** tab (administrators — see §5.2). Filter by **user**, **time**, **LLM provider/model**, **playbook**, **outcome**, and a **wildcard over the prompt/response** (only meaningful in `truncated_prompt`/`full_prompt` modes). Views: activity timeline (request↔response, with an **assurance** marker), frequency ("how often"), consent log, governance log, and **CSV export** for legal hand-off.

Ad-hoc SPL (run as a user whose role can read the index):
```spl
index=_itmip_audit_DFLT sourcetype=itmip:ai:audit event_type=llm_request actor_user="alice"
| table ts_request actor_user template_ref.name provider_kind model endpoint_host
        consent_status audit_content_mode user_input_full user_input_sha256 attachments{}.name
```
> Operational events (`event_type=audit_config`) and config changes (`governance_change`) are **excluded** from the activity/frequency views, so admin index maintenance never inflates a user's disclosure counts.

---

## 8. Operational dependency & assurance

- **Auditing relies on Splunk.** If an Org's audit index is missing or unhealthy and the Org is in **`enforce`** mode, **LLM turns are blocked by design** (fail-closed) rather than running un-audited. Keep the index healthy.
- **`enforce` ⇒ `splunk_proxy` only.** Enforced auditing is **server-mediated**: the proxy writes the audit record before it calls the AI service, so a turn cannot reach the provider without being audited — including one driven straight at the REST endpoint rather than through the UI. Enforced Orgs therefore require a `splunk_proxy` connection; `browser_direct` is refused.
- **Consent is server-verified.** A turn's recorded consent is `confirmed` only when the server matched a stored acceptance event; otherwise it is flagged `client_asserted_unconfirmed`.

---

## 9. Retention, immutability & data protection (read before enabling)

- **Immutability is layered, claimed honestly:** the app is append-only (no edit/delete path), the index ACL is restricted, and an integrity hash-chain detects **accidental** gaps/edits. The hash does **not** defend against a malicious privileged admin who can write to the index — only an **off-box WORM/SIEM copy** does, which is an **optional operator choice**, not built in or required.

> **One nuance about the hash-chain.** Each event links to the previous one, and
> the running end of that chain is held in memory by the process that wrote it. A
> search head serves requests from several worker processes and restarts them from
> time to time, so in practice there is **one chain per worker, not one per index**.
> A break at a process boundary is indistinguishable from a restart. That is fine
> for the purpose — spotting accidental loss or corruption — and it is another
> reason the chain is not a defence against a deliberate edit.

- **You are the data controller; ITMIP is the software vendor.** When you run Adjutant AI in **your own** Splunk, configure the audit yourself, and ITMIP has **no access to your environment or the audit data**, ITMIP is — for that self-hosted model — most likely **outside the processing relationship entirely** (neither controller nor processor). ITMIP provides the mechanism and safe defaults; **you** decide content mode, retention, lawful basis, and the privacy notice per your **DPIA**. Adjutant AI can only ever record what *you* configured it to record. Storing verbatim prompts (`full_prompt`) for >24 months is a controller decision with real GDPR weight — involve your DPO/counsel before enabling it broadly. (Confirm the precise roles with your own counsel; a managed/SaaS deployment would change the analysis.)

---

## 10. See also
- [the admin manual](../admin-manual.md) — step-by-step provisioning + Org configuration.
- the architecture overview — where audit events flow.
- the rights and roles reference — admin vs auditor.
