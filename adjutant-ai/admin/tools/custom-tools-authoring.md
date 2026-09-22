---
sidebar_position: 9
---

# Custom HTTP tools — authoring guide

**App version:** 2.5.9 · **Last updated:** 2026-09-16 · **Audience:** Splunk admins
(`admin` / `sc_admin`) who will author custom tools on the search head where Adjutant AI
is installed.

This is the deep guide. [The tool catalogue](./tool-catalogue.md) covers the Tools tab end-to-end — the
built-in catalogue, per-tenant assignment, metadata overrides, MCP servers — and has a
shorter custom-tools section. Read that first if you want the wider map; read this one
when you are actually about to write a tool definition, or when you are reviewing one
somebody else wrote.

---

## 1. What a custom tool is, and why it exists

The dispatcher ships **182 built-in tools** (source-verified:
`grep -cE "^\s*name:\s*[\"']" src/services/tools.ts`). Every one of them talks to
*Splunk* or to a system Adjutant AI has a first-class integration with — search, indexes,
saved searches, dashboards, ES, ITSI, TrackMe, SSE, ServiceNow, MLTK. None of them talks
to **your** systems: the internal CMDB that is not ServiceNow, the change-freeze calendar,
the asset-owner lookup service, the threat-intel API your SOC pays for, the wiki that
holds the runbooks.

A **custom tool** is an admin-authored declarative HTTP call that the LLM can invoke by
name, exactly as it invokes `splunk_run_search`. You describe the call once — method,
URL, headers, auth, response shaping — and the model gets a named function with a
JSON Schema. It cannot see the URL, cannot see the credential, and cannot change either.

That last sentence is the whole point of the feature, and it is why "just let the model
call an HTTP tool with a URL parameter" is not an acceptable substitute. A model steered
by indirect prompt injection — and event data ingested into Splunk is attacker-influenced
text — would happily be talked into fetching a different host. Here it cannot: the host
allowlist is re-checked server-side after argument substitution.

**When *not* to use one:**

- **ServiceNow** — use **Tools → ServiceNow** instead. v1.7.0 shipped 16 first-class
  ServiceNow tools plus CMDB/CSDM traversal, write-back and per-Org transports. See
  [the ServiceNow guide](../integrations/servicenow.md). A custom HTTP tool remains the escape hatch for a
  bespoke ServiceNow table nothing else reaches.
- **An upstream that already speaks MCP** — register it under **Tools → MCP servers**
  and import its tools. You get schema drift detection and refresh; a hand-written
  custom tool gets neither.
- **Anything that needs to run SPL** — that is what the built-ins are for.
  `implementation.type: splunk_search` exists in the schema but is **not executable**
  (§8).

---

## 2. The security model

This is the section to read before anything else, and the section to re-read when
reviewing somebody else's tool definition.

### 2.1 What reaches the LLM, and what does not

A stored `CustomToolDefinition` has seven top-level blocks: `name`, `version`, `title`,
`description`, `parameters`, `scope`, `implementation`, `response`, `guardrails`,
`enabled`. The runtime hands the model **three of them**:

```ts
// src/services/tools.ts:14133-14145
return defs
    .filter((d) => d.enabled)
    .map((d) => ({
        name: d.name,
        description: d.description,
        input_schema: {
            type: "object" as const,
            properties: (d.parameters?.properties as Record<string, unknown>) ?? {},
            required: Array.isArray(d.parameters?.required) ? ... : undefined
        }
    }));
```

`implementation`, `response` and `guardrails` are never in that projection. They are
also never rendered into the LLM prompt anywhere else. The model knows a tool called
`cmdb_get_owner` takes a `ci_name` string; it does not know the call goes to
`https://cmdb.acme.internal/api/v2/ci`, and it does not know a bearer token is attached.

The same split holds on the wire in the browser. The `/definitions` GET does return the
full envelope to an admin's browser (the editor needs it to render), so an admin's
session can read the URL and header map — but **never a secret value**: `implementation`
stores a credential *name*, and the cleartext is fetched server-side at invoke time and
discarded. See the handler docstring at `bin/itmip_llm_custom_tools.py:11-32`.

### 2.2 `allowed_hosts` — the SSRF gate

`implementation.allowed_hosts` is a **required, non-empty array** of hostnames
(`bin/itmip_llm_custom_tools.py:203-208`). It is checked **twice**:

1. **At save time** — the definition is refused if the list is empty or malformed.
2. **At invoke time, after `{{ }}` substitution** —
   `bin/itmip_llm_custom_tools.py:676-683`:

```python
parsed = urlparse(url)
host = parsed.hostname or ""
allowed = impl.get("allowed_hosts") or []
if host not in allowed:
    return {"ok": False, "error": "Host '%s' is not in allowed_hosts." % host}
```

The order matters. A tool whose URL is `https://{{ host }}/api/ci` is legitimate — an
admin may want one tool per environment — but the model supplying `host` cannot escape
the allowlist, because the check happens on the *rendered* host. The comparison is an
exact, case-sensitive string match against `parsed.hostname`; there is no wildcard, no
suffix match, and no port in the comparison (a different port on an allowed host is
allowed). The UI lowercases hosts as you add them (`CustomToolsSection.tsx:900`), so
type them in lowercase — a `{{ host }}` argument rendering to `CMDB.acme.com` will not
match a stored `cmdb.acme.com`.

