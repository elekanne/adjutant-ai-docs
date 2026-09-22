---
sidebar_position: 4
---

# LLM Models & Cost Catalogue

**App version:** 2.5.9
**Last updated:** 2026-09-22
**Status:** definitive. This is the reference for *which LLMs Adjutant AI can use*,
what they cost, how one gets chosen, and how to add one the app has never heard of.

> **Read §12 before you quote a price to a customer.** The shipped pack was priced
> on 2026-06-27 and has known gaps — including an Anthropic line-up that predates
> the Claude 5 family.

---

## Contents

1. [What you can actually run](#1-what-you-can-actually-run)
2. [The nine providers](#2-the-nine-providers)
3. [The shipped model catalogue](#3-the-shipped-model-catalogue)
4. [How a model gets chosen](#4-how-a-model-gets-chosen)
5. [Adding a model the app does not ship](#5-adding-a-model-the-app-does-not-ship)
6. [Authoritative cost](#6-authoritative-cost)
7. [Token limits, and the reasoning-model rule](#7-token-limits-and-the-reasoning-model-rule)
8. [`preference_classes`](#8-preference_classes)
9. [Live discovery](#9-live-discovery)
10. [Admin overrides, manual registration, the Models tab](#10-admin-overrides-manual-registration-the-models-tab)
11. [The collection, the schema, the seed](#11-the-collection-the-schema-the-seed)
12. [Known gaps and caveats](#12-known-gaps-and-caveats)
13. [Tests](#13-tests)
14. [Roadmap](#14-roadmap)

---

## 1. What you can actually run

Adjutant AI is **not tied to one model vendor**. It speaks four wire protocols
through nine provider kinds, and every model it knows about lives in one runtime
table — the KVStore collection `itmip_llm_model_catalog` — that the dropdowns,
the proxy, the unattended runner, the audit trail and the cost reporting all read
from. Add a model there and it appears everywhere.

Three sentences that answer most questions:

- **Out of the box** you get **31 models across 8 providers**, priced, classified
  and ready to select. Nothing to import.
- **Any OpenAI-compatible endpoint** works even if the app has never met it —
  vLLM, LiteLLM, LM Studio, TGI, llama.cpp, SGLang, your own gateway, or a Splunk
  AI Tier BYOLLM endpoint (`openai_compatible`, §5.3).
- **Local and private models are first-class**, not an afterthought: Ollama ships
  seeded at $0, and an air-gapped gateway is a supported deployment, not a
  workaround.

This matters commercially. Splunk AI Assistant runs on Splunk's model on Splunk's
terms. Adjutant runs on **your** model, under **your** contract, in **your**
region — including one on a box in your own rack that no packet leaves.

---

## 2. The nine providers

`LlmProviderKind` is the closed set, and every one of them routes to a real
adapter.

**Table 1 — Providers**

| Kind | Label | Adapter dispatched | Catalogue `runtime_adapter` | Default endpoint | Seeded models |
|---|---|---|---|---|:---:|
| `anthropic` | Anthropic | `anthropicAdapter` | `anthropic_messages` | `https://api.anthropic.com/v1/messages` | 5 |
| `openai` | OpenAI | `openAiCompatAdapter` | `openai_chat` | `https://api.openai.com/v1/chat/completions` | 6 |
| `azure_openai` | Azure OpenAI | `openAiCompatAdapter` | `azure_openai` | `https://<resource>.openai.azure.com/` | 4 |
| `gemini` | Google Gemini | `geminiAdapter` | `gemini` | `https://generativelanguage.googleapis.com/v1beta/models` | 2 |
| `groq` | Groq | `openAiCompatAdapter` | `openai_chat` | `https://api.groq.com/openai/v1/chat/completions` | 3 |
| `bedrock` | AWS Bedrock | `bedrockAdapter` | `bedrock` | `https://bedrock-runtime.<region>.amazonaws.com` | 3 |
| `openrouter` | OpenRouter | `openAiCompatAdapter` | `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | 4 |
| `ollama` | Ollama | `openAiCompatAdapter` | `ollama` | `http://localhost:11434/api/chat` | 4 |
| `openai_compatible` | *(the escape hatch)* | `openAiCompatAdapter` | `openai_chat` | **you supply it** | 0 — by design |

> **The two adapter columns are not the same thing**, and conflating them will
> mislead you. `runtime_adapter` is a **catalogue label** carried by discovery and
> seed rows for provenance. The adapter actually *dispatched* is chosen from
> `provider_kind` alone. Ollama
> and OpenRouter label themselves `ollama` / `openrouter` but are called through
> the OpenAI-compat adapter, because that is the shape they speak on the wire.

Only **four adapters** exist — Anthropic, OpenAI-compatible, Gemini and
Bedrock — because **six of the nine kinds** speak OpenAI's chat-completions
shape. That is why adding an
OpenAI-compatible vendor costs almost nothing.

### 2.1 Connecting one

Settings → **LLM configurations** → **Add connection** runs a four-step wizard: *Choose an
AI service* → *Enter connection details* → *Test connection* → *Review and
create*.

The test is a ten-rung ladder with plain-English stage labels —
"Finding the server", "Asking what sign-in it wants", "Finding models that work",
"Asking a first question", "Testing Splunk actions". Each rung says what it is
waiting on, so a stall names its own cause instead of producing a red box.

**"Finding models that work" is evidence, not a gate**. A
provider that publishes no model list is *not* a failure — the stage reports
`not_applicable` with "This provider publishes no model list to read." A
configured model that is *missing* from a list the provider does publish is
reported plainly rather than silently accepted.

> **Azure asks twice.** Microsoft documents two data-plane list routes and a
> gateway implements whichever its author chose. Answering 404 on one is not
> evidence about the other, so after a refusal the wizard asks the second route
> before concluding. One
> extra GET, only after a refusal, only on Azure — added because a real customer's
> gateway 404'd the first route and was told it published no models at all.

### 2.2 Call modes

Every configuration picks one (`call_mode`, default `splunk_proxy`):

| Mode | Path | When |
|---|---|---|
| `splunk_proxy` | browser → splunkd → provider | **The default and the right answer.** The key never reaches the browser; private endpoints and CORS-refusing providers work. |
| `browser_direct` | browser → provider | Only where CORS is known to work — Anthropic, Ollama, OpenRouter. |

A row saved without a call mode reads as `splunk_proxy`, deliberately: defaulting an
unknown row to a browser call is the worse of the two guesses, because most
providers refuse a browser outright, a private endpoint is not reachable from a
desktop at all, and the key would have to travel to the browser to even try.

---

## 3. The shipped model catalogue

31 rows, `pricing_pack_version = seed-1`, `catalog_version = 1`, all priced
`2026-06-27`, all `price_source = shipped_pack`, all `model_status = active`,
all `scope = global`.

**All prices are USD per 1,000,000 tokens.** A non-USD row is rejected at write
time — the seed loader skips it, and the override endpoint refuses it.

### 3.1 Anthropic

The only provider whose rows carry real context and output limits (1M context on
the 4.x line; 128K output on Opus/Fable, 64K on Sonnet/Haiku) and full capability
flags (`tools`, `vision`, `prompt_cache`, `reasoning`).

| Model | Display | In | Out | Cache read | Speed | Classes |
|---|---|--:|--:|--:|---|---|
| `claude-fable-5` | Claude Fable 5 | 10 | 50 | 1.0 | slow | premium, reasoning, large_context |
| `claude-opus-4-8` | Claude Opus 4.8 | 5 | 25 | 0.5 | slow | premium, reasoning, large_context |
| `claude-opus-4-7` | Claude Opus 4.7 | 5 | 25 | 0.5 | slow | premium, reasoning, large_context |
| **`claude-sonnet-4-6`** | Claude Sonnet 4.6 | 3 | 15 | 0.3 | balanced | balanced, **safe_default**, large_context |
| `claude-haiku-4-5` | Claude Haiku 4.5 | 1 | 5 | 0.1 | fast | cheap |

`claude-sonnet-4-6` is the app's floor in every sense: the bootstrap config, the
Anthropic default, and the hard-coded last rung of the resolution ladder.

### 3.2 OpenAI

| Model | In | Out | Cache read | Speed | Classes |
|---|--:|--:|--:|---|---|
| `gpt-4o-mini` | 0.15 | 0.6 | — | fast | cheap |
| `gpt-4o` | 2.5 | 10 | — | balanced | balanced, vision |
| `gpt-4.1` | 2 | 8 | — | balanced | balanced, large_context |
| `gpt-4.1-mini` | 0.4 | 1.6 | — | fast | cheap |
| `gpt-5.4` | 1.25 | 10 | 0.125 | balanced | premium, reasoning |
| `gpt-5.4-mini` | 0.25 | 2 | 0.025 | fast | cheap, reasoning |

The two GPT-5.4 rows carry a note saying their pricing is approximate — verify
against OpenAI's current rate card before invoicing anyone. Both also trigger the
reasoning-parameter rule in §7.

### 3.3 Azure OpenAI

| Model | In | Out | Cache read | Speed | Classes |
|---|--:|--:|--:|---|---|
| `gpt-4o-mini` | 0.15 | 0.6 | — | fast | cheap |
| `gpt-4o` | 2.5 | 10 | — | balanced | balanced, vision |
| `gpt-5.4` | 1.25 | 10 | 0.125 | balanced | premium, reasoning |
| `gpt-5.4-mini` | 0.25 | 2 | 0.025 | fast | cheap, reasoning |

> **The `model` field must equal YOUR deployment name**, not the SKU. Azure puts
> the deployment in the URL and leaves the model field empty on the wire, which
> is why a price override may be keyed on `underlying_model` (the SKU) to fan out
> across every deployment of it (§10).

Since 2.4.x the app **discovers the endpoint** rather than making an admin
assemble prefix + deployment + api-version by hand.
Two customer setups — Azure OpenAI behind API Management, and behind a private
endpoint — stalled for a fortnight on exactly that assembly, with green
credentials and a 404 on every Ask that looked like an auth fault.

### 3.4 Google Gemini

| Model | In | Out | Speed | Classes |
|---|--:|--:|---|---|
| `gemini-2.0-flash` | 0.075 | 0.3 | fast | cheap, large_context |
| `gemini-2.5-pro` | 1.25 | 5 | balanced | premium, reasoning |

Carries a **free-tier caveat** shown under the provider picker: free-tier keys can
return zero quota, which presents as a broken connection rather than a billing
limit.

### 3.5 Groq

| Model | In | Out | Speed | Classes |
|---|--:|--:|---|---|
| `llama-3.3-70b-versatile` | 0.59 | 0.79 | fast | balanced |
| `llama-3.1-8b-instant` | 0.05 | 0.08 | fast | cheap |
| `mixtral-8x7b-32768` | 0.24 | 0.24 | fast | cheap |

Also carries a free-tier caveat: **Groq's free tier is 12K tokens/minute, smaller
than a single typical Adjutant request.** A free Groq key will look broken under
normal use. This is a rate limit, not a fault.

### 3.6 AWS Bedrock

| Model | In | Out | Speed | Classes |
|---|--:|--:|---|---|
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | 3 | 15 | balanced | balanced |
| `anthropic.claude-3-5-haiku-20241022-v1:0` | 0.8 | 4 | fast | cheap |
| `meta.llama3-70b-instruct-v1:0` | 2.65 | 3.5 | balanced | balanced |

Same Claude models, AWS-billed, inside your AWS account and region. Signed with
SigV4; credentials come
from the standard ladder (task role → env → IMDS → static keys). Bedrock is
**proxy-only** — there is no browser-direct path.

### 3.7 OpenRouter

| Model | In | Out | Speed | Classes |
|---|--:|--:|---|---|
| `openrouter/auto` | 1 | 3 | balanced | balanced |
| `anthropic/claude-3.5-sonnet` | 3 | 15 | balanced | balanced |
| `openai/gpt-4o-mini` | 0.15 | 0.6 | fast | cheap |
| `google/gemini-2.0-flash` | 0.075 | 0.3 | fast | cheap |

`openrouter/auto` routes to whichever provider OpenRouter thinks fits the prompt,
so **its price is variable** and the seeded 1/3 is an average, not a rate.
OpenRouter is also the **only provider whose discovery returns real prices**
(§9).

### 3.8 Ollama — local and private

| Model | In | Out | Speed | Classes |
|---|--:|--:|---|---|
| `llama3.1:8b` | 0 | 0 | fast | local, private, cheap |
| `llama3.1:70b` | 0 | 0 | slow | local, private |
| `mistral-nemo` | 0 | 0 | fast | local, private |
| `qwen2.5:14b` | 0 | 0 | balanced | local, private |

Zero-cost because you already own the hardware. `llama3.1:8b` runs on a laptop
GPU; `llama3.1:70b` needs a real one. This is the path for an environment where
prompt content may not leave the building.

---

## 4. How a model gets chosen

### 4.1 The model lives on the LLM configuration — nowhere else

This is the single most important thing to understand, and it surprises people:

> **There is no per-Playbook, per-Skill or per-Scheduled-Ask model field.** A
> model is pinned on an **LLM configuration**, and everything else selects a
> *configuration*.

Verified across the surfaces where you would expect to find one: the 90 rows of
`default/data/seeds/itmip_ai_use_cases.json` and the 52 of
`itmip_ai_skills.json` carry no `model`, `provider` or `llm_*` key, and neither
`[itmip_ai_use_cases]` nor `[itmip_ai_skills]` declares one in
`default/collections.conf`. The unattended queue pins `llm_config_id`
(`collections.conf:788`), Scheduled Ask pins `llm_config_id`, and the RCA ask
action pins `llm_config_id`. All of them
choose a configuration; the configuration chooses the model.

**Per-Org / per-BU model selection therefore works through config scoping.** A
configuration is scoped to tenants via `tenants` (or legacy
`org_short` + `bu_short`), resolved server-side by `config_tenants()` and mirrored in the browser.
Give a BU its own configuration and you have given it its own model.

### 4.2 The resolution ladder

When nothing explicit was selected — an unattended Ask, an empty or
misconfigured catalogue — `safe_default_model()` resolves one. It **never dead-ends**, and returns the rung it landed on so drift
is visible:

| Rung | `source` | Rule |
|---|---|---|
| 1 | `safe_default` | An active row for this provider tagged `safe_default`. |
| 2 | `balanced_cheapest` | Cheapest active row classed `balanced` **whose `price_status` is `known`**. |
| 3 | `active_cheapest` | Cheapest active row **whose `price_status` is `known`**. |
| 4 | `active_any` | Any active row at all — the first rung an **unpriced** row can reach. |
| 5 | `shipped_floor` | `claude-sonnet-4-6`, hard-coded. |

> The `price_status = known` filter on rungs 2 and 3 is real and is
> **not in the function's own docstring**. It matters: a model you registered by
> hand without a price cannot be picked by price-based rungs at all, and is only
> reachable at rung 4. If you register a private-gateway model and want the
> runner to choose it, either give it a price or tag it `safe_default`.

The full unattended chain is
**explicit model → the config's `model` → catalogue `safe_default` for that
provider → shipped floor**,
and the runner emits a drift warning on stderr when it falls past `safe_default`.

The interactive Ask has no override layer at all — it passes
`opts.config.model` straight through, and prices with the same value.

### 4.3 The browser's mirror is shorter

`catalogDefaultModel()` implements
**three** rungs — `safe_default` → cheapest `balanced` → first row — with **no
price-status filter and no shipped floor**. It feeds the UI's default when you
change provider in the config editor, so the
model the editor pre-fills and the model an unattended run would pick can differ
on the same catalogue. Server-side is authoritative.

### 4.4 The offline fallback

If the catalogue REST call fails or has not loaded, the frontend falls back to
`PROVIDER_DEFAULTS` — a hard-coded copy kept only for that case. **It is stale; see §12.2.**

> **The practical advice:** tag exactly one row `safe_default` per provider you
> actually use. Point it at your in-house gateway model and every unattended Ask
> routes there with zero per-call configuration. Today only one row in the whole
> shipped pack carries the tag (§12.4).

### 4.5 What restricts which models a user may pick

**Nothing, by policy.** There is no model allow-list or deny-list anywhere in the
app, and the config editor accepts a free-text model id.
What exists is *status* filtering and *advice*:

| Mechanism | Effect |
|---|---|
| `model_status = retired` | Dropped by the read handler, the bootstrap slice, and the browser cache. Pass `include_retired` to see them. |
| Bootstrap slice | Also drops any provider kind with no configuration — you only see models you could actually call. |
| `deprecated` / `preview` | A badge. Nothing more. |
| Health check | `selected_model_available` fails on retired, warns on deprecated or absent. **Advisory — it never blocks a call.** |
| Config-collection ACL | `itmip_llm_configs` is write `[admin, sc_admin]`. A non-admin cannot create a configuration and therefore cannot pin a model. |

That last row is the only real restriction, and it is a write ACL rather than a
model policy. Licence gates apply to *catalogue features*
(`live_model_discovery`, `model_catalog_overrides`) — **never to which model you
may run**.

---

## 5. Adding a model the app does not ship

Three routes, in increasing order of "the app has never heard of this".

### 5.1 Let discovery find it

If the model is a new SKU from a provider you already have configured, run
Models → **Refresh from providers** (or wait for the 6-hourly sweep). It appears
with `discovery_source = live_provider`. Requires Professional+ (§9).

### 5.2 Register it by hand

Models → the manual-registration form. Writes a catalogue row with
`discovery_source = admin`, which the seed job and every discovery sweep are
forbidden to overwrite. Use this for a restricted Azure deployment, a private
gateway model, or anything a list endpoint will not admit exists. Requires admin
**and** Enterprise (`model_catalog_overrides`).

### 5.3 `openai_compatible` — the endpoint the app has never met

The ninth provider kind, added in 2.5.x, covers **vLLM, LiteLLM, LM Studio, TGI,
llama.cpp, SGLang, a customer's own gateway, and a Splunk AI Tier BYOLLM
endpoint**. It is defined by what the app does *not* know about it, and it is
deliberately **last in the wizard's card list**: an admin who recognises their
provider by name should use that card, which has real signatures, real prices and
a real model list behind it.

**You fill in three things**:

| Field | The wizard's own words |
|---|---|
| `endpoint` | "The address of the endpoint, such as `http://vllm.internal:8000/v1`" — plain HTTP in the example on purpose; vLLM, LM Studio and llama.cpp serve it by default. |
| `api_key` | "A key or token, if the endpoint needs one. Many self-hosted servers do not, and the test finds out." |
| `model` | "The model name, if the endpoint publishes no list." |

Everything else is **probed rather than asked**:

- **Auth style** — none, then Bearer, then `api-key`.
  **No-auth is tried first**, because many self-hosted servers accept anything
  including nothing, so asking "what auth?" first gets a confident wrong answer.
  The style that worked is written onto the record as `compat_auth_style`.
- **URL shape** — normalised across four paste shapes, **keeping a gateway path
  prefix**, which the Azure path deliberately throws away. Getting that backwards
  was a real 2.4.1 bug.
- **Tool calling is actually verified**, uniquely for this kind:
  *"Only asked of an endpoint the app has never met — for the eight known
  providers a tool call that exists is one the dispatcher can run."*

> **The card carries its own warning, and it is honest**:
> *"This is the least tested path in the app… Tool calling is the thing most
> likely to be missing… If you run Ollama, use the Ollama card instead."* The
> failure modes are also separated for you: "the server does not implement tool
> calling" (fix: a different server build) is a different problem from "the model
> will not call tools" (fix: a different model on the same endpoint).

There is no seeded model list and no discovery connector (§12.6), so these models
carry `price_status = unknown` until you register a price (§10). Usage is still
recorded **with real token counts and a null cost rather than a fabricated
figure**,
and the Ask is never blocked.

---

## 6. Authoritative cost

`bin/itmip_llm_pricing.py` resolves unit rates from the catalogue and computes
cost **server-side**, so the stored figure does not trust the browser.

- `itmip_llm_usage_log.py` and `itmip_llm_audit.py` (the `llm_response` event)
  recompute `cost_usd` from the catalogue using the request's token counts, and
  **freeze the unit rates and their provenance onto the event**:
  `unit_input_price`, `unit_output_price`, `unit_cache_read_price`, `currency`,
  `price_source`, `price_status`, `price_as_of`, `catalog_version`.
- `itmip_llm_agent_runner.py` stamps the same authoritative cost onto unattended
  runs.
- The browser's figure is a **preview**, used only when the catalogue cannot
  price the model.

Because rates are frozen per event, a price change re-prices only *future* turns —
**yesterday's recorded cost stays reproducible**. A model the catalogue cannot
price records token counts with `price_status = unknown` and asserts no cost. It
never blocks the Ask.

**Precedence when resolving a rate** (highest first):

1. Admin override (`price_source = admin_override`, `price_status = overridden`)
2. Live provider price from a discovery sweep
3. Existing pack / seed price
4. `unknown`

### 6.1 The disclaimer

Shown in the UI, and reproduced here because it is the honest position:

> Cost is an estimate based on the active Adjutant AI model catalogue. It may
> differ from provider invoices, regional pricing, enterprise contracts,
> discounts, or internal chargeback rules.

---

## 7. Token limits, and the reasoning-model rule

### 7.1 Output caps

An explicit `maxTokens` on the call always wins. Otherwise both adapters resolve
the cap the same way — **catalogue capability, clamped → name-pattern fallback**:

| Adapter | Catalogue step | Fallback when the catalogue gives nothing |
|---|---|---|
| **Anthropic** | `catalogMaxOutputTokens(model, "anthropic")`, clamped to 16384 | regex `(opus\|sonnet\|haiku)-4` or `claude-3-7` → 16384, else 8192 |
| **OpenAI-compatible** | `catalogMaxOutputTokens(model)` — searched **across providers**, since one adapter serves six kinds and same-id rows share a cap — clamped to 16384 | reasoning model → 16384, else 8192 |
| **Gemini** | `min(catalogMaxOutputTokens(…) \|\| 8192, 16384)` | 8192 |
| **Bedrock** | `min(catalogMaxOutputTokens(…) \|\| 8192, 16384)` | 8192 |

`catalogMaxOutputTokens()` guards on
`m && m.max_output_tokens`, so **a stored `0` is falsy and reads as "no row"** —
which is what makes §12.3 bite.

**`context_window` is never read by any adapter.** It is catalogue metadata for
display and planning; nothing enforces it at call time.

`SAFE_CEILING = 16384` is not arbitrary. The catalogue stores the model's
*capability* (Opus advertises 128K output), but 16384 stays safely below the
Splunk SDK's ~21K non-streaming 10-minute guard, so the browser's non-streaming
and fallback paths never throw "streaming required".

> **Why the floor is 8192 and not lower.** A smaller cap truncates large
> artifacts. A multi-panel dashboard's XML alone can exceed it, and when it does
> the model hits its limit **mid-`tool_use`**: the partial JSON loses the `xml`
> and `name` arguments, and `splunk_create_dashboard_xml` throws "name and xml are
> required". Observed on a 20-panel MITRE dashboard failing five times in a row.

> **26 of the 31 seeded rows carry `max_output_tokens = 0`** — every non-Anthropic
> row — so in practice those models resolve on step 2, not step 1 (§12.3).

### 7.2 The GPT-5 / o-series parameter rule

**The GPT-5 family and the o-series answer HTTP 400 to `max_tokens`** and require
`max_completion_tokens` instead — on OpenAI, Azure OpenAI and OpenRouter alike.

Matched **by name**, with an Azure **deployment** name counting, because Azure
exposes no capability flag on this surface and deployments are conventionally
named after the model. An aggregator's provider prefix (`openai/gpt-5-mini`) is
stripped first, because the rule is about the model, not who is reselling it.

There is a second, less obvious half. A reasoning model **spends its completion
budget on hidden reasoning before it emits a single visible token**, so a cap
sized for the visible answer returns HTTP 200 with empty content — which reads as
"the model refused to answer" when the truth is "we did not let it think". Hence
`REASONING_CONTENT_FLOOR = 16384`: any caller
that reads content gets at least that. A cap of exactly `1` is left alone — that
is a status-only probe whose caller reads the HTTP code and never the text, and a
deliberately cheap probe stays cheap.

> **Why this is worth knowing.** The rule lives in two places — the browser cannot
> call Python — and for a while only the browser knew it. A customer whose Ask
> worked perfectly was told by *Test connection* that their endpoint URL was not a
> chat-completions URL, because every server-side probe was sending `max_tokens`
> and collecting a 400. The two halves are now pinned together by a test that
> reads the TypeScript source and fails the build if either side moves.

---

## 8. `preference_classes`

A CSV of selector hints on each catalogue row. The shipped pack sets sensible
defaults; an admin override survives later packs.

| Class | Meaning |
|---|---|
| `cheap` | Lowest cost; high-volume / simple tasks. |
| `balanced` | Everyday default — good price/quality. |
| `premium` | Highest quality; hardest reasoning. |
| `reasoning` | Strong multi-step reasoning. |
| `large_context` | Big context window. |
| `vision` | Image input. |
| `local` / `private` | Runs on your own hardware / network. |
| `safe_default` | **Where unattended Asks route when nothing is selected.** Tag exactly one per provider. |

---

## 9. Live discovery

Discovery enriches the catalogue by reading each configured provider's
`list-models` endpoint. It is **additive** — never a runtime dependency of the
Ask flow, and the only part of the catalogue story the free tier lacks
(`live_model_discovery`, Professional+).

**Connectors** — `bin/llm_discovery/` mirrors the `bin/knowledge_connectors/`
contract: each module exposes `MODULE_NAME` / `PROVIDER_KIND` / `RUNTIME_ADAPTER`
plus `probe()` and `discover()`, and the loader isolates import failures so one
broken provider cannot break the sweep.

**Table 2 — Discovery connectors**

| Module | Provider kind | Endpoint | Returns price? |
|---|---|---|---|
| `anthropic.py` | `anthropic` | `GET /v1/models` | no |
| `openai.py` | `openai` | `GET /v1/models` (ids only) | no |
| `azure_openai.py` | `azure_openai` | `GET {endpoint}/openai/deployments` (deployment→SKU) | no |
| `gemini.py` | `gemini` | `GET /v1beta/models?key=…` (key never logged) | no |
| `groq.py` | `groq` | `GET /openai/v1/models` | no |
| `openrouter.py` | `openrouter` | `GET /api/v1/models` | **yes** (per-token ×1e6 → USD/MTok) |
| `ollama.py` | `ollama` | `GET {endpoint}/api/tags` | n/a ($0 local) |
| `bedrock.py` | `bedrock` | — | **stub, always unavailable** (§12.5) |
| *(none)* | `openai_compatible` | — | **no connector** (§12.6) |

Eight modules are registered in the loader.

**Sweep** — the discovery sweep plans accounts from two sets: `GLOBAL_PROVIDERS` — anthropic, openai, gemini, groq, openrouter —
gets one account per provider that has ≥1 config, and `PER_ACCOUNT_PROVIDERS` —
azure_openai, ollama, bedrock — gets one per configuration.
`openai_compatible` is in **neither set**, so such a configuration is silently
skipped by `_plan_accounts()`. The sweep then
calls each module, applies the §6 pricing precedence, upserts
**merge-not-replace** (never clobbering `discovery_source = admin`), and marks
vanished models `missing_from_latest_discovery` — **it never deletes**. Each
sweep bumps `catalog_version` and writes one sanitised
`itmip_llm_model_catalog_runs` row plus one redacted telemetry event per account.

**Triggers** — scheduled input every 6h (`interval = 21600`), which checks the
capability *first* and no-ops below Professional; the refresh endpoint on demand;
and saving an LLM config fires a scoped, fire-and-forget refresh that never blocks
the save (a 403 on free/non-admin is swallowed).

**REST**

| Route | Method | Gate |
|---|---|---|
| `/itmip_llm/model_catalog` | GET | any authenticated user |
| `/itmip_llm/model_catalog/refresh` | POST | admin **and** `live_model_discovery` |
| `/itmip_llm/model_catalog/runs` | GET | admin (all tiers; empty below Professional) |

**Redaction** — `bin/llm_discovery/_common.py` never logs keys, tokens,
`Authorization` headers or credential-bearing URLs (Gemini's `?key=` is stripped
by `redact_url()`); error bodies are reduced to class + HTTP status by
`sanitise_error()`, because provider bodies can echo auth; `account_ref` is the
opaque config `_key`, never a tenant string.

> **Implementation note that will bite you.** `run_sweep()` is called both from
> the scripted input (where stdout is the event pipeline) and from the REST
> handler (where stdout carries the persistconn framing protocol). It therefore
> **collects** telemetry and returns it; only the scripted-input `main()` writes
> events to stdout. Writing telemetry to stdout from the REST path corrupts the
> reply with `bad character in reply size`.

---

## 10. Admin overrides, manual registration, the Models tab

**The catalogue read and the override overlay stay all-tiers; only AUTHORING is
gated** — admin role **and** `model_catalog_overrides` (Enterprise).

**Price overrides** live in a separate collection, `itmip_llm_price_overrides`,
kept apart from the catalogue so that **a discovery sweep can never destroy a
human correction**. They are applied as a top-precedence overlay at read time and
at cost-resolve time, stamping `price_source = admin_override` /
`price_status = overridden`. Deleting an override simply removes the overlay and
the discovered/seed price shows again — there is no destructive revert.

**Match mode:** an override keyed on `underlying_model` (the SKU) **fans out to
every deployment of it**; adding `model_id` makes it per-deployment and wins for
that one. All override prices are USD; non-USD is rejected at write.

**Manual registration** writes a catalogue row with `discovery_source = admin`,
never overwritten by the seed job or a sweep.

**REST** — `GET/POST/DELETE /itmip_llm/model_price_override`. GET lists
overrides and manual rows; POST with `kind=override` upserts an override and
`kind=manual_model` registers a catalogue row; DELETE takes `?kind=&_key=`.

### 10.1 The Models tab

**Admin-only.** It lived under Settings until 2.5.9 — older screenshots show it
there — and now has its own tab, because the catalogue,
discovery history, overrides and registration are a subject of their own and the
combined page read as a wall.

Header: *"Every model Adjutant knows about, where its price came from, and which
models a discovery run found. Prices here drive the estimates on Tokens & Costs;
an override you set outranks every other source."*

What is on it:

| Element | What it does |
|---|---|
| The catalogue table | Every row with price status, provenance, `price_as_of`, and a **⌛ staleness marker past 90 days**. |
| **Came from** column | Plain words — *Shipped* / *Discovered &lt;date&gt;* / *Admin* — instead of the raw `discovery_source` enum. |
| **Refresh from providers** | Runs a sweep now. 403s below Professional. |
| **Set price** *(per row)* | Carries that row's identity into the override form. Enterprise admins only. |
| Discovery run history | Past sweeps, with an upgrade explainer as the empty state on non-discovery tiers. |
| Override + registration forms | Enterprise admins only; hidden otherwise, and the endpoint 403s regardless. |

Arriving from a specific LLM configuration filters to that provider and highlights
that configuration's default model (`initialProvider` / `focusModel`).

---

## 11. The collection, the schema, the seed

### 11.1 Collections

| Collection | Holds |
|---|---|
| `itmip_llm_model_catalog` | The catalogue. `_key` = `<provider_kind>::<account_ref\|global>::<model_id>` (non-key-safe characters sanitised in the `_key`; `model_id` keeps the real id). |
| `itmip_llm_catalog_meta` | Singleton `_key=seed` — the `seed_version` marker. |
| `itmip_llm_price_overrides` | Admin overrides, deliberately separate. |
| `itmip_llm_model_catalog_runs` | Sanitised discovery-run history. |

**ACL** (`metadata/default.meta`): catalogue **read `[ * ]`** — the bootstrap/Ask
flow and the dropdown read it as any authenticated user via the system token —
**write `[ admin, sc_admin ]`**. `export = none`.

### 11.2 Row schema

Grouped by what it is for:

- **Identity / routing** — `provider_kind`, `runtime_adapter`, `model_id`,
  `underlying_model`, `account_ref`, `scope`
- **Status** — `model_status`, `price_status`, `capability_status`
- **Limits** — `context_window`, `max_output_tokens`
- **Pricing** — `input_price`, `output_price`, `cache_read_price`,
  `cache_write_price`, `currency`, `pricing_extra`, `price_valid_until`
- **Provenance** — `price_source`, `price_as_of`, `pricing_pack_version`,
  `catalog_version`, `discovery_source`, `discovered_at`, `last_verified_at`,
  `created_at/by`, `updated_at/by`
- **Display** — `display_name`, `speed`, `preference_classes`, `modalities`,
  `capabilities`, `note`

Full list: `default/collections.conf:924-1040` and spec §5.

### 11.3 Seeding

The catalogue seed job runs **once at startup** (`interval = -1`, `passAuth = admin`) and materialises the catalogue
**before any user interaction**, so the Ask flow is never the first reader. It is
idempotent and merge-not-replace:

- Reads `seed_version` from `itmip_llm_catalog_meta`. If the shipped
  `SEED_VERSION` is newer, or the catalogue is empty, it upserts; otherwise
  it no-ops.
- Merges onto existing rows, **never overwrites `discovery_source = admin`**, and
  **skips any non-USD row**.
- Emits one redacted `itmip:llm:seed` event — counts only, no keys or URLs.

**Bump `SEED_VERSION`** whenever you change the shipped seed, and keep it in step with the
`catalog_version` / `pricing_pack_version` baked into the rows.

> The first seed lands at the first start after install or restart —
> `collections.conf` and `inputs.conf` changes need a Splunk restart — **not**
> during the setup screen.

---

## 12. Known gaps and caveats

Verified against the code on 2026-09-22. These are real, and a few will surprise
you.

### 12.1 The Anthropic line-up predates the Claude 5 family

The newest Anthropic models in the catalogue are **Opus 4.8, Sonnet 4.6 and Fable
5**. The current generation — Opus 5, Sonnet 5, Fable 5.1 — is **absent from the
entire codebase**, not just the seed: no `claude-opus-5`, `claude-sonnet-5` or
`claude-fable-5-1` string exists anywhere in `bin/`, `src/` or `default/`.

Nothing breaks. A customer can type the id into the model field and the adapter
will send it; discovery will find it on the next sweep and add it with
`price_status = unknown`. But **it is not offered in the dropdown, and it is not
priced**, so cost reporting will record tokens without a cost. The fix is a seed
refresh plus a `SEED_VERSION` bump.

### 12.2 The offline fallback still carries the 3× Opus price

The offline `PROVIDER_DEFAULTS` fallback prices `claude-opus-4-7` at **$15/$75**, against the catalogue's **$5/$25** — the exact
error the catalogue was introduced to fix. It also does not list `claude-opus-4-8`
or `claude-fable-5` at all.

Impact is bounded: the recorded cost is computed server-side from the catalogue
(§6), so **billing figures are not affected**. What is affected is the browser's
pre-send *estimate* on a cold start or a failed catalogue fetch, which will read
3× high for Opus.

### 12.3 26 of 31 rows carry no context or output limits

Only the five Anthropic rows set `context_window` and `max_output_tokens`. Every
OpenAI, Azure, Gemini, Groq, Bedrock, OpenRouter and Ollama row has both at `0`,
so those models take the regex fallback in §7.1 rather than the catalogue value —
the cap-source ladder working as designed, but on its second rung for 84% of the
pack.

### 12.4 One `safe_default` in the entire pack

`claude-sonnet-4-6` is the only row tagged `safe_default`, though §8 advises one
per provider. For the other eight providers the ladder therefore always falls to
rung 2 (`balanced_cheapest`) or lower. That is a *working* outcome — the ladder
never dead-ends — but it means an unattended Ask on, say, Bedrock routes by price
rather than by your choice. **Tag one per provider you use.**

### 12.5 The Bedrock discovery stub's stated reason is out of date

The Bedrock discovery connector reports `discovery_not_implemented_sigv4` and its docstring says ListFoundationModels
"requires SigV4 request signing (IAM creds), which this app does not implement
in-process".

**It does now.** The app ships a general SigV4 signer and is already used for **Bedrock itself** in the
wizard, plus S3,
STS and Secrets Manager. The blocker named in the comment is gone; only the
connector has not been written. Bedrock models still come from the shipped pack
alone.

### 12.6 `openai_compatible` gets no discovery

There is no `bin/llm_discovery/openai_compatible.py`, **and the kind is absent
from both sweep sets**, so such a configuration is silently skipped rather than
attempted and reported. Models on a custom gateway must be registered manually
(§5.2) or typed in, and they stay `price_status = unknown` until someone sets a
price. Reasonable — the app cannot guess a gateway's rate card — but worth knowing
before you promise a customer cost reporting on their in-house endpoint.

### 12.7 Seven of nine providers are labelled "(preview)", and should not be

`implementation_status: "scaffold"` marks everything except `anthropic` and
`openai_compatible`, which renders a **"(preview)"** suffix in the provider
dropdown.

That one label is the flag's **only** consumer anywhere in the repo. Nothing in
the dispatcher, proxy, wizard, licence tier or any handler reads it; it has no
functional effect. Meanwhile all nine kinds route to a real adapter (the
`default:` throw in `adapterFor` is unreachable), and each of the seven
"scaffold" kinds has a discovery connector, a probe-provider profile, and
provider-specific production handling.

The flag has been touched twice in its life: introduced in `def05d6`
(2026-05-12, *before* 1.7.0), and extended in `e97e5ec` (2026-09-14) only to add
the ninth entry. **The seven `scaffold` values have never been revisited.**

The result is upside-down: every Azure, OpenAI, Gemini, Groq, Ollama, OpenRouter
and Bedrock user reads "(preview)" next to a provider that has had years of
customer-driven fixes, while `openai_compatible` — described in its own wizard
card as *"the least tested path in the app"* — is one of the two marked `wired`.

### 12.8 A failover to a different provider still sends the first one's model id

A configuration can name an `on_failure_fallback` chain of other configurations
(`on_failure_fallback` on the configuration row). Failing
over swaps the endpoint, headers and credentials — but **the request body is
forwarded verbatim**; the fallback config's own `model` is
read only for telemetry.

So a chain whose members use **different models or providers** will send the
primary's model id to the secondary. Falling back between two configs on the same
model — a second region, a spare key — behaves correctly, and that is the common
shape. **Falling back across models or providers is the case to avoid** until
this is fixed; it is a defect, not a documented design.

---

## 13. Tests

| Area | Covers |
|---|---|
| **The reasoning-parameter rule** *(17 tests)* | The GPT-5/o-series `max_completion_tokens` rule, **and that the Python and TypeScript halves agree** — it reads the adapter source and fails the build when either side moves. |
| **Model detection on a gateway** *(16 tests)* | What the wizard can tell you about a model when the endpoint publishes no list. From an Azure-behind-a-Function customer. |
| **The credential check names a model** *(33 tests)* | The credential check must name a model — for half the providers nothing ever gave it one. |

These run under plain `python3`, or under Splunk's own interpreter with
`$SPLUNK_HOME/bin/splunk cmd python`.

---

## 14. Roadmap

Not built: per-Org price overlays (the schema has `scope`, but only
global/account overrides are wired), pricing-pack version pin/rollback, and the
in-app "newer pack available" notice. Bedrock discovery is now unblocked (§12.5)
but unwritten. See the spec for the full plan.
