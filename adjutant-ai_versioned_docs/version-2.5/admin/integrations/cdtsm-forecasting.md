---
sidebar_position: 13
---

# CDTSM — Cisco Deep Time Series Model playbooks

**App version:** 2.5.9
**Last updated:** 2026-09-22
**Audience:** Splunk admins and analysts setting up or running CDTSM forecasting
and anomaly detection through Adjutant AI.
**Requires (at runtime, not at app install):** Splunk AI Toolkit (`Splunk_ML_Toolkit`) **>= 5.7.3**

> **Licensing note.** ML generation — MLTK `fit` **and CDTSM
> training** — is now a **Professional+** capability (`ml_generation`).
> It is enforced server-side at model-promotion time in
> `bin/itmip_llm_mltk_share.py`, which refuses the privileged global-share
> with **403 `Machine-learning workflows require a Professional or higher
> license.`** below Professional; the CDTSM playbooks also drop out of the
> Ask-tab picker below that tier. **CDTSM scoring / inference behaviour is
> unchanged** — the `apply CDTSM` command, its parameters, output columns,
> and the proof-dashboard logic are exactly as documented below. See
> the licensing reference for the full capability matrix.

> CDTSM is Splunk AI Toolkit's **pre-trained, generative** time-series model (jointly Cisco-branded, feature preview in MLTK 5.7.3+). Unlike the existing AI Toolkit playbooks it needs **no per-metric training** — no `fit`, no model object, no `splunk_share_mltk_model_globally`. You just `... | timechart ... | apply CDTSM <field>` and get a forecast (or anomalies). Adjutant AI wraps this in three conversational playbooks that ship a saved search + proof dashboard (+ alert) with the AI Toolkit Forecast / Anomaly Detection charts and TrackMe feed-health.

---

## 1. The three playbooks — when to use which

| Playbook | Answers | Output |
|---|---|---|
| **AI Toolkit – CDTSM Smart Forecasting** | "Where will this metric go in the next N hours?" | saved search + dashboard (Forecast Chart, confidence band) |
| **AI Toolkit – CDTSM Anomaly Detection** | "Is the current behaviour of this metric surprising?" | saved search + dashboard (Anomaly Detection Chart, segments + bands) |
| **AI Toolkit – CDTSM Predictive Alerting** | "Alert me *before* this metric crosses a threshold" | saved search + dashboard + scheduled alert (forecast-crosses-threshold). **Requires `power`/`admin`.** |

All three appear in the Ask-tab picker **only when MLTK >= 5.7.3 is installed** (they declare `dependent_apps = [{Splunk_ML_Toolkit, 5.7.3}]`). They share the `cdtsm-discipline` skill, which carries the hard rules (fixed-resolution data, >=60 / <=30k points, mode-specific parameter exclusions, no model sharing, rate limit, on-prem dependency). They do **not** include the training-based skills (`ml-aiworkbench-naming-and-share`, `ml-data-readiness-precheck`, `ml-self-correct-budget`).

CDTSM is **additive** — the nine existing AI Toolkit playbooks still serve data that doesn't fit CDTSM (sparse, < 60 points, irregular resolution) or use cases that need training-based models (categorical outliers, classification).

---

## 2. Cloud vs on-premise

| | Splunk Cloud | On-premise (Enterprise) |
|---|---|---|
| Model location | Splunk-hosted GPUs | Customer-run open-source **Cisco Time Series (CTS) server** |
| Admin setup | none | install the CTS server + point MLTK at it (§3) |
| Permission | caller needs `list_tokens_scs` | n/a |
| Rate limit | ~50 req/min (beta, AI-Toolkit-managed) | whatever the CTS server is provisioned for |
| Cost | no extra cost during beta | your GPU/CPU infra |

The playbooks handle both transparently; only the deliverable advisory text differs. Run `splunk_check_cdtsm_availability` (read-only tool) to see exactly which prerequisites are met.

---

## 3. On-premise setup runbook (CTS server)