Substitution itself is a strict whitelist, not an evaluator:

```python
# bin/itmip_llm_custom_tools.py:82
TEMPLATE_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")
```

Only `{{ name }}` where `name` is a key in the call's `arguments`. No expressions, no
Python `eval`, no filters. A placeholder whose argument is missing raises `KeyError` and
the call fails closed with `Missing required argument: x`
(`bin/itmip_llm_custom_tools.py:673-674`) — it never goes out with a blank substituted in.
Substitution runs over `url`, `query`, `headers` and `body`, recursing through dicts and
lists (`_render`, lines 449-467).

### 2.3 Private, loopback and link-local refusal

`https://169.254.169.254/latest/meta-data/` is the cloud metadata service.
`https://127.0.0.1:8089/` is splunkd's own management port. Both are reachable from the
search head, and both are exactly what an SSRF wants. So:

> A host that resolves to an RFC1918, loopback or link-local address is **refused**
> unless the definition sets `implementation.allow_internal: true`.

The classification is delegated to `itmip_llm_probe_guard.classify_host`
(`bin/itmip_llm_custom_tools.py:128-156`), which is the app's single implementation of
"is this destination allowed" — shared with the setup wizard's probe path. It resolves
the name, judges **every** address it resolves to, and the **strictest verdict wins**
(`bin/itmip_llm_probe_guard.py:118-140`) — a name returning one public and one loopback
address is refused, because taking the permissive answer is how a DNS-rebinding attack
gets its first lookup past a guard. Reserved, multicast and unspecified addresses are
refused too.

The check runs at save time against every entry in `allowed_hosts`
(`bin/itmip_llm_custom_tools.py:211-216`) and again at invoke time against the rendered
host (lines 682-683).

Two honest caveats:

- **A name that does not resolve is not treated as internal.** DNS being briefly
  unavailable would otherwise refuse a host an admin explicitly allowed. The allowlist,
  not this check, is the actual gate.
- **The verdict is not pinned to an address.** `classify_host` resolves, decides, and
  discards; `opener.open()` later resolves again. The gap between the two lookups is a
  rebinding window. The code says so in its own docstring (lines 137-150) and points at
  `guard.check_destination`, which returns the address it validated — moving `/invoke`
  onto that is deliberately a separate change with its own test. Treat `allow_internal`
  as a control you audit, not a control you sprinkle.

**When you legitimately need `allow_internal`:** an on-prem CMDB or wiki on a private
address. Set it, and then keep `allowed_hosts` to the exact names — the allowlist is
doing the real work at that point.

### 2.4 Credentials

Tool definitions contain **no secrets**. `implementation.auth` carries a credential
*name*; the cleartext is read at invoke time from Splunk's `storage/passwords` under
realm `itmip_llm_assistent_app` (`bin/itmip_llm_common.py:23`), by the **system token**,
inside splunkd. It is:

- never written into the KVStore row,
- never returned in any `/definitions` response,
- never logged (the audit row records the *resolved name*, not the value —
  `bin/itmip_llm_custom_tools.py:1201-1219`),
- never sent to the LLM.

The name is sanitised before lookup — only `[A-Za-z0-9._-]` survives
(`bin/itmip_llm_custom_tools.py:477`) — so a hostile Org name in a per-tenant template
cannot traverse into another realm. Secret values get their endpoints stripped before
being formed into a header (line 728): a trailing newline from a copy-paste would
otherwise make urllib3 raise `InvalidHeader` on `b'Bearer …\n'`. Only the endpoints,
never the middle, so PEM-shaped values survive.

Full credential-model detail is §5.

### 2.5 `redact_fields`

`guardrails.redact_fields` is a list of key names. After the transform and before the
response reaches the model, the payload is walked recursively and any key whose name
matches is replaced with the literal string `[REDACTED]`
(`bin/itmip_llm_custom_tools.py:603-617`).

Use it for fields that are structurally present in a response and have no business in a
prompt or a chat transcript: `sys_id`, `internal_notes`, `password_hash`, a PII column
your upstream returns whether you asked for it or not.

Two limits worth knowing:

- It matches **keys, not values**. A secret that appears inside a free-text field is not
  redacted.
- It matches **exact key names**, case-sensitively, at any depth. `Sys_id` is not
  `sys_id`.

If you need to strip whole branches rather than named keys, use a `jq` / `jsonpath`
transform (§3, Response shaping) to project only the fields you want — an allowlist
beats a denylist here, as it usually does.

### 2.6 Rate limiting

`guardrails.rate_limit_per_minute` (default 30) is enforced **per (tool, user)** on a
60-second sliding window before anything else happens
(`bin/itmip_llm_custom_tools.py:1113-1116`, implementation at
`bin/itmip_llm_common.py:431-447`). Over the cap, `/invoke` returns HTTP 429 and the
call is not made.

Be honest about what this is: the state is a **process-local dict** in the persistent
splunkd handler. On worker recycling the bucket resets, and on a search-head cluster
each member counts separately. It is a defensive brake against a model in a tool loop
hammering an upstream, not a billing control or a quota you can prove to a vendor.

### 2.7 TLS verification skip

The editor exposes a **⚠ Skip TLS certificate verification (dev only)** checkbox
(`CustomToolsSection.tsx:647-694`). It is:

