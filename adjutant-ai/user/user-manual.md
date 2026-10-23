---
sidebar_position: 1
---

# User manual — Adjutant AI (formerly AI Workbench)

**App version:** 2.7.0
**Last updated:** 2026-10-12
**Audience:** end users — anyone who does **not** hold `admin`,
`splunk_admin` or `sc_admin` on the search head. If you hold any of those
three, see [the admin manual](../admin/admin-manual.md) instead: you get extra tabs and
controls on top of everything below.

> **`sc_admin` counts as an admin — and on Splunk Cloud it is *the* admin
> role.** Earlier builds disagreed with the server about this: an `sc_admin`
> passed every server-side check but was still shown the non-admin UI, with no
> Playbooks, Tools, Models, License or Backups tab. **Fixed in 2.5.9.** If you
> are on an older build and see this manual's app while holding `sc_admin`,
> that is the bug, not your configuration, and upgrading resolves it.

> **About this app — read first.** Adjutant AI is a *host shell*: a
> single-page React app that has **no use-cases of its own**. Every
> piece of functionality it offers (which governed agents appear, which
> LLMs are reachable, which tools the LLM may call, where saved
> searches / dashboards / alerts land) is fully derived from
> **(a) the Splunk app you opened it from** and **(b) the Splunk
> roles you hold**. You should reach the assistant from within
> Search / ITSI / Enterprise Security / your team's custom apps via a
> nav-menu entry — you should **not** click the
> `itmip_ai_splunk_assistent_app` tile on the Splunk launcher
> directly. The whole point of the Workbench is to deliver governed
> agents *inside the apps you already work in*, with everything they
> creates landing in those apps' namespaces. See
> [the installation guide, Deployment model](../admin/installation.md)
> for the full rationale.

> **A note on what you can see (license tiers).** Depending on the
> active license tier, some tabs and agents may appear **greyed out
> with a 🔒 padlock and a short upsell message** instead of being
> usable. A locked agent tile is greyed, refuses the click, and carries a
> **`🔒 Pro`** or **`🔒 Enterprise`** badge; hovering it tells you exactly which
> entitlement is missing.
>
> As a rough guide: machine-learning and data-onboarding agents need
> **Professional** or higher; security / Enterprise Security / ITSI agents
> and integrations (reconciliation, integration flows, scheduled integrations)
> need **Enterprise**; and **History** needs **Professional**. Some features
> need a **named add-on** on top of the edition — you may see messages naming
> `itsi-rca`, `fraud-analytics`, `socplaybooks`, `opsrunbooks` or `servicenow`.
> Those are purchased separately; having Enterprise alone is not enough for them.
> (`socplaybooks` unlocks the SOC and security agent templates; the licence
> feature keeps its original name.)
>
> This is normal — it just means that feature isn't in your current plan.
> **Nothing you have created is ever deleted** if a licence changes or expires;
> gated features simply become unavailable until the tier is restored.
>
> **To see your active tier, open Help → About.** (Older versions of this manual
> said to check the License tab — that tab is admin-only, so it is not somewhere
> you can go.) Everyday work — SPL, dashboards, saved searches, alerts, the
> knowledge layer — is available on every tier.

## What this app does

Adjutant AI turns plain English into:

- **SPL searches** — generate, improve, audit, explain.
- **Simple XML dashboards** and panels, including large multi-panel
  dashboards, which the assistant now assembles panel-by-panel so they
  render reliably (no truncation or escaping errors).
- **Saved searches** and **alerts** (alert creation requires the
  `power` role).
- **Reports** and **lookups**.
- **AI Toolkit (Splunk_ML_Toolkit) machine-learning pipelines** —
  outlier detection, smart forecasting, clustering, prediction,
  anomaly detection, ONNX scoring, SageMaker scoring (these require
  Splunk_ML_Toolkit to be installed and visible to you).

You ask in natural language; the app calls a Large Language Model and
the LLM uses a curated set of Splunk-aware **tools** to look at your
data, list your knowledge objects, run probe searches, and create the
artefact you asked for.

## Where the app runs (and where it saves things)

Adjutant AI is designed to be **added to the navigation menu of every
Splunk app you use** — not just opened from the "Adjutant AI" tile in
Splunk Home. Your administrator typically does this by editing each
app's `data/ui/nav/default.xml` to add an entry that opens the
Workbench in the context of *that* app.

This matters because:

- **The Splunk app you launch Adjutant AI from is the namespace it
  works in.** If you open it from the Search app, the saved searches /
  dashboards / alerts the assistant creates land in the Search app. If
  you open it from a sister app (e.g. `itmip_ai`), the same artefacts
  land there instead. The header bar shows the active app under
  *App: \<name\>*.
- **Your visible Org + BU is decided automatically** from the calling
  app and your Splunk roles. The admin scopes Organisations (by app
  patterns) and Business Units (by role/user) up front; Adjutant AI
  picks the first match for you. The header bar shows the active
  *Org: \<short\>* / *BU: \<short\>*.
- **If no Org matches you**, the app greys out every tab and shows a
  message from your Splunk team explaining how to request access. You
  can still see that the Workbench is installed, but nothing is
  clickable.

You don't pick the Org/BU yourself — it's a property of "which app you
opened the Workbench from + your role". If you need access in a
different app's namespace, ask your Splunk admin to either add a nav
entry for Adjutant AI in that app OR extend an Organisation's
`app_patterns` to cover it.

## Opening the app

From the Splunk Web app menu, open **Adjutant AI** — or open it from
**any other app's nav menu** if your admin has added it there (this is
the common case; see the section above on where the app runs).

The header shows:

```
Adjutant AI   [License badge if any]   v2.7.0
App: <your-current-app>  •  User: <you>  •  Org: <ORG>  •  BU: <BU>
```

The version is whatever is installed. Admins see `(admin)` after their
username — if you don't, you are on the user experience this manual describes.

- **License badge** — the pill next to the title shows the active edition:
  `Professional Edition`, `Enterprise Edition`, or
  `MSP Enterprise Edition` (the MSP text is white-labelable by your admin);
  `Running on free License` on the free tier; `Running on a Proof of Value
  License` / `Running on a Proof of Value MSP License` for trials; and
  `Not-for-Resale License` for NFR. An expired or mis-activated paid licence
  reads `Running on free License` until it is re-activated.
