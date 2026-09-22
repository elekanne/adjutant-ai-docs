# adjutant-docs

Public documentation site for Adjutant AI and Adjutant AI Domain Workspace,
published at https://docs.thedutchdatadifference.nl

Do not edit the pages under `user/` or `admin/` here. They are overwritten by
the sync workflows in the private product repos on every release. Edit the
docs/ folder in the private repo instead. The `index.md` and `_category_.json`
files are maintained by hand here and are never touched by a sync.

## Syncing docs from a product repo

Each private repo keeps a manifest listing exactly which files it publishes and
where they land, so it can reorganise its own docs/ folder without changing a
public URL. One entry per line, blank lines and `#` comments ignored:

    docs/user/getting-started.md -> user/getting-started.md
    docs/admin/install.md        -> admin/installation.md
    docs/images/console.png      -> user/img/console.png

The source path is relative to the private repo checkout, the target is
relative to the product folder and must start with `user/` or `admin/`.

If the source of an entry is a folder, the images inside it (`svg`, `png`,
`jpg`, `jpeg`, `webp`, at any depth) are published and everything else in the
folder is ignored, so working files never ship by accident:

    docs/img/ -> admin/img/

A page may link to any image published this way, because the expansion puts it
in the manifest. A folder entry that matches no images fails the sync, since an
entry that does nothing is a manifest bug.

The workflow in the private repo then runs, from the root of this repo:

    node scripts/publish.mjs --product adjutant-ai --tag "$GITHUB_REF_NAME" \
                             --source ../private-checkout \
                             --manifest ../private-checkout/docs-manifest.txt

The script validates everything before writing a single file, and reports all
problems at once if something is wrong. It rewrites relative links and image
references between synced files to their new locations. Pages without a
`sidebar_position` get one from their order within `user/` or `admin/`.

A link to a markdown page the manifest does not list is replaced by its own
link text, so a private repo can mention a page it chooses not to publish
without breaking the build. Each one is listed as a warning at the end of the
run, so add the page to the manifest if it was meant to be published. A link
to any other unlisted local file, an image or a script for example, still
fails the sync. So do an unlisted markdown page reached through an image, a
`[id]: path` reference definition or raw HTML, since none of those has link
text to fall back on.

It records what it wrote in `<product>/.synced-files.json` and deletes exactly
those files on the next run, so a page dropped from the manifest disappears.

## Releases and versions

`scripts/publish.mjs` makes the whole release decision, so a product repo only
has to hand over its tag. It reads the tag, decides where the docs belong,
freezes the previous version when it has to, and then calls the sync.

Tags are `vMAJOR.MINOR.PATCH` with an optional suffix, so `v2.5.9` and
`v2.5.9-docs1` are both release 2.5.9 and a product can republish its docs
without inventing a release. Anything else is refused.

Three files per product record the result. Do not edit them by hand:

- `<product>_current.json`  `{"version": "2.5", "release": "2.5.9"}`
- `<product>_releases.json` `{"2.4": "2.4.7"}`, the last release of each frozen minor
- `<product>_versions.json` written by `docs:version`

Readers navigate by minor, so a link to `/adjutant-ai/2.4/` keeps working for
the life of that version, while the version picker shows the exact release.

What the tag's minor does, compared numerically against the current one so
that 2.10 is newer than 2.9:

- **higher**: freeze the published docs under the old minor, record its
  release, move the pointer to the new one, then sync
- **equal**: sync into the current docs, and move the release label forward if
  the tag is newer
- **lower**: a maintenance release of an older version, so sync into that
  version's frozen folder and update its label. If the site has no frozen docs
  for that minor, the run fails rather than publishing old docs as current.

## Diagrams and images

A ```` ```mermaid ```` fence renders as a diagram, in plain `.md` as well as
MDX. The diagram follows the reader's colour mode and uses the brand palette.
Images and diagrams are centred and never wider than the text column; an
italic line straight after one renders as a caption.

## Search

Search runs entirely in the reader's browser against an index built with the
site, so nothing is sent to a search service. It is scoped per product: inside
Adjutant AI only Adjutant AI is searched, inside Domain Workspace only Domain
Workspace, and from the landing page both. Each version has its own index, so a
reader on the current docs never gets results from a frozen version.

## Preview locally

    npm install
    npm start

Opens http://localhost:3000 and reloads on every change.

## What lives where

- `adjutant-ai/`, `domain-workspace/`  live docs, filled by the sync workflows
- `scripts/publish.mjs`                the release entry point the private repos call
- `scripts/sync-docs.mjs`              copies one manifest into a folder
- `static/robots.txt`                  welcomes search and citation, refuses AI training crawlers
- `*_current.json`, `*_releases.json`  version and release labels per product
- `*_versioned_docs/`, `*_versions.json` frozen older versions (created automatically)
- `docusaurus.config.js`               site settings
- `src/css/custom.css`                 brand colours and fonts
- `src/pages/index.js`                 landing page
- `.github/workflows/deploy.yml`       builds and publishes to GitHub Pages