- **Hidden on Splunk Cloud.** The whole block is behind `{!isCloud && ...}`, where
  `isCloud` is `instanceType === "cloud"` (line 247).
- **Refused on Splunk Cloud server-side, regardless of what is in the stored row**
  (`bin/itmip_llm_custom_tools.py:798-815`). A definition imported from a dev instance
  with the flag set will have it ignored on Cloud, with an INFO line to `splunkd.log`
  saying why. If Cloud detection itself throws, the flag is refused anyway — fail-safe.
- **Audited on every call it affects.** When it is active a line goes to `splunkd.log`
  (`tls_verify_skipped=true url=… tool=… user=…`, lines 816-821) and every audit row
  carries `tls_verify_skipped: true` (line 1214).

The editor turns red and shows a standing warning panel while the box is ticked
(lines 673-692). Treat any audit row with `tls_verify_skipped=true` outside a dev
instance as an incident:

```spl
| inputlookup itmip_llm_custom_tool_calls | where tls_verify_skipped=1
```

The correct fix for a private CA is `tls_ca_pem_ref`, not this flag. See [the tool catalogue](./tool-catalogue.md),
"Working with PEM files" for how to get a PEM into `storage/passwords` intact.

### 2.8 Who can do what

| Operation | Who | Enforced at |
|---|---|---|
| List definitions (`GET /definitions`) | any authenticated user, filtered by scope | `itmip_llm_custom_tools.py:993-1027` |
| Create / edit (`POST /definitions`) | **Splunk admin only** (`admin`/`sc_admin`) | line 1030 |
| Delete (`DELETE /definitions`) | **Splunk admin only** | line 1063 |
| Invoke (`POST /invoke`) | any authenticated user whose Org/BU the tool is in scope for | lines 1096-1105 |

The caller's Org and BU are resolved **server-side from that user's own Splunk roles**
(`_caller_tenant`, lines 248-265). The `org` / `bu` the browser sends are advisory hints
only — a non-admin claiming another tenant's Org/BU cannot list or invoke that tenant's
private tools, which is important because those tools run with *server-stored
credentials*. The `splunk_app` hint only selects which Org/BU app-pattern to match.

The authoring UI additionally returns `null` for non-admins (`CustomToolsSection.tsx:63`),
but that is cosmetic; the handler is the authority.

### 2.9 Per-invocation auditing

Every `/invoke` — success, failure, cache hit, refusal — writes one row to the
`itmip_llm_custom_tool_calls` KVStore collection (`default/collections.conf:405`,
writer at `bin/itmip_llm_custom_tools.py:1188-1219`). Auditing is best-effort by design:
an audit write that fails must never block the tool call (lines 426-436).

| Field | Meaning |
|---|---|
| `tool_name`, `user`, `org_short`, `bu_short` | who called what, as which tenant |
| `arguments_hash` | SHA-256 of the canonicalised arguments — **the arguments themselves are not stored** |
| `status` | `ok` / `error` |
| `error` | first 200 chars of the failure |
| `duration_ms` | wall time |
| `cached` | served from the in-process result cache |
| `customer_auth_used` | the IAM hook ran on this call |
| `credential_model` | `global` / `per_tenant` / `per_user` |
| `credential_ref_resolved` | the final `storage/passwords` **name** after template expansion — no value |
| `tls_verify_skipped` | the dev-mode TLS skip was active |
| `tool_kind` | `http_custom` here; `mcp` for MCP-imported |
| `run_id` | join key back to the template run (v1.7.0; older rows null) |
| `created_at` | epoch ms |

Read it from SPL with `| inputlookup itmip_llm_custom_tool_calls`. The collection is
admin-readable. `arguments_hash` means you can prove *the same arguments* were used
twice without the audit trail itself becoming a place secrets accumulate — but it also
means you cannot reconstruct what was asked from the audit alone. That is deliberate.

Note what is **not** there: the response body. A call is audited; its payload is not
retained.

---

## 3. Creating one, step by step

### Click path

**Adjutant AI → Tools → Custom tools → + Add custom tool**

The **Tools** tab is admin-only and hidden for everyone else (`src/App.tsx:233, 434`).
As of 2.5.9 the Tools page has four second-level tabs — **Built-in tools**, **Custom
tools**, **MCP servers**, **ServiceNow** (`ToolsPage.tsx:138-142`); before 2.5.9 these
were four panels stacked down one page, so reaching ServiceNow meant scrolling past 182
built-in rows. If you are reading an older doc that says "beneath the built-in tool
table", this is what changed.

The Custom tools panel lists what exists (Name / Type / Scope / Version / State) with
**Edit** and **Delete** per row, an **Import JSON** button and **+ Add custom tool**. A
tool using the IAM hook shows an **IAM** pill next to its name.

If the licence tier cannot unlock `custom_http_tools`, an upsell banner appears at the
top of the panel (`CustomToolsSection.tsx:77-79`) — see §8.

### Every field in the editor

Labels below are the literal on-screen strings. Blocks appear in this order.

**Identity**