- **Org / BU**: the Org and BU you are assigned to. Admins decide which Org and
  BU you fall into based on your Splunk role(s) and the app you're
  currently in. The Org/BU affects which agents and LLMs you see.

## Tabs you can use

You get **four**:

| Tab | Purpose |
|-----|---------|
| **Console** | The main workspace. Run an agent or type a request; the assistant responds with SPL / dashboards / created objects. |
| **History** | Replay and re-ask previous questions. Always present, but **greyed out on the Personal (free) tier** — hovering says *"Available with a Professional+ license"*. |
| **Settings** | See the AI connections available to you, check their status, and choose a colour theme. (**Read-only** as far as creating connections goes — see [The Settings tab](#the-settings-tab).) |
| **Help** | About / version / licence tier, and **🐞 Report an issue**. |

**Help is special:** it sits outside the main panel, so it keeps working even
when the rest of the app is greyed out — which is exactly when you need to
report a problem.

Tabs you **won't** see, because they are admin-only: Agents, Skills,
Knowledge, **Unattended** (which includes integrations, mappings and input
sources), Tokens & Costs, Orgs & BUs,
Tools, **Models**, Audit, License, Backups.

> Don't worry about the admin tabs. Everything they configure (which agents
> you get, which AI connections you can use, what the assistant is allowed to
> do) shows up for you inside the **Console**.

### Dashboards in the app's left-hand nav

Separately from the tabs above, the app ships Splunk dashboards in its
left-hand nav. They are operator views and are visible to administrators only
(`admin`, `sc_admin`, `splunk_admin`); other users do not see them in the nav:

| Dashboard | Shows |
|---|---|
| **Adjutant AI — ITSI RCA** | Root-cause investigations the assistant has run. |
| **Adjutant AI — Automation Outcomes** | What automated runs did, and how they turned out. |
| **Adjutant AI — AI Activity** | Assistant activity over time. |
| **Adjutant AI — LLM Health** | Whether the AI connections are answering. |
| **Adjutant AI — Resource Consumption** | What the app is costing in resources. |
| **Adjutant AI — Pipeline Knobs** | The tuning settings currently in effect. |

**Outcome Ledger**, **Behaviour (OCSF)** and **Fraud Data Readiness** are
admin-only as well.

## The Console tab

This is the main workspace. The flow is:

1. (Optional) Click a tile in the **Agents** card. Each tile is
   an agent: a pre-tuned prompt for a common task ("Build a SPL search",
   "Improve an existing SPL", "Build a Simple XML dashboard", "AI
   Toolkit – Smart outlier detection (single metric)", "ATT&CK Tactic Hunt —
   Technique Coverage Dashboard" (only appears when Splunk Security
   Essentials is installed), and more; which ones you see depends on your
   Org/BU and roles). If you don't pick one,
   the router picks the right agent for you.

   **Finding one**: the card has a search box
   (*"Search N agents…"*, where N is the number of agents you can see), a
   **Filter by tag…** box and a **Filter by
   category…** box, a **Clear** button and a live *"N matches"* counter. The
   tag and category suggestions only offer values that exist in agents
   *you* can see.

   Click the selected tile again to deselect it. Collapse the whole card with
   the **▸ / ▾** chevron in its heading; when collapsed it shows a
   *"Agent active: &lt;name&gt;"* pill with an **×** to clear it.

   > **An agent applies to the first message of a thread only.** Once you are
   > in a conversation, the other tiles are disabled — hovering says so. Click
   > **Clear** to start a new thread if you want a different agent.
   >
   > If an agent carries a ready-made question form, picking it asks
   > *"Replace the current text in 'Your request' with the template's form?"*
   > — say no to keep what you have typed.
2. Type your request in the **Your request** box. Be specific:
   include the index you care about, the time range, the field
   name(s), and what "good" looks like.
3. (Optional) **Attach references & samples** — the card is titled that —
   to pin one or more concrete
   Splunk objects to the conversation:
   - Index
   - Saved search
   - Lookup table file
   - Dashboard view
   - AI Toolkit model (only shown if Splunk_ML_Toolkit is installed
     and visible to you)
   - **A sample file from your computer**: pick a local
     text file (a `.log`, `.txt`, `.csv`, `.json`, `.conf`, …) and its
     contents are read **in your browser** and sent along as **data to
     analyse**. This is perfect for **onboarding a brand-new source**:
     attach a raw sample log and ask "what `props.conf` / `transforms.conf`
     do I need?" — even before the data is in Splunk. Notes:
     - Only the **file name** is recorded in the audit trail — the file
       **contents are never audited**.
     - Large files are **capped** (about the first 512 KB is read and up
       to ~80,000 characters are sent); you'll be told if a file was
       trimmed to a sample.
     - The contents are clearly labelled to the assistant as *data, not
       instructions*, so text inside the file can't hijack the request.
4. Choose the **LLM** to use from the dropdown (top right of the Console
   panel). Your admin has provisioned at least one. You can use the
   built-in **`DFLT_DFLT_anthropic_central`** as long as the admin
   has stored the central Anthropic key on the SH.
5. Choose the **Model** — the dropdown shows the price per million
   tokens and a speed hint (⚡ fast, • balanced, 🐢 careful).
6. Decide on **Also build a proof dashboard** — *"A dashboard that shows the
   result works. Adds time to the Ask."* With the switch off, the assistant
   builds what you asked for (a saved search, an alert, a model, an
   investigation summary) and no extra dashboard, and it does not ask you
   about one. Switch it on and it also builds a dashboard that proves the
   result. The switch appears only where it can change something: when no
   agent is selected, and for agents with an optional proof-dashboard
   step. It is hidden for agents that build no dashboard (such as
   **Build a SPL search**) and for agents whose dashboard is the result
   you asked for (the dashboard-building agents, ATT&CK Tactic Hunt,
   Fraud Data Coverage Audit and Fraud Command Center); there the request runs
   without a proof dashboard. Where it appears it is off unless the agent
   starts it on: the AI Toolkit model builds, Build / improve an alert, the
   two data-quality checks, Investigation and Fraud Ring Mapper start it
   on. You can change it before you send and between turns. If you ask for
   a dashboard in your own words, you get one whatever the switch says.
