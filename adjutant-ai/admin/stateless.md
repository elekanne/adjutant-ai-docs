---
sidebar_position: 4
---

# Stateless operation

**What this page is.** The single page for stateless mode: what it is, what it buys you, what it
costs you, how to configure it, how to verify it, and where Adjutant tells you it is working.
This is the operator's view.

**Read it in this order.** §1–§3 is what you are deciding. §4 is the Splunk side. §5–§12 is the
bucket, which is the longest part because it is the part with the traps. §13–§15 is how you prove
it works.

---

## 1. What stateless operation is

An instance that is **rebuilt rather than maintained**. The image is redeployed — nightly, on every
change, or whenever the platform team feels like it — and nothing on its disk survives. Adjutant
has to be the same environment afterwards: the same integrations, resuming from the same positions,
without a person logging in to put it back.

That works by moving the system of record OFF the instance:

| | Without stateless mode | With it |
|---|---|---|
| Where durable state lives | KV Store, on the instance | The object store; KV Store is a cache |
| What a rebuild costs | Every watermark, every memory row | Nothing that was committed |
| Who may write | Whoever is running | One instance, holding a lease |
| An empty watermark means | "First run — read everything" | A refusal, unless someone authorised it |

The last row is the one that changes behaviour most. An integration that loses its watermark and
treats that as a first run either re-reads a window — visible, expensive — or **skips** one, which
is silent and much worse. Stateless mode refuses instead, and names the key it wanted.

---

## 2. What you get, and what you must accept

**What you get**

- **Watermarks survive the roll.** A scheduled integration resumes where it stopped.
- **A wiped instance restores itself** and checks its work: every restored collection is re-hashed
  against the backup manifest before the instance is allowed to run anything.
- **One writer at a time.** During the overlap when an outgoing and an incoming instance are both
  alive, the lease means only one of them can write.
- **Refusals instead of silent divergence.** A failed restore refuses scheduled work rather than
  running on partial state; a run blocked on a person is a different terminal state from a run that
  failed; a write that cannot reach the object store fails the caller instead of landing locally.

**What you must accept**

- **The object store is required, and there is no local fallback.** If it is unreachable the
  environment degrades to interactive use. That is deliberate: a local fallback is exactly the
  divergence this mode exists to prevent.
- **KV Store is required** and must be enabled on the instance (Adjutant announces it if not).
- **Secrets survive only if you reference them.** A credential field holding a bare name still
  resolves from Splunk's own store and still dies with the instance; one holding an `awssm://`
  ref does not. Migrating them is a deliberate step, and §4.3 is how.
- **The clock matters.** A watermark is a timestamp written by one instance and read by its
  successor. Keep NTP disciplined; skew either re-reads a window or skips one.

---

## 3. What is implemented today

Adjutant 2.5.9. Stateless mode is **off by default** and every key below is inert until you turn it
on, so nothing here changes an existing install.

> **The prerequisite, before anything else on this page: stateless mode requires the Splunk
> instance to run on AWS EC2.** Not "prefers" — requires. `provider = aws_s3` is the only provider
> implemented (`azure_blob` is refused at boot), and `auth_mode = instance_role` is the only
> credential mode accepted. That mode reads the EC2 instance metadata service, which exists on
> EC2 and nowhere else.
>
> This is a deliberate consequence of the design rather than an oversight: an instance-role
> credential is minted *for* the instance, so there is no key to store, and "no secret at rest"
> holds without needing a secret store first. The cost is that an S3-compatible store reached
> through `endpoint_url` does **not** get you off EC2 — the credential mode is still
> instance-role-only. Azure is a planned milestone (SL5) and is not built.

| Capability | State | What it means for you |
|---|---|---|
| Object store client, lease, conditional writes | **In** | S3 with `instance_role` (IMDSv2); path-style addressing for dotted buckets |
| Watermark + memory write-through and boot restore | **In** | The core promise: positions survive the roll |
| Full KV Store restore at boot, verified against the manifest | **In** | A wiped instance comes back whole, tenancy first — for this app's collections (see below) |
| `object_store` backup sink | **In** | The snapshot this restores from; required when stateless is on |
| Readiness gate, no-implicit-cold-start | **In** | Scheduled work waits for the boot, and refuses rather than starting empty |
| Operator visibility (system messages, boot record, run states) | **In** | §14 |
| **AWS Secrets Manager as the credential store** (`awssm://`) | **In** | Read and write. A `credential_ref` may be `awssm://<secret-id>`, `#<json-field>` for one key of a key/value secret, `@AWSPREVIOUS` or `@<version-id>` to pin a version. Verified against the real service by `tools/verify_secrets_store.py` |
| `storage_passwords_policy = refuse` | **In**, ships `allow` | The switch that stops a credential resolving from the local store — the one that dies with the instance. Ships off so an upgrade cannot take every credential with it; turn it on once your refs are migrated |
| Azure Key Vault (`azkv://`) | **NOT built** | Refused by name |
| Declarative schedules (`itmip_ai_schedule.conf`) | **NOT built** | A scheduled ask is still a saved search; recreate or restore it |
| Destination durability gate, drain hook | **NOT built** | A `kvstore` or spool destination on a rolling instance is not yet refused for you |
| Azure Blob provider | **NOT built** | `provider = azure_blob` is refused at boot |
| Licence identity pinning (`[licensing] environment_id`) | **NOT built** | A rebuilt instance may consume a fresh activation |

