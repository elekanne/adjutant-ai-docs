---
sidebar_position: 10
---

# Adjutant AI — inbound MCP server (playbooks over MCP)

**App version:** 2.5.9  ·  **Last updated:** 2026-09-22  ·  **Audience:** Splunk
admins publishing Adjutant AI playbooks to other AI agents.

Adjutant AI exposes a small set of tools over the Model Context Protocol so an external AI
agent — or Splunk's own MCP Server — can discover and run your governed playbooks with a
**fire‑and‑poll** pattern: start returns a `run_id` immediately, then two fast read‑only tools
report progress and return the verdict.

> **Use Splunk's MCP Server.** On any estate that has **Splunk_MCP_Server ≥ 1.2**, that is the
> route to use, and the app registers the playbook tools into it automatically. It is Splunk's
> own supported surface, it is where an agent already looks for Splunk tools, and it gives you
> one endpoint, one token audience and one place to govern access instead of a second server to
> expose and maintain. The app's **standalone** endpoint is a **compatibility fallback**, for
> estates where Splunk_MCP_Server is absent or older than 1.2. It is fully supported and
> functionally equivalent; it is simply not the one to reach for first.

| Tool | Args | Does |
|---|---|---|
| `adjutantai_list_playbooks` | `org_bu` (e.g. `TDDD/SFIT`) | Lists the **MCPready‑tagged** playbooks visible to that Org/BU. |
| `adjutantai_start_playbook` | `org_bu`, `playbook_name` | Enqueues an **unattended** run through the governed Backend Ask Service; returns a `run_id` **immediately** (does not wait). |
| `adjutantai_get_playbook_status` | `org_bu`, `run_id` | Read‑only. Returns `queued` / `running` / `completed` / `failed` (+ `retrying`/`attempts`/`partial`). |
| `adjutantai_get_playbook_results` | `org_bu`, `run_id`, `format?` | Read‑only. Returns the verdict once `completed`; `format=summary` (default) or `full`. |

> The pre‑1.8.4 name `adjutantai_run_playbook` has been **removed** (it had no consumers) — use
> `adjutantai_start_playbook`, which does exactly the same thing (starts asynchronously, returns
> a `run_id` immediately — it was never a "run and wait" tool). The reconciler
> **de‑registers** any lingering `run_playbook` from Splunk's MCP Server automatically on its
> next tick.

**Why start/status/results instead of one blocking run?** A playbook can take several minutes,
but MCP tool calls face multiple independent timeouts none of which you control on a customer
deployment — the Splunk MCP Server's 60‑second guardrail, the MCP client's per‑request timeout,
HTTP intermediaries (load balancers/proxies), and the orchestrating LLM's own patience. So every
Adjutant tool call completes in **seconds** and the agent polls. Raising the MCP Server guardrail
is **not required**.

Only playbooks you tag **`MCPready`** are ever exposed. **Starting** a run requires the Backend
Ask Service (`[agent_runner] enabled=1`) and an **admin** caller; the read‑only **status/results**
tools require only that you are authorized for the run's Org/BU (admin, same‑tenant, or the run's
owner) — a run started by one tenant is never readable by another (`SEC-3`). Run records expire
after `[agent_runner] queue_retention` (default 7 days); an expired `run_id` returns not‑found.

> **Ships with one example.** A read‑only reference playbook, **`MCP Example: Read-only
> Health Check`**, is seeded on every install (scope `DFLT/DFLT`, `sharing=global`, all
> licence tiers, tagged `MCPready`). So the moment you switch the server on,
> `adjutantai_list_playbooks` returns something for **any** valid Org/BU — you don't have to
> tag one of your own first. It performs no writes; running it still needs `[agent_runner]=1`.
> The Org/BU you pass must be a **registered business unit** (`itmip_business_units`); an
> unknown value returns `Unknown Org/BU …`. `TDDD/SFIT` in these docs is only a placeholder —
> use one of your real Org/BUs.

---

## 1. OFF by default — the master switch

The whole surface is **disabled by default**. Turn it on in
`default/itmip_ai_workbench.conf` (or a `local/` override) and **restart splunkd**:

```ini
[mcp_server]
enabled = 1
# Register the playbook tools into Splunk's own MCP Server (Splunk_MCP_Server) if it is
# installed, so they appear at the /services/mcp URL. Default 1 — LEAVE IT AT 1. This is
# the preferred surface; setting it to 0 leaves only the standalone fallback endpoint.
register_in_splunk_mcp = 1
```

That is the whole configuration. With the default `register_in_splunk_mcp = 1`, an estate
running `Splunk_MCP_Server` ≥ 1.2 gets the preferred surface with no further steps: the tools
appear at `/services/mcp` on the next reconcile tick.

When `enabled = 0` (default) both endpoints below return a clear "disabled" error and the
tools are **not** registered anywhere.

---

## 2. Two ways to reach the tools

**Prefer Splunk's MCP Server.** Use the standalone endpoint only when that is not available.

| | Splunk's MCP Server (**preferred**) | Standalone Adjutant endpoint (fallback) |
|---|---|---|
| URL | `/services/mcp` | `/services/itmip_llm/mcp_server` |
| Needs | `Splunk_MCP_Server` ≥ 1.2 installed | nothing beyond this app |
| Setup | automatic (`register_in_splunk_mcp = 1`) | none |
| Token | bearer/JWT with **`audience = mcp`** | any Splunk auth (bearer, session, basic) |
| Use it when | the estate has Splunk_MCP_Server ≥ 1.2 | it is absent, or older than 1.2 |