| On-screen label | Stored as | Rules and notes |
|---|---|---|
| `Tool name (lowercase, 3-64 chars, no spaces)` | `name` | Must match `^[a-z][a-z0-9_]{2,63}$` (`itmip_llm_custom_tools.py:78`). This is the function name the LLM calls. Must be unique — a clashing name is refused with HTTP 409 (line 1044). A name colliding with a **built-in** is not refused at save time but the custom tool is silently dropped at runtime: built-ins win (§7). |
| `Title (display name)` | `title` | Admin-facing only. Never reaches the model. |
| `Version (semver)` | `version` | Must match `^\d+\.\d+\.\d+$`. Not used for anything at runtime — it is there so exported JSON is reviewable. |
| `Description (shown to the LLM — be specific)` | `description` | **Minimum 8 characters**, required. This is the *only* prose the model gets. Say what the tool does **and when to call it**; a vague description is the single most common reason a custom tool is never used or is used wrongly. |

**Scope**

| On-screen label | Stored as | Notes |
|---|---|---|
| `Sharing` | `scope.sharing` | `private (owner Org+BU only)` / `app (whole owner Org)` / `global (every Org)`. Evaluated in `_doc_visible_to` (`itmip_llm_custom_tools.py:268-285`). |
| `Owner Org` | `scope.owner_org` | Upper-cased by the form. |
| `Owner BU` | `scope.owner_bu` | Upper-cased by the form. |
| `Enabled` | `enabled` | Unticking hides the tool from every non-admin and refuses `/invoke` with 403 (line 1105). Admins still see disabled rows in the list. |

**Parameters** — see §4.

**Implementation**

| On-screen label | Stored as | Notes |
|---|---|---|
| `Type` | `implementation.type` | `http (declarative)` is the only selectable option. The other three are rendered `disabled` (`CustomToolsSection.tsx:509-517`). |
| `Method` | `implementation.method` | GET / POST / PUT / PATCH / DELETE. |
| `Timeout (s)` | `implementation.timeout_seconds` | Form clamps 1–60; default 10 (`DEFAULT_TIMEOUT_S`). |
| `URL (supports {{ argName }} substitution)` | `implementation.url` | Must be `http`/`https` (line 201). |
| `Allowed hosts (required — every host the tool may reach)` | `implementation.allowed_hosts` | Pill editor; type a host, Enter or **+ Add**. Lowercased on add. Non-empty is enforced server-side. |
| `Allow internal (RFC1918 / loopback) hosts in the allowlist` | `implementation.allow_internal` | Checkbox under the host pills. §2.3. |
| `Query params` | `implementation.query` | Key/value rows, `{{ }}`-substituted, URL-encoded and appended (line 772-774). |
| `Headers` | `implementation.headers` | Key/value rows, `{{ }}`-substituted. |
| `Auth type` | `implementation.auth.type` | `none` / `basic` / `bearer token` / `custom header`. |
| `Credential model (v0.7.0+)` | `auth.credential_model` | Shown only when auth type ≠ none. §5. |
| `Credential ref (name in storage/passwords)` | `auth.credential_ref` | Shown for the `global` model. |
| `Credential ref template — {org} and {bu} substitute at invoke` / `… {user} substitutes at invoke` | `auth.credential_ref_template` | Shown for `per_tenant` / `per_user`. |
| `Basic-auth username` | `auth.username` | Shown for `basic`. The *password* is the resolved secret. |
| `Header name` | `auth.header_name` | Shown for `header`. Defaults to `X-Api-Key` if left blank. |
| `Use customer auth hook for IAM-gated targets` | `implementation.customer_auth` | Calls `bin/customer_authorisation.py` once per request to mint headers, for targets behind WebEAM / Ping / Okta / AzureAD. Runs **after** static auth so its headers win on collisions; a hook failure is a **hard refusal** — there is no unauthenticated fallback (lines 758-764). See [the customer authorisation hook guide](../security/customer-authorisation-hook.md). |

**Outbound network (proxy + TLS CA)** — independent per tool, so several tools on one
search head can each use a different proxy and trust a different CA.

| On-screen label | Stored as |
|---|---|
| `Proxy URL (e.g. http://proxy.dc1.internal:8080)` | `implementation.proxy_url` |
| `Proxy credential ref (storage/passwords name; user:password format)` | `implementation.proxy_credential_ref` |
| `TLS CA ref (storage/passwords name holding a PEM CA bundle)` | `implementation.tls_ca_pem_ref` |
| `⚠ Skip TLS certificate verification (dev only)` | `implementation.tls_skip_verify` — **hidden on Splunk Cloud**, §2.7 |

All three are honoured by the shared outbound builder
`bin/itmip_llm_http_client.py::build_request`, which also backs the MCP client.

**Response shaping**

| On-screen label | Stored as | Notes |
|---|---|---|
| `Transform` | `response.transform` | `none` / `jq` / `jsonpath`. |
| `Max bytes (after transform)` | `response.max_bytes` | Default 8192, hard-capped at 65536 (§8). |
| `Expression (jq)` / `Expression (jsonpath)` | `response.expression` | Only shown when a transform is selected. |

A transform that cannot run — `jq` or `jsonpath_ng` not importable, or the expression
throws — does **not** fail the call. The untransformed body is returned and
`transform_skipped: true` comes back with it (`itmip_llm_custom_tools.py:620-645`). The
reasoning is that the LLM still gets data; the cost is that a silently-skipped transform
can push a much larger payload at the model than you designed for, which then hits
`max_bytes` and truncates mid-JSON. If you rely on a transform, check
`transform_skipped` in the Save & test output.