7. Click **Run** (or press `⌘/Ctrl + Enter`).

   If the button reads **`Configure LLM first`**, no AI connection is usable
   yet — that is one for your admin.

While the assistant works, the **Tool calls** panel under your question shows
what it is doing, step by step, and lets you stop it. See
[The Tool calls panel](#the-tool-calls-panel).

In the question box, next to the model choice, a **Session** pill shows what the
session has used so far.
Before you ask anything it reads `Session: 0 tokens`; once running it shows the
real figures, for example `Session: 12K in · 3.4K out · ≈ $0.0421 · 1m 20s`.

### Reading the answer

The response block gives you more than prose:

- **Created in Splunk** — a card listing each object, with a pill saying
  *Created / Updated / Linked / Noted on / Acknowledged*, and a
  **"Click here to view &lt;kind&gt; →"** button that jumps straight to it.
- **⤓ Download package** — when the assistant generated a configuration
  package rather than an object in Splunk.
- **Validation pills** — `Validation: OK` or `Validation: N errors`, plus
  `N searches passed` / `N skipped`.
- **Reasoning** — open by default, streaming as it is written.
- **Tool calls**: every step the assistant took for this question. See
  [The Tool calls panel](#the-tool-calls-panel).
- **Copy** on any code block, and **Run ad-hoc** on SPL to execute it straight
  away in Splunk.

### The Tool calls panel

Every question you send gets its own **TOOL CALLS** panel. It shows each step the
assistant takes for that question: each Splunk search, each lookup, each model round,
in the order they happen, with how long each took. Everyone sees it; there is no
setting to turn it off. The panels last while the Console tab is open: **Clear** empties
them, and a question reopened from History does not bring its panel back.

**The header** reads `TOOL CALLS`, followed by `Running` while the question runs, the
time so far, the number of steps (model rounds included) and, when it applies,
`1 needs attention` or `N need attention`. Click the header to open or close the
list; after you do, the panel keeps your choice.

**The headline** under the header is one sentence that says where things stand:

- While it runs: `Now:` followed by the current step and its purpose, and the step's
  live line. For example: *Now: Splunk search main, last 24 h: stats count by host.
  1,284 events found · 4.1 million scanned · 37% done.* Before the first step it
  reads `Starting.`
- When it is done, one of:
  - *Took 48 s. Most of it (41 s) was one Splunk search (…).*, when one step took at
    least half the time;
  - *Took 12 s, 5 steps.*;
  - *Answered without tools in 3.2 s.*;
  - *Took 30 s. 1 item needs attention: …*, naming the step and what is wrong;
  - *Cancelled after 1 min 5 s.*, when you pressed **Stop**;
  - *Stopped after 20 s: …*, when the question ended with an error.

While the question runs, the list stays open. When it is done, the list closes to the
headline and a time strip, unless a step needs attention; then it stays open. The strip
says where the time went: *Waiting for user* (a write waiting for your approval), *Splunk*,
*Other tools*, *Model*, *Network and proxy*, *Adjutant* and *Unaccounted*. Every moment counts
once, so the parts add up to the whole; when steps ran at the same time the strip says
*parallel steps counted once*. A second or more that no step accounts for (10% of the time or
more) is noted under the strip as *… not attributed*.

**The steps.** Each row shows a plain name (*Splunk search*, *Run saved search*,
*List indexes*, *Save search*, *Create alert*, *Dashboard builder*, *Model*, and so
on), what the step is for (built from what it actually did, for example the index,
the time range and the command of a search, or *Added panel: Errors by host* for the
dashboard builder), and its duration. Hover a row to see the tool's technical name.
Model rounds read *Planned the next step*, *Read the tool results* or *Wrote the
answer*.

A running step also shows a **live line**, updated every second or two:

| Live line | Meaning |
|---|---|
| *Sending search* | The search is being sent to Splunk. |
| *Waiting for a free search slot (…)* | Your searches are at their limit; this one waits its turn. |
| *Queued at Splunk (…)* | Splunk has queued the search. |
| *1,284 events found · 4.1 million scanned · 37% done* | The search is running. A search that summarises shows *results so far* instead of *events found*. |
| *Finalizing* | Splunk is finishing the search. |
| *Fetching results (…)* | The search is done; its rows are being read. |
| *Cancelling* | You cancelled the search. |
| *Failed at Splunk* | Splunk reported an error. |
| *Waiting for the model (…)* / *Waiting for response (…)* | A model round, or another tool, is still working. |

Click a row (or press Enter on it) to see its details: the step, its purpose, its
status, when it started and how long it took, a short summary of what came back, and
any attention notes. **Expand all** and **Collapse all** sit above the list; the arrow
keys, Home and End move between rows. **Copy diagnostics** copies the steps' names, times,
statuses, notes, ids, searches and counts as text for a support ticket. It never copies results
or what a tool returned. In a step's Input and Output, passwords, keys and tokens are masked. A
question opened from History also has **Export**: the steps as JSON (optionally with each step's
inputs and outputs, masked as above), as OCSF events, or as OpenTelemetry spans.

**Hints.** A Splunk search step's Summary can carry hints, each marked with its rule (for
example *Hint (HNT-C): Wide time range (last 30 days).*). They come from fixed rules about
the search itself (events read against events kept, no index named, a range over 7 days,
verbose mode, time spent reading raw events, time queued, `transaction`, `join` or a
subsearch), never from the AI.

**Attention marks.** A step that needs a look gets a mark in front of its name and a
short note under its purpose. An amber `!` means caution, a red `!` means something
failed; a pulsing dot means the step is still running. The notes you can see:

- `Failed: …` or `Timed out after …` (red);
- `Refused: …`, when the app refused the step on purpose, for example a search
  containing a command that is not allowed. The note gives the reason, cut short at a
  word (caution, not a failure);
- `Blocked by policy`, which is also what you see when you answered no in the
  write-action confirmation;
- `Partial result: …`, when a step returned only part of its result, for example a
  check that stopped at its time limit;
- `Slow: …`, for a search that took 20 s or more, a model round of 30 s or more, or
  any other step of 15 s or more;
- `ⓘ Cancelled`, for a step you cancelled (information only);
- `0 rows: no access to index …` (caution), when a search found nothing and names an index your
  roles cannot search;
- `ⓘ Model saw … of …`, when a result was cut to fit the model's context; the full result is in
  the step's Output tab;
- `ⓘ No progress for 3 rounds`, when the model asked three times in a row without getting a new
  result or writing an answer.
- `Context nearly full` (caution), when a model round's input reached 80% of the model's context
  window (judged only when the window is known).
- `ⓘ Repeated call`, when the same tool ran with the same arguments earlier in the question;
- `Output flagged for review` (caution), when a tool's output (today: a knowledge entry) was
  flagged by the injection scanner; its text is treated as untrusted.

A model round's details say which model answered and how it was called, its tokens in and out,
when its first text arrived (when it streamed) and an estimated cost, when the model's price is
known.

When several notes apply, the row shows the most serious one followed by `+1`, `+2`
and so on; the full list is in the row's details.

**Stop.** While a question runs, a **Stop** button sits under the header. It ends the
whole question at once: the running model call and any running Splunk searches are
cancelled, and no new step starts. Nothing is undone: an object the assistant already
created stays. The headline then reads *Cancelled after …*, and the question is
recorded as cancelled.

**Cancel search.** A step that is running a Splunk search shows **Cancel search**
under its purpose. It stops that one search and lets the question continue. The
assistant is told that you cancelled the search and how far it got, and is asked to
answer with what it has or to try a narrower search. It does not run the same search
again in this question; ask for it in a new message if you want it.

**After two minutes.** When a search has run for two minutes, its row says
*This search has run for 2 min*, shows its progress (and, when the app could estimate
it, *Expected: about … min in total*), and offers **Keep waiting** next to
**Cancel search**. **Keep waiting** hides the prompt and lets the search go on; it does
not come back for that search. Nothing is ever cancelled for you.

**What a cancelled search means for the answer.** The assistant only has what the
search returned before you cancelled it, and its answer should say that you cancelled
the search. If a draft answer blames a timeout or "the system" instead, the app sends
it back once to be corrected.

**Following the current step.** While the list is open, it scrolls by itself to keep
the running step in view. Scroll up to read something and it stops following; scroll
back to the bottom, or click **Jump to current step**, to follow again.

### Estimates, checks and repeated searches

To keep a run fast, the assistant reads as few events as it can, and the
answer tells you when that shaped the result:

- **"Estimate, sampled 1:N"** — when the matching events can be counted up
  front and there are more than a million, the question is answered from a
  sample. Counts and sums are scaled up from it; averages, distinct counts,
  minimums, maximums and percentiles are the sample's own values. The answer
  says which numbers are estimates. A word that occurs at most 100,000 times
  is never sampled.
- **"Searched only … (where ERROR occurs)"** — for a word that has to be in
  every matching event, the search reads only the hours in which that word
  occurs. The result is exact, not an estimate.
- **"Checked over the last hour, sampled 1:10"** — after the assistant saves
  a report or alert, it says what its check covered. Checks (dashboards too)
  start with the last hour and widen only if they find nothing; the saved
  object always keeps the time range you asked for.
- **"Already run at …"** — the same search over the same long time range
  runs once per request. A different breakdown of events that were already read
  is not read again; the answer points to the earlier search instead.

Ask for the exact count and the assistant runs the search again without
sampling. After a save you can ask it to validate the report, alert or
dashboard over its full time range, exactly as saved; it asks you to confirm
first, because this can take minutes.

### Tips for getting better answers

- **Start small.** Ask the LLM to generate a 10-line SPL preview
  before asking for a full alert + dashboard.
- **Paste the data shape.** If your event schema is unusual, paste a
  redacted sample event in the question. The LLM grounds much faster.
- **Name the goal.** "I want to know when free memory drops more
  than 30 % in 15 minutes" is better than "make me an alert".
- **Use the agents.** The AI Toolkit agents know how to call
  `fit`, `apply`, `ai`, and `listmodels` — they save a lot of
  back-and-forth versus starting from a blank prompt.

### What the LLM can and cannot do

The LLM uses these Splunk tools on your behalf:

| Capability | Tool name | Notes |
|------------|-----------|-------|
| Run a quick SPL probe | `splunk_run_search` | Side-effect commands (`outputlookup`, `sendemail`, `collect`, …) are refused. |
| List indexes / saved searches / lookups / dashboards | `splunk_list_*` | What the LLM can see is what **you** can see. |
| Run a named saved search | `splunk_run_saved_search_by_name` | Name validated against your inventory. |
| Run a saved report | `splunk_run_report_by_name` | Same validation. |
| Fetch dashboard panel data | `splunk_get_dashboard_panel_data` | Doesn't return a screenshot — returns per-panel rows. |
| Create / update SPL / saved search / alert / dashboard / report / lookup / field extraction | `splunk_create_*`, `splunk_update_*` | Requires you to have the right Splunk capability (alert creation needs `power`). |
| AI Toolkit | `splunk_check_ml_capabilities`, `splunk_list_ml_models`, `splunk_ai_command` | Requires Splunk_ML_Toolkit installed and your role to allow `fit`/`apply`/`ai`. |
| **Flag ingestion / onboarding problems** for a sourcetype | `splunk_check_ingest_health` | Reads **Splunk's own internal logs** for you to spot **timestamp-parse failures** (events landing at index time instead of the real event time), out-of-window timestamps, line truncation, and line-breaking warnings: problems a "is my data flowing?" check (like TrackMe) can miss. The assistant runs it before time-based work and reports a plain verdict (`ok` / `warnings` / `errors`). It works even though you normally can't read the internal logs (the app reads them on your behalf). **Available on every tier (incl. Personal/free)** as of v1.7.1; access is bounded only by your Splunk role + the index's own ACL, not a licence tier. A clean result means "no errors logged", which is good but not a 100% guarantee. |
| Read other agents | `splunk_list_use_case_templates`, `splunk_get_use_case_template_prompt` | Used by the router. Only returns agents your Org / BU / role can see. |

The LLM **cannot**:

- Read events in indexes you don't have permission for.
- Run `outputlookup`, `sendemail`, `collect`, `summaryindex`,
  `tscollect`, `script`, `runshellscript`, `delete`, or any other
  side-effect SPL command — the proxy refuses those before they hit
  splunkd.
- Create alerts unless you have the `power` role (or higher).
- See or modify another user's history.
- Talk about anything that isn't Splunk / SPL / AI-Toolkit. The
  **base guardrails** (silently prepended to every
  question) refuse sexual / religious / political / racial / illegal
  / medical / financial-advice content, and refuse to leak the API
  key or system prompts.

### Skills — invisible rules the LLM follows

Each agent you pick (or the router picks for you)
comes with a list of **skills**: pre-written rules like "no emojis
in dashboards", "a proof dashboard shows the artifact working" (applied
only when **Also build a proof dashboard** is on),
"MLTK models must follow the `aiworkbench` naming pattern". The LLM
sees these rules in front of the agent's own workflow, so the
outputs you get are consistent across agents that share the same
rules. You don't pick skills; they're attached to the agent.

