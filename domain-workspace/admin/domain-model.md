---
sidebar_position: 2
---

# The Domain Model — an administrator's guide

What a Domain Model is, where it lives, how to create one, how to change one
safely, and how to keep it honest over time.

Read the [Administrator Manual](./admin-manual.md) first if you have not
installed the workspace yet. This document assumes it is running.

---

## Contents

1. [What a Domain Model is](#1-what-a-domain-model-is)
2. [Where it lives](#2-where-it-lives)
3. [What is inside it](#3-what-is-inside-it)
4. [Two layers: vendor and customer](#4-two-layers-vendor-and-customer)
5. [Creating one](#5-creating-one)
6. [Publishing and versioning](#6-publishing-and-versioning)
7. [Changing one safely](#7-changing-one-safely)
8. [What the publish gates refuse](#8-what-the-publish-gates-refuse)
9. [Maintaining it](#9-maintaining-it)
10. [Retiring one](#10-retiring-one)
11. [Worked example: adding a panel](#11-worked-example-adding-a-panel)
12. [Reference: section by section](#12-reference-section-by-section)

---

## 1. What a Domain Model is

A Domain Model is **one versioned JSON document describing a business domain**
— its data, its questions, its answers and how they are shown to whom.

It is not a dashboard, and it is not a data catalogue. A catalogue records what
the data *means*. A Domain Model adds four more things: **what to ask, how to
prove it, how to show it, and how to work it.** Those four are what turn a
description of data into a working surface.

The rule that governs everything below:

> **The document is the source of truth. Everything in Splunk is materialized
> from it.**

The saved searches the workspace runs are generated from the model. If you edit
one by hand in Splunk, that is **drift** — the workspace detects it by hash,
reports it, and leaves your edit in place until you decide. It never silently
overwrites you, and it never silently accepts a divergence either.

One model can serve many audiences. A perspective is a view of the same model
for one audience — the analyst, the fraud desk, compliance, the executive. They
are not four dashboards that disagree; they are one model at four altitudes.

---

## 2. Where it lives

A Domain Model lives in **three places at once**, and knowing which is which
prevents most confusion.

| Where | What it is | When it changes |
| - | - | - |
| **The seed document** — a JSON file in a content app, at `default/data/models/<model>.json` | The authored source of truth, shipped with the app. | When you edit and redeploy the app. |
| **KVStore** — one row per part of the model, plus a header row | The live copy the workspace reads. Imported from the seed. | On import, and when an overlay is saved. |
| **Splunk objects** — saved searches named `ds_<model>__<item>`, plus scheduled triggers | The runtime objects that actually execute. | On materialize. |

Stored **one row per part**, never one blob. That is what lets a customer change
one panel without marking the whole model as modified, and lets a vendor update
one search without discarding that change.

**Registration.** A content app declares its model in
`default/domain_models.conf`:

```ini
[cycle_finance]
seed = default/data/models/cycle_finance.json
content_version = 3.10.0
collection = cycle_finance
collection_cust = cycle_finance_cust
publisher = Your Organisation
views = workspace
```

The workspace discovers models by reading this configuration across all
installed apps. **Drop in an app, get a model** — no registration step.

---

## 3. What is inside it

| Section | Declares |
| - | - |
| `model` | Identity, version, publisher, supported Splunk versions, verification record, lifecycle. |
| `sources` | The feeds the domain stands on, each with a description and how to select it. |
| `entities` | The business objects — a customer, an order, an account — each with a key field, a canonical form and a pattern. |
| `relations` | How entities join, each with an execution contract: method, cardinality, fan-out limit, temporal rule, and the match rate below which the relation must be distrusted. |
| `searches` | SPL templates with **typed parameter slots**. `base` searches feed others; `ready` searches answer questions. |
| `tokens` | The typed filter variables panels listen to and emit. |
| `question_bank` | Questions in the words people use, each bound to a search — and, for the important ones, a known-correct answer with a tolerance. |
| `knowledge` | Governed facts the workspace can state without running a search. |
| `perspectives` | Which audience sees which tabs, and which roles open or may switch into each. |
| `tabs` | Groupings of panels. |
| `panels` | What is drawn, from which search, at what size. |
| `attention_rules` | What earns a place on the Cockpit, and when. |
| `report_definitions` | Recurring questions that become worked case queues. |
| `policy` | Limits, which Splunk-native panel controls are offered, governed jump links. |
| `brand` | Theme tokens — colours and fonts, validated for contrast and colour-vision safety. |
| `home` | Purpose, audiences, owners, what the model **can** answer and what it **cannot**. |
| `documentation` | Chapters shown in the help surface. |
| `coverage`, `data_quality` | What the domain claims to cover; which fields are critical enough to measure. |

Section 12 has a field-level reference.

---

## 4. Two layers: vendor and customer

Every part of a model belongs to one of two layers.

- **Vendor** — what the model's publisher shipped. **Never modified in place.**
- **Customer** — your changes, stored separately as *overlays*.

When the workspace reads the model it serves the customer version of anything
you have overlaid, and the vendor version of everything else. Delete an overlay
and the vendor original returns, untouched.

This is what makes upgrades survivable. A publisher shipping a new version
updates the vendor layer; your overlays are preserved and reported, never
overwritten.

**What you can overlay today:** `panel`, `knowledge`, `tab` and `perspective`.

**What you cannot:** searches and their SPL. Changing a search means changing
the source document (§7). That boundary is deliberate — the assurances a panel
displays are only meaningful if the search behind it came through the governed
path. Bringing searches into the overlay layer safely, with the
who-can-execute checks that requires, is designed and not yet available.

---

## 5. Creating one

> **How authoring works today.** A Domain Model is authored as a JSON
> document, starting from a worked example, with a strong validator that
> refuses a malformed model and names the reason. Two things are designed and
> on the way, and are worth knowing about before you commit to an approach:
> a **guided visual editor** that walks the build order with a health check at
> each step, and **discovery tooling** that drafts a first model from apps and
> dashboards you already have, for review rather than for blind acceptance.
> Neither ships yet. Plan your first model as a hand-authored one; expect the
> second to be easier.

### Start from the example

The bundled demo model is a complete, working, realistic model. Copy it and
replace its content:

```
demo_app/itmip_adjutantai_domainworkspace_demo/default/data/models/cycle_finance.json
```

### Build it in this order

Each step depends on the one before, and the validator will tell you when you
have skipped one.

1. **`model`** — id, version, publisher, supported Splunk versions.
2. **`sources`** — what the domain reads. Nothing else can reference a source that is not declared.
3. **`entities`** and **`relations`** — the business objects and how they join.
4. **`searches`** — the SPL, with parameters as typed slots. **Never concatenate a value into SPL**; declare a slot and let the compiler place it.
5. **`tokens`** — the filters panels share.
6. **`panels`**, **`tabs`**, **`perspectives`** — what is shown, grouped, to whom.
7. **`question_bank`** — the questions people will actually type, with their phrasings.
8. **`home`** — purpose, audiences, owners, capabilities **and limitations**. The model will not publish as operational without these.
9. **`policy`**, **`brand`**, **`documentation`** — limits, look, help.

### Package it as a content app

A minimal content app is:

```
<your_app>/
  default/
    app.conf                        version must equal the model's content_version
    domain_models.conf              the registry entry
    data/models/<model>.json        the model
    data/ui/views/workspace.xml     the view that loads the workspace
  metadata/default.meta
```

### Then

Install the app, open the workspace, and run the self-test (see the
Administrator Manual). Import happens automatically on first open. Materialize
from the Inspector.

---

## 6. Publishing and versioning

### Three versions must agree

| Place | Field |
| - | - |
| the model document | `model.content_version` |
| `domain_models.conf` | `content_version` |
| the content app's `app.conf` | `version` |

**The registry's `content_version` is the authority for re-import.** A model
whose content changed but whose version did not is **not re-imported** —
version-equal imports are never repeated. This is the single most common cause
of "I changed the model and nothing happened".

### Version numbering

`major.minor.patch`.

| Change | Bump |
| - | - |
| Wording, a label, a colour, a threshold | patch |
| A new panel, question, tab or report | minor |
| A removed or renamed item, a changed search meaning | major |

Anything that could make an existing saved session or a bookmarked answer refer
to something that no longer exists is a major change.

### The publish sequence

1. Edit the source document.
2. Bump all three versions.
3. Redeploy the content app.
4. Open the workspace — import happens on first open.
5. **Materialize** from the Inspector.
6. **Health refresh** from the Inspector, so verdicts and coverage reflect the change.
7. Run the self-test.

---

## 7. Changing one safely

### For presentation changes — use an overlay

Renaming a panel, changing a description, reordering a tab, adjusting who sees
a perspective, correcting a governed fact:

1. Open the **Domain administration** perspective → **Inspector**.
2. Find the item. Items show their layer, so you can see what is vendor and what is already overlaid.
3. Edit the JSON and **Save**. It is written as a customer overlay; the vendor row is untouched.
4. **Revert** deletes the overlay and restores the vendor version.

Requires Splunk admin. Every save is audited.

The Inspector's editor is a JSON form today. The guided editor described in §5
replaces that form with a field-by-field surface over the same governed write
path — the overlay mechanics, the audit trail and the vendor-never-mutated rule
below do not change, only how you type.

### For anything structural — change the source document

New searches, changed SPL, new entities or relations, new report definitions.
Follow the publish sequence in §6.

### Test it before your users see it

The safest path is a non-production instance with the same model. Failing that,
a new perspective restricted to a role only you hold lets you exercise a change
on the real estate without exposing it.

**Always run the self-test after a model change.** It will tell you if
materialization stopped converging, if a search no longer returns its declared
shape, or if a question no longer matches its known answer.

---

## 8. What the publish gates refuse

A model that would render something untrue **does not publish**. Each refusal
names the item and the reason. This is the list worth knowing before you author,
because each one is a rule about honesty rather than syntax.

| Refusal | Meaning |
| - | - |
| `format_version … is outside this engine's window` | The document format is newer or older than this build supports. |
| `model.id … is not a valid identifier` | Ids are lowercase letters, digits and underscores. They are technical identifiers and are never translated. |
| `invalid sub-item id` / `duplicate sub-item id` | Every part needs a unique, valid id. |
| `… references missing …` | A dangling reference — a panel naming a search that does not exist, a tab naming a missing panel, a perspective naming a missing tab, a quicklink pointing nowhere. **A model that references a missing part renders lies**, so it is refused rather than rendered with a hole. |
| `declares unknown sentinel` | A data-quality sentinel that is not one of the known kinds. |
| a sentinel on a search whose final stage aggregates | The sentinel measures raw shape; after an aggregation there is no raw left to measure. Declaring one there would be a silent no-op, so it is refused. |
| `declares marker … with no window` / `marker names knowledge …` | Chart annotations must come from governed knowledge with a time window. An ungoverned marker is decoration presented as fact. |
| **LEG-601** size declaration fits no container class | A panel that cannot be drawn at any screen width. |
| **LEG-602** too many panels on one tab | More panels than a tab can carry legibly. |
| **LEG-604** compact variant missing | A panel that needs a compact form at narrow widths and does not declare one. |
| **LEG-801** operational without required Home fields | A model claiming to be `operational` while missing purpose, audiences, owners, capabilities, limitations or suggested questions. Home is where a user learns what the model **cannot** do; a model making its strongest claim without its most important disclosure is refused. Publish it as a draft instead. |
| theme gate failures | Colours failing contrast, or indistinguishable to a colour-blind reader. |

A model may be published as a **draft** with as much missing as you like. The
gates apply to the claim of being operational.

---

## 9. Maintaining it

A Domain Model is not finished when it publishes. Three things keep it honest.

### The health run

Re-measures what the model stands on: which sources exist, what each panel's
dependencies resolve to, data quality, field presence. Run it from the
Inspector, or enable its scheduled trigger.

Its results appear on the **About** tab, which every user can read. Coverage,
freshness, how many questions are proven, what is degraded and why.

### Watch the red list

The About tab lists everything currently not available, each with its cause.
That list is your maintenance backlog, and it is visible to your users — which
is the point. Two kinds of entry:

- **Blocked, feed not onboarded** — a data request. The message carries the route.
- **Degraded** — a measured data-quality problem, with the share affected and a remedy ordered by what your deployment can actually do.

### Keep the question bank honest

The bank is what lets a panel claim its answer means something. A question with
a known-correct answer and a tolerance is re-checked; one without can never
claim semantic validity, and the workspace will say so rather than imply
otherwise.

When users ask something outside the bank, the workspace tells them and shows
what it can answer. **Those refusals are your roadmap** — a question asked
repeatedly is a question worth adding.

### Watch for drift

Someone will eventually edit a generated saved search by hand. The Inspector
shows it as *drifted*. Decide deliberately: **Repair drift** to restore what
the model declares, or move the change into the model so it survives.

---

## 10. Retiring one

Uninstalling the content app removes the model's registration. Before you do:

- **Materialized objects** — the `ds_*` searches and scheduled triggers remain until removed. Retire them deliberately so nothing references a model that is gone.
- **User work is not part of the model.** Sessions, evidence snapshots and report work items live in their own storage and are not deleted with it. That is intentional: an audit trail that vanishes when an app is uninstalled is not an audit trail.
- **Evidence outlives everything.** Frozen snapshots stay in the evidence index under your retention policy, and remain verifiable.

To replace a model rather than remove it, publish a new major version and let
the version-authority rule re-import it.

---

## 11. Worked example: adding a panel

Adding a panel that shows failed payments by provider.

**1. Make sure the source is declared** in `sources`. If the data is not
declared, nothing may reference it.

**2. Add a ready search**, with the variable parts as typed slots — never
concatenated:

```json
{
  "id": "failed_payments_by_provider",
  "spl": "index=payments status=failed $window$ | stats count by provider | sort -count",
  "slots": [
    { "name": "window", "type": "timerange", "from_token": "tok_time" }
  ],
  "output_contract": { "fields": ["provider", "count"], "min_rows": 0 },
  "viz_pref": "bar"
}
```

The `output_contract` is what lets the panel check that a result had the shape
it was supposed to have.

**3. Add the panel:**

```json
{
  "id": "pnl_failed_payments",
  "ready_search": "failed_payments_by_provider",
  "size": { "class": "half", "h": 2 },
  "name_i18n": { "key": "panel.failed_payments.name",
                 "values": { "en-GB": { "text": "Failed payments by provider" } } }
}
```

**4. Put it on a tab** — add its id to that tab's `panels` list.

**5. Optionally add a question** so people can ask for it in words:

```json
{
  "id": "q_failed_payments",
  "phrasings": ["which providers are failing", "show failed payments by provider"],
  "search": "failed_payments_by_provider",
  "plan": { "placement": "tab_payments" }
}
```

**6. Bump all three versions, redeploy, import, materialize, health refresh,
self-test.**

The new panel now carries freshness stamps, honest states, Explain, the four
assurances and Snapshot — without any of that being written for it. That is
what the model buys you.

---

## 12. Reference: section by section

### `model`

| Field | Notes |
| - | - |
| `id` | Lowercase identifier. Never translated. Appears in every generated object name. |
| `content_version` | `major.minor.patch`. Must match the registry and the app version. |
| `publisher` | Shown on the About tab. |
| `lifecycle` | `draft` or `operational`. Operational is gated — see §8. |
| `supported_product_bands` | Which Splunk versions this model supports. |
| `verification` | The fixture and known-answer set this model was proven against. |

### `sources`

One entry per feed, with a plain-language description and how to select it.
Everything else references these by id. A source declared and absent from the
estate yields an honest blocked panel naming it — which is better than an empty
chart, and is why declaring them all matters.

### `entities` and `relations`

Entities carry a key field, a canonical form and a pattern. **The pattern is
load-bearing**: it is what allows a value clicked in a panel to become a filter,
and what refuses a value that is not really one of these.

Relations carry an execution contract, including `min_match_rate` — the rate
below which the relation must be distrusted. Be honest here. A relation that
matches 5% of the time because only some transactions are traced should say so.

### `searches`

`base` searches feed others; `ready` searches answer questions.

**Slots are the security boundary.** Every variable part is a typed slot with a
declared domain. Free text has no slot type, so it structurally cannot reach a
search. Never build a search string by concatenation.

`output_contract` declares the columns and minimum rows a result should have.
It is checked on every run.

### `tokens`

Typed filter variables. Declare `sensitive: true` on anything that should never
appear in a shareable link — it will be refused from a URL and masked in the
filter chip.

### `question_bank`

Each entry: the phrasings people use, the search that answers it, and where the
answer should land. Add a known-correct answer for the questions that matter —
that is what allows the semantic assurance to pass.

### `perspectives`, `tabs`, `panels`

Perspectives declare `entry_roles` (opens here) and `switchable_roles` (may
switch here). **The roles are yours to create in Splunk**; the model only names
them.

Remember that perspectives decide presentation only. A perspective can never
reveal what a viewer's Splunk permissions forbid.

### `attention_rules`

What earns a Cockpit card. Each rule names the signal, the threshold and the
panel that proves it. **A rule whose proof panel is not in a perspective is
counted there, not shown** — a finding without proof does not render.

### `report_definitions`

A recurring question as a worked queue: which questions, which schedule, which
audience, and what makes two findings the same finding across runs. That last
one — the row identity — is what separates a case queue from a spreadsheet that
resets every morning. Choose the fields that genuinely identify a case.

### `home`

Purpose, audiences, owner contacts, capabilities, **limitations**, missing feeds
with their effect, suggested questions.

Write the limitations properly. They are shown to every user, and a workspace
that states on its front page what it cannot answer is making a different
promise from one that shows an empty chart.

### `policy`

Row limits, which Splunk-native panel controls are offered, governed jump links.

### `brand`

Theme tokens, validated at publish for contrast and colour-vision safety. A
palette that fails is refused with the offending pair named.