On-prem `apply CDTSM` will **not** work until the open-source CTS server is running **and** MLTK is pointed at it. The most common failure is the second half being missing — then `apply CDTSM` silently falls back to the Splunk-Cloud provider and fails on an on-prem box.

1. **Run the CTS server** (open source): https://github.com/splunk/cisco-time-series-model. It serves an HTTP infer API (FastAPI). Confirm it's healthy and note the published port and infer route — e.g. a container publishing `:8080` with routes `GET /health` and `POST /cdtsm/v1/ai/infer`:
   ```bash
   curl http://localhost:8080/health        # -> {"status":"ok","service":"cdtsm-inference-host"}
   ```
2. **Point MLTK at it** — add to `$SPLUNK_HOME/etc/apps/Splunk_ML_Toolkit/local/mlspl.conf`:
   ```ini
   [CTSM]
   self_hosted_cdtsm_endpoint = http://localhost:8080/cdtsm/v1/ai/infer
   ```
   The value must be the **fully-qualified infer URL** (scheme + host + path), not just host:port. If MLTK complains about acknowledgement, also set `ctsm_acknowledge = true` (accepts the feature-preview terms).
3. **Store the server's bearer token** (if the CTS server requires auth — it returns HTTP 401 otherwise) in Splunk `storage/passwords`, realm `aitk_fm_tokens`, name `CDTSM_AUTH_TOKEN`, value = the server's `CDTSM_AUTH_TOKEN`:
   ```bash
   curl -k -u admin https://localhost:8089/servicesNS/nobody/Splunk_ML_Toolkit/storage/passwords \
     -d realm=aitk_fm_tokens -d name=CDTSM_AUTH_TOKEN --data-urlencode password=<TOKEN>
   ```
   Or use the AI Toolkit UI's foundation-model token field. (`--data-urlencode` matters — plain `-d` can turn `+` into a space and corrupt the token.) **No splunkd restart needed** — MLTK reads it at search time.
3a. **Share the token GLOBALLY — REQUIRED for Adjutant AI.** ⚠️ The token above is created scoped to the **Splunk_ML_Toolkit app** (and often `owner=admin`). Adjutant AI is a host shell: it creates and runs CDTSM saved searches + dashboards in the **calling app's namespace** (Search, ITSI, your SOC app…), *not* in Splunk_ML_Toolkit. A search running there cannot read an app-scoped token, so `apply CDTSM` returns **HTTP 401** even though the same SPL works inside the AI Toolkit app. Re-share the credential globally (no restart needed):
   ```bash
   curl -k -u admin https://localhost:8089/servicesNS/admin/Splunk_ML_Toolkit/storage/passwords/aitk_fm_tokens%3ACDTSM_AUTH_TOKEN%3A/acl \
     -d sharing=global -d owner=nobody
   ```
   Verify with `| rest /servicesNS/-/-/storage/passwords | search realm=aitk_fm_tokens | table title eai:acl.sharing eai:acl.owner` → `sharing` should read `global`. The preflight tool `splunk_check_cdtsm_availability` warns when this isn't global.
4. **Test:** `index=_internal | timechart span=5m count | apply CDTSM count` → expect `predicted`, `lower*`, `upper*` columns. Run it from a **non-AI-Toolkit app** (e.g. Search) to confirm the global sharing took.

> If you recreate the CTS container with a new `CDTSM_AUTH_TOKEN`, update the `storage/passwords` entry to match (and it stays globally shared).

---