If you're an admin you can browse and edit the catalogue from the
new **Skills** tab. End users never see skills directly; they just
benefit from the consistency the skills enforce. The one place a
non-admin user might notice them is when a skill is *dropped*
because it doesn't apply to your environment — e.g. the
`feed-health-verdict` skill is dropped silently when TrackMe is
not installed. You may see a one-line note in the LLM's reply
saying *"feed-health-verdict skill was dropped because TrackMe is
not installed in this environment"* — that's not an error, just an
honest acknowledgement that the LLM didn't run a check it would
normally run.

### Creating your own agents

You can create your own agents without writing any YAML or
schema: describe what you want and the LLM does the rest.

**To create:**

1. Open the Console tab.
2. In the **Agents** card, pick **Create your own agent**.
3. Answer the questions in its form:
   - *What should this agent do (one or two sentences, plain English)?*
   - *What inputs should users provide when running it (one per line, free form)?*
   - *Will it create knowledge objects (saved searches / dashboards / alerts),
     or is it recommend-only?*
   - *(optional) Which existing agent is closest to what you want?* Name
     one if you want the LLM to use it as a structural reference.
   - *(optional) Should its answers be terse rather than explanatory?*
4. Submit. The LLM:
   - Inspects similar agents if you named one.
   - Picks the right cross-cutting skills (no emojis, validation
     loops, naming-collision handling, etc.).
   - Writes a clean agent definition.
   - Saves it as **your own private agent**: only you can see
     it; only you can refine it.