**Guardrails**

| On-screen label | Stored as | Default |
|---|---|---|
| `Rate limit (calls / min / user)` | `guardrails.rate_limit_per_minute` | 30 |
| `Cache TTL (seconds, 0 = off)` | `guardrails.cache_ttl_seconds` | 0 |
| `Redact fields (comma-separated)` | `guardrails.redact_fields` | empty |

The result cache is in-process and keyed by credential model —
`(tool, args)` for global, `(tool, org, bu, args)` for per-tenant,
`(tool, user, args)` for per-user (`itmip_llm_custom_tools.py:1128-1137`), so a cached
result can never cross a tenant or user boundary. Only successful calls are cached
(line 1175). A cache hit **does not re-run the IAM hook** — that is why
`customer_auth_used` is false on cached rows, and it is how you tell a fresh
gateway-authorised call from a replayed one in the audit log.

**Footer** — `Export JSON` (left), `Cancel` / `Save` (right).

---

## 4. The parameters JSON Schema

`parameters` is a JSON Schema draft-07 **object** schema. Its `properties` and `required`
are what the model receives as the tool's `input_schema`; everything else in the schema
is stored but not forwarded.

The server validation is deliberately light — the app does not carry `jsonschema` as a
dependency (`itmip_llm_custom_tools.py:105-125`). It refuses:

- `parameters` that is not an object,
- `parameters.type` that is not `"object"`,
- `properties` that is not an object,
- `required` that is not an array of strings,
- a `required` entry that is not present in `properties` — the one error that actually
  catches a real authoring mistake.

The browser also refuses to save while the textarea does not parse as JSON with
`type: "object"` (`CustomToolsSection.tsx:258-271`); the field border turns red and
**Save** reports `Parameters JSON Schema is invalid.`

Note what is *not* enforced: nothing validates the arguments the model actually sends
against this schema at invoke time. The schema is guidance to the model and a contract
for your `{{ }}` placeholders — the real gate on a bad argument is that `_render` fails
closed on a missing key, plus the `allowed_hosts` re-check.

### Worked example

A tool that fetches a CI's owner from an internal CMDB.

```json
{
  "name": "cmdb_get_ci_owner",
  "version": "1.0.0",
  "title": "CMDB — get CI owner",
  "description": "Look up the owning team and on-call contact for a configuration item by its exact CI name, as recorded in the Acme CMDB. Call this when a search result names a host, service or application and you need to say who owns it. Returns owner_team, owner_email and support_group. Does not accept partial names or wildcards.",
  "scope": { "sharing": "app", "owner_org": "ACME", "owner_bu": "OPS" },
  "parameters": {
    "type": "object",
    "properties": {
      "ci_name": {
        "type": "string",
        "description": "Exact CI name as it appears in the CMDB, e.g. 'web-prod-07' or 'payments-api'. Case-sensitive. Not a wildcard."
      },
      "include_children": {
        "type": "boolean",
        "description": "When true, also return owners of CIs that depend on this one. Defaults to false; leave it out unless the user asked about downstream impact."
      }
    },
    "required": ["ci_name"]
  },
  "implementation": {
    "type": "http",
    "method": "GET",
    "url": "https://cmdb.acme.example/api/v2/ci/{{ ci_name }}/owner",
    "allowed_hosts": ["cmdb.acme.example"],
    "query": { "expand": "{{ include_children }}" },
    "headers": { "Accept": "application/json" },
    "auth": {
      "type": "bearer",
      "credential_model": "global",
      "credential_ref": "cmdb_readonly"
    },
    "timeout_seconds": 10
  },
  "response": {
    "transform": "jq",
    "expression": "{owner_team: .result.owner_team, owner_email: .result.owner_email, support_group: .result.support_group}",
    "max_bytes": 2048
  },
  "guardrails": {
    "rate_limit_per_minute": 20,
    "cache_ttl_seconds": 300,
    "redact_fields": ["sys_id", "internal_notes"]
  },
  "enabled": true
}
```

Things this example is doing on purpose:

- **The description tells the model when to call it and what it refuses.** "Does not
  accept partial names or wildcards" saves a round of failed calls.
- **Every property has its own `description`.** Those descriptions reach the model
  verbatim — they are the cheapest accuracy improvement available.
- **`include_children` is optional and the description says what the default means.**
  If the model omits it, `{{ include_children }}` raises `KeyError` and the call fails
  closed. Either mark it `required`, or move it out of the template and into a fixed
  query value. This is the most common trap in the template system: an *optional*
  parameter used in a `{{ }}` placeholder is effectively required.
- **The `jq` transform projects three fields** rather than redacting the rest — an
  allowlist, with `redact_fields` as belt-and-braces if the transform is skipped.
- **`cache_ttl_seconds: 300`** because CI ownership does not change minute to minute,
  and the model tends to ask about the same host repeatedly inside one investigation.

---

## 5. Credential models

Set `Auth type` first; the `Credential model` selector appears only when it is not
`none`. All three resolve against `storage/passwords`, realm `itmip_llm_assistent_app`.

