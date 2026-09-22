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
The workflow in the private repo then runs, from the root of this repo:

    node scripts/sync-docs.mjs --product adjutant-ai \
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

## Preview locally

    npm install
    npm start

Opens http://localhost:3000 and reloads on every change.

## What lives where

- `adjutant-ai/`, `domain-workspace/`  live docs, filled by the sync workflows
- `scripts/sync-docs.mjs`              the sync script the private repos call
- `*_current.json`                     live version label per product
- `*_versioned_docs/`, `*_versions.json` frozen older versions (created automatically)
- `docusaurus.config.js`               site settings
- `src/css/custom.css`                 brand colours and fonts
- `src/pages/index.js`                 landing page
- `.github/workflows/deploy.yml`       builds and publishes to GitHub Pages