5. The response includes the agent's name. Your new agent then appears
   as a tile in the **Agents** card in the Console; that is where
   you use it from. The card is your view of your own agents; there is no separate tab for
   them.

**To refine later:**

1. In the **Agents** card, pick **Update your own agent**.
2. Name the agent and describe what should change ("shorten the
   intro paragraph", "add the data troubleshooting skill", "remove
   the alert step").
3. The LLM fetches the current state, applies the change, and tells
   you a diff narrative — what was changed, what was kept, what was
   refused.

**What you cannot do (and why the LLM will refuse if you ask):**

- *Make your agent visible to your team / org / everyone*: an
  administrator sets that under **Who can see it** on the agent's
  **Visibility** tab in the **Agents** tab (admin-only).
- *Change the owner to someone else*: your own private agents are
  always yours.
- *Include a skill that doesn't exist or that admins haven't shared
  with you* — skills are admin-curated. If you need a rule that
  isn't a skill, ask your admin to add it.
- *Set `is_default` / `is_general`*: those are reserved for the router
  and the base guardrails.

These refusals come from a defence layer called the
**`prompt-injection-defense-on-authored-content` skill** (which the
LLM follows automatically). Even if you trick the LLM into writing
forbidden values, the server overrides them silently and logs the
attempt for admin review. Your agent is still created, just
with the safe defaults.

**Quota:** 25 private agents per user by default.

> **If you hit the cap, ask your admin.** There is currently **no way for you to
> delete your own agent**: there is no **Agents** tab for non-admins and no
> delete action in the card. An admin can remove one for you, or raise the
> quota for your Org.

### Errors you might see

| Error | What it means | What to do |
|-------|---------------|------------|
| "You aren't authorised to read this LLM config's secret." | The admin granted you a LLM config but you don't match its role / user list. | Ask your admin to add your role to the LLM's `extra_role_patterns`. |
| "Available with a Professional+ license" on a greyed History tab | Your install is on the free Personal tier. | Ask your admin to activate a paid licence. |
| "License 'personal' allows up to 1 Org(s)" | Org/BU writes only happen on admin's Orgs & BUs tab — you shouldn't see this. | Tell your admin if you do. |
| "Refused: dashboard XML contains unsafe markup" | The LLM tried to inject `<script>`, `<iframe>`, or `javascript:` URLs into a dashboard. | The guard worked; ask the LLM to re-generate without those constructs. |
| "Refused: side-effect command" | The LLM proposed an SPL that would mutate state outside the safe-list. | Re-phrase the request more narrowly. |
| "customer_auth hook failed: …" | An LLM you're using sits behind a corporate IAM gateway, and the auth dance failed. | Ask your admin to check the WebEAM / SSO health (see [the customer authorisation hook guide](../admin/security/customer-authorisation-hook.md)). |

## The History tab

Greyed out on the free tier. On Professional or higher:

- A **Your totals (all-time)** card at the top — your own usage, summarised.
- Conversations grouped by thread, newest first, each turn listed under it.
- Click a row to re-ask the same question — the Console tab opens with
  the question pre-filled.
- Each row shows the agent, the LLM/model, token cost, the
  created/updated knowledge objects as clickable links, and
  **Knowledge sources (N)** chips showing what the assistant consulted.

**Finding an old answer.** There is a **Search the question…** box, plus
**Agent: any** and **Model: any** dropdowns and a **Clear filters** button.

**Deleting.** Each turn has its own **Delete**; **Clear all** removes
everything of yours. You cannot see or delete anyone else's.

History is **per user** — admins can't see your history, and you
can't see theirs.

## The Settings tab

You can:

- **See the AI connections available to you.** The bootstrap
  Anthropic config (`DFLT_DFLT_anthropic_central`) is visible to
  everyone unless the admin restricts it.
- **Check whether a connection is actually working.** Every row has a
  **Status** badge. Click it, or the **Recheck** button, to run a connection
  check — it opens the same staged check the admin sees, telling you which
  step fails ("Finding the server", "Signing in", "Asking a first question",
  and so on). Simply *opening* the page never tests anything, so it costs
  nothing; only Recheck reaches out.
- **Choose a colour theme.** The **Theme** card offers one button per preset.
  It is per-you and cosmetic.
- See a notice when a credential is **approaching expiry**, so you can warn
  your admin before it stops working.

**You cannot:**

- **Create or edit any AI connection.** `+ Add LLM`, `Edit` and
  `Open in wizard` are admin-only and are **not shown to you at all**.

  > **Creating an AI connection is an administrator's job.** If you need a
  > different model, or your own API key used, ask your admin.

- Activate or remove the app licence (License tab is hidden).
- Add or remove Orgs / BUs / agents / tool assignments.

## The write-action confirmation

Separate from the security prompt below, and easy to confuse with it.

Before the assistant changes **anything outside the chat**, it stops and asks
you — every time, in a blocking dialog:

> Adjutant AI wants to run a WRITE action that changes data outside this chat:
>
> &nbsp;&nbsp;Tool: `<name>`
>
> Arguments:
> `<the exact arguments, as JSON>`
>
> Allow this change? Cancel refuses it — the assistant will continue without
> performing it.

**What triggers it:** closing or annotating a notable, setting a disposition,
updating an ITSI episode, a TrackMe acknowledge / priority / maintenance change,
any ServiceNow write, and **overwriting an existing** dashboard, saved search or
alert.

**Why it is a clunky native dialog and not a pretty one.** That is deliberate. A
native confirm is a real blocking gate that the page cannot click for you, so an
assistant that has been talked into something by malicious text inside your data
still cannot change Splunk, ES, ITSI or ServiceNow without you personally
approving it. Read the **Arguments** block before clicking OK — it is the actual
change, not a summary of it.

**Cancel is safe.** It refuses that one action and the assistant carries on
without it; it does not abandon your whole question.

> Creating something *new* does not trigger this. Overwriting something that
> already exists does.

## The security confirmation prompt

If the LLM you're about to use connects to a service outside your
organisation (Anthropic, OpenAI, Azure OpenAI, Groq, Gemini, Bedrock,
OpenRouter — basically every cloud provider), the app shows a
full-screen confirmation modal before the first run and every time
you switch to that LLM. It lists exactly what data the LLM may see —
your question text, the SPL it runs, the events / lookups it samples,
the dashboard or alert XML it builds — and asks you to confirm:

1. Your request contains no production credentials, API tokens,
   customer PII, or restricted-classification data.
2. Sensitive field values are masked (user IDs, IP addresses, emails,
   account numbers replaced with placeholders).
3. Your organisation's policy allows sending data of this
   classification to this provider.
4. The network path the request will take is acceptable.

Two buttons:

- **I understand — send this question** (when you triggered it by clicking
  **Run**) or **I understand — use this LLM** (when you triggered it by
  choosing the connection) — acknowledge and proceed. `Esc` cancels.
  The app remembers your acknowledgement for the current session, so
  subsequent Asks (and replies) with the same LLM don't re-prompt.
- **Cancel** — close the modal. Your request text stays in the
  textbox so you can review and mask before retrying.

**Reset triggers**:
- A full page reload (closing the tab + reopening, or Cmd+R) clears
  the acknowledgement and re-prompts.
- The **Clear** button in the Console does **not** reset the
  acknowledgement.
- Switching to a different LLM re-prompts (different LLM = different
  external connection).

If you're using a trusted-network LLM (e.g. an on-prem Ollama your
admin set up), the modal won't appear — your admin has turned the
"Show security confirmation before sending" checkbox off in that
LLM's configuration.