## 4. Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| Forecast fails on an on-prem box with a Cloud/SCS error | `mlspl.conf [CTSM] self_hosted_cdtsm_endpoint` is unset → MLTK uses the Cloud provider | §3 step 2 |
| `Self-hosted endpoint rejected credentials (HTTP 401)` **everywhere** | MLTK isn't sending the bearer token (missing / wrong) | §3 step 3 |
| `Self-hosted endpoint rejected credentials (HTTP 401)` **only outside the AI Toolkit app** (works in Splunk_ML_Toolkit, 401s in the app Adjutant AI runs from) | **The #1 Adjutant AI CDTSM failure.** The token is scoped to the Splunk_ML_Toolkit app (and/or `owner=admin`), but Adjutant AI runs CDTSM searches/dashboards in the **calling app's** namespace, which can't read an app-scoped credential. Affects **both** methods (it's not method-specific). | **§3 step 3a — share the token globally.** `splunk_check_cdtsm_availability` flags this. |
| `connection refused` / `service unavailable` | CTS server not running | start the CTS server (§3 step 1) |
| `data does not have fixed resolution` | input series has irregular bucket spacing | use a fixed `timechart span=`, or `fill_null=forward_fill`, or a tighter window |
| `RATE_LIMIT_EXCEEDED` / HTTP 429 | the ~50 req/min beta cap | retry with backoff; use sequential not parallel calls; avoid minute-cadence scheduled CDTSM searches |
| Forecast Chart shows "no data" | `show_input=true` missing (forecast) or `mode=anomaly` missing (anomaly) | add the missing parameter to the search |

The read-only **`splunk_check_cdtsm_availability`** tool consolidates these checks (MLTK version, deployment kind, `list_tokens_scs`, and the on-prem `[CTSM]` endpoint config) into one structured report with concrete next steps.

---

## 5. SPL constraints (the model is strict)

- No wildcards in the field list — name fields explicitly.
- `by` must immediately follow the fields, as a **quoted CSV**: `by "host, region"` (quote even one field).
- `holdback` <= `forecast_k`; not both 0 when specified.
- `quantiles` needs a quoted CSV: `quantiles="p10,p50,p90"`.
- In `mode=anomaly` do **not** use `forecast_k`, `holdback`, or `quantiles` — they error.
- Data: fixed resolution; >= 60 and <= 30,000 input points; input + `forecast_k` <= ~50,000 for the chart to render.
- Defaults: `forecast_k`=128 (max ~384); `conf_interval`=80 forecast / 60 anomaly; anomaly `multiplier`=5 (quantile) / 3 (iqr_residual); `off_ratio`=0.9. **There is no `fill_null` param** — irregular spacing is repaired (only if enabled) by the admin's `mlspl.conf [CTSM] repair_timeseries`, not by the search.

---

## 6. Complete `apply CDTSM` parameter reference

From the MLTK 5.7.3 implementation (`cdtsm_pkg/constants.py` → `EXPECTED_PARAMS`). `by` is a structural split clause (like `stats … by`), not a parameter.

**Forecast / base (any mode):**

| Param | Type | Default | Notes |
|---|---|---|---|
| `fields_to_forecast` | fields | — | one or more numeric fields; **no wildcards** |
| `by "f1, f2"` | clause | — | quoted CSV, immediately after the fields |
| `time_field` | str | `_time` | must be populated + parseable |
| `forecast_k` | int | 128 | horizon in buckets; max ~384 |
| `holdback` | int | 0 | must be <= `forecast_k` |
| `conf_interval` | int/str | 80 (60 in anomaly) | one of 20/40/50/60/80/90/98 |
| `quantiles` | str | — | quoted CSV, e.g. `"p10,p50,p90"` |
| `show_input` | bool | false | `true`/`t` returns history with the forecast |

**Anomaly only (`mode=anomaly`):**

| Param | Type | Default | Notes |
|---|---|---|---|
| `mode` | str | forecast | set to `anomaly` |
| `method` | str | quantile | `quantile` or `iqr_residual` |
| `multiplier` | float | 5 (quantile) / 3 (iqr_residual) | lower = more sensitive |
| `threshold_direction` | str | both | `both` / `upper` / `lower` |
| `quantile` | float | — | quantile level |
| `quantile_lower` | float | — | lower threshold quantile (p1..p40) |
| `quantile_upper` | float | — | upper threshold quantile (p60..p99) |
| `detection_window_earliest` | str | -3h | start of the detection window |
| `detection_window_latest` | str | (search latest) | end of the detection window — **defaults to the search's `latest` time** |
| `context_window_earliest` | str | — | start of the model context window |
| `context_window_latest` | str | — | end of the model context window |
| `context_length` | int | 512 | context length (advanced) |
| `detection_length` | int | 128 | detection length (advanced) |
| `stride` | int | 128 | stride (advanced) |
| `on_span` / `off_span` | int | 3 / 3 | segment on/off span |
| `on_ratio` / `off_ratio` | float | 0.5 / 0.9 | segment on/off ratio |

