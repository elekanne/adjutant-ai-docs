#!/usr/bin/env node
// Publish one product's documentation for a release tag.
//
//   node scripts/publish.mjs --product <id> --tag <tag> \
//                            --source <private repo checkout> \
//                            --manifest <manifest file>
//
// Run from the root of this repo. This is the whole release decision, so a
// product repo's workflow only has to hand over its tag and its manifest.
//
// Three files per product record where a release went:
//
//   <product>_current.json    {"version": "2.5", "release": "2.5.9"}
//   <product>_releases.json   {"2.4": "2.4.7"}  last release of each frozen minor
//   <product>_versions.json   ["2.4"]           written by docs:version
//
// Readers navigate by minor (/adjutant-ai/2.4/) and see the exact release in
// the version picker.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS = ['adjutant-ai', 'domain-workspace'];

const USAGE = `Usage:
  node scripts/publish.mjs --product <${PRODUCTS.join('|')}> --tag <vMAJOR.MINOR.PATCH> \\
                           --source <dir> --manifest <file>

The tag may carry a docs suffix: v2.5.9 and v2.5.9-docs1 are both release 2.5.9.`;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return {help: true};
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) fail(`Unrecognised argument: ${arg}\n\n${USAGE}`);
    const [, key, inline] = match;
    const value = inline !== undefined ? inline : argv[++i];
    if (value === undefined) fail(`Missing value for --${key}\n\n${USAGE}`);
    out[key] = value;
  }
  return out;
}

// v2.5.9 and v2.5.9-docs1 are both release 2.5.9 on minor 2.5. The suffix lets
// a product republish its docs without inventing a product release.
function parseTag(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(tag);
  if (!match) {
    fail(
      `Tag "${tag}" is not a release tag.\n` +
        `Expected vMAJOR.MINOR.PATCH, optionally with a suffix, for example ` +
        `v2.5.9 or v2.5.9-docs1.`,
    );
  }
  const [, major, minor, patch] = match.map(Number);
  return {
    major,
    minor,
    patch,
    minorKey: `${major}.${minor}`,
    release: `${major}.${minor}.${patch}`,
  };
}

// Compare "2.10" against "2.9" as numbers, so 2.10 is newer. Text comparison
// gets this backwards and would quietly publish a new release into an old
// version's folder.
const parts = (value) => String(value).split('.').map((n) => Number(n) || 0);

function compare(a, b) {
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

const readJson = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;

// Sorted keys, so a releases file produces a readable diff instead of a
// reshuffle every time a version is added.
function writeJson(file, value) {
  const ordered =
    Array.isArray(value) || typeof value !== 'object'
      ? value
      : Object.fromEntries(Object.keys(value).sort(compare).map((k) => [k, value[k]]));
  fs.writeFileSync(file, `${JSON.stringify(ordered, null, 2)}\n`);
}

function run(command, args) {
  process.stdout.write(`  $ ${command} ${args.join(' ')}\n`);
  execFileSync(command, args, {stdio: 'inherit'});
}

function syncDocs({product, source, manifest, targetDir}) {
  const args = [
    path.join('scripts', 'sync-docs.mjs'),
    '--product',
    product,
    '--source',
    source,
    '--manifest',
    manifest,
  ];
  if (targetDir) args.push('--target-dir', targetDir);
  run(process.execPath, args);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const {product, tag, source, manifest} = args;
  if (!product || !tag || !source || !manifest) fail(`Missing required argument.\n\n${USAGE}`);
  if (!PRODUCTS.includes(product)) {
    fail(`Unknown product "${product}". Expected one of: ${PRODUCTS.join(', ')}`);
  }

  const currentFile = `${product}_current.json`;
  const releasesFile = `${product}_releases.json`;
  if (!fs.existsSync(currentFile)) {
    fail(`${currentFile} is missing. Run this from the root of the docs repo.`);
  }

  const incoming = parseTag(tag);
  const current = readJson(currentFile, {});
  const releases = readJson(releasesFile, {});
  const currentMinor = current.version;
  const currentRelease = current.release ?? current.version;

  if (!currentMinor) fail(`${currentFile} has no "version" field.`);

  const direction = compare(incoming.minorKey, currentMinor);
  process.stdout.write(
    `${product}: tag ${tag} is release ${incoming.release} on minor ${incoming.minorKey}; ` +
      `current is ${currentRelease} on minor ${currentMinor}.\n`,
  );

  if (direction > 0) {
    // A new minor. Freeze what is published now under its own number so the
    // previous version stays readable at its own URL, then move the pointer
    // forward. Docusaurus versions whatever is in the product folder, so this
    // has to happen before the sync.
    process.stdout.write(`Freezing ${currentMinor} and opening ${incoming.minorKey}.\n`);
    run('npm', ['run', 'docusaurus', '--', `docs:version:${product}`, currentMinor]);

    releases[currentMinor] = currentRelease;
    writeJson(releasesFile, releases);
    writeJson(currentFile, {version: incoming.minorKey, release: incoming.release});
    syncDocs({product, source, manifest});
    process.stdout.write(`Published ${incoming.release} as the current version.\n`);
    return;
  }

  if (direction === 0) {
    process.stdout.write(`Publishing into the current version ${currentMinor}.\n`);
    syncDocs({product, source, manifest});
    if (compare(incoming.release, currentRelease) > 0) {
      writeJson(currentFile, {version: currentMinor, release: incoming.release});
      process.stdout.write(`Current release ${currentRelease} -> ${incoming.release}.\n`);
    } else {
      process.stdout.write(
        `Release ${incoming.release} is not newer than ${currentRelease}; label unchanged.\n`,
      );
    }
    return;
  }

  // A maintenance release of an older version. It belongs in that version's
  // frozen folder, never in the current docs.
  const versionedDir = path.join(`${product}_versioned_docs`, `version-${incoming.minorKey}`);
  if (!fs.existsSync(versionedDir) || !fs.statSync(versionedDir).isDirectory()) {
    fail(
      `Tag ${tag} is a maintenance release of ${incoming.minorKey}, but this site has no\n` +
        `frozen docs for that version: ${versionedDir} does not exist.\n` +
        `Current version is ${currentMinor}. Either the tag is wrong, or ${incoming.minorKey}\n` +
        `was never published here and there is nothing to amend.`,
    );
  }

  process.stdout.write(`Publishing into frozen version ${incoming.minorKey}.\n`);
  syncDocs({product, source, manifest, targetDir: versionedDir});

  const known = releases[incoming.minorKey];
  if (!known || compare(incoming.release, known) > 0) {
    releases[incoming.minorKey] = incoming.release;
    writeJson(releasesFile, releases);
    process.stdout.write(`Frozen ${incoming.minorKey} now reads ${incoming.release}.\n`);
  } else {
    process.stdout.write(
      `Release ${incoming.release} is not newer than ${known}; label unchanged.\n`,
    );
  }
}

main();