## Custom tools and MCP servers your admin may have added

The LLM has **196** built-in tools that cover Splunk itself: running
searches, listing indexes, building dashboards, ES / ITSI / TrackMe
operations, MLTK, etc. Starting with version 0.4.0, your admin can
also add **custom HTTP tools** that reach into other systems your
organisation runs: ServiceNow tickets, your CMDB, an internal
threat-intel feed, the company wiki — whatever the admin wires up.

Since version 0.7.0, admins can also register **MCP servers** (Model
Context Protocol — an emerging open standard for exposing tool
catalogues to AI assistants). One registered MCP server can bring in
many tools at once without the admin hand-authoring each. From your
perspective the tools look identical regardless of where they come
from.

You don't have to do anything to use them. If a tool is in scope for
your Org / BU and relevant to your question, the LLM picks it up
automatically and you'll see it appear in the **Tool calls** panel
during the response — exactly like the built-in tools.

A few things to know:

- The tools you can use are decided by your admin. If you think the
  LLM should be able to fetch a piece of information that it can't,
  ask the admin to consider adding a custom tool or wiring up an MCP
  server. There may also be a tag/category filter on your agent
  that scopes which tools the LLM sees — narrowing that helps the
  model focus on the right ones.
- Anything a tool returns becomes part of what the LLM sees, just
  like search results from `splunk_run_search`. If your LLM uses an
  external provider with the security-confirmation prompt on, that
  acknowledgement covers the whole conversation including any tool
  responses.
- Admins set per-tool guardrails (rate limits, response-size caps,
  caching, field redaction). If you see a "Rate limit exceeded"
  status in the Tool calls panel, the LLM tried to call the same
  custom tool too many times in a minute — give it a moment and
  re-ask, or ask the admin to raise the limit if it's too tight.
- Some tools use a credential stored per Org, per BU or per user. If
  your Org or BU has none stored for a tool, that tool is not offered
  to the LLM at all. If a tool reports *"No per-user credential is
  stored for …"*, nothing is stored for your account yet. In both cases
  ask your Splunk administrator to store one, as the message says: there
  is no screen where you add a tool credential yourself.

## AI Toolkit models you create via this app

When you use one of the AI Toolkit agents (Smart outlier detection,
Smart forecasting, Smart clustering, Smart prediction, Multi-field
anomaly detection), the assistant trains a model in the app you're
currently in (e.g. `search`) and then **promotes it to globally shared**
so the model and its proof dashboard (on by default for these agents)
work from any app, including the AI Toolkit's own Models tab.

Two things to know:

- **Naming convention.** Every model the assistant trains is named
  `mltk_<algorithm>_<thing>_aiworkbench_v<N>` — the `aiworkbench` token tells
  you (and your admin) at a glance that the model came from this app.
  Look for it in **AI Toolkit → Models** alongside any models built
  manually.