**Three smaller things the restore does not cover.** Named here rather than discovered later:

- **Per-model overlays that live in another app.** A model's `collection_cust` overlay is stored in
  that model's own home app, and the backup engine only reaches this app's namespace. Everything
  Adjutant itself owns is restored; a customisation stored in a neighbouring app is not.
- **Lookup CSVs are not synced.** Nothing writes them yet, so there is nothing to lose today — but
  do not assume a lookup you add by hand survives the roll.
- **The KV Store changelog is index-only.** It is written to an index, and replaying it needs a
  search, which a heavy forwarder cannot run. The snapshot-plus-write-through path is what restores
  a rolling instance; the changelog is not part of that path.

**The practical reading.** State survives a rebuild, and so do secrets, provided their refs name
the external store. Point `secrets_backend` at `aws_secrets_manager`, give the instance role
`secretsmanager:GetSecretValue` on your prefix, and make each `credential_ref` an `awssm://` ref.
Two postures decide how they get there: `secrets_write = app` lets an administrator type a
credential into the UI and have it stored externally, which costs the instance role
`PutSecretValue` and `CreateSecret`; `secrets_write = operator` gives the instance no write
permission at all and expects the value to be placed out of band. Under **neither** posture can
the instance delete a secret — a rotation adds a version and the previous one stays recoverable.

Anything whose ref still says `splunk://` continues to die with the instance. Setting
`storage_passwords_policy = refuse` is what turns that from a thing you hope you finished into a
thing the product enforces.

---

## 4. Configure Adjutant

Two stanzas in `local/itmip_ai_workbench.conf`, then a restart. The boot runs once per splunkd
start, so a restart is how any change here takes effect.

### 4.1 The minimum that works

```ini
[stateless]
enabled = 1
environment_id = acme-acc          # ^[a-z0-9][a-z0-9-]{1,62}$ — NOT the hostname
provider = aws_s3
bucket = my-adjutant-bucket
region = eu-west-1
prefix = adjutant/                # the environment_id is appended to this
auth_mode = instance_role         # the only mode supported today

[kvstore_backup]
backup_sinks = index,object_store
```

**`environment_id` is a declared identity, not a discovered one.** Not the instance id, not the
hostname, not the Splunk GUID — all three change when the instance is rebuilt, which is the one
thing this value must not do. It is also the prefix component, so two environments can share a
bucket.

**`backup_sinks` must contain `object_store` when stateless is on**, and the boot refuses the
configuration if it does not, naming the key. That is not bureaucracy: the snapshot that sink
writes is what a wiped instance restores from, and `index` alone is the configuration that looks
healthy and cannot be restored from (§4.4).

### 4.2 The rest of the keys, and their defaults

| Key | Default | What it does |
|---|---|---|
| `restore_on_start` | `1` | Restore at boot. `0` boots ready without restoring — for a brand-new environment only |
| `restore_timeout_seconds` | `600` | Exceeding it is `degraded`, never a partial run |
| `allow_cold_start` | `0` | `1` lets an empty watermark mean "first run". A provisioning-window setting; prefer the per-integration marker (§13.3) |
| `readiness_gate` | `1` | Refuse scheduled asks until the boot says ready |
| `write_through` | `1` | Write the object store before KV Store, and fail the caller if it refuses |
| `lease_ttl_seconds` / `lease_renew_seconds` | `120` / `40` | Single-writer lease lifetime and renewal |
| `retention_snapshots_daily` / `_weekly` / `_monthly` | `7` / `4` / `3` | What the `object_store` backup sink keeps |
| `sse` / `kms_key_id` | `aws_kms` / empty | A **declaration of what you expect the bucket to enforce**, not a per-request setting — Adjutant sends no encryption headers, so encryption comes from the bucket's default-encryption rule (§10). `sse = none` is refused |
| `endpoint_url` | empty | Set only for an S3-compatible store |
| `secrets_backend` | `none` | `aws_secrets_manager` turns on `awssm://` refs (§4.3). Nothing else in this block does anything while it is `none` |
| `secrets_write` | `app` | `app` lets the UI store a credential; `operator` accepts only a ref it can resolve and needs no write permission at all. **Neither can delete** — a rotation is a new version |
| `storage_passwords_policy` | `allow` | `refuse` stops a credential resolving from Splunk's own store. Refused at boot when `secrets_backend = none`, because that would leave no store at all |
| `secret_cache_ttl_seconds` | `300` | How long a resolved external secret is held in memory. Without it an Ask makes one AWS round trip per credential. Dropped on rotation |
| `secrets_prefix` | `adjutant/` | Where an operator is expected to put this environment's secrets, and what the IAM policy should be scoped to. Informational — refs name their secret in full |

