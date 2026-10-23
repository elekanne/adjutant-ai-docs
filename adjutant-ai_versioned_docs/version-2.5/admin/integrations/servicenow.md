---
sidebar_position: 12
---

# ServiceNow integration — tools, knowledge, playbooks

**App version:** 2.5.9  ·  **Last updated:** 2026-09-22  ·  **Audience:** Splunk admins,
SOC/ITOps engineers, integrators, security reviewers.

Adjutant AI (formerly AI Workbench) can **read and write ServiceNow** — incidents, security incidents (SIR), changes,
problems, events, and the **CMDB/CSDM** — from the interactive Ask tab **and** from the unattended
backend engine (alert → playbook). It works over two interchangeable per-Org transports (direct
**REST** or a **ServiceNow MCP server**), turns Splunk/ITSI/ES alerts into **rich, well-formatted**
ServiceNow incidents, and writes the incident number **back** to the originating Splunk object.

> **One-line summary.** ServiceNow is reached as an **external system through the Splunk backend**
> (`splunkd` / server-side Python) — the browser holds **no** ServiceNow credential and opens **no**
> outbound connection to the instance. The integration is **per-Org scoped**, gated on **Professional
> + the `servicenow` feature** (MCP rides a `servicenow-mcp` carve-out), and **safe by construction**:
> it can never block the assistant (strict timeouts), never invents schema (it works from a known
> table/field map), allowlists every write, and renders incident descriptions deterministically.

> **Before you rely on it.** Every capability below is built and tested against the documented
> ServiceNow REST, Table and Event Management APIs and the MCP contract. Instance-specific
> behaviour — live reads and writes, CMDB traversal, SIR, MCP, threat-intel enrichment — depends on
> your own instance's tables, plugins and access policies, so verify the connection against your
> ServiceNow before putting it in front of users. **Tools → ServiceNow → Test connection** does
> exactly that, table by table.

---

## 1. What you get

| Layer | What | Licensing |
|---|---|---|
| **Read tools** | `servicenow_get_incidents` / `_get_incident` / `_get_changes` / `_get_problems` — search by CI, support group, or description; human-readable results. | Professional + `servicenow` |
| **CMDB/CSDM tools** | `servicenow_cmdb_list_classes` / `_get_records` / `_describe_table` / `_related` (bounded multi-hop relationship traversal) + a generic allowlisted `servicenow_table_get`. | Professional + `servicenow` |
| **Write tools** | `servicenow_create_incident` / `_update_incident` / `_create_event` / `_cmdb_upsert` — gated, allowlisted, deterministic description. | Professional + `servicenow` |
| **SIR (security incidents)** | `servicenow_get_security_incidents` / `_create_security_incident` / `_update_security_incident` on `sn_si_incident`, with MITRE ATT&CK association. | Professional + `servicenow`, **only when `sir_enabled`** |
| **Knowledge** | CSDM logical→physical map, choice/state code dictionaries, encoded-query grammar, API-failure runbook, relationship-traversal dictionary — so the LLM is *given* the schema, never guesses. | Professional + `servicenow` |
| **Skills** | `servicenow-structured-discipline`, `servicenow-incident-description-authoring`, `servicenow-tisc-enrichment`. | Professional + `servicenow` |
| **Playbooks** | "ServiceNow CMDB Lookup & Enrichment", "ServiceNow Incident / Event Raise", 3 alert-driven incident playbooks + 3 closed-incident override runbooks, and (admin-assigned) 3 SIR security playbooks + 3 SIR override runbooks. | Professional + `servicenow` (security playbooks also admin-assigned) |
| **Transport** | Per-Org: **direct REST** *or* a **ServiceNow MCP server** (Action Fabric / Console-built). Same logical tools either way. | REST → `servicenow`; MCP → `servicenow-mcp` |

---

## 2. The non-negotiable behaviours (and why)

All of these are enforced **in code/config, never by trusting the model**.

- **Never-hang [most important].** A slow or down ServiceNow can never block the Ask loop, the
  browser, or the backend runner. Per-call connect/read timeouts (defaults 5 s / 20 s, conf knobs),
  bounded retries on 429/5xx honouring `Retry-After`, terminal `401/403/404` (no retry-loop), and a
  circuit-aware "skip-and-note" degrade that **lowers verdict confidence rather than failing**.
- **Structured-data discipline.** ServiceNow is a structured platform; the LLM **never invents**
  table names, field names, dot-walk paths, encoded-query operators, or choice codes. Reads go
  through **named query patterns** (the tool builds the query from typed values); a write or
  dot-walk that references a field absent from the resolved release/instance is **refused before the
  API call**.
- **Deterministic incident descriptions.** The LLM emits a *structured content object*; a
  deterministic renderer produces the final plain-text `description` (fixed section skeleton, no
  HTML/Markdown/emoji). A raw LLM paragraph is never sent as a description.
- **Write safety.** CMDB writes hit only an **allowlisted** set of tables (default deny-all) +
  optional per-table field allowlist; `servicenow_cmdb_upsert` **refuses** `incident`/`problem`/
  `change`; unattended writes run only if the trigger's `allowed_actions` permits; **write-target
  binding** stops a crafted alert field from redirecting a write to another record.
- **Server-side only.** Every call is server-side; credentials live in `storage/passwords`.

---

## 3. Per-Org connection (admin setup)

