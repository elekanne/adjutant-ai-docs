// @ts-check
// Site configuration for docs.thedutchdatadifference.nl
// Two products, each with its own independent version history.

import fs from 'fs';
import {themes as prismThemes} from 'prism-react-renderer';

// Version labels come from three files per product, all written by
// scripts/publish.mjs when a release tag is pushed. Do not edit by hand once
// automation is running.
//
//   <product>_current.json    {"version": "2.5", "release": "2.5.9"}
//   <product>_releases.json   {"2.4": "2.4.7"}  last release of each frozen minor
//   <product>_versions.json   ["2.4"]           written by docs:version
//
// URLs stay on the minor (/adjutant-ai/2.4/) while the label shows the exact
// release a reader is looking at.
// A version file that is missing, half-written or from an older shape must
// never take the build down: a release goes out at the moment these files are
// being rewritten, so every read here degrades instead of throwing.
const readJson = (file) => {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.warn(`[versions] ignoring ${file}: ${error.message}`);
    return null;
  }
};

function docsVersions(product) {
  const current = readJson(`./${product}_current.json`) ?? {};
  const releases = readJson(`./${product}_releases.json`) ?? {};
  const frozenRaw = readJson(`./${product}_versions.json`);
  const frozen = Array.isArray(frozenRaw) ? frozenRaw : [];

  // Each label falls back a step at a time: the exact release, then the minor,
  // then whatever Docusaurus would have shown on its own.
  const versions = {};
  const currentLabel = current.release ?? current.version;
  if (currentLabel) versions.current = {label: String(currentLabel)};

  for (const minor of frozen) {
    if (typeof minor !== 'string') continue;
    versions[minor] = {label: String(releases[minor] ?? minor)};
  }
  return versions;
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'The Dutch Data Difference Docs',
  tagline: 'Documentation for Adjutant AI and Adjutant AI Domain Workspace',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://docs.thedutchdatadifference.nl',
  baseUrl: '/',

  // Warn instead of failing the build on a broken link, so one bad link
  // never blocks a release. Tighten to 'throw' once the docs are stable.
  onBrokenLinks: 'warn',

  markdown: {
    // Treat .md files as plain Markdown instead of MDX. This stops characters
    // like < and { in normal text (common in SPL examples) from breaking the build.
    format: 'detect',
    // ```mermaid fences render as diagrams. This works in plain .md as well as
    // MDX, because Docusaurus rewrites the fence before either parser runs.
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: false, // docs are defined per product in `plugins` below
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'adjutant-ai',
        path: 'adjutant-ai',
        routeBasePath: 'adjutant-ai',
        sidebarPath: './sidebars-adjutant-ai.js',
        lastVersion: 'current',
        versions: docsVersions('adjutant-ai'),
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'domain-workspace',
        path: 'domain-workspace',
        routeBasePath: 'domain-workspace',
        sidebarPath: './sidebars-domain-workspace.js',
        lastVersion: 'current',
        versions: docsVersions('domain-workspace'),
      },
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      // Local search. The index is built at build time and shipped with the
      // site, so no request leaves the reader's browser for a search service.
      require.resolve('@easyops-cn/docusaurus-search-local'),
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */
      ({
        hashed: true,
        indexBlog: false,
        docsDir: ['adjutant-ai', 'domain-workspace'],
        docsRouteBasePath: ['/adjutant-ai', '/domain-workspace'],
        // One search context per product, so a reader inside Adjutant AI never
        // gets Domain Workspace hits and the other way round. The plugin picks
        // the context from the current path.
        searchContextByPaths: [
          {label: 'Adjutant AI', path: 'adjutant-ai'},
          {label: 'Domain Workspace', path: 'domain-workspace'},
        ],
        // On the landing page there is no product context, so search everything
        // rather than nothing.
        useAllContextsWithNoSearchContext: true,
        hideSearchBarWithNoSearchContext: false,
        // Fallback for pages outside a docs plugin. On a docs page the plugin
        // uses that page's own product, so each product keeps its own version.
        docsPluginIdForPreferredVersion: 'adjutant-ai',
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        respectPrefersColorScheme: true,
      },
      mermaid: {
        theme: {light: 'neutral', dark: 'dark'},
        options: {
          // Only `theme` switches with the colour mode; these variables are
          // shared by both. So the palette is deliberately mode-agnostic: navy
          // fills with light text and gold edges read correctly on a white page
          // and on a dark one, and the base theme supplies the surroundings.
          themeVariables: {
            fontFamily: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
            primaryColor: '#14233f',
            primaryTextColor: '#f4f6fa',
            primaryBorderColor: '#b8860b',
            secondaryColor: '#1f3a68',
            secondaryTextColor: '#f4f6fa',
            secondaryBorderColor: '#b8860b',
            tertiaryColor: '#2a4c87',
            tertiaryTextColor: '#f4f6fa',
            tertiaryBorderColor: '#b8860b',
            lineColor: '#b8860b',
          },
        },
      },
      navbar: {
        title: 'The Dutch Data Difference',
        items: [
          {to: '/adjutant-ai/', label: 'Adjutant AI', position: 'left', activeBasePath: 'adjutant-ai'},
          {
            type: 'docsVersionDropdown',
            docsPluginId: 'adjutant-ai',
            position: 'left',
          },
          {to: '/domain-workspace/', label: 'Domain Workspace', position: 'left', activeBasePath: 'domain-workspace'},
          {
            type: 'docsVersionDropdown',
            docsPluginId: 'domain-workspace',
            position: 'left',
          },
          {
            href: 'https://www.thedutchdatadifference.nl',
            label: 'thedutchdatadifference.nl',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Products',
            items: [
              {label: 'Adjutant AI', to: '/adjutant-ai/'},
              {label: 'Domain Workspace', to: '/domain-workspace/'},
            ],
          },
          {
            title: 'Company',
            items: [
              {label: 'Website', href: 'https://www.thedutchdatadifference.nl'},
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} ITMIP BV, The Dutch Data Difference`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.vsDark,
      },
    }),
};

export default config;