| Model | Resolves to | Template placeholders | Use when |
|---|---|---|---|
| `Global — one shared identity for everyone` | the literal `credential_ref` | — | one service account for the whole estate |
| `Per-tenant — one identity per (Org, BU)` | `credential_ref_template` with `{org}` / `{bu}` substituted | `{org}`, `{bu}` (`{user}` renders empty) | MSP / multi-tenant installs where each customer has their own upstream account |
| `Per-user — each Splunk user's own OAuth token` | `credential_ref_template` with `{user}` substituted | `{user}`, `{org}`, `{bu}` | **not shipped** — see below |

Substituted values are lower-cased and stripped to `[a-z0-9_-]`
(`_safe_lower`, `itmip_llm_custom_tools.py:487-497`), so Org `ACME` / BU `Ops-1` with
template `confluence_{org}_{bu}` resolves to `confluence_acme_ops-1`.

**Backward compatibility:** a definition with no `credential_model` but a
`credential_ref` is interpreted as `global` (lines 543-545), so 0.6.0-era definitions
keep working untouched.

### Storing the secret

There is no in-app secrets editor for tool credentials. The UI hint mentioning a
"Secrets tab" (`CustomToolsSection.tsx:1148`) does not correspond to a tab that exists —
store the credential against splunkd directly:

```bash
curl -k -u admin:<pw> \
  --data-urlencode "name=cmdb_readonly" \
  --data-urlencode "realm=itmip_llm_assistent_app" \
  --data-urlencode "password=<the token>" \
  https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/passwords
```

For a PEM CA bundle use `--data-urlencode "password@/path/to/file"` so the newlines
survive — [the tool catalogue](./tool-catalogue.md), "Working with PEM files", has the full procedure and the verification
one-liner.

### What happens when a credential is missing

This differs by model, and the difference is deliberate:

- **Global** — `/invoke` returns `{ok: false, error: "credential_ref '<name>' is missing
  or empty."}` (lines 709-719). A global credential missing is a *configuration* error;
  it should be loud.
- **Per-tenant** — the tool is **dropped from the advertised list** for that (Org, BU)
  before the model ever sees it (lines 1004-1026). A tenant that has not been onboarded
  simply does not get the tool, rather than getting a tool that fails on every call.
  Dropping is not silent: every listing logs it, and the first drop per process also
  posts a Splunk system message naming the tool, the tenant and the fix
  (`_announce_tool_drop`, lines 507-523):

  > Custom tool 'x' is not advertised for Org ACME / BU OPS: its per-tenant credential
  > is missing from the secret store. Store the credential to restore the tool.

  If an admin reports "the tool works for me but the model never uses it for Team B",
  this is the first thing to check. Note that **admins see every tool regardless of
  scope** (`_doc_visible_to` returns True for admins, line 270) — but the per-tenant
  credential drop is applied *after* that, so an admin without the credential for their
  own resolved Org/BU also loses the tool from the advertised list.
- **Per-user** — see below.

### Per-user is schema-only

The `per_user` runtime is **not shipped in 2.5.9**. The schema is in place, the editor
accepts it, the definition saves and loads — and every invocation returns a structured
refusal (lines 586-595):

```json
{
  "ok": false,
  "error": "no_user_credential",
  "auth_url": null,
  "message": "No per-user credential is stored for 'github_user_alice'. Connect your account in Settings → Tool credentials, then re-try."
}
```

`auth_url` is `null` because the OAuth-start endpoint does not exist yet, and the
"Settings → Tool credentials" page referenced in that message does not exist either.
Per-user tools stay **visible** to the model (unlike per-tenant) precisely so the model
can relay that message and the user can act on it — which, today, they cannot.

The in-app hint says the runtime is "scheduled for v0.8.0"
the user-credential runtime is not yet shipped; the handler comment
says "Phase 3". All three predate 2.5.9 and none of them has happened. **Do not build a
workflow on `per_user`.** If a user-scoped credential is a hard requirement today, the
workable shape is `per_tenant` with a BU per team, or an IAM gateway in front of the
upstream via the `customer_auth` hook, which *does* have the calling user's name in its
context (`splunk_user`, line 755).

---

## 6. Testing it — Save & test

At the bottom of the editor, above the footer:

1. **`Arguments JSON`** — a textarea. Type the arguments as the model would send them,
   e.g. `{"ci_name":"web-prod-07"}`.
2. **`Save & test`** — the button. It **saves the draft first**, then calls `/invoke`
   (`CustomToolsSection.tsx:328-361`). There is no dry-run: a `DELETE`-method tool
   under test performs the delete.
3. The status line next to the button shows `OK (HTTP 200)`, plus ` — cached` and/or
   ` — truncated` when either applies, or `Error: <message>`.
4. The response body appears in a scrolling `<pre>` below.

The path is the same `/invoke` the LLM uses — same allowlist check, same credential
resolution, same transform, same redaction, same rate limit, same audit row. **What you
see in that box is exactly what the model will see**, which is the point: if the output
is 6 KB of noise, the model gets 6 KB of noise.

Two consequences to keep in mind:

- Your test calls **count against the rate limit** and **populate the cache**. A second
  test with identical arguments inside the TTL returns the cached body, marked
  `— cached`; it does not re-hit the upstream.
- Your test calls appear in `itmip_llm_custom_tool_calls` under your own username. That
  is correct — an admin testing a credentialled call is exactly the thing an audit trail
  should record.

If the test fails, read the error literally:

| Error | What it means |
|---|---|
| `Host 'x' is not in allowed_hosts.` | the *rendered* host is not an exact match for a list entry — check case and any `{{ }}` in the URL |
| `Host 'x' resolves to a private network.` | §2.3 — tick allow-internal if that is genuinely intended |
| `Missing required argument: x` | a `{{ x }}` placeholder has no matching key in your arguments JSON |
| `credential_ref 'x' is missing or empty.` | no `storage/passwords` entry named `x` under realm `itmip_llm_assistent_app` |
| `Network error: …` / `Request failed: …` | did not reach the upstream — proxy, DNS, TLS |
| HTTP 429 | your own rate limit; wait a minute |
| HTTP 403 `require an Enterprise license` | §8 |
| HTTP 501 | a non-`http` implementation type; §8 |

---

## 7. Attaching a tool to a playbook

There are two independent layers. Both must let the tool through.

### 7.1 Tenant visibility — scope, and Tools → Manage

A custom tool's own `scope.sharing` + `Owner Org` / `Owner BU` decide which tenants can
see and invoke it at all (§3). That is the mechanism to use.

The per-Org/BU **Manage** button described in [the tool catalogue](./tool-catalogue.md) lives on the **Built-in tools**
tab only, and that table is built from `TOOL_DEFINITIONS` — the hard-coded built-in
catalogue (`ToolsPage.tsx:72-76`). **Custom tools do not appear there and cannot be
assigned from the UI.** The runtime *does* apply `isToolEnabled()` to the combined
built-in + custom + MCP list (`src/services/llm/ask.ts:404-406`), so a row written
directly into `itmip_tool_assignments` with a custom tool's name would take effect — but
there is no supported path to create one, and the metadata-override editor is likewise
built-ins-only. Use `scope` and the `Enabled` checkbox.

### 7.2 Playbook scoping — Playbooks → edit → Routing & tools

In the playbook editor, the **Routing & tools** tab (`TemplatesPage.tsx:698`) carries
four fields (lines 1675-1706):

| On-screen label | Field |
|---|---|
| `Tool tag filters — only tools with any of these tags will be advertised` | `tool_tag_filters` |
| `Tool category filters — only tools in any of these categories will be advertised` | `tool_category_filters` |
| `Allowed tools (explicit allowlist; union with the tag/category filters above)` | `allowed_tools` |
| `Denied tools (subtracted after every other filter)` | `denied_tools` |

The resolution order is in `filterToolsByTemplate` (`src/services/llm/ask.ts:128-164`):

1. If the playbook sets **none** of `allowed_tools` / `tool_tag_filters` /
   `tool_category_filters` / `denied_tools`, the model is offered only the small
   **essentials set** (~21 built-ins) and discovers the rest on demand via
   `splunk_route_tools`. **Your custom tool is not in the essentials set** — see below.
2. A tool passes the positive scope if it is a UNIVERSAL tool, or is named in
   `allowed_tools`, or carries a tag in `tool_tag_filters`, or a category in
   `tool_category_filters`. The three are a **union**, not an intersection.
3. If only `denied_tools` is set, everything else is allowed — a pure denylist.
4. `denied_tools` is subtracted last and wins over everything except UNIVERSAL tools.

The `Allowed tools` / `Denied tools` pickers autocomplete against the union of built-in,
custom and MCP tool names for your Org/BU (`TemplatesPage.tsx:1528-1560`), so your custom
tool appears in the dropdown once saved. Free text is still accepted — a typo'd name is
not rejected anywhere, it just never matches a tool, so copy the name rather than typing
it.

> **Tags and categories do not work for custom tools.** This is the one place where the
> feature set does not line up. The `itmip_llm_custom_tools` collection has no
> `category` or `tags_json` field (`default/collections.conf:380-399` — compare
> `itmip_mcp_tools` at line 537, which has both), the editor has no field for them, and
> `listCustomToolDefinitions` emits no `tags` or `categories`
> (`src/services/tools.ts:14133-14145`). So `tool_tag_filters` and
> `tool_category_filters` can **never match a custom tool**. `src/services/tools.ts:13828`
> says so in as many words.
>
> **The practical rule: name your custom tool explicitly in `allowed_tools`.** A
> playbook scoped purely by tag will silently not advertise it.

A custom tool that is not advertised up front can still be reached mid-conversation:
`splunk_route_tools` includes custom tools in its catalogue and *adds* what it returns to
the live advertised set. But with no tags or categories it only surfaces there on a
free-text `query` match against its name or description, or when the router is called
with no filters at all. That is another reason the description matters.

### 7.3 Name collisions

The advertised list is deduplicated with **first occurrence wins**, and built-ins are
prepended (`src/services/llm/ask.ts:388-403`). A custom tool named `splunk_run_search`
is dropped with a console warning; it cannot hijack a built-in. At execution time the
dispatcher routes built-in → MCP → custom in that order
(`src/services/tools.ts:13985-14023`).

---

## 8. What this cannot do

Honest limits, roughly in order of how often they bite.

**Only `http` is executable.** `implementation.type` accepts `http`, `splunk_search`,
`kvstore_lookup` and `python` at validation (`itmip_llm_custom_tools.py:99`), but
`SUPPORTED_IMPL_TYPES = {"http"}` (line 100) and `/invoke` returns **HTTP 501** for the
other three (lines 1110-1111). The editor renders them as disabled options labelled
"coming in 0.5.x" — a label that has been wrong since 0.5.x shipped. Treat the three as
reserved schema, not as a roadmap commitment.