The whole integration is **Adjutant AI-Org scoped** — each Org configures its own ServiceNow in
**Tools → ServiceNow connections** (admin only). One row per Org (optionally per BU) in the
`servicenow_connections` KVStore. An Org with no row never sees the ServiceNow tools
("visible-and-broken is forbidden").

Key settings:

| Setting | Meaning |
|---|---|
| `transport` | `rest` (default), `mcp`, or `none`. |
| `instance_url` | REST instance base, e.g. `https://acme.service-now.com` (or the WebEAM gateway host). |
| `mcp_server_id` | The registered MCP server's id when `transport = mcp`. |
| `credential_model` / `credential_ref` | `global` / `per_tenant` (`servicenow_{org}_{bu}`) / `per_user`; names a `storage/passwords` entry. **You create that entry yourself — exact syntax in [§4.1](#41-storing-the-credential--exact-syntax).** |
| `auth_type` | `basic` / `bearer` (token) / `header` (API key) / `oauth2`. |
| `customer_auth_hook` | Use the shared IAM hook (`customer_authorisation.py`) for WebEAM-style gateways. |
| `csdm_version` | `v3` / `v4` / `v5` — drives which CMDB classes resolve. |
| `write_allowlist` / `write_field_allowlist` | Physical CMDB tables (and optionally columns) `cmdb_upsert` may write. **Default deny-all.** |
| `on_closed_incident` / `closed_lookback_window` | Policy when a re-fire matches a closed incident — `new_linked` (default) / `reopen` / `suppress` — see §7. |
| `sir_enabled` | Advertise the SIR (`sn_si_incident`) tools. |
| `security_playbooks_enabled` + assignment list | Explicitly enable + assign the SIR security playbooks (off by default — §8). |
| `logical_tool_map` | (MCP) logical `sn.*` id → imported MCP tool name (§6). |
| `severity_mapping` | Per-Org override of the Splunk/ITSI/ES severity → impact/urgency mapping. |

Use **Test connection** to validate auth + detect the instance release.

> **Restart note.** Adding the REST route and the `servicenow_connections` collection takes effect
> after a `splunkd` restart + bundle redeploy.

---

## 4. Authentication (WebEAM and others)

Credentials live in `storage/passwords` (realm `itmip_llm_assistent_app`) and never reach the
browser. Supported on the **REST** transport: Basic (service account), static token / API key,
OAuth 2.0 (via the shipped runtime, REST `/oauth_token.do`), and — for IAM-gated instances — the
shared **customer-auth hook** (`customer_authorisation.py`, `target_kind="tool"`), which composes
**on top** of the static credential (hook wins per header; fail-closed on hook failure). See
[the customer authorisation hook guide](../security/customer-authorisation-hook.md).

### 4.0 What to ask the customer for

Hand this section to whoever administers the ServiceNow instance. It is written
to be requested once and satisfied once, because the usual failure is not a
refusal, it is three rounds of "we granted it" followed by the same 401.

**Ask for four things.** An API key alone is not enough, and a key delivered
without the other three will not work.

1. The **instance URL**, for example `https://acme.service-now.com`.
2. An **API key** (or a service account for Basic auth).
3. The key attached to a **service user with the roles below**.
4. The key admitted by the **REST API Access Policies below**, including the
   built-in ones.

#### 1. Tables

Required. Without these the integration does not function:

| Table | Why |
|---|---|
| `incident` | read and write; the core object |
| `problem`, `change_request`, `task` | correlation, and `task` is the parent class |
| `sys_dictionary` | schema discovery, so generated queries use real field names |
| `sys_user`, `sys_user_group` | caller and assignment-group resolution |

Strongly recommended:

| Table | Why |
|---|---|
| `cmdb_ci`, `cmdb_rel_ci` | CMDB lookup and relationship traversal |
| `sys_audit_delete` | deleted records. A deleted CI otherwise looks identical to one that never existed |
| `sys_audit`, `sys_history_line` | field-level change history |

**Do not request `sys_journal_field` by default.** Work notes and comments are
readable from the incident itself, and asking for the journal table when you do
not need it is a bad trade: it is a single global table holding the journal of
every table on the instance, so read access to it spans HR cases, security
incidents and anything else installed, which undoes the per-table scoping the
rest of this list is built on. Ask for it only if you need individual entries
attributed and ordered, and then ask for a **conditional read ACL** on
`sys_journal_field` with `name=incident` rather than a blanket grant. See
section 7.1.

Only if the customer licenses it: `sn_si_incident` (Security Incident Response).
Do not request it otherwise; on an instance without SIR the table does not exist
and the request will confuse the administrator.

#### 2. Roles on the service user

The policy decides whether the request is admitted. The **roles** decide whether
any rows come back. Get this wrong and every table returns `200` with an empty
result, which reads like an empty instance rather than a permissions problem.

| Role | Grants |
|---|---|
| `itil` | incident, problem, change_request, task |
| `personalize_dictionary` | `sys_dictionary`, so schema discovery returns real fields |
| `cmdb_read` | CMDB classes |

The journal and audit tables are frequently admin-only. If the customer will not
grant them, that is a legitimate decision: the integration degrades and says so
rather than failing.

#### 3. REST API Access Policies

Two instructions, and the second is the one that gets missed:

1. Create a policy on the **Table API** admitting the API key's authentication
   profile for the tables above.
2. **Also add that authentication profile to the built-in `Table GET API Access
   Policy` and `Table POST API Access Policy`.** Instances with the REST API
   Access Policy plugin ship these already active, covering `incident`,
   `problem`, `change_request`, `task`, `sys_dictionary`, `sys_user`,
   `sys_user_group`, `cmdb`, `cmdb_ci` and `cmdb_rel_ci`. ServiceNow enforces
   only the **most specific** matching policy, and those built-in policies name
   an explicit method and resource, which outranks a broader custom policy. A
   correctly built, active, correctly mapped custom policy is simply never
   consulted for those tables, and they all answer 401.

> **Warning worth passing on.** Attaching an authentication profile to the
> built-in policies makes those policies enforce the profiles they list.
> Verified on a live instance: after adding an API key profile, Basic auth
> stopped working on exactly those tables while tables outside the policies
> still accepted it. On a production instance that can break other integrations
> that authenticate differently. If Basic auth must keep working, the customer
> must add a Basic auth profile to the same policies.

#### 4. Non-table APIs, only if you need them

A Table API policy never covers these, and each needs permitting separately:

| Capability | Endpoint |
|---|---|
| Event creation | `/api/global/em/jsonv2` |
| CMDB ingest (IRE) | `/api/now/identifyreconcile` |
| Aggregates | `/api/now/stats/{table}` |
| Attachments | `/api/now/attachment` |

#### 5. How to confirm it is right, in one command

Do not accept "it is configured" without this. It exits non-zero if anything
required is unreachable, and names which layer to fix:

```
python3 tools/check_servicenow_access.py \
  --instance https://CUSTOMER.service-now.com \
  --apikey 'THE_KEY' --read-back
```

Expect every required table `200 ok`. Two results specifically do **not** mean
success:

- `200, 0 rows` — the policy is right and a **role** is missing
- `401` — the **policy** is missing, not the key

`--read-back` additionally confirms `work_notes` can be read back, which should
pass on the required tables alone with no journal access.

### 4.1 Storing the credential — exact syntax

Every command in this section was run against a live instance and verified,
including that the app's own credential resolver finds the resulting entry.

The connection record does not hold the secret. It holds a **name** (`credential_ref`),
and the secret is stored separately in `storage/passwords`. You create that entry
yourself; nothing in the UI writes it for you.

Two values are fixed by the app and must match exactly:

| | Value |
|---|---|
| App context | `itmip_ai_splunk_assistent_app` |
| Realm | `itmip_llm_assistent_app` |

**Yes, the realm and the app folder differ, and that is deliberate.** In v0.1 the
app stored a single Anthropic key under a realm named after the app folder. v0.2
made the product multi-LLM, so keys became per-config and a new realm
(`itmip_llm_assistent_app`) was introduced for them. The folder could not be
renamed without breaking every existing install, and the old realm had to keep
working for anyone who had already saved a key, so both survive:
`itmip_ai_splunk_assistent_app` still holds only the legacy `anthropic_api_key`,
and everything since lives in `itmip_llm_assistent_app`.

The consequence for you is only that the realm reads as though it were
LLM-specific when it is not: it holds the licence blob and the ServiceNow
credential too. Use `itmip_llm_assistent_app` and ignore the name. Renaming it
now would orphan every stored credential on every install for no functional
gain.

The **username** is the credential name the connection will look up. Which name
depends on `credential_model`:

| `credential_model` | Username to use | Example |
|---|---|---|
| `global` | whatever you set in `credential_ref` | `servicenow_prod` |
| `per_tenant` | `servicenow_{org}_{bu}`, lower-case | `servicenow_acme_soc` |
| `per_user` | `servicenow_{splunk_username}`, lower-case | `servicenow_jsmith` |

Names are sanitised to letters, digits, `.`, `_` and `-`. For `per_tenant` and
`per_user` the app lower-cases the org, BU and username before building the name,
so store the entry in lower case or it will not be found.

**Create it with the REST API** (adjust the last two values only):

```
curl -k -u admin:PASSWORD \
  https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords \
  -d name=servicenow_prod \
  -d realm=itmip_llm_assistent_app \
  -d password='PASTE_THE_SECRET_HERE'
```

**Or with the Splunk CLI**, if you would rather not use curl:

```
splunk _internal call /servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords \
  -post:name servicenow_prod \
  -post:realm itmip_llm_assistent_app \
  -post:password 'PASTE_THE_SECRET_HERE' \
  -auth admin:PASSWORD
```

Both forms produce the same entry. Note there is no UI for this: the Settings
pages do not expose app-scoped `storage/passwords` entries, so it is the REST
API or the CLI.

**Verify it stored** (the secret is not echoed):

```
curl -k -u admin:PASSWORD \
  "https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords?output_mode=json" \
  | python3 -c "import json,sys; [print(e['content']['realm'], e['content']['username']) for e in json.load(sys.stdin)['entry']]"
```

You should see `itmip_llm_assistent_app servicenow_prod`.

**To update a secret**, POST to the specific entry. The id is `realm:username:`,
URL-encoded, so the colons become `%3A`:

```
curl -k -u admin:PASSWORD -X POST \
  https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords/itmip_llm_assistent_app%3Aservicenow_prod%3A \
  -d password='THE_NEW_SECRET'
```

**To delete it**, send DELETE to that same URL.

### 4.2 What the secret must contain, per `auth_type`

This is the part most often got wrong. The stored value is used differently for
each authentication type:

| `auth_type` | Store exactly this | Sent as |
|---|---|---|
| `basic` | `username:password` (one string, with the colon) | `Authorization: Basic <base64 of what you stored>` |
| `bearer` | the token on its own | `Authorization: Bearer <secret>` |
| `header` | the API key on its own | a header named by `auth_header_name`, default `x-sn-apikey` |
| `oauth2` | a bearer token, until full OAuth resolution lands | `Authorization: Bearer <secret>` |

For `basic`, the app base64-encodes **whatever you stored, unchanged**. If you
store only the password, the header is malformed and ServiceNow answers 401 with
nothing useful in it. Store `svc_splunk:S3cr3t`, not `S3cr3t`.

Do not base64-encode the value yourself either. The app does that, so a
pre-encoded secret is encoded twice.

### 4.2b API keys need a REST API Access Policy

A ServiceNow API key does not authenticate anything on its own. It has to be
bound by a **REST API Access Policy** (*System Web Services → REST API Access
Policies*). Until one admits the key on the endpoint you are calling, every
request fails with the same misleading message:

```
{"error":{"message":"User is not authenticated",
          "detail":"Required to provide Auth information"}}
```

That wording says "you sent no credential" even when you sent a perfectly valid
one that is simply not permitted there. It is very easy to conclude the key is
wrong when the policy is merely too narrow, and to spend an afternoon re-minting
a key that was never the problem.

**Basic auth does not have this problem.** A service account's own ACLs apply, so
if you are evaluating and want to move on, use `basic` and come back to
least-privilege later.

#### Three layers decide whether a table answers

This is the part that costs people the most time, because a denial can come from
any of three places and they need different fixes.

1. **REST API Access Policy** — may this authentication method reach this
   endpoint at all. Failure is **401**.
2. **Web service access on the table** — the *Allow access to this table via web
   services* flag on the table record (`sys_db_object`). If it is off, the table
   is unreachable over REST regardless of policy, and it may not appear as a
   selectable resource when you are building the policy.
3. **Record ACLs** — may this user see these rows. Failure is **403**, or a
   **200 with zero rows**.

Read the status code and you know which layer to go to:

| Response | Meaning | Fix |
|---|---|---|
| 200 with rows | working | nothing |
| **200, zero rows** | admitted, but no rows visible | grant a **role**, or the table really is empty |
| **401** "User is not authenticated" | no policy covers this endpoint | fix the **policy** |
| **403** "User Not Authorized" | authenticated, ACL refused | grant a **role** |
| **400** "Invalid table" | table not on this instance | nothing — the plugin is not activated |

A 403 next to a wall of 401s is a useful hint that the credential authenticates
somewhere, but do not lean on it: some system tables answer 401 even to a full
admin over basic auth, so a table-level restriction can masquerade as either
code. Treat it as a lead, and confirm with the decisive test below.

#### The decisive test: try basic auth

When you cannot tell whether the credential, the policy or the instance is at
fault, stop reasoning about status codes and remove one variable. Basic auth
needs no Access Policy on a default instance:

```
python3 tools/check_servicenow_access.py \
  --instance https://YOUR_INSTANCE.service-now.com \
  --basic 'admin:PASSWORD'
```

- **Tables return 200** — the instance, the tables and the data are all fine, so
  the fault is entirely in the API key's Access Policy. You can also demo on
  basic auth today while you sort the policy out.
- **Tables also fail** — something larger changed on the instance, and the
  policy is not the place to look.

This one command settles in a single run what several rounds of API-key probing
cannot, because an API key exercises the credential, the policy and the ACLs all
at once and a failure never says which one moved.

#### Check the built-in policies FIRST — a new policy will not override them

This is the single most expensive trap in the whole setup, so do this before
creating anything.

Instances with the REST API Access Policy plugin ship two **out-of-box policies
on the Table API**, both active:

| Policy | Method | Tables it claims |
|---|---|---|
| `Table GET API Access Policy` | GET | `incident`, `problem`, `change_request`, `task`, `sys_dictionary`, `sys_user`, `sys_user_group`, `cmdb`, `cmdb_ci`, `cmdb_rel_ci`, `csdm_service_mapping` |
| `Table POST API Access Policy` | POST | the same list |

That is very nearly the exact set this integration needs.

When several policies match a request, ServiceNow enforces **only the most
specific one**. The built-in policies name an explicit method (`GET`) and an
explicit resource (`/now/table/{tableName}`), which makes them *more* specific
than a policy of your own that sets *Apply to all methods* and *Apply to all
resources*. Your policy is therefore never consulted for those tables, and if the
built-in one does not list your API Key authentication profile, the answer is
401 no matter what you put in yours.

The symptom is unmistakable once you know it:

- tables **not** in the built-in list work as soon as you add them to your policy
- tables **in** the built-in list stay 401 however many times you add them
- a table you add and later remove appears to "work then break", which reads like
  your edits are being lost when they are simply irrelevant

**The fix is to add your API Key inbound authentication profile to the built-in
`Table GET` and `Table POST` policies**, not to build a broader policy of your
own. Keep your own policy for everything outside the built-in list, such as
`sys_audit` and the change-history tables below. There is normally no built-in
policy for PUT, PATCH or DELETE, so your own policy governs updates.

To see the full picture on an instance, read the policies rather than clicking
through them:

```
curl -s -u 'admin:PASSWORD' \
  'https://YOUR_INSTANCE.service-now.com/api/now/table/sys_api_access_policy?sysparm_display_value=all' \
  | python3 -m json.tool | grep -E '"(name|http_method|api_tablename|active)"' -A1
```

Then confirm your profile is attached where it matters:

```
curl -s -u 'admin:PASSWORD' \
  'https://YOUR_INSTANCE.service-now.com/api/now/table/sys_auth_profile_mapping?sysparm_display_value=all'
```

Whichever route you take, confirm each policy is **Active**, and check the *Allow
access to this table via web services* flag on any table that does not appear in
the picker.

#### Give the credential's user roles too

A policy alone is not enough. The user tied to the API key needs roles, or the
tables return 200 with zero rows and look empty:

- `itil` for `incident`, `problem`, `change_request`, `task`
- read on the CMDB classes you use
- the change-history and journal tables below are frequently admin-only

#### The tables, by feature

Grant only what you enable. This list is derived from the integration's source,
not from memory.

**Always required** (the base ITSM tools and the schema reads they depend on):

| Table | Access | Used by |
|---|---|---|
| `incident` | read + write | incident read, create, update, the triage playbooks |
| `problem` | read | problem read |
| `change_request` | read | change read |
| `task` | read | parent class of the above; some dot-walks resolve through it |
| `sys_dictionary` | read | schema discovery, so generated queries use real field names |
| `sys_user` | read | caller and assignee resolution |
| `sys_user_group` | read | `assignment_group` dot-walk by name |

**CMDB / CSDM** (only if you use CMDB lookup, enrichment or the CSDM traversals):

| Table | Access | Notes |
|---|---|---|
| `cmdb_ci` | read | the base class every lookup starts from |
| `cmdb_rel_ci` | read | **required for any relationship traversal**; without it CSDM walks return nothing |
| `cmdb_ci_server`, `cmdb_ci_linux_server`, `cmdb_ci_win_server` | read | server classes |
| `cmdb_ci_database`, `cmdb_ci_db_instance` | read | database classes |
| `cmdb_ci_service`, `cmdb_ci_service_auto`, `cmdb_ci_service_discovered` | read | service classes |
| `cmdb_ci_business_app` | read | business application |
| `cmdb_ci_information_object` | read | information object |
| `cmdb_ci_netgear` | read | network gear |
| `service_offering` | read | service offering |

CMDB **writes** additionally require the specific physical tables you list in the
connection's *CMDB write allowlist*. That allowlist is deny-all when empty, so a
table must appear in BOTH the ServiceNow policy and the allowlist before a write
is possible.

**Security incidents (SIR)** — only when *SIR enabled* is ticked:

| Table | Access |
|---|---|
| `sn_si_incident` | read + write |

**Change history, deletions and journal text** (optional, but read the warning):

Edits and deletions are **not** stored on the record's own table. If you grant
only `incident` and `cmdb_ci`, these questions are silently unanswerable.

| Table | Access | Holds |
|---|---|---|
| `sys_audit_delete` | read | **deleted records**, including deleted `cmdb_ci` rows |
| `sys_audit` | read | field-level changes to audited fields |
| `sys_journal_field` | read | the text of `work_notes` and `comments` |
| `sys_history_line`, `sys_history_set` | read | computed record history |

Two consequences worth understanding before you decide to skip these.

**A deleted CI is invisible, not flagged.** Delete a CI and it simply stops
appearing in `cmdb_ci`, which is indistinguishable from a CI that never existed.
Since "what changed shortly before this incident" is most of the RCA value, a
decommission that caused an outage is exactly the event you will fail to find.

**`work_notes` looks write-only and is not.** The field returns empty from a
table read unless `sysparm_display_value` is `true` or `all`. Send that and the
text comes back on the record, with no access to `sys_journal_field` required.
Do not grant the journal table to fix an empty `work_notes`: see section 7.1 for
the one case that genuinely needs it. Confirm which situation you are in:

```
python3 tools/check_servicenow_access.py \
  --instance https://YOUR_INSTANCE.service-now.com \
  --apikey 'your_api_key' --read-back
```

**Event creation is NOT a table.** `servicenow_create_event` posts to
`/api/global/em/jsonv2`, the Event Management API. A table policy will not cover
it: you must permit that API separately, or event creation returns 401 while
every table call succeeds.

**Optional:**

| Table | Access | Notes |
|---|---|---|
| `sys_properties` | read | Only to display the instance release. Being denied no longer fails the connection test; it falls back to `incident` and reports the release as unknown. Often not selectable as a policy resource, and admin-only by ACL. Safe to skip. |

#### Which ServiceNow APIs the integration uses

The product calls three today. Everything else on this list is a decision you may
want to make later, not something to grant pre-emptively.

| API | Path | Status |
|---|---|---|
| Table API | `/api/now/table/{table}` | **in use**, the bulk of the integration |
| Event Management | `/api/global/em/jsonv2` | **in use** by `servicenow_create_event` |
| EM connector | `/api/sn_em_connector/em/inbound_event` | **in use** |
| Aggregate | `/api/now/stats/{table}` | worth adding: counts and grouping without pulling rows back |
| Attachment | `/api/now/attachment` | worth adding if you want evidence attached to incidents |
| CMDB Instance | `/api/now/cmdb/instance/{class}` | class-aware CMDB reads, better than raw `cmdb_ci` |
| Identification and Reconciliation | `/api/now/identifyreconcile` | CMDB **ingest**. Only if Adjutant should write CIs, which is a much larger decision than reading them |
| GraphQL | `/api/now/graphql` | fewer round trips for related records, at the cost of a second query dialect |
| Import Set, Service Catalog, Knowledge | various | no current use |

The table above is the reason `servicenow_create_event` deserves its own check:
it is the one call in daily use that a Table API policy will never grant.

#### The product will tell you

**Test connection** now returns a per-feature access report, so you do not have
to work this out from scattered 401s. It probes what the credential can actually
read and shows, for each feature, whether it is usable and which tables are
missing:

```
Credential access — Required access missing for: Schema discovery.

REQUIRED  Incidents, problems, changes                 yes
REQUIRED  Schema discovery                             denied: sys_dictionary
REQUIRED  Caller and assignment-group resolution       yes
optional  CMDB / CSDM lookup and traversal             yes
optional  Change history, deletions and journal text   yes, but no rows from sys_audit_delete (check roles)
optional  Security incidents (only if SIR is enabled)  not installed here
optional  Event creation (/api/global/em/jsonv2)       not probeable
```

Three phrasings there carry specific meaning:

- **denied** is a 401. Fix the policy.
- **no rows (check roles)** is a 200 with an empty result. The policy is already
  right; the user is missing a role, or the table is genuinely empty. We cannot
  tell which from outside, and the wording says so rather than guessing.
- **not installed here** is a 400 invalid table. Nothing to grant, ever. Earlier
  versions reported this identically to a denial, which sent people hunting for
  permissions on a plugin they had never licensed.

Event creation shows as *not probeable* because it is not a table: a table read
cannot test it and a table policy does not grant it.

#### Check a key before wiring it up

```
python3 tools/check_servicenow_access.py \
  --instance https://YOUR_INSTANCE.service-now.com \
  --apikey 'your_api_key'
```

It prints one row per table with the status code and which layer to fix, and
exits non-zero if any required table is unreachable. Add `--read-back` to also
check whether `work_notes` can be read, not just written.

To test the credential the app is actually using rather than one pasted into a
shell, drop `--apikey` and let it read `storage/passwords` directly:

```
python3 tools/check_servicenow_access.py \
  --instance https://YOUR_INSTANCE.service-now.com \
  --conn servicenow_prod --splunk-password 'YOUR_SPLUNK_PASSWORD'
```

If **every** table returns 401, including one that worked previously, that is a
policy that was replaced or deactivated rather than a bad credential. Both report
"User is not authenticated", which is precisely why they get confused.

To separate "is the integration correct" from "is the policy correct" while you
are still sorting the policy out, basic auth needs no Access Policy at all on a
default instance:

```
python3 tools/check_servicenow_access.py \
  --instance https://YOUR_INSTANCE.service-now.com \
  --basic 'user:password'
```

### 4.3 If it does not authenticate

Work through these in order; each rules out one layer.

1. **Is the name right?** The connection's `credential_ref` (or the derived
   `servicenow_{org}_{bu}` / `servicenow_{user}`) must equal the username you
   stored. A mismatch is not an error anywhere: the lookup returns empty, no
   `Authorization` header is sent, and ServiceNow answers 401. This is the most
   common cause.