### A. Inside Splunk's own MCP Server (the `/services/mcp` URL) — **preferred**
When `register_in_splunk_mcp = 1` (the shipped default), the app **auto‑registers** the playbook
tools as `api`‑type **custom tools** in `Splunk_MCP_Server` (via `POST /services/mcp_tools`), so
they show up at `https://<host>:8000/<locale>/splunkd/__raw/services/mcp` next to
`splunk_get_info`, `saia_*`, etc. The scripted input `bin/itmip_llm_mcp_register.py` reconciles
this on startup and every few minutes; disabling the switch (or the app) **de‑registers** them.

Nothing to configure beyond the master switch in section 1: if `Splunk_MCP_Server` is installed
and new enough, the tools appear there on the next reconcile tick.

> **⚠ Version requirement — Splunk_MCP_Server 1.2+.** Registering into Splunk's MCP Server
> only works on **Splunk_MCP_Server 1.2 or newer**, because custom‑tool **argument
> substitution** (`$org_bu$` → the caller's value) was added in 1.2. On **1.1.x** the
> placeholders pass through **literally** (verified on 1.1.3), so the tools would receive
> `"$org_bu$"` and error. To avoid registering broken tools, the app **checks the
> installed `Splunk_MCP_Server` version and only registers on ≥ 1.2**; below that it
> **de‑registers** rather than leaving broken tools in place, logs a note (in
> `index=_internal sourcetype=itmip_llm_mcp_register`) and registers nothing. Fall back to the
> **standalone endpoint** (option B) until you upgrade Splunk_MCP_Server.
>
> Note the placeholder syntax is **dollar‑delimited `$arg$`** — the Splunk_MCP_Server docs
> show `{{arg}}`, but its `tool_manager._substitute_placeholders` uses `$arg$`. Verified
> end‑to‑end on **Splunk_MCP_Server 1.2.1** (a `tools/call adjutantai_list_playbooks`
> with `org_bu` returns the playbook list via both `:8089` and the `:8000` web port).

### B. The standalone Adjutant MCP server — fallback, works on any Splunk
Reach for this when `Splunk_MCP_Server` is **not installed** or is **older than 1.2**, or when an
MCP client cannot produce a bearer token with `audience = mcp`. A JSON‑RPC 2.0 MCP endpoint
served directly by this app:

```
POST  https://<host>:8089/services/itmip_llm/mcp_server        (splunkd management port)
      https://<host>:8000/<locale>/splunkd/__raw/services/itmip_llm/mcp_server   (via Splunk Web)
```
Speaks `initialize` / `tools/list` / `tools/call` / `ping`. Point any MCP client that can
target a plain HTTP JSON‑RPC endpoint at it. This is independent of Splunk's own MCP
Server and works regardless of its version, which is exactly why it exists.

There is also a **flat REST** companion (used by option A and handy for scripts):
`POST /services/itmip_llm/playbooks` with body
`{"action":"list"|"run","org_bu":"…","playbook_name":"…"}`.

Both surfaces run the **same** governed code path and enforce the **same** gates (section 4), so
choosing one over the other changes reachability and nothing else.

---

## 3. How to authenticate

Both surfaces use **standard Splunk authentication** — there is no separate credential.
Authenticate as a Splunk **user** whose role carries the capabilities the tools need
(list needs a normal authenticated user scoped to the Org/BU; **run** needs **admin**).

### To Splunk's MCP Server (option A, preferred)
The MCP client authenticates to **Splunk's** MCP server (`/services/mcp`) with a Splunk bearer
token — but note **Splunk_MCP_Server only accepts a bearer (JWT) token whose `audience` is
`mcp`** (a session key or a token with any other audience is rejected with
`Failed to decode bearer token` / `Invalid token audience`). Create one via
Settings → Tokens (Audience = `mcp`) or `POST /services/authorization/tokens` with
`audience=mcp`.

When the tool executes, Splunk's MCP Server calls the app's `/services/itmip_llm/playbooks`
endpoint **on the caller's behalf** — the caller's identity/roles carry through, so the same
admin / Org‑BU / MCPready gates apply. Registering the tools needs the **`mcp_tool_admin`**
capability; the app's scripted input runs `passAuth = admin`, so no manual step is required.

### To the standalone Adjutant endpoint (option B, fallback)
- **Bearer token (recommended for MCP clients).** Create a Splunk authentication token
  (Settings → Tokens, or `POST /services/authorization/tokens`) for that user and send it:
  ```
  Authorization: Bearer <splunk_token>
  ```
- **Session/basic auth** also works (`Authorization: Splunk <sessionKey>`, or HTTP Basic for
  a quick test).

No `audience` constraint applies here, which is the one practical reason to choose this surface
on an estate that could otherwise use option A.

---

## 4. Governance (unchanged by where the tools are surfaced)

Wherever the tools appear, the app enforces, server‑side:
- **MCPready allowlist** — only `MCPready`‑tagged playbooks are listable/runnable.
- **Org/BU safeguard** — admin may target any valid Org/BU; a tenant‑scoped caller only its own.
- **Run gates** — `[agent_runner] enabled=1` **and** an admin caller; runs go through the
  governed Backend Ask Service queue (default‑deny allowlist, write‑back contract).

## 5. Files
- `bin/itmip_llm_mcp_server.py` — JSON‑RPC MCP endpoint + the shared list/run/authorise logic.
- `bin/itmip_llm_playbooks.py` — flat REST companion (`/services/itmip_llm/playbooks`).
- `bin/itmip_llm_mcp_register.py` — scripted input that (de)registers the tools in
  Splunk_MCP_Server per the switch + the ≥1.2 version guard.
- `default/itmip_ai_workbench.conf` `[mcp_server]` — the master switch.