**Not a parameter:** `fill_null` does not exist; time-gap repair is the conf-level `mlspl.conf [CTSM] repair_timeseries` (off by default — inconsistent spacing then raises a `RuntimeError`). Resolution must be consistent; **1-min or 5-min is recommended** (larger fixed buckets work but the model emits a caution).

**Detection window ≤ 24 h (hard limit).** CDTSM errors `detection window duration (… hours) exceeds the maximum allowed (24 hours)` when `detection_window_latest − detection_window_earliest > 24h`. Because `detection_window_latest` **defaults to the search's `latest`**, live relative bounds (`detection_window_earliest=-3h`, latest `now`) are fine — but a **fixed / historical dataset** (`| inputlookup`) is a trap: you must bound the dashboard panel's time range to the data window (an unbounded `timechart span=…` over `earliest=0` separately trips the ">50000 rows" guard), and that bounded panel `<latest>` then becomes `detection_window_latest`, which can sit >24 h after an absolute `detection_window_earliest`. **On a fixed dataset, set `detection_window_latest` explicitly (= `detection_window_earliest` + ≤24 h) and use absolute EPOCH for both the panel `<earliest>`/`<latest>` and the detection-window bounds** — an ISO panel `<latest>` is parsed in the server timezone and can push a 24 h window to 25 h (e.g. `…T23:59:59`). The panel `<latest>` need only cover the data; the window is pinned by the explicit `detection_window_latest`. (See the `cdtsm-discipline` skill.) **The dashboard create/update path now hard-refuses a publish when a computable detection window exceeds 24 h** (alongside the existing ">50000 rows" span guard and the `<html>`-escape auto-repair), so a broken CDTSM dashboard cannot ship from the UI.

---

## 7. Proof dashboard & verification (trustworthy to a non-specialist)

Every CDTSM playbook ships a **proof dashboard** whose job is to let a user who knows no ML decide whether to trust the result. The mechanism differs by mode: forecasting has a ground truth (the future eventually arrives, so you can backtest), anomaly detection does not (no labels), so it is proven indirectly.

### 7.1 Output columns — exact names

CDTSM does **not** emit a bare `predicted` column. Reference these names single-quoted in eval (they contain parentheses/dots): `'predicted(cpu)'`, `'cpu.anomaly_state'`.

**Forecast mode** (`cdtsm_pkg/forecast_mode.py::_get_forecast_column_name`), `C` = `conf_interval` (e.g. 80):

| Column | Meaning |
|---|---|
| `predicted(<field>)` | forecast mean |
| `lower<C>(predicted(<field>))` | lower band — e.g. `lower80(predicted(cpu))` |
| `upper<C>(predicted(<field>))` | upper band |
| `p<N>(predicted(<field>))` | a requested user quantile (only if `quantiles=` given) |
| `<field>` | the actual history (only when `show_input=true`) |

**Anomaly mode** (`cdtsm_pkg/anomaly_mode.py`), `C` = `conf_interval` (default 60):

| Column | Meaning |
|---|---|
| `<field>.forecast` | expected / mean |
| `_lower<C>.<field>` / `_upper<C>.<field>` | the C% band quantiles |
| `<field>.threshold_lower` / `<field>.threshold_upper` | pointwise thresholds |
| `<field>.anomaly_state` | `"ANOMALOUS"` / `"NORMAL"` |
| `_isAnomaly.<field>` | `0` / `1` |
| `<field>.anomaly_score` | numeric score |
| `_is_anomaly_start.<field>` / `_is_anomaly_end.<field>` | anomaly-segment edges |
| `_zone` | `"history"` / `"forecast"` / `"post"` |

### 7.2 Forecast proof — the holdback backtest