2. **Is the realm right?** It must be `itmip_llm_assistent_app`, which is not the
   app name. An entry in the wrong realm is invisible to the lookup.
3. **Is it in the app context?** It must live under
   `/servicesNS/nobody/itmip_ai_splunk_assistent_app/`. An entry created in
   `search` or under your own user will not be found.
4. **Is the shape right for the `auth_type`?** See the table above, especially
   the `username:password` requirement for `basic`.
5. **Case.** For `per_tenant` and `per_user` the derived name is lower-cased.
6. **Is it the policy rather than the credential?** With an API key this is the
   most likely answer once 1 to 5 are ruled out, and it looks identical from
   here. Run the checker in section 4.2b: if some tables answer and others 401,
   the key is valid and the policy is too narrow. If a table returns **403**
   while its neighbours return 401, that settles it — 403 means the credential
   authenticated and only an ACL refused it, so the key is definitely fine.

**Shortcut.** Rather than working down this list by hand, run:

```
python3 tools/check_servicenow_access.py \
  --instance https://YOUR_INSTANCE.service-now.com \
  --conn servicenow_prod --splunk-password 'YOUR_SPLUNK_PASSWORD'
```

Reading the secret from `storage/passwords` tests steps 1 to 3 implicitly: if it
cannot find the credential, the name, realm or app context is wrong.