**Enterprise licence required.** `custom_http_tools` maps to `TIER_ENTERPRISE`
(`bin/itmip_llm_license_tier.py:155`). Listing (GET) stays open so the UI can render the
greyed state, but **authoring and every invocation** are refused server-side with HTTP
403 `Custom HTTP tools require an Enterprise license.`
(`itmip_llm_custom_tools.py:971-974`). That check is authoritative — a direct REST call
cannot bypass it. See the licensing reference.

**Response size is hard-capped at 64 KB.** `HARD_MAX_BYTES = 64 * 1024`. The socket read
stops there and sets `truncated: true` (lines 845-847); after the transform,
`response.max_bytes` (default 8192) is applied and is itself clamped to the hard cap
(lines 874-881). Truncation is a **byte slice**, not a structural one — a truncated JSON
body reaches the model as invalid JSON. If your upstream returns large payloads, a
transform that projects the few fields you need is not optional.

**No human confirmation gate, ever.** `GATED_TOOL_NAMES` is derived from the `gated` tag
on `TOOL_DEFINITIONS` — built-ins only (`src/services/tools.ts:4512-4514`). A custom
tool with `method: "DELETE"` against a production API will be executed by the dispatcher
with no confirmation modal, no matter what it does. Nothing in the definition can request
one. **If a custom tool mutates anything you care about, the safety has to live upstream**
— a scoped service account, a change-approval step behind the API, an IAM gateway. Prefer
read-only tools.

**No response-schema validation and no argument validation.** The `parameters` schema is
advisory to the model; nothing enforces it at invoke time. The response is whatever the
upstream sent.

**No retries, no circuit breaker.** One attempt, one timeout (default 10 s, form max 60).
A 5xx comes back as `ok: false` with the upstream body; a network failure as
`Network error: …`. A consistently failing upstream will be re-tried by the *model* as
many times as its loop allows, each one a fresh audit row.

**Rate limit and cache are per-process.** Both live in module-level dicts. Worker
recycling resets them; SHC members do not share them. §2.6.

**No pagination, no multi-step calls.** One definition is one request. Following a
`next` link means a second tool, or a model-driven second call with a different argument.

**No response streaming, no file/binary handling.** The body is decoded as UTF-8 with
replacement (line 854). Binary upstreams produce garbage.

**No versioning or rollback of definitions.** `version` is a label. Edits overwrite the
KVStore row; the change is emitted to the KVStore changelog
(`emit_change`, lines 1048-1057) but the previous definition is not recoverable from the
UI. Export the JSON before a risky edit.

**Definitions are not backed up separately.** They live in the `itmip_llm_custom_tools`
collection and ride along with whatever covers your KVStore
(see the support-bundle guide and the Backups page). The *credentials* live
in `storage/passwords` and do not — a restored KVStore with no matching secrets gives you
tools that fail (global) or vanish (per-tenant).

---

## 9. Import and export

A tool definition is plain JSON, and the round trip is symmetric.

**Export** — open a tool, click **Export JSON** in the editor footer. The browser
downloads `<tool_name>.json` containing the current *draft* — including unsaved edits —
with `_key` stripped (`CustomToolsSection.tsx:363-375`).

**Import** — **Tools → Custom tools → Import JSON**, paste, **Import**. The modal
(lines 1203-1292):

- merges the pasted object over `emptyCustomTool(orgShort, buShort)`, so anything the
  JSON omits gets the starter default rather than `undefined`;
- **forces `_key: ""`** so the import always creates a fresh row and can never overwrite
  an unrelated tool by key;
- leaves `scope` as whatever the JSON specified, falling back to the importer's own
  Org/BU. The modal's own text says the importing Org/BU "defaults to X/Y" — that is
  only true when the pasted JSON has no `scope`. **An exported `global`-scoped tool
  stays `global` on import.** Check the scope after importing somebody else's
  definition.

Then it goes through the same `POST /definitions` validation as a hand-authored tool,
including the unique-name check — importing a definition whose `name` already exists is
refused with HTTP 409, not merged. Rename or delete the incumbent first.

**What does not travel with the JSON:** the credential. The export contains
`credential_ref` / `credential_ref_template` — a *name* — and the `storage/passwords`
entry it points at exists only on the search head where you created it. The same applies
to `proxy_credential_ref` and `tls_ca_pem_ref`. Importing a tool into a new environment
is two steps: paste the JSON, then create the secrets it names.

Also check `tls_skip_verify` on anything imported from a dev instance. It is hidden from
the editor on Splunk Cloud and ignored at runtime there, but on a non-Cloud target it
will be honoured, silently, until somebody reads the audit log.

---

## Related documents

- [the tool catalogue](./tool-catalogue.md) — the Tools tab end-to-end: built-ins, routing, overrides, MCP,
  PEM handling.
- [the ServiceNow guide](../integrations/servicenow.md) — use this instead of a custom tool for ServiceNow.
- [the customer authorisation hook guide](../security/customer-authorisation-hook.md) — the IAM hook the
  `customer_auth` checkbox invokes.
- [the auditing guide](../security/auditing.md) — where custom-tool invocations sit in the wider audit
  picture.
- the licensing reference — the per-feature capability matrix.
- the security audit — the findings the controls above answer.