Reserve the last `H` buckets, forecast them, compare to what actually happened. `forecast_k=H holdback=H show_input=true` makes CDTSM predict a recent window it was **not** shown (`H = min(forecast_k, max(12, round(0.1 × points)))`):

```spl
... | timechart span=<bucket> <agg>(<field>) AS <field>
| apply CDTSM <field> forecast_k=<H> holdback=<H> conf_interval=<C> show_input=true
```

Two plain-language KPIs off that one search, plus the Forecast Chart over the held-back window (predicted-vs-actual overlay = the visual proof):

- **Band coverage %** — how often reality landed inside the band (≈ `C`% = well-calibrated):
  ```spl
  | where isnotnull('predicted(<field>)')
  | eval _in=if('<field>'>='lower<C>(predicted(<field>))' AND '<field>'<='upper<C>(predicted(<field>))',1,0)
  | stats avg(_in) AS c | eval coverage=round(c*100,1)
  ```
- **Accuracy %** — `1 − MAPE`, computed in eval (the `score` command has no MAPE):
  ```spl
  | where isnotnull('predicted(<field>)')
  | eval _e=abs('<field>'-'predicted(<field>)')/abs('<field>')
  | stats avg(_e) AS m | eval accuracy=round((1-m)*100,1)
  ```

### 7.3 The `score` command (MLTK) — available metrics

`| score <method> <actualField> against <predictedField>`. This MLTK build ships **regression** metrics `R2`, `mean_squared_error` (→ RMSE = √it), `mean_absolute_error`, `explained_variance` — **no `mean_absolute_percentage_error`**, so MAPE is computed in `eval`. For goodness-of-fit on a backtest: `| score R2 <field> against 'predicted(<field>)'`. (Other categories present: classification `Accuracy`/`Precision`/`Recall`/`F1`/`ROCAUC`, statistical tests, `Describe`.)

### 7.4 Anomaly proof — no ground truth