On the **MCP** transport, auth is the MCP server's own OAuth, handled by the shipped client — see
[the MCP OAuth guide](../tools/mcp-oauth.md). **ServiceNow REST and ServiceNow MCP are separate connections with
separate, never-shared credentials** (a REST token is not an MCP resource token). Action Fabric MCP
is OAuth-only and uses the authorization-code grant (interactive) or a `service` owner-mode delegated
token (unattended) — it does **not** yet offer client-credentials for MCP.

---

## 5. CMDB / CSDM — working in logical names

You (and the LLM) work in **logical CSDM class names** — "Business Application", "Server",
"Business Service" — and the tools resolve them to the right physical tables (`cmdb_ci_business_app`,
`cmdb_ci_server`, …) for the Org's CSDM version. Reads return **display values** (state → "In
Progress") and dot-walked references.

The highest-value question is a **relationship-graph** question, answered by
`servicenow_cmdb_related` with a *named traversal*:

- `business_services_for_ci` — "which Business Service is this host part of?"
- `dependencies_of_ci` — "what does this CI depend on?"
- `impact_of_ci` — "what is the blast radius if this CI fails?"

Traversals are **depth- and breadth-bounded** (max hops / max nodes); an over-limit walk returns a
partial graph + a "truncated" note, never hangs. A class missing from the Org's CSDM version is
reported, not guessed. The CSDM map ships as curated knowledge and is also exposed through the
`servicenow-cmdb` knowledge connector; a live overlay of the customer's own `u_*` classes is the
production enhancement (the static map is the never-hang fallback).