- **No admin role required.** Splunk's stock `user` and `power` roles
  cannot share a knowledge object globally on their own; that
  normally needs `admin_all_objects`. The assistant works around this
  via a scope-limited server-side handler that promotes ONLY models
  matching the `aiworkbench` naming pattern. You don't have to ask your
  admin for extra capabilities.

If the dashboard ever shows "Failed to load model — Model does not
exist", the share step didn't run. Run the agent again, or ask your
admin to check `splunkd.log` for `itmip_llm_audit action=mltk_share`
entries.

## CDTSM — forecasting & anomaly detection without training

If your Splunk has **AI Toolkit 5.7.3 or newer**, three extra agents
appear in the agent picker in the Console. They use **CDTSM** (the Cisco Deep Time Series
Model) — a model that is *already trained*, so unlike the AI-Toolkit
agents above there is **no training step, no model to manage, and
nothing to share**. You point it at a metric and it forecasts (or finds
anomalies in) it.

**Which one to pick:**

- **AI Toolkit – CDTSM Smart Forecasting** — "where is this metric
  heading?" Gives a forecast with a shaded "expected range" band.
- **AI Toolkit – CDTSM Anomaly Detection** — "is this metric behaving
  strangely right now?" Flags the surprising points.
- **AI Toolkit – CDTSM Predictive Alerting** — "warn me *before* this
  crosses a limit." Creates a scheduled alert (needs the `power` or
  `admin` role).

**You don't need to know any machine learning.** The questions are in
plain language: every setting has a recommended default and an "if
unsure" hint, you give the forecast horizon in plain time ("next 12
hours"), and anything genuinely technical (such as the anomaly-detection
method) is chosen for you and explained. Leave a question on its default
and the assistant picks a sensible value.

**How to trust the result.** Each dashboard includes a built-in proof:

- For a **forecast**, an **Accuracy Backtest** — the model predicts a
  recent window it was *not* shown, and the dashboard overlays its
  prediction (orange) on what actually happened (blue). Two plain numbers
  tell you how good it was: **Band coverage** ("how often the real value
  landed inside the expected range" — close to your chosen band % is
  healthy) and **Accuracy** ("how close it was on average").
- For **anomaly detection**, a **Band coverage on normal points** number
  (should be high — the model's idea of "normal" fits ordinary
  behaviour), plus the anomaly rate and a table of what was flagged.

**Needs AI Toolkit.** If you do not see these agents, AI Toolkit is
not installed (or is older than 5.7.3) — ask your admin. On a self-hosted
Splunk your admin also has to set up a small Cisco model server; if a
forecast fails with a connection or authentication error, that is what to
check (see your admin, or [the CDTSM forecasting guide](../admin/integrations/cdtsm-forecasting.md)).

## ATT&CK Tactic Hunt — technique coverage dashboard

If your Splunk has **Splunk Security Essentials (SSE)** installed, an extra
agent, **ATT&CK Tactic Hunt — Technique Coverage Dashboard**, appears
in the agent picker in the Console. Pick a MITRE ATT&CK tactic and it builds a dashboard that
shows, per technique in that tactic, whether you currently have detection
coverage and evidence in your data. The coverage is grounded in SSE's **real
detections**, not the LLM's guesses, so what you see reflects what your
environment can actually catch.

**It will not lie to you with a green zero.** A technique with no hits in the
time window you chose is shown as a neutral "no evidence" tile, never a
reassuring green "0" that could be mistaken for "all clear". That keeps you
from trusting coverage you don't really have.

**Needs Splunk Security Essentials.** If you do not see this agent, SSE is
not installed or not visible to you — ask your admin.

## ServiceNow — ask about (and raise) tickets

If your admin has connected your Org to ServiceNow, Adjutant AI can **read and
write ServiceNow** for you — incidents, problems, changes, and the **CMDB**
(your configuration-item / service catalogue) — straight from the Console, in
plain English. You never touch a ServiceNow credential; the assistant reaches
ServiceNow through the Splunk backend on your behalf.

**What you can ask for:**

- **Look up tickets.** "Show me open ServiceNow incidents for the payments
  Business Service", "what changes are scheduled for `web-prod-01` this week?",
  "list the problems assigned to the Network support group". Results come back
  human-readable (states shown as "In Progress", not raw codes).
- **Explore the CMDB / service map.** Work in the names you already use —
  "Business Application", "Server", "Business Service". Ask the relationship
  questions that matter: "which Business Service is `host-x` part of?", "what
  does this CI depend on?", "what's the blast radius if this CI fails?". Big
  graphs come back trimmed (with a note) rather than hanging.
- **Create or update an incident.** "Raise a ServiceNow incident for this disk
  alert on `web-prod-01`", "update incident INC0012345 with the latest event
  count". The assistant fills the incident with a clean, consistently-formatted
  description — no garbled HTML or emoji.

**Example prompts:**

- "Open ServiceNow incidents for the `Email Gateway` Business Service in the
  last 24 hours."
- "Which Business Service does `app-srv-204` belong to, and what depends on it?"
- "Create a ServiceNow incident for this Splunk alert and link the affected CI."

**Good to know:**

- **It can never hang your session.** If ServiceNow is slow or down, the
  assistant says so and carries on — it won't freeze the run.
- **It won't invent ServiceNow fields.** The assistant works from a known
  table/field map, so it asks ServiceNow only for things that actually exist on
  your instance instead of guessing.
- **Writes are tightly controlled.** Your admin allowlists exactly which records
  the assistant may write; anything outside that is refused before any call.

**Security incidents (SIR).** If your SOC runs ServiceNow *Security Operations*
and your admin has turned it on, the same flow works for **security incidents**
(with MITRE ATT&CK association). This is opt-in and admin-enabled — if you don't
see it, it isn't switched on for your Org.

**Licensing.** ServiceNow needs a **Professional** edition **and** the
`servicenow` feature on your license. On a tier without it, the ServiceNow
agents and tools appear **greyed out with a padlock**; ask your admin
about enabling the feature. If your Org simply has no ServiceNow connection
configured, the ServiceNow tools won't appear at all (your admin sets the
connection up — see [the ServiceNow guide](../admin/integrations/servicenow.md)).

