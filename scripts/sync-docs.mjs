#!/usr/bin/env node
// Copy documentation from a private product repo into this site.
//
//   node scripts/sync-docs.mjs --product <adjutant-ai|domain-workspace> \
//                              --source <private repo checkout> \
//                              --manifest <manifest file>
//
// Run from the root of this repo. The manifest lists exactly which files are
// published and where they land, so a private repo can reorganise its own docs/
// folder without changing any public URL.
//
// Nothing is written unless every check passes. Files this script did not
// write are never touched: index.md and _category_.json are maintained by hand.

import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS = ['adjutant-ai', 'domain-workspace'];
const SECTIONS = ['user/', 'admin/'];
const STATE_FILE = '.synced-files.json';
const MARKDOWN = new Set(['.md', '.mdx']);

const USAGE = `Usage:
  node scripts/sync-docs.mjs --product <${PRODUCTS.join('|')}> --source <dir> --manifest <file>

Manifest lines are "<source path> -> <target path>", one per line. Blank lines
and lines starting with # are ignored. Source paths are relative to --source,
target paths are relative to the product folder and must start with user/ or admin/.`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Paths inside the manifest are always POSIX style, on every platform, so that
// a manifest written on Linux CI behaves the same way locally.
const toPosix = (p) => p.split(path.sep).join('/');
const normalise = (p) => path.posix.normalize(p).replace(/^\.\//, '');
const isMarkdown = (p) => MARKDOWN.has(path.posix.extname(p).toLowerCase());
const escapes = (p) => p.split('/').includes('..');

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

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// Print every problem we found at once. Fixing a manifest one error per run is
// miserable, so each category is listed in full.
function abort(groups) {
  const present = groups.filter((g) => g.items.length > 0);
  const total = present.reduce((n, g) => n + g.items.length, 0);
  const lines = [`Sync aborted. ${total} problem${total === 1 ? '' : 's'} found.`];
  for (const group of present) {
    lines.push('', `${group.title} (${group.items.length}):`);
    for (const item of group.items) lines.push(`  ${item}`);
    if (group.hint) lines.push(`  ${group.hint}`);
  }
  fail(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function parseManifest(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const entries = [];
  const malformed = [];

  raw.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const text = line.trim();
    if (text === '' || text.startsWith('#')) return;

    const parts = text.split('->');
    if (parts.length !== 2) {
      malformed.push(`line ${lineNo}: ${text}`);
      return;
    }
    const source = parts[0].trim();
    const target = parts[1].trim();
    if (source === '' || target === '') {
      malformed.push(`line ${lineNo}: ${text}`);
      return;
    }
    entries.push({lineNo, source: toPosix(source), target: toPosix(target)});
  });

  return {entries, malformed};
}

// Every structural check runs before a single byte is written. Unparseable
// lines are carried in here so one run reports everything at once.
function validate(entries, malformed, sourceRoot) {
  const missing = [];
  const badSection = [];
  const traversal = [];
  const absolute = [];
  const duplicates = [];
  const seen = new Map();

  for (const entry of entries) {
    const {lineNo, source, target} = entry;

    if (path.posix.isAbsolute(source) || path.isAbsolute(source)) {
      absolute.push(`line ${lineNo}: source "${source}" must be relative to --source`);
    }
    if (path.posix.isAbsolute(target) || path.isAbsolute(target)) {
      absolute.push(`line ${lineNo}: target "${target}" must be relative to the product folder`);
    }
    if (escapes(source)) traversal.push(`line ${lineNo}: source "${source}" contains ".."`);
    if (escapes(target)) traversal.push(`line ${lineNo}: target "${target}" contains ".."`);

    entry.source = normalise(source);
    entry.target = normalise(target);

    if (!SECTIONS.some((s) => entry.target.startsWith(s))) {
      badSection.push(`line ${lineNo}: target "${entry.target}" must start with user/ or admin/`);
    }

    const previous = seen.get(entry.target);
    if (previous !== undefined) {
      duplicates.push(`line ${lineNo}: target "${entry.target}" already used on line ${previous}`);
    } else {
      seen.set(entry.target, lineNo);
    }

    const absoluteSource = path.join(sourceRoot, entry.source);
    if (!fs.existsSync(absoluteSource) || !fs.statSync(absoluteSource).isFile()) {
      missing.push(`line ${lineNo}: ${entry.source} (looked for ${absoluteSource})`);
    }
  }

  const groups = [
    {
      title: 'Malformed manifest lines',
      items: malformed,
      hint: 'expected "<source path> -> <target path>"',
    },
    {title: 'Absolute paths', items: absolute},
    {title: 'Paths containing ".."', items: traversal},
    {title: 'Targets outside user/ or admin/', items: badSection},
    {title: 'Duplicate targets', items: duplicates},
    {title: 'Missing source files', items: missing},
  ];
  if (groups.some((g) => g.items.length > 0)) abort(groups);
}

// ---------------------------------------------------------------------------
// Markdown link rewriting
// ---------------------------------------------------------------------------

// Fenced blocks and inline code are hidden before links are scanned. Without
// this a path inside a shell or SPL example would be rewritten, or worse would
// fail the run as an unlisted link.
function maskCode(text) {
  const stash = [];
  const keep = (match) => {
    stash.push(match);
    return `\u0000${stash.length - 1}\u0000`;
  };
  const masked = text
    .replace(/^([ \t]*)(```+|~~~+)[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm, keep)
    .replace(/(`+)(?:[^`]|(?!\1)`)*\1/g, keep);
  return {masked, stash};
}

const unmaskCode = (text, stash) => text.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);

// http(s), mailto, any other scheme, protocol-relative and site-absolute links
// are somebody else's business. Pure anchors stay put too.
function isExternal(target) {
  return (
    target === '' ||
    target.startsWith('#') ||
    target.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  );
}

// Split "./guide.md#install" into its path and its #anchor / ?query tail.
function splitSuffix(target) {
  const match = /^([^#?]*)([#?][\s\S]*)?$/.exec(target);
  return {pathPart: match[1], suffix: match[2] || ''};
}

// Resolve a link against the source file that contains it, then look it up in
// the manifest. A bare "./guide" is accepted for a manifest entry "guide.md".
function resolveLink(pathPart, sourcePath, bySource) {
  const fromDir = path.posix.dirname(sourcePath);
  const resolved = normalise(path.posix.join(fromDir, decodeURIComponent(pathPart)));
  if (resolved.startsWith('..')) return {resolved, entry: undefined};
  const entry =
    bySource.get(resolved) ||
    bySource.get(`${resolved}.md`) ||
    bySource.get(`${resolved}.mdx`);
  return {resolved, entry};
}

function rewriteLinks(text, entry, bySource, problems) {
  const {masked, stash} = maskCode(text);
  const fromDir = path.posix.dirname(entry.target);

  const rewrite = (rawTarget) => {
    const bracketed = /^<([\s\S]*)>$/.exec(rawTarget);
    const target = bracketed ? bracketed[1] : rawTarget;
    if (isExternal(target)) return rawTarget;

    const {pathPart, suffix} = splitSuffix(target);
    if (pathPart === '') return rawTarget;

    const {resolved, entry: destination} = resolveLink(pathPart, entry.source, bySource);
    if (!destination) {
      problems.push(`${entry.source} -> ${target}  (resolves to ${resolved})`);
      return rawTarget;
    }

    let next = path.posix.relative(fromDir, destination.target);
    if (!next.startsWith('.')) next = `./${next}`;
    next += suffix;
    return bracketed ? `<${next}>` : next;
  };

  let out = masked;

  // [text](dest) and ![alt](dest), with an optional "title".
  out = out.replace(
    /(!?\[(?:[^\][\\]|\\.)*\]\(\s*)(<[^>\n]*>|[^()\s]*)((?:\s+["'][^"'\n]*["'])?\s*\))/g,
    (_, head, dest, tail) => head + rewrite(dest) + tail,
  );

  // Reference definitions: [id]: dest "optional title"
  out = out.replace(
    /^([ \t]{0,3}\[(?:[^\][\\]|\\.)+\]:[ \t]*)(<[^>\n]*>|\S+)/gm,
    (_, head, dest) => head + rewrite(dest),
  );

  // Raw HTML in markdown, most often <img src="...">.
  out = out.replace(
    /(\b(?:src|href)\s*=\s*)(["'])([^"'>]*)\2/gi,
    (_, head, quote, dest) => head + quote + rewrite(dest) + quote,
  );

  return unmaskCode(out, stash);
}

// ---------------------------------------------------------------------------
// Front matter
// ---------------------------------------------------------------------------

// Insert sidebar_position without reformatting anything the author wrote.
function addSidebarPosition(text, position) {
  const opening = /^---\r?\n/.exec(text);
  if (!opening) {
    return `---\nsidebar_position: ${position}\n---\n\n${text}`;
  }
  const bodyStart = opening[0].length;
  const closing = /^---[ \t]*\r?$/m.exec(text.slice(bodyStart));
  if (!closing) {
    // Unterminated front matter. Leave the file exactly as it is and let the
    // Docusaurus build be the one to complain about it.
    return text;
  }
  const closingAt = bodyStart + closing.index;
  const frontMatter = text.slice(bodyStart, closingAt);
  if (/^sidebar_position[ \t]*:/m.test(frontMatter)) return text;

  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return (
    text.slice(0, closingAt) + `sidebar_position: ${position}${eol}` + text.slice(closingAt)
  );
}

// ---------------------------------------------------------------------------
// Previously synced files
// ---------------------------------------------------------------------------

function readPreviousState(productDir) {
  const file = path.join(productDir, STATE_FILE);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const files = Array.isArray(parsed) ? parsed : parsed.files;
    if (!Array.isArray(files)) return [];
    // Only ever delete inside the product folder, whatever the file claims.
    return files.filter((f) => typeof f === 'string' && !escapes(f) && !path.posix.isAbsolute(f));
  } catch (error) {
    fail(`Could not read ${path.join(productDir, STATE_FILE)}: ${error.message}`);
  }
}

// Remove directories left empty by a deletion, but never the section roots and
// never a directory that still holds a hand-maintained file.
function pruneEmptyDirs(productDir, startDir) {
  let dir = startDir;
  while (dir !== productDir && dir.startsWith(productDir)) {
    const name = toPosix(path.relative(productDir, dir));
    if (SECTIONS.includes(`${name}/`)) return;
    if (!fs.existsSync(dir) || fs.readdirSync(dir).length > 0) return;
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const {product, source, manifest} = args;
  if (!product || !source || !manifest) fail(`Missing required argument.\n\n${USAGE}`);
  if (!PRODUCTS.includes(product)) {
    fail(`Unknown product "${product}". Expected one of: ${PRODUCTS.join(', ')}`);
  }

  const sourceRoot = path.resolve(source);
  const manifestFile = path.resolve(manifest);
  const productDir = path.resolve(product);

  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    fail(`--source is not a directory: ${sourceRoot}`);
  }
  if (!fs.existsSync(manifestFile) || !fs.statSync(manifestFile).isFile()) {
    fail(`--manifest is not a file: ${manifestFile}`);
  }
  if (!fs.existsSync(productDir) || !fs.statSync(productDir).isDirectory()) {
    fail(`Product folder not found: ${productDir}. Run this from the root of the docs repo.`);
  }

  const {entries, malformed} = parseManifest(manifestFile);
  validate(entries, malformed, sourceRoot);
  if (entries.length === 0) fail(`Manifest has no entries: ${manifestFile}`);

  const bySource = new Map(entries.map((e) => [e.source, e]));

  // Position markdown pages by the order they appear within their own section.
  const counters = new Map(SECTIONS.map((s) => [s, 0]));
  for (const entry of entries) {
    if (!isMarkdown(entry.target)) continue;
    const section = SECTIONS.find((s) => entry.target.startsWith(s));
    const next = counters.get(section) + 1;
    counters.set(section, next);
    entry.position = next;
  }

  // Build every file in memory. A bad link must stop the run before we delete
  // the previous sync.
  const linkProblems = [];
  const planned = [];
  for (const entry of entries) {
    if (isMarkdown(entry.target)) {
      const original = fs.readFileSync(path.join(sourceRoot, entry.source), 'utf8');
      const linked = rewriteLinks(original, entry, bySource, linkProblems);
      planned.push({target: entry.target, contents: addSidebarPosition(linked, entry.position)});
    } else {
      planned.push({target: entry.target, copyFrom: path.join(sourceRoot, entry.source)});
    }
  }

  if (linkProblems.length > 0) {
    abort([
      {
        title: 'Links to local files that are not in the manifest',
        items: linkProblems,
        hint: 'add each file to the manifest, or remove the link',
      },
    ]);
  }

  // Everything checks out. Remove the previous sync, then write the new one.
  const previous = readPreviousState(productDir);
  let removed = 0;
  for (const relative of previous) {
    const absolute = path.join(productDir, relative);
    if (!fs.existsSync(absolute)) continue;
    fs.rmSync(absolute);
    pruneEmptyDirs(productDir, path.dirname(absolute));
    removed++;
  }

  for (const file of planned) {
    const absolute = path.join(productDir, file.target);
    fs.mkdirSync(path.dirname(absolute), {recursive: true});
    if (file.copyFrom) fs.copyFileSync(file.copyFrom, absolute);
    else fs.writeFileSync(absolute, file.contents);
  }

  const state = {
    product,
    syncedAt: new Date().toISOString(),
    files: planned.map((f) => f.target).sort(),
  };
  fs.writeFileSync(path.join(productDir, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);

  process.stdout.write(
    `${product}: wrote ${planned.length} file${planned.length === 1 ? '' : 's'}, ` +
      `removed ${removed} from the previous sync.\n`,
  );
}

main();