---

## 6. Two transports — REST or MCP (per Org)

Playbooks, knowledge and skills are written against **logical ServiceNow tool ids**
(`sn.get_incidents`, `sn.create_incident`, `sn.cmdb_get_records`, …). A per-Org **capability map**
resolves each logical id to whatever is wired:

- **REST Org** → the built-in `servicenow_*` tools (this page).
- **MCP Org** → an **imported MCP tool**, via the admin-edited `logical_tool_map` (because MCP tool
  names differ per vendor). An **unmapped** logical id is reported *unavailable* for that Org
  (graceful — the playbook says so in `missing_context`, never errors).

Switching an Org's `transport` changes **no** playbook, knowledge entry, or skill. On the
MCP transport Adjutant AI still enforces its own governance **in Adjutant AI, never delegated to the
MCP server**: the never-hang bound, the write allowlist, write-target binding, and the deterministic
description render all still apply; `stdio` MCP servers are rejected. A generic MCP-server
registration pointing at a ServiceNow-looking URL gets a **non-blocking hint** that the dedicated
integration is richer — never a refusal.

---

## 7. Rich incidents + the bi-directional round-trip

The flagship value is turning a Splunk/ITSI/ES alert into a **rich, readable** ServiceNow incident
and **writing the number back** — the round-trip stock one-directional integrations skip.

