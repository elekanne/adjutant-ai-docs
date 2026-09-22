---
sidebar_position: 5
---

# LLM reliability — retry, fallback & circuit breaker

**App version:** 2.5.9
**Last updated:** 2026-09-22
**Audience:** Splunk admins configuring failover between AI connections, and
anyone diagnosing why an Ask failed.

Adjutant AI classifies LLM provider failures, retries transient ones with
exponential backoff, and trips a per-config **circuit breaker** when a provider is
down — turning a `529 overloaded_error` or a `RESOURCE_EXHAUSTED` from a "loud
cliff" (the whole Ask turn lost) into a graceful, mostly-invisible degrade.

**Retry, fallback and the circuit breaker run on every licence tier.** The
`reliability_llm_ops` entitlement decides only whether the tuning controls appear
in the Settings form; it does not gate the behaviour itself.

---

## What ships in this increment

| Piece | Status |
|---|---|
| Error taxonomy (8 providers → 5 buckets, normalized codes) | **Built** — `bin/itmip_llm_errors.py` (+ TS mirror `src/services/llm/llmErrors.ts`) |
| Retry orchestrator (backoff + jitter, total-call budget, Retry-After cap) | **Built** — `bin/itmip_llm_retry.py` |
| Circuit breaker (CLOSED/OPEN/HALF-OPEN, per config, cross-worker mirror) | **Built** — `bin/itmip_llm_circuit.py` |
| Wired into the server-side proxy (retry + circuit on the configured provider) | **Built** — `bin/itmip_llm_proxy.py` |
| Per-attempt telemetry rows (`itmip_llm_call_attempts`) | **Built** |
| Conf defaults (`[llm_reliability]`) + per-config schema fields | **Built** |
| Unit tests (25 classification cases + DoD fallback/breaker behaviours) | **Built** — `tests/test_llm_errors.py`, `tests/test_llm_retry.py` |
| **Cross-config fallback in the interactive proxy** (`on_failure_fallback`) | **Built + live-verified** — broken-primary → fallback → real Anthropic, with the chain narrative recorded |
| **LLM Health dashboard** (circuit state, success rate, latency, error codes, fallback usage) | **Built** — `default/data/ui/views/ai_llm_health.xml` (see the AI Activity dashboard guide) |
| AI Activity dashboard (runs table + drilldown) | **Built** — the dispatcher generates a `run_id` per Ask turn, threads it to the proxy (linking `call_attempts`), and posts a run row via `itmip_llm/run_event`; drilldown joins by `run_id`. |
| Run-row **cost rollup** (list pricing) | **Built** |
| **Concurrency gate** (per-user/BU/Org/server, queue/refuse, per-BU cap overrides) | **Built + live-verified** — see the concurrency guide |
| **Unattended (agent_runner) runs in the dashboards** | **Built** — the agent_runner threads `run_id`, so its proxy calls write linked `call_attempts` (and get the proxy's retry + circuit breaker). |
| Admin **config editor** fields (fallback chain + breaker/budget knobs) | **Built** — the LLM-config form (Settings) has a *Fallback chain* (comma-separated config names) + call-budget / breaker inputs; saved natively to `itmip_llm_configs`. (The form's data shape was live-verified: a config saved this way fails over correctly through the proxy.) |
| **Browser-direct transient retry** | **Built** — Anthropic via the SDK (`maxRetries`), OpenAI-compat / Gemini via a stream-safe `fetchWithRetry` (retries 408/429/5xx/529 with backoff + Retry-After). |
| Cross-config **fallback** on the browser-direct path | *Deferred* — accepted limitation (risk register §982): browser-direct retries transient errors but doesn't switch to a different config (that needs per-config key re-resolution client-side). The `splunk_proxy` call mode has full cross-config fallback. |
| Scheduled slot janitor / Playwright e2e | *Not needed / deferred* — slot leaks are prevented by the opportunistic sweep + safety TTL; logic is covered by the Python unit tests (`tests/test_llm_*.py`, `tests/test_concurrency.py`). No Playwright harness exists in the repo. |

The backend **agent_runner** (unattended Ask) already walks a multi-config
fallback chain (`[agent_runner] llm_fallback_config_id`); this increment adds the
classification/retry/breaker engine those paths can adopt.

---

## The error taxonomy (5 buckets)

Every provider failure maps to one bucket, which decides retry/fallback:

| Bucket | Examples | Retry same provider? | Fall back to next config? |
|---|---|---|---|
| `transient_network` | connection refused/reset, DNS, timeout-before-first-byte | yes (≤3) | yes, after retries |
| `transient_provider_side` | 429, 503, 529, overloaded, throttled, RESOURCE_EXHAUSTED | yes (≤3, longer backoff) | yes, after retries |
| `permanent_request` | 400/422, context-window exceeded, content filter, out-of-credits, OOM | **no** | **no** (fails identically elsewhere) |
| `permanent_auth` | 401/403, expired/revoked key, SigV4/AccessDenied | no | yes (next config may have different creds) |
| `unknown` | anything unclassified | 1 retry | 1 fallback |

Each failure also gets a **normalized code** (e.g. `anthropic_overloaded`,
`openai_quota_exhausted`, `gemini_rate_limited`, `bedrock_throttled`,
`ollama_model_not_pulled`, `net_dns_failed`) — stable across releases and used in
the telemetry rows. Billing states (`openai_quota_exhausted`,
`openrouter_no_credits`) are deliberately **non-retryable** even though they look
like rate limits — retrying a billing problem just wastes time.

TLS failures are `permanent_request` (a CA mismatch won't fix itself); when
`tls_skip_verify` is on for the config, the code is `net_tls_failed_dev_mode` so
the operator knows the dev-mode flag didn't mask it.

## Retry & backoff

Per-bucket budget, full-jitter exponential backoff, with a hard **total-call
budget** (default 30 s across all retries) so a slow provider can't burn the
user's patience. A provider `Retry-After` header is honoured for the next attempt
but **capped** (`retry_after_cap_ms`, default 60 s) — a hostile/buggy provider
can't make the server sleep for minutes.

## Circuit breaker

Per LLM config. After **5** transient/unknown failures within a 60 s window the
breaker **opens** for 30 s (calls short-circuit straight to fallback / surface).
After the open window one **half-open** probe is allowed; if it succeeds the
breaker closes, if it fails it re-opens for twice as long (capped at 600 s). A run
of `permanent_auth` errors (a bad key) **never** trips the breaker — that's the
operator's to fix, not something to lock the config out over. State is mirrored
(best-effort, ≤5 s staleness) to `itmip_llm_circuit_state` so other search-head
workers see an open breaker.

---

## Tuning knobs

Defaults live in `default/itmip_ai_workbench.conf [llm_reliability]` (override in
`local/`; see `README/itmip_ai_workbench.conf.spec`):

```ini
[llm_reliability]
default_retry_max_transient_network = 3
default_retry_max_transient_provider = 3
default_retry_base_delay_ms = 250
default_retry_max_delay_ms = 8000
default_total_call_budget_ms = 30000
default_circuit_failure_threshold = 5
default_circuit_open_duration_sec = 30
default_circuit_max_open_duration_sec = 600
respect_retry_after_header = true
retry_after_cap_ms = 60000
```

Per-LLM-config overrides (fields on `itmip_llm_configs`):

| Field | Meaning |
|---|---|
| `on_failure_fallback` | Ordered list of connection **names** to fall back to. When the primary exhausts its retries on a transient, auth or unknown failure, the next connection is prepared — **its own endpoint, key and headers** — and tried; a missing or disabled entry is skipped. A `permanent_request` failure (context exceeded, content filter, billing) does **not** fall back. The reply carries `config_used` and a note naming the fallback. **See the warning below before building a chain.** |
| `retry_policy_override` | JSON per-bucket override of the retry budgets |
| `total_call_budget_ms` | per-call time ceiling for this config |
| `stream_interruption_policy` | `restart` (default) / `surface_partial` / `bail` |
| `circuit_open_duration_sec`, `circuit_failure_threshold` | per-config breaker tuning |

> **⚠ Every connection in a chain must use the same model id.**
>
> Failing over swaps the endpoint, the key and the headers — but the request body
> is forwarded **exactly as the primary built it**, and that body carries the
> model id. A fallback pointing at a different model, or at a provider that names
> its models differently, is therefore called with the *primary's* model id and
> answers `400` or `404 model_not_found`. That is a permanent failure, so the
> chain stops there and the user sees it.
>
> A chain of connections that all name the same model — a second region, a spare
> key, a different account with the same provider — works exactly as described.
> That is the shape to build. Falling back across models or providers does not
> work today.
>
> One related detail when reading cost reports: the usage row records the
> fallback connection's *declared* model, while `actual_model` records what the
> provider actually answered with. Trust `actual_model`.

A change to the conf takes effect after a Splunk restart/reload; KVStore config
fields take effect on the next call.

---

## What the proxy returns

On success the proxy response gains `config_used` (and `reliability_note` if a
fallback was used). On exhaustion it returns the provider's **actual** last error
response (status + body) — exactly as before this feature — so existing browser
error handling is unchanged. Every attempt (including retries and
`circuit_open_skip`) writes one `itmip_llm_call_attempts` row for the (future) AI
Activity / LLM Health dashboards.

## Verifying

```bash
python3 tests/test_llm_errors.py    # 25 golden classification cases
python3 tests/test_llm_retry.py     # fallback, no-fallback-on-permanent, breaker open/half-open/closed
```

A live check: point an LLM config at an endpoint that returns 503, run an Ask, and
confirm the turn now retries (and ultimately surfaces the same error if the
provider stays down) instead of dying on the first 503 — and that
`| inputlookup itmip_llm_call_attempts_lookup` shows the retry rows.
