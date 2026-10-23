---
sidebar_position: 8
---

# Extending Adjutant AI — MCP servers and custom tools

**App version:** 2.5.9
**Last updated:** 2026-09-22
**Audience:** Splunk administrators connecting Adjutant AI to systems outside
Splunk, or exposing Adjutant AI's playbooks to other AI agents.

Out of the box the assistant can reach Splunk and the tools this app ships with.
This manual covers the three ways to widen that reach — and, just as importantly,
which of the three to choose.

---

## Contents

1. [Three ways to extend, and when to use each](#1-three-ways-to-extend-and-when-to-use-each)
2. [Connecting to an MCP server](#2-connecting-to-an-mcp-server)
3. [Choosing which tools to import](#3-choosing-which-tools-to-import)
4. [Keeping imported tools honest](#4-keeping-imported-tools-honest)
5. [Credentials](#5-credentials)
6. [Reaching a server the search head cannot](#6-reaching-a-server-the-search-head-cannot)
7. [Custom HTTP tools](#7-custom-http-tools)
8. [Publishing your playbooks over MCP](#8-publishing-your-playbooks-over-mcp)
9. [What a tool call leaves behind](#9-what-a-tool-call-leaves-behind)
10. [Limits](#10-limits)

---

## 1. Three ways to extend, and when to use each

They sound similar and solve different problems.

| | What it is | Reach for it when |
|---|---|---|
| **MCP client** (§2) | Adjutant connects **out** to a Model Context Protocol server someone else runs, and imports its tools | The system you want already has an MCP server — Confluence, GitHub, a vendor's, or one your platform team runs |
| **Custom HTTP tool** (§7) | You describe one REST call, and the assistant can make it | There is no MCP server, just an API. One endpoint, one job |
| **MCP server** (§8) | Adjutant publishes **your playbooks** so other AI agents can run them | Another agent — or Splunk's own MCP Server — should be able to run your investigations |

The first two bring capability **in**. The third sends it **out**. They are
independent; most estates use one or two, and nothing breaks if you use all three.

> Everything here is **administrator-only** and **off until you configure it**.
> No connection is made, and no tool is offered to the model, until you say so.

### Licensing

MCP servers and custom HTTP tools both need an **Enterprise** licence. Below
that, the sections still appear in the **Tools** tab with an upgrade note, and
nothing activates.

---

## 2. Connecting to an MCP server

**Tools → MCP servers → + Add MCP Server.**

### What you will need

| Field | Meaning |
|---|---|
| **Name** | Yours to choose, unique within the Org. |
| **Short** | 1–8 characters. Becomes the prefix on every imported tool name, so two servers offering `search_pages` do not collide. |
| **Transport** | **Streamable HTTP** (current) or **HTTP + SSE** (legacy). Both work — Streamable HTTP is a superset, so one code path serves them and a server that replies with either single JSON or an event stream is handled. Pick what the server documents; if in doubt, leave it on Streamable HTTP. |
| **Endpoint URL** | The server's address. |
| **Org / BU** | Who may use it. Imported tools can be narrowed further, never widened beyond this. |
| **Credential** | See §5. |

**Network transports only.** A server that offers nothing but stdio is out of
scope — the search head does not spawn long-lived child processes for this. If
that is all you have, put a small HTTP adapter in front of it.

### The connection test

Saving runs a real handshake and asks the server for its tool list, using the
credential and proxy you configured. The result appears inline. A failure tells
you which step failed — reaching the host, the TLS handshake, authentication, or
the tool listing — so you are not guessing between a firewall and a bad token.

---

## 3. Choosing which tools to import

The test leaves you looking at everything the server advertises, each with a
checkbox. **Nothing is imported until you tick it.**

That is deliberate. An MCP server can advertise dozens of tools. Every one you
import is described to the model on every turn, which costs tokens and dilutes
its attention. Import the three you need, not the forty on offer.

For each tool you keep:

| Setting | What it does |
|---|---|
| **Exposed name** | What the model sees. Prefilled as `<short>_<upstream name>`. Editable, but two tools cannot share a name within the same Org/BU. |
| **Description addendum** | Your text, appended to the server's own description when the model reads it. Use it to say when *your* people should reach for this tool. |
| **Short description** | For you, in the admin table. The model never sees it. |
| **Category** | Groups the tool in the Tools tab. Grouping only — it changes nothing about behaviour. |
| **Tags** | Free-form, for filtering a long list. No functional role. |
| **Org / BU** | Narrower than the server's scope, or equal to it. |

### Trying one before you trust it

Expand any imported tool and use **Run**. It calls the real server with the
stored credential and shows you the raw response. That is how you confirm a tool
does what its description claims, before the assistant starts calling it on
someone's behalf.

---

## 4. Keeping imported tools honest

An upstream server can change under you. Adjutant checks periodically, and
whenever you press **refresh** on a server.

| What changed | What happens |
|---|---|
| A tool's description or input schema | Flagged as **drift** with a badge. **The change is not applied silently** — you review it and click *Accept upstream changes*. |
| A tool disappeared upstream | Disabled automatically and marked as removed. Past audit records stay valid. |
| A new tool appeared | Listed as *available but not imported*, with a quick-import button. |

Your edits survive all of this. The addendum, category, tags, exposed name and
visibility are yours and are never overwritten by a refresh.

**Unreachable servers drop out quietly.** If a server is down, its tools are
simply not offered to the model that turn — no error in the middle of somebody's
question. A degraded server still offers its tools and logs a warning.

---

## 5. Credentials

Two models for MCP servers, chosen per server.

| Model | The server sees | Use it when |
|---|---|---|
| **Global** | One identity, for everybody | The upstream system does its own authorisation, or every user should look the same to it |
| **Per tenant** | One identity per Org/BU | Different business units must not read each other's data upstream |

With per-tenant, a tenant that has no credential stored simply does not see those
tools. They are dropped before the model is told about them, rather than failing
mid-answer.

**How the credential is sent** is yours to specify — an auth header template such
as `Bearer {token}` puts the stored secret where the server expects it.

### OAuth-protected servers

For servers that require OAuth 2.1 rather than a static token, Adjutant acts as a
confidential OAuth client: it runs the PKCE authorisation-code exchange itself,
stores and refreshes tokens encrypted, and resolves a valid bearer token at call
time. The browser is used only for the human login and consent step. See
[the MCP OAuth guide](./mcp-oauth.md).

### Setting credentials without leaving the UI

Credentials for MCP servers and ServiceNow connections are set in the Tools tab.
Rotating one does not mean a trip to the backend.

---

## 6. Reaching a server the search head cannot

Search heads in real datacentres rarely have open egress. Each MCP server
connection can therefore carry its own:

- **Proxy** — an outbound HTTP proxy, with optional proxy credentials, used for
  this server only.
- **Private CA** — a PEM certificate, if the server presents one your search head
  would otherwise reject.
- **Customer authorisation hook** — for estates where an IAM gateway mints
  short-lived headers per call. The hook is told it is being asked for an MCP
  target, so it can behave differently from an LLM call. See
  [the customer authorisation hook guide](../security/customer-authorisation-hook.md).

---

## 7. Custom HTTP tools

**Tools → Custom tools.** When the system you want has an API but no MCP server,
describe the call and the assistant can make it.

You provide the method and URL, a JSON Schema for the arguments the model may
supply, how to authenticate, and how to shape the response. The credential models
are the same idea as §5, with one more option:

| Model | Identity used |
|---|---|
| **Global** | One, for everybody |
| **Per tenant** | One per Org/BU |
| **Per user** | The calling user's own |

> **Per-user tools are not finished.** The configuration saves and loads
> correctly, but a call returns `no_user_credential` because the interactive
> sign-in that would obtain each user's token has not shipped. Use global or
> per-tenant for anything you need working today.

Two things worth knowing before you write one:

- **Response shaping matters.** A tool that returns a 2 MB JSON document will
  swamp the model. Cap the size and trim to the fields that answer the question.
- **Redact what should not travel.** Named fields can be stripped from the
  response before the model ever sees them.

The full authoring guide — schema, worked examples, testing, attaching a tool to
a playbook — is [the custom-tools guide](./custom-tools-authoring.md).

---

## 8. Publishing your playbooks over MCP

The other direction. Another AI agent discovers your governed playbooks and runs
them, without being given the keys to Splunk.

**Four tools are exposed, and no more:**

| Tool | Does |
|---|---|
| `adjutantai_list_playbooks` | Lists the playbooks published for one Org/BU |
| `adjutantai_start_playbook` | Starts a run, returns a run id immediately |
| `adjutantai_get_playbook_status` | `queued` / `running` / `completed` / `failed` |
| `adjutantai_get_playbook_results` | The verdict, once finished |

Start-then-poll rather than one long call, so every request finishes well inside
the timeouts an MCP client expects.

### Making a playbook available

A playbook is reachable over MCP **only** when you tag it `MCPready`. Tag it in
the Playbooks tab. Nothing else is exposed, however many playbooks you have.

Two more things must be true before a run will start:

1. **`[mcp_server] enabled = 1`** in `local/itmip_ai_workbench.conf`. It ships
   off, and changing it needs a Splunk restart.
2. **The Backend Ask Service is enabled**, because an MCP run goes through the
   same governed, bounded, default-deny queue as an alert-triggered one. An MCP
   caller gets no more privilege than an alert does.

Listing a playbook needs an authorised user for that Org/BU. **Starting one needs
an administrator.**

### Where the tools appear

**Prefer Splunk's own MCP Server.** If `Splunk_MCP_Server` 1.2 or newer is
installed, Adjutant registers the playbook tools into it automatically, and they
appear at `/services/mcp` alongside Splunk's own. One endpoint, one token
audience, one place to govern access.

The app's standalone endpoint at `/services/itmip_llm/mcp_server` is a fully
supported fallback for estates where Splunk's MCP Server is absent or older than
1.2 — it is simply not the one to reach for first.

Both use ordinary Splunk authentication; there is no second credential to manage.
Note that Splunk's MCP Server accepts only a bearer token whose **audience is
`mcp`** — a session key will be rejected.

Detail, including the version check and what happens below 1.2, is in
[the MCP server guide](./mcp-server.md).

---

## 9. What a tool call leaves behind

Every call is recorded, whether it came from a built-in tool, a custom HTTP tool
or an MCP server. The record says which kind it was, and for MCP calls, which
server and which upstream tool name. Records survive a tool being renamed or
removed, because they point at the tool's identity rather than its label.

---

## 10. Limits

Worth knowing before you design around them.

- **No stdio MCP servers.** Network transports only.
- **No per-user identity to an MCP server.** A server connection is global or
  per-tenant. Where per-user identity genuinely matters, a custom HTTP tool is
  the better shape — or run one MCP server per user pool, which is per-tenant by
  another name.
- **Per-user credentials on custom tools do not complete a call** (§7).
- **Category does not route anything.** It groups the admin view. It does not
  influence which tools the model is offered.
- **Only `MCPready` playbooks are reachable** over MCP, and only an administrator
  can start one.

---

## Related documents

- [the custom-tools guide](./custom-tools-authoring.md) — authoring a custom HTTP tool in full
- [the MCP server guide](./mcp-server.md) — publishing playbooks, both surfaces
- [the MCP OAuth guide](./mcp-oauth.md) — OAuth-protected MCP servers
- [the tool catalogue](./tool-catalogue.md) — the built-in tools and per-Org enablement
- [the customer authorisation hook guide](../security/customer-authorisation-hook.md) — IAM-gated targets