Keys that exist only so their refusal is **explicit** — Adjutant names them rather than accepting a
value it will not honour:

| Key | Refused value | Why |
|---|---|---|
| `auth_mode` | `access_key` | Still refused. The secret store can now hold the key, but reaching the store needs a credential of its own, so on EC2 the instance role remains the only thing that breaks the cycle. Use `instance_role` |
| `provider` | `azure_blob`, and `local_file` while enabled | Not built; `local_file` dies with the instance |
| `watermark_write_mode` | anything but `synchronous` | A batched watermark can be lost on the roll it exists to survive |
| `fail_closed_on_restore_error` | `0` | The boot is fail-closed on every branch. Accepting `0` and ignoring it is how an operator discovers during an incident that it never applied |
| `sse` | `none` | See §10 |
| `secrets_backend` | anything but `none` / `aws_secrets_manager` | `azure_key_vault` arrives with the Azure milestone |
| `allow_env_secrets` | `1` | Reserved. `env://` refs are refused; the key exists so the refusal is explicit rather than a silent miss |

A refusal names the key rather than falling back to a default — deliberately unlike `[indexes]`,
because a silent fallback here would mean writing state somewhere you did not choose.

### 4.3 Putting a credential where the rebuild cannot reach it

Turn the backend on, then reference secrets instead of naming them.

```ini
[stateless]
secrets_backend = aws_secrets_manager
secrets_write   = app          # or operator — see below
```

**Every credential field takes a ref instead of a name.** The LLM configuration's key, a
ServiceNow connection, an MCP server's token, a custom HTTP tool's credential — all four resolve
through the same seam, so all four accept:

```
awssm://adjutant/prod/anthropic                the whole secret
awssm://adjutant/prod/servicenow#password      one field of a key/value secret
awssm://adjutant/prod/anthropic@AWSPREVIOUS    a pinned version, or @<version-id>
```

A field that still holds a bare name keeps resolving from Splunk's own store, and keeps dying with
the instance. That is what `storage_passwords_policy = refuse` is for: it turns "we think we
migrated everything" into something the product enforces. It is refused at boot unless
`secrets_backend` names a store, so you cannot switch it on and be left with nothing.

**The IAM policy.** Read-only is enough for `secrets_write = operator`:

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
  "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:adjutant/*"
}
```

Add `secretsmanager:PutSecretValue` and `secretsmanager:CreateSecret` for `secrets_write = app`,
where an administrator types a credential into the UI. **Do not add `DeleteSecret`** — nothing in
Adjutant calls it, under either posture, and leaving it out means a compromised instance cannot
destroy your credentials.

> **The trailing `*` is doing real work.** Secrets Manager appends six random characters to every
> secret's ARN, so the secret `adjutant/prod/anthropic` really lives at
> `…:secret:adjutant/prod/anthropic-AbC123`. A resource pattern without the wildcard matches
> nothing, and the failure looks like a missing secret rather than a policy mistake.

**Prove it before you rely on it.** `tools/verify_secrets_store.py` reads and writes against the
real service and reports what it proved:

```bash
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...   # not needed on EC2
python3 tools/verify_secrets_store.py --region eu-west-1

