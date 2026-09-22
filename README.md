# adjutant-docs

Public documentation site for Adjutant AI and Adjutant AI Domain Workspace,
published at https://docs.thedutchdatadifference.nl

Do not edit the contents of `adjutant-ai/` or `domain-workspace/` here.
They are overwritten by the sync workflows in the private product repos on
every release. Edit the docs/ folder in the private repo instead.

## Preview locally

    npm install
    npm start

Opens http://localhost:3000 and reloads on every change.

## What lives where

- `adjutant-ai/`, `domain-workspace/`  live docs, filled by the sync workflows
- `*_current.json`                     live version label per product
- `*_versioned_docs/`, `*_versions.json` frozen older versions (created automatically)
- `docusaurus.config.js`               site settings
- `src/css/custom.css`                 brand colours and fonts
- `src/pages/index.js`                 landing page
- `.github/workflows/deploy.yml`       builds and publishes to GitHub Pages