**Flow (per alert-driven playbook).** Alert fires → the backend run enriches (Splunk context +
optional CMDB owner/criticality/Business-Service) → the LLM emits the structured content object →
the **renderer** produces the plain-text description → coded fields are resolved label→code → the
incident is **created or updated** → the number is written **back** to the originating object.

**Idempotency — two keys, two jobs.**
- A **run-id-independent correlation key** `aiwb:<source_type>:<source_object_id>[:<playbook>]` is
  stamped on the incident's `correlation_id` and queried before writing. A genuine **re-fire** (a new
  run) finds and **updates the same incident** instead of spawning a duplicate.
- A **`(run_id, step_id)` failover marker** on each write stops a runner that died mid-write from
  double-posting on failover.

**Write-back rides the existing backend adapters** (`notable_comment` / `episode_comment` /
`write_structured_report`) — there is **no new ServiceNow backend adapter**. Creating/updating the
incident is a governed **tool call** inside the run; annotating the Splunk object is the backend's
existing safe path. If ServiceNow is unreachable, **no** incident is created and the Splunk object
gets an honest "ServiceNow unavailable — incident not raised" note.

**Closed-incident policy.** When a re-fire matches an already **resolved/closed** incident, behaviour
follows `on_closed_incident` (per Org/BU, overridable per alert by attaching one of the three
override runbooks):