# on a customer's account, read-only, needs only GetSecretValue:
python3 tools/verify_secrets_store.py --secret-id adjutant/prod/anthropic
```

### 4.4 The one configuration to avoid

`backup_sinks = index` on a rolling instance. The indexed snapshot is written to indexers and read
back with a **search**, which a heavy forwarder cannot run — so the backup looks healthy, the
Backups tab is green, and there is no path that can ever restore it on that instance. Adjutant now
says so in red (§14), and the stateless boot refuses the combination outright.

---

## 5. Two workloads, and they do not want the same things

Adjutant puts two quite different kinds of object in S3, and treating them as one is how you end
up paying to version a data lake or losing a watermark you needed.

| | **Stateless state** | **AI Driven Integration data** |
|---|---|---|
| What it is | Watermarks, the lease, tenancy, playbooks, mappings, boot records | Records an integration landed: nodes, edges, manifests, extracts |
| Typical key | `state/wm/<integration>.json` | `o11y/inbound/nodes/env_code=PRD/dt=2026-08-19/run=<id>/part-0000.parquet` |
| Size | Hundreds of bytes to a few KB | Megabytes |
| Write pattern | **Rewritten constantly**, same key every run | **Written once**, new key every run |
| Read pattern | Every boot, all of it | Rarely, by a downstream consumer |
| Losing one means | An integration re-reads its whole source, or two instances both write | One run's output is missing; re-run it |
| Versioning | **Wanted** — recovery from a bad write | **Useful**, for recovery and for seeing what a run wrote — but the manifest, not versioning, is what makes deltas cheap |
| Tiering | **Never** — too small to tier economically | **Yes, after a while** |
| Retention | Indefinite; it is current state | Finite; it is a historical extract |

The write pattern is the root of every difference below. A watermark overwritten on every run
produces a new non-current version every run; a Parquet part written once under a
run-scoped key never produces a second version at all.

---

## 6. The constraint that shapes the decision

**Some S3 settings are bucket-wide and cannot vary by prefix.** This is the thing to know before
designing a layout:

| Cannot differ per prefix | Can differ per prefix |
|---|---|
| Versioning | Lifecycle rules (`Filter.Prefix`) |
| Block public access | Bucket-policy statements (`Resource` on `bucket/prefix/*`) |
| Default encryption *(a PUT may still override per object)* | IAM policy scoping |
| Object ownership / ACLs | Object Lock retention *(the bucket toggle is global)* |

**Versioning is the one that forces a choice**, because stateless state wants it and integration
data does not.

### One bucket or two

**One bucket is fine, and it is what we recommend to start.** Turn versioning on — stateless
needs it — and add a lifecycle rule that expires non-current versions under the integration prefix
after a day or two. Integration objects rarely produce non-current versions anyway, because each
run writes a new key, so the cost of versioning them is close to zero.

**Two buckets are worth it when** the integration data is large enough that you want lifecycle
tiering and a different retention policy without a `Filter` on every rule, or when a downstream
consumer needs bucket-level access you do not want to grant over state.

Either way the prefixes stay separate, because the IAM scoping and the lifecycle rules key on
them.

---

## 7. Settings that apply to the whole bucket

### 7.1 Region — same as the Splunk instance

Cross-region adds latency to the boot path, which is the one place it is felt, and sends state
over the public internet unless you add an endpoint. A **VPC gateway endpoint for S3** keeps the
traffic on AWS's network and costs nothing.

### 7.2 Block public access — all four flags

```bash
aws s3api put-public-access-block --bucket <bucket> \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

If `ObjectOwnership` is `BucketOwnerEnforced` — the modern default — ACLs are disabled entirely
and the first two flags are already moot. Set all four anyway: it costs nothing and removes the
need for the next reader to work out which two were load-bearing.

### 7.3 Deny anything not over TLS

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyInsecureTransport",
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": ["arn:aws:s3:::<bucket>", "arn:aws:s3:::<bucket>/*"],
    "Condition": { "Bool": { "aws:SecureTransport": "false" } }
  }]
}
```

Adjutant only ever speaks HTTPS, so this changes nothing about how the app behaves. It is there
for everything else that will eventually touch the bucket.

### 7.4 Versioning — on, because stateless needs it

```bash
aws s3api put-bucket-versioning --bucket <bucket> \
  --versioning-configuration Status=Enabled
```

Enabling it is half the job. §8.2 and §9.2 add the expiry rules without which every overwrite is
kept forever.

### 7.5 A dotted bucket name changes the addressing

S3 presents a wildcard certificate for `*.s3.<region>.amazonaws.com`, and a wildcard matches
exactly **one** label. A bucket named `example-corp.adjutant-test-bucket` needs two, so the
virtual-hosted hostname fails during the **TLS handshake** — before anything is signed or sent,
with an error that mentions nothing about bucket naming.

Adjutant handles it: a dot selects path-style addressing automatically, so
`https://s3.<region>.amazonaws.com/<bucket>/<key>` is used. Nothing is required of you. It is here
because the same trap catches every other tool you point at the bucket, and because a new bucket
is easier to name without a dot than to explain later.

---

## 8. The stateless-state prefix

Suggested prefix: `<root>/state/`. Everything Adjutant needs to be the same instance tomorrow.

```
<bucket>/<prefix>/<environment_id>/
├── _meta/
│   ├── environment.json                    declared identity — the marker that turns
│   │                                       "no state" into "state is MISSING" (§13.2)
│   ├── lease.json                          the single-writer lease, with its epoch
│   ├── boot/<epoch>.json                   one record per boot: restored, verified, refused
│   └── cold_start/<integration_id>.json    an admin's one-shot permission to start empty
├── state/
│   ├── watermark/<ORG>/<row key>.json.gz   written on every commit, read at every boot
│   └── memory/<ORG>/<type>/<key>.json.gz   learned facts, mapping decisions, run summaries
├── snapshots/<backup_id>/<collection>.jsonl.gz   the full KV Store snapshot
└── manifest/
    ├── <backup_id>.json                    per-collection counts + sha256 + object keys
    └── current.json                        pointer, written LAST — a half-written
                                            snapshot is invisible because nothing points at it
```

Two things worth reading off that tree. The **per-key** objects under `state/` are the ones
rewritten constantly — that is what §8.2's non-current expiry is about. The **snapshot** under
`snapshots/` is the backup subsystem writing its `object_store` sink here (§4.2), and it is what a
wiped instance restores from before the per-key objects are laid over the top.

### 8.1 Versioning: required

This is the prefix versioning exists for. A watermark written wrongly, or a restore that lands bad
state, is recovered by reading the previous version.

### 8.2 Lifecycle: expire non-current versions, and abort stalled uploads

```json
{
  "Rules": [
    {
      "ID": "state-abort-incomplete-mpu",
      "Status": "Enabled",
      "Filter": { "Prefix": "<root>/" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    },
    {
      "ID": "state-expire-noncurrent",
      "Status": "Enabled",
      "Filter": { "Prefix": "<root>/" },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
      "Expiration": { "ExpiredObjectDeleteMarker": true }
    }
  ]
}
```

**Keep the abort rule even though Adjutant cannot currently strand a part.** Multipart upload is
not implemented (`bin/itmip_object_store_s3.py` says so in its header): every object goes up in a
single PUT, so a failed write leaves nothing behind. The rule is here because stranded parts are
billed as storage and **do not appear in an ordinary listing** — nothing tells you they are
accumulating — and because anything else you point at this bucket may well use multipart. It costs
nothing and it removes a trap for whoever comes next.

**The non-current rule matters the moment versioning is on**, and it is easy to miss because
nothing breaks: you enable versioning, everything works, and the bill grows quietly. A watermark
is rewritten every run, so a daily integration produces a new non-current version every day,
retained forever. Thirty days is a starting point; the real value is how far back you would ever
restore.

`ExpiredObjectDeleteMarker` removes delete markers once every version beneath them has expired.
Without it they accumulate as zero-byte clutter that slows listings.

### 8.3 Never tier this prefix

S3 Infrequent Access bills **any** object as at least 128 KB and charges a transition request to
move it there. A watermark is a few hundred bytes, so tiering it costs several times what leaving
it in Standard costs, and adds a retrieval charge on the boot path. If you add tiering anywhere,
exclude small objects explicitly:

```json
{ "Filter": { "And": { "Prefix": "<root>/", "ObjectSizeGreaterThan": 131072 } } }
```

### 8.4 Encryption: recommended, and see §10

---

## 9. The AI Driven Integration prefix

Suggested prefix: `<root>/integration/`, or a separate bucket. Records an integration landed —
write-once, under a key that already carries the run id.

### 9.1 Versioning: useful here too, and it changes the expiry you want

An earlier draft of this document said versioning was not needed for integration data. That was
too quick. Each run writes a new key, so a second version of the same key is rare — but versioning
still earns its place, for the same reason it does on state: recovering from a bad run, and seeing
what a previous run actually wrote when you are working out why a downstream consumer disagrees.

**What versioning does not do is make deltas cheap**, and it is worth being precise because the
two get conflated. Finding out *which rows changed* between two Parquet or NDJSON objects means
downloading both and parsing them. Finding out *whether anything changed* is one `HEAD`, because
an object's ETag is a content hash.

So the mechanism Adjutant uses for "only work on what changed" is the **manifest**, not
versioning. Every landing writes `<resource>/_manifest.json` carrying:

```json
{
  "object_key": "apm_service/run=run-3/part-0000.ndjson",
  "etag": "…",
  "content_hash": "3e34ef4d590496ca…",
  "records": 2,
  "previous_object_key": "apm_service/run=run-1/part-0000.ndjson",
  "previous_content_hash": "762540a38999cc20…"
}
```

One small `GET` answers "has anything changed", and the previous key is right there if you want to
diff. **A landing whose content is identical writes nothing at all** and reports `unchanged`,
which is what makes the store a cache rather than an append-only dump.

**If you do rely on versions for diffing, the expiry must outlast your diff window.** That is the
practical consequence, and it is why the rule below is a week rather than the one day that would
otherwise suit write-once data:

```json
{
  "ID": "integration-expire-noncurrent",
  "Status": "Enabled",
  "Filter": { "Prefix": "<root>/integration/" },
  "NoncurrentVersionExpiration": { "NoncurrentDays": 7 }
}
```

### 9.2 Lifecycle: tier, then expire

This is the prefix where tiering earns its keep, because the objects are large:

```json
{
  "Rules": [
    {
      "ID": "integration-abort-incomplete-mpu",
      "Status": "Enabled",
      "Filter": { "Prefix": "<root>/integration/" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    },
    {
      "ID": "integration-tier-and-expire",
      "Status": "Enabled",
      "Filter": {
        "And": { "Prefix": "<root>/integration/", "ObjectSizeGreaterThan": 131072 }
      },
      "Transitions": [{ "Days": 30, "StorageClass": "STANDARD_IA" }],
      "Expiration": { "Days": 365 }
    }
  ]
}
```

**Set `Expiration.Days` to your retention requirement, not ours.** This is historical extract
data; how long you keep it is a business decision. If a downstream system reads it — Athena,
a warehouse, a graph loader — make sure the expiry is longer than that system's own window.

**Keep the 128 KB floor on the transition** even here. A run manifest is small and sits in the
same prefix as the Parquet parts it describes.

### 9.3 Encryption: the same decision, usually the same answer

---

## 10. Encryption: what SSE-S3 gives you and what KMS adds

**For a development bucket, SSE-S3 is not a problem. Revisit before production.**

SSE-S3 (`AES256`) is real encryption at rest: every object encrypted with a 256-bit key, AWS
managing it, unreadable from the disks underneath. If the question is "is the data encrypted", it
is.

What SSE-KMS with a **customer-managed key** adds is not stronger encryption, it is **control**:

| | SSE-S3 | SSE-KMS, customer-managed |
|---|---|---|
| Encrypted at rest | Yes | Yes |
| Who holds the key | AWS | You |
| Bucket access implies data access | **Yes** | No — the key policy is a second gate |
| Per-decrypt audit in CloudTrail | No | Yes |
| Revoke access to existing data | No | Yes, disable the key |

The third row is what decides it. With SSE-S3, anyone who can read the bucket can read the data,
so the bucket policy is the only gate. With KMS there are two, and they can be held by different
people.

**Which prefix needs it more.** Stateless state carries tenancy configuration, playbooks and
mappings — customer content. Integration data carries whatever the integration extracted, which
may be more sensitive still. In practice, if you enable KMS, enable it for the bucket rather than
trying to split it.

```bash
aws s3api put-bucket-encryption --bucket <bucket> \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:<region>:<account>:key/<key-id>"
      },
      "BucketKeyEnabled": true
    }]
  }'
```

**Two practical notes.** Enabling SSE-KMS later applies to **new objects only** — existing objects
stay SSE-S3 until rewritten, so a switch needs a copy-in-place pass if the old objects matter. And
a KMS key introduces a failure mode SSE-S3 does not have: if the key policy does not grant the
instance role `kms:Decrypt`, **every read fails with `AccessDenied`** and it looks like an S3
permission problem. Grant `kms:Decrypt`, `kms:GenerateDataKey` and `kms:DescribeKey`.

`BucketKeyEnabled` cuts KMS request charges substantially and is worth having on.

**Set it on the bucket, not in Adjutant.** Adjutant sends no `x-amz-server-side-encryption` header
— every object it writes is encrypted by the bucket's default-encryption rule above. The
`[stateless] sse` and `kms_key_id` keys record what you expect that rule to be; they do not create
it. So the command above is the step that actually encrypts anything.

---

## 11. Credentials: the instance role, and nothing else

**The instance role is not the recommended option, it is the only one** — see the note in §3.
`auth_mode = access_key` is refused at boot until the external secret store lands, because an
access key has to be stored somewhere that survives a rebuild, and that place does not exist yet.

**On EC2, no key should exist on the instance.** Attach an IAM role and Adjutant resolves
credentials from the instance metadata service — the only form that survives a rebuild, because an
instance-role credential is minted *for* the instance rather than configured *on* it.

IMDS**v2** is used: a token is requested with a `PUT` before anything is read. IMDSv1 is a
well-known SSRF amplifier, and this is deliberate. The credential is re-fetched as it nears expiry
rather than captured once, because a client that captured one at boot starts failing hours later
with a signature error that reads like clock skew.

### The IAM policy

Two statements per prefix, so the role can reach state and integration data but nothing else:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ObjectsUnderOurPrefixes",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::<bucket>/<root>/*",
        "arn:aws:s3:::<bucket>/<root>/integration/*"
      ]
    },
    {
      "Sid": "ListOnlyThosePrefixes",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<bucket>",
      "Condition": {
        "StringLike": { "s3:prefix": ["<root>/*", "<root>/integration/*"] }
      }
    }
  ]
}
```

Scoped to the prefixes on purpose. Adjutant never needs the rest of the bucket, and a role that
cannot reach it cannot be made to by a bug or by a manifest naming a key outside it.

**If the integration data is consumed by something else**, give that consumer its own read-only
role on `<root>/integration/*` rather than sharing Adjutant's. They have different lifetimes and
different blast radii.

### One credential, or several

**The same credential covers both prefixes by default, and that is the recommended shape**: one
instance role, two prefixes, different folders. Nothing needs configuring for it.

**A destination may name its own credential instead.** Each integration destination takes an
optional `credential_ref`, so one integration can use a key that the stateless store and the other
integrations do not have:

```
kind:           object_store
bucket:         <bucket>
region:         <region>
prefix:         <root>/integration/servicenow
credential_ref: servicenow_s3_key      # optional; absent = the instance role
```

That matters when the prefixes belong to different owners, when an integration writes into a
bucket in another account, or when one integration's access has to be revocable without touching
anything else. It is a field on the destination rather than a different code path, so using it
costs nothing structurally.

The stateless store resolves its own credentials the same way and is unaffected by whatever the
integrations do.

`s3:GetBucketVersioning` and the other `s3:GetBucket*` reads are **not** in this policy. The app
does not use them; `tools/verify_s3_store.py` does, so run that with an administrator's
credentials rather than widening the role.

### If you must use an access key

Environment variables, never a file in the app:

```
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN (temporary credentials only)
```

Adjutant reads the container credential endpoint, then the environment, then IMDS, and reports
which source won — because an instance profile plus an environment key is ambiguous, and choosing
silently is how somebody debugs the wrong identity for an afternoon.

---

## 12. The lease, and why the conditional write matters

A single-writer fence is taken with a conditional write (`If-None-Match: *`): it succeeds for
exactly one instance and returns `412` to every other. This is the only real mutual exclusion this
topology has, so it was verified against a live bucket rather than assumed.

| Verified | Result |
|---|---|
| Acquire into an empty prefix | succeeds |
| A second acquire while held | refused `412` |
| `If-Match` with the current ETag | accepted |
| `If-Match` with a stale ETag | refused `412` |
| Conditional PUT when a **delete marker** is current | **succeeds** — a delete marker reads as absence |

The last row is the one that needed a real bucket. It means a deleted lease can be re-acquired and
cannot wedge the writer fence permanently.

Nothing is required of you for this beyond versioning being on, which §7.4 already covers.

---

## 13. Verify it works

Three levels, and they answer different questions. Do them in order: a bucket problem looks like an
app problem from inside Splunk.

### 13.1 The bucket, before Adjutant touches it

Writes only under the prefix you give it and cleans up after itself, so it is safe against a live
bucket:

```bash
python3 tools/verify_s3_store.py \
    --bucket <bucket> --region <region> --prefix <prefix>/_verify
```

Run it with an administrator's credentials, not the instance role — it checks bucket-level settings
(`s3:GetBucketVersioning` and friends) that the role deliberately does not have (§11).

### 13.2 The boot, after you enable it

Restart splunkd, then read the boot's own verdict. It is written in two places, and both are worth
knowing because one of them survives the instance:

```bash
# The instance's current state — one row, always present while stateless is on
curl -sk -u admin:<pw> \
  "https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/collections/data/itmip_stateless_boot?output_mode=json" \
  | python3 -m json.tool

# The durable record of every boot, in the bucket
aws s3 ls s3://<bucket>/<prefix>/<environment_id>/_meta/boot/
```

| `state` | Meaning | What runs |
|---|---|---|
| `restoring` | The boot is working | Scheduled asks are refused; the dispatcher claims nothing |
| `ready` | Restore complete and verified | Everything |
| `degraded` | The restore was incomplete, or state exists without its environment marker | Interactive use only — scheduled asks refused, by design (never partially restore and then run) |
| `failed` | Configuration invalid, store unreachable, KV Store not ready, or the lease is held elsewhere | The same refusal, with the reason naming the key |

The record also carries `snapshot_outcomes`, one entry per collection, with an honest verdict each:
`restored` (and whether its hash matched the manifest), `matched` (live already equals the
snapshot), or `kept_live` — live rows exist and differ, so they are NEWER than the snapshot and
restoring would regress them. Nothing is overwritten on a `kept_live`; it is recorded so you can
look.

**Three ways `_meta/environment.json` can be absent, and they are not the same thing.** An empty
prefix is a genuinely new environment: the marker is written, and the first run of every
integration is legitimately a cold start. State objects present WITHOUT the marker is an existing
environment whose marker went missing, and that is `degraded` — never treated as new. An
unreachable store is `failed`. Conflating the first two is how a rebuild quietly re-reads
everything.

### 13.3 The behaviour, which is the only proof that counts

**Does a position survive a roll?** Note a watermark, roll the instance, and check the same value
came back:

```bash
curl -sk -u admin:<pw> \
  "https://localhost:8089/servicesNS/nobody/itmip_ai_splunk_assistent_app/storage/collections/data/itmip_ai_memory_<org>?output_mode=json" \
  | python3 -c "import sys,json;[print(r['_key'], r.get('watermark_value')) for r in json.load(sys.stdin) if r.get('record_type')=='integration_state']"
```

**Does it refuse when it should?** This is the half people skip, and it is the half that matters —
a restore you have never seen fail is a restore you are trusting on faith. Delete one watermark
object from the bucket, restart, and confirm the integration refuses with
`stateless_state_missing` naming `is::<BU>::<integration_id>` rather than starting from zero.

To let it start empty on purpose, an administrator writes a one-shot marker, which is **consumed on
use** so it authorises exactly one run:

```
<prefix>/<environment_id>/_meta/cold_start/<integration_id>.json
```

---

## 14. Where Adjutant tells you things

Stateless mode is mostly invisible when it works, so it was built to speak up. Four places:

**The Backups tab.** Each configured sink shows whether a restore could actually run *from this
instance*, with the reason when it could not. A configuration that is being written but cannot be
restored here shows a red banner saying exactly that.

**Splunk's message bus and `splunkd.log`.** Every operator-facing condition posts a system banner
(visible in Splunk Web wherever the instance's UI is reachable) and the same line to `splunkd.log`
prefixed `itmip_llm_visibility:` — which forwards to `_internal`, so it is alertable from the
search tier even on a headless instance. Messages are name-keyed: a re-post replaces rather than
stacks, and a healed condition clears its own banner.

| Message | Raised when |
|---|---|
| `itmip_adjutant_stateless_boot` | The boot ended `degraded` or `failed` |
| `itmip_adjutant_stateless_missing_<integration>` | A scheduled integration was refused for a missing watermark |
| `itmip_adjutant_backup_unrestorable` | Backups are being written and none of them can be restored here |
| `itmip_adjutant_kvstore_required` | KV Store is disabled or failed — one stated cause instead of a cascade |

**The Scheduled Ask tab's last-run cell.** A refused tick never enqueues a run, so there is no run
to look at — the refusal is recorded on the schedule's single-flight guard and the cell reads
`skipped`, qualified with the reason. Hover for the full sentence:

| Cell reads | Meaning |
|---|---|
| `skipped (not ready)` | The boot has not opened the gate yet. Not an error — runs resume by themselves |
| `skipped (no state)` | Refused: no restored watermark and no cold-start authorisation. The banner and `splunkd.log` name the key |
| `skipped (gate error)` | The readiness check itself errored; refused rather than run blind (S8) |

A schedule that has opted out of single-flight has no guard row to record on, so its refusal is
visible only in the banner and `splunkd.log` — the two above.

**A run left over from before the roll stays `pending`.** There are two gates, not one: the
schedule refuses to *enqueue* while the boot is not ready, and the dispatcher refuses to *claim*
anything already queued. A queue row written before the rebuild must wait for the restored
watermarks rather than race them, so `pending` immediately after a roll is the system working. It
clears by itself when the boot opens the gate.

> Not the same thing: a run that finished but stopped because a **person** must act (an open drift
> proposal, unresolved missing context) is a terminal state, `blocked_on_human`, not a skip. It
> fires no on-error automation, and it currently reads as `finished` in this cell — the distinction
> lives in the run's History entry.

**The bucket itself.** `_meta/boot/<epoch>.json` is written on every boot whatever the verdict,
including the ones that refused. "What did this instance do when it came up, and what did it
decline to do" is answerable after the fact, from outside the instance.

> The spec also describes a `boot_record_index` key for mirroring boot records into an index. That
> is **not implemented**; the object in the bucket is the record today.

---

## 15. Checklist

**Bucket-wide**
```
[ ] Same region as the Splunk instance
[ ] Versioning enabled
[ ] Block public access: all four flags true
[ ] Bucket policy denying aws:SecureTransport = false
[ ] (recommended) SSE-KMS customer-managed key, BucketKeyEnabled, role granted kms:Decrypt
[ ] (optional) VPC gateway endpoint for S3
```

**Stateless-state prefix**
```
[ ] Lifecycle: AbortIncompleteMultipartUpload after 7 days
[ ] Lifecycle: NoncurrentVersionExpiration, with ExpiredObjectDeleteMarker
[ ] NO tiering rule that can match it
```

**Integration prefix**
```
[ ] Lifecycle: AbortIncompleteMultipartUpload after 7 days
[ ] Lifecycle: NoncurrentVersionExpiration — longer than any diff window you rely on
[ ] Lifecycle: transition and expiry set to YOUR retention requirement
[ ] Any tiering filtered to ObjectSizeGreaterThan 131072
```

**Access**
```
[ ] IAM role attached to the instance, scoped to the prefixes
[ ] Downstream consumers given their own read-only role
[ ] tools/verify_s3_store.py passes
```

**Adjutant (§4)**
```
[ ] [stateless] enabled = 1, environment_id set and STABLE across rebuilds
[ ] bucket / region / prefix match what you provisioned above
[ ] [kvstore_backup] backup_sinks contains object_store
[ ] KV Store enabled on the instance (server.conf [kvstore] disabled = false)
[ ] splunkd restarted — the boot runs once per start
```

**Proof (§13)**
```
[ ] boot_state reads ready, and the boot record lists the collections it restored
[ ] a watermark survives a rebuild and the integration does not re-read
[ ] a DELETED watermark object produces stateless_state_missing, not a cold start
[ ] the Backups tab shows at least one sink restorable from this instance
```

**Before you roll unattended (§3)**
```
[ ] secrets_backend = aws_secrets_manager, and the instance role can read your prefix
[ ] every credential field holds an awssm:// ref, not a bare name (§4.3)
[ ] tools/verify_secrets_store.py passes against the real account
[ ] storage_passwords_policy = refuse, once the refs are migrated — it is what
    stops a missed one resolving locally and dying with the instance
[ ] Scheduled asks are recreated or restored (declarative schedules are not built)
[ ] NTP disciplined on the instance
```