No label to score against, so prove it indirectly: **band coverage on NORMAL points** (of non-anomalous detection points, the % inside `_lower<C>.<field>`..`_upper<C>.<field>` — should be high → the model's normal range fits ordinary behaviour), the **anomaly rate** (`sum('_isAnomaly.<field>')` ÷ detection buckets — should be small), the **anomalies table**, and the visual (do flagged points stand out from the shaded band?). Tuning: raise `multiplier` to flag fewer, lower it to flag more.

### 7.5 AI Toolkit custom-visualization options

Set as `<option name="display.visualizations.custom.Splunk_ML_Toolkit.<VizId>.<opt>">value</option>`. **These live in each viz's `formatter.html`, so `splunk_get_visualization_docs` (which reads `conf-visualizations`) does NOT return them** — set them explicitly.

| Viz | Option | Values | Notes |
|---|---|---|---|
| ForecastViz | `showConfInterval` | true/false | show the confidence band |
| ForecastViz | `legendAlign` | bottom/right/left/top | legend position |
| ForecastViz | `groupByFilter` | `"<col>=<value>"` | **required for a `by` search** — else all groups overplot |
| AnomalyViz | `showConfInterval95` | true/false | 95% prediction band |
| AnomalyViz | `showConfInterval50` | true/false | 50% prediction band |
| AnomalyViz | `showAnomalyRegion` | true/false | shade the anomaly segments |
| AnomalyViz | `showZoneBoundaries` | true/false | history / detection boundaries |
| AnomalyViz | `legendAlign` | bottom/right/left/top | legend position |
| AnomalyViz | `groupByFilter` | `"<col>=<value>"` | pick one series from a `by` search |

> ForecastViz has **no** threshold-line option (Predictive Alerting draws the threshold as a separate constant series, not a viz option).

---

## 8. How it works — Adjutant AI × AI Toolkit (the integration)

CDTSM is **not** implemented in Adjutant AI. The model and the `apply CDTSM` SPL command live entirely inside **Splunk AI Toolkit (MLTK >= 5.7.3)**; Adjutant AI is a thin **orchestration layer** that helps a non-ML user drive that command correctly and then proves the result. Nothing in this app calls Cisco or a model endpoint directly — every model call is `splunkd -> MLTK -> (Splunk Cloud GPUs | on-prem CTS server)`, exactly as if the user had typed `apply CDTSM` in Search.

### 8.1 What Adjutant AI adds (and only this)

| Layer | Artifact | Role |
|---|---|---|
| Playbooks | 3 seed playbooks in `src/services/useCases.ts` (`SEED_TEMPLATES`) | Conversational guides: gather intent through a plain-language questionnaire, then have the LLM compose the correct `apply CDTSM` SPL, create the saved search + proof dashboard (+ alert), and self-verify. |
| Skill | `cdtsm-discipline` in `src/services/skillSeeds.ts` | The hard rules (parameters, constraints, exact output columns, viz options, verification, no model sharing) injected into each playbook's assembled prompt. |
| Tool | `splunk_check_cdtsm_availability` in `src/services/tools.ts` | Read-only preflight: MLTK version, Cloud-vs-on-prem, `list_tokens_scs`, and the on-prem `[CTSM]` endpoint config. |

That is the entire footprint — three seeds and one read-only tool, all frontend. There is **no** new Python REST handler, **no** new KVStore collection, and **no** new outbound network egress from Adjutant AI.

### 8.2 Runtime path (one forecast)

1. The user opens the assistant inside their own app, picks a CDTSM playbook, fills the guided form, and sends.
2. The LLM (browser-direct or splunk_proxy) runs the playbook loop, calling the **existing** tools over **browser -> splunkd REST**: `splunk_list_apps` (gate on MLTK >= 5.7.3), `splunk_check_cdtsm_availability`, `splunk_run_search`, `splunk_create_saved_search`, and the Simple XML builder chain `splunk_xml_create -> splunk_xml_add_input -> splunk_xml_add_panel x N -> splunk_xml_publish` (`_publish` still persists through the same `create_dashboard_xml` guardrails).
3. When a saved search runs, **splunkd** executes `… | apply CDTSM …`, which hands off **inside MLTK** (`cdtsm_pkg`) to the model provider:
   - **Splunk Cloud** -> Splunk-hosted GPUs (the SCS provider); caller needs `list_tokens_scs`.
   - **On-premise** -> the customer-run open-source **CTS server** (FastAPI, `POST /cdtsm/v1/ai/infer`), selected because `mlspl.conf [CTSM] self_hosted_cdtsm_endpoint` is set; the bearer token is read from `storage/passwords` realm `aitk_fm_tokens`, name `CDTSM_AUTH_TOKEN`.
4. The forecast / anomaly columns return to the saved search; the LLM builds the proof dashboard via the Simple XML builder (`splunk_xml_create -> splunk_xml_add_input -> splunk_xml_add_panel x N -> splunk_xml_publish`, the AI Toolkit Forecast / Anomaly custom viz + the holdback backtest, §7) and delivers a plain-language summary.

### 8.3 Why it is additive and gated

- **Gating** — the playbooks declare `dependent_apps = [{Splunk_ML_Toolkit, 5.7.3}]`, so they appear in the Ask picker **only** when MLTK >= 5.7.3 is installed; on a box without MLTK, CDTSM is simply invisible (no errors). Predictive Alerting also sets `required_roles = [power, admin]` (alert creation).
- **No training, no model object** — unlike the nine training-based AI Toolkit playbooks (StateSpaceForecast, DensityFunction, …), CDTSM is pre-trained: no `fit`, no `into <model>`, no `splunk_share_mltk_model_globally`. The `cdtsm-discipline` skill enforces this.
- **Trust boundary** — the model call belongs to MLTK, not to Adjutant AI. Adjutant AI's own boundary stays exactly what it was: browser <-> splunkd REST plus the LLM channel. The on-prem CTS hop (splunkd -> CTS server) is described in the architecture overview §3.12.

---

*Authoritative CDTSM docs:* https://help.splunk.com/en/splunk-cloud-platform/apply-machine-learning/use-ai-toolkit/5.7.4/ai-toolkit-models/feature-preview-cisco-deep-time-series-model