## Data Foundation — onboard a new data source

The data-onboarding agents ("Data Source Onboarding (full)") do more than
advise. Attach a raw **sample log from your computer** (see the Console's
*Attach references* above) and ask the assistant to onboard it: it analyses the
sample, drafts the `props.conf` / `transforms.conf` and friends, and produces a
**deployment-ready config package** — a downloadable `.tar.gz` laid out as the
standard four Splunk apps (forwarder inputs, indexer parsing, search-head
parsing, deployment server). A **Download** button appears in the reply, along
with a per-app "what deploys where" summary and verification SPL. The assistant
**does not install anything** — it hands you a package your admin pushes from
their deployment server.

Before handing it over, the assistant **validates the drafted config against
your Splunk's own `.conf` spec** (catching hallucinated or mis-cased attribute
names that would silently break a stanza) and gives you a **Data Quality Score
(0–100 + an A–F letter grade)** across six dimensions (Magic-8 review, props /
transforms validity, line breaking, timestamp parsing, CIM alignment), iterating
if the score is low. It can also **flag onboarding problems on data already in
Splunk** — timestamp-parse failures, line truncation, and similar — by reading
Splunk's own internal logs for you (a feed can look healthy yet still be parsed
wrong). These onboarding features are **Professional+**.

## Unattended runs

Beyond the Console, an agent you author can also run with nobody
at the keyboard: unattended runs (called the Backend Ask Service in earlier
documents). You (or an operator) author an **agent** describing an
investigation; an **admin** then attaches it to a native Splunk alert, an ES
correlation search (notable), or an ITSI episode. When the trigger fires, the
agent runner runs the investigation server-side with no human in the loop: it
gathers evidence, reaches a verdict, and writes a result back to the
notable / episode (or an index report) and optionally emails a report.

The agent runner ships **disabled by default** and is set up and operated by admins
(it's bounded, allowlisted, and fully governed). As an end user the main thing
to know is that the agents you write are what run this way. For the full
picture see the unattended runs guide.

### Unattended: on a timer rather than a trigger

Admins can also put an agent **on a schedule**, from the admin-only
**Unattended** tab, which is also where every integration is listed and
managed. Two kinds:

- **Scheduled Job**: run an agent and deliver a result, on a schedule.
- **Scheduled Integration** — read a source and write to a target, repeatedly,
  keeping track of what it has already processed so it does not do the same work
  twice.

You will not see the tab, and you do not need to. What matters to you is that
**an agent you wrote may be picked up and scheduled**, and that results you did
not personally ask for may originate this way. See
the unattended runs and memory guide and
the AI Driven Integration guide if you are curious.

## The Help tab

Always available, and it keeps working even when the rest of the app is greyed
out.

**About** shows Product, **Version**, **License** (your active tier, with its
badge), Splunk version, Website and Support. **This is where you check your
licence tier** — the License tab is admin-only.

### 🐞 Report an issue / share diagnostics

The button is on the Help tab, and also on the reply card of any run that went
wrong (**🐞 Report issue**) — use that one, because it attaches the conversation
that failed.

You then choose how to send it:

| Button | What it does |
|---|---|
| **⬇ Download (.zip)** | Saves the package locally so you (or your admin) can inspect it before anything leaves. |
| **📨 Send via support form** | Submits it directly. |
| **✉ Email instead** | Opens an email to support with the package attached. |
| **⇪ Upload to support** | Uploads it. |
| **Close** | Cancels. |

The package is **encrypted** for the support recipient. If you are at all unsure
what is in it, choose **⬇ Download (.zip)** first — and see
the support-bundle guide, which lists exactly what is collected and
what is redacted.

**What the package contains:** your question, the AI's answer, and every step of the conversation
with its timings, counts, the search or arguments it ran (with secrets redacted), the Splunk job
facts and all its IDs. **What it never contains:** what a tool returned: no search results, no
records, nothing from a step's Output tab.

## Privacy, security, and what's logged

- The contents of your questions and answers are sent to the
  configured LLM provider. Read the supported-LLM matrix
  for the per-provider data-handling matrix.
- Per-question telemetry (tokens in/out, cost, model, provider) is
  written into Splunk's event index for the central-key LLM. Personal
  LLM keys produce no telemetry.
- The **Tokens & Costs** tab is admin-only; admins can see your
  aggregate cost but not the question text.
- Your Splunk session key is never sent to the LLM. The LLM only
  sees what the tools it called returned to it.
- **Audit logging (v1.3.0).** Your organisation may enable an
  audit trail. When it is on, each time you send a request to an external
  LLM the system records — to a secured, admin/auditor-only index — **who
  you are, which agent you used, your answers (or full prompt), the
  names of any objects you attached, which LLM and model, and the time**,
  together with the fact and time that you **accepted the security
  confirmation**. Depending on a per-organisation setting, the stored copy
  of your input may be the full text, the first 200 characters, just a
  fingerprint (hash), or only metadata. This exists so that sending
  business- or personal-sensitive data to a public LLM is traceable to the
  person who chose to send it. **Treat the confirmation seriously: only
  send data you are authorised to send outside your Splunk environment.**
  See [the auditing guide](../admin/security/auditing.md).

## Glossary

- **Org** — Organisation. First level of multi-tenancy; matches one
  or more Splunk apps and roles.
- **BU** — Business Unit. Second level inside an Org.
- **Agent**: a pre-tuned prompt the app prepends to your
  question, run with every action gated and logged. Agents have a `short_description` and may require
  specific apps (e.g. Splunk_ML_Toolkit) or roles (e.g. `power` for
  alert creation). An **agent template** is an agent that ships with the app.
- **Base guardrails**: the hidden safety prompt added to every
  conversation. Defines what the app will and won't help with.
- **Router**: a special agent that runs when you don't
  pick a specific one. It looks at your question, lists every
  agent you have access to, picks the most relevant one, and runs
  it for you.

## Getting help

- Admin / install / licence questions: ask your Splunk admin or
  point them at [the admin manual](../admin/admin-manual.md).
- Something's broken in the UI (blank dashboard, "no LLM
  configured", a tool the LLM says it can't find): your admin
  can walk through the troubleshooting guide.
- Provider-specific notes: the supported-LLM matrix.