| Policy | Behaviour |
|---|---|
| `new_linked` *(default)* | Create a new incident **linked** to the closed one as a recurrence. |
| `reopen` | Attempt to reopen; if ServiceNow refuses (business rule / ACL), **fall back to `new_linked`** and record it. |
| `suppress` | Within a lookback window, do nothing in ServiceNow (annotate Splunk only); outside it, behave as `new_linked`. |

The three shipped playbooks are: **ServiceNow Incident from Splunk Alert / ITSI Episode / ES Notable**.
The override runbooks are **ServiceNow Closed-Incident: Create New / Reopen / Suppress**.

### 7.1 Reading work notes and comments

`work_notes` and `comments` are **journal fields**. A table read returns them
**empty** unless `sysparm_display_value` is `true` or `all`. With it, the full
text arrives on the record itself. On a live instance one incident returned 2113
characters of comments this way, using a credential with **no access to
`sys_journal_field` at all**.

That empty field is the trap. It looks exactly like a permissions problem, and
treating it as one costs a policy change, a role grant and access to a table the
integration does not need. It is a missing query parameter.

**`servicenow_get_incident` is the answer for reading a ticket's history.** It
requests both fields and the module already defaults `sysparm_display_value=all`,
so the narrative comes back at no extra call. List reads deliberately do **not**
carry journal text: at 2113 characters per incident, a 20-row search would push
tens of kilobytes of narrative through the model for rows nobody has opened.

#### When the journal table is genuinely needed

`display_value` returns every entry concatenated into one string with the author
and timestamp inlined as text. That is fine for reading the story and useless for
attributing or ordering individual entries.

**`servicenow_get_journal`** reads `sys_journal_field` and returns each entry as
its own object with `kind`, `value`, `created_by` and `created_on`. Use it for
"who added the note that closed this" or "how long between the customer's reply
and ours". It is opt-in, and `servicenow_get_incident` will do the same on
request via `structured_notes: true`.

Two things to be deliberate about before asking a customer for it:

**It is one global table.** `sys_journal_field` holds the journal of every table
on the instance. A query without a `name=` filter returns work notes from
everywhere, including HR cases and, if SIR is installed, security incidents. That
undoes the per-table scoping the Access Policy was built to enforce. Adjutant
always sends `name=`, and restricts the parent table to `incident`, `problem`,
`change_request`, `task` and `sn_si_incident` rather than accepting one from the
model. Ask the customer for a **conditional read ACL** with `name=incident`
assigned to `itil`, not a blanket grant.

**Read ACLs on it are restrictive.** `itil` alone is usually not enough, and the
failure is `{"result":[]}` rather than a 403 — the empty-result case that reads
as "no notes" instead of "no permission". Out of the box you may find only
`admin` satisfies it, which is a larger grant than this account should have.

#### Writing notes

Never insert into `sys_journal_field` directly: it bypasses the journal machinery
and produces orphaned, misattributed entries. Adjutant writes by PATCHing the
parent record and lets ServiceNow create the journal row itself, correctly
attributed. `comments` is customer-visible; `work_notes` is internal.

If the journal is unreadable, the structured read degrades rather than fails: the
record and its narrative text are unaffected, `notes` is empty, and `notes_note`
says why. Treat a present `notes_note` as **notes missing**, not as a record with
no notes.

---

## 8. Security incidents (SIR) — opt-in

A SOC running ServiceNow **Security Operations** wants **security incidents** (`sn_si_incident`), not
ITSM incidents. The SIR tools are the ITSM tools' twins pointed at `sn_si_incident`, with the same
renderer + correlation round-trip, optional **MITRE ATT&CK** association (from knowledge, never
invented; skipped-with-note when the plugin is absent), and SIR's **NIST-based, per-instance** state
model. Because SIR state writes are frequently refused even on an HTTP 200, `update_security_incident`
**reads the state back and reports whether it actually changed** — which drives the SIR reopen
fallback.

**SIR is opt-in twice:**
1. The Org connection must set **`sir_enabled`** (else the SIR tools are not advertised).
2. The **security playbooks are NEVER auto-assigned.** A (sc)admin must set
   `security_playbooks_enabled` **and** explicitly assign each security playbook to the Org/BU. The
   security playbooks (**Security Incident from ES Notable / Splunk Alert / ITSI Episode**) and their
   SIR override runbooks are neither advertised nor runnable until then.

---

## 9. Threat-intel enrichment (TISC) — detect-and-prefer

When you run ServiceNow's **Threat Intelligence Security Center (TISC)**, Adjutant AI enriches
indicators (reputation, threat score/severity, MITRE `attack_phases`) using **one capability, two
sources, same schema**:

1. **Source A (preferred):** if the `splunk_tisc_addon`'s `tisc_store_lookup` is present and
   populated, read it via plain SPL — local, fast, already scored. The customer chooses which
   *optional* attributes get synced, so non-core fields (notably MITRE `attack_phases`) are
   **best-effort** — present if populated, gracefully omitted otherwise (never fabricated).
2. **Source B (fallback):** the live `servicenow-tisc` adapter against the same TISC API.
3. **Neither:** note "no TISC enrichment available" and lower confidence — **never block**.

Adjutant AI never installs the add-on. The worst-case TISC threat score feeds the
`threat_reputation` dimension of `compute_risk_score`; pre-declared MITRE technique ids feed the SIR
association.

---

## 10. Licensing

Gated on **two dimensions** (both must hold): edition **AND** feature presence.

- **`servicenow`** (Professional) — all REST tools, knowledge, playbooks, and the ITSM playbooks.
- **`servicenow-mcp`** (Professional) — the MCP transport. A deliberate **carve-out**: the dedicated
  ServiceNow-connection MCP path is reachable at Professional **without** the Enterprise `mcp_servers`
  capability, while a *generic* (non-ServiceNow) MCP server still requires `mcp_servers` (Enterprise).

Tools carry a `min_feature` gate and are hidden unless the Org both holds the feature **and** has an
active connection; playbooks carry a parallel `required_feature` gate (server-enforced, fail-closed).
See the licensing reference.

---

## 11. Out of scope (conscious deferrals)

Other ServiceNow REST APIs (Aggregate, Import Set, GraphQL, Scripted REST; **Attachment** is a
fast-follow), **full continuous lifetime state-sync** (the create-time round-trip IS in scope — the
ongoing mirror of every later ServiceNow status change is not), a dedicated notable/episode *field*
write (needs a new backend allowlist action; comment + index report is the shipped path),
client-credentials OAuth for ServiceNow MCP (ServiceNow roadmap), rich HTML/Markdown descriptions
(plain text is the committed default), exposing the whole Action Fabric catalog as free tools, and
`stdio` MCP servers.

---

## 12. References

- [the tool catalogue](../tools/tool-catalogue.md) — tool model, custom-HTTP tools, the IAM hook, MCP servers.
- [the MCP OAuth guide](../tools/mcp-oauth.md) — OAuth for MCP servers (the ServiceNow MCP transport).
- [the customer authorisation hook guide](../security/customer-authorisation-hook.md) — WebEAM / IAM gateway auth.
- the Backend Ask Service guide — the unattended engine the ServiceNow playbooks ride.
- the knowledge-layer guide — curated entries + connectors (the CSDM map).
- the licensing reference — editions + named features.
- [the tools and playbooks overview](../tools/tools-and-playbooks.md) — the full tool/playbook catalogue.
