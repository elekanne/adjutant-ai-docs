// @ts-check
// Site configuration for docs.thedutchdatadifference.nl
// Two products, each with its own independent version history.

import fs from 'fs';
import {themes as prismThemes} from 'prism-react-renderer';

// The live version label of each product. The sync workflows in the private
// repos update these files on every new minor release. Do not edit by hand
// once automation is running.
const readVersion = (file) => JSON.parse(fs.readFileSync(file, 'utf8')).version;
const aiCurrent = readVersion('./adjutant-ai_current.json');
const dwCurrent = readVersion('./domain-workspace_current.json');

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
        versions: {current: {label: aiCurrent}},
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
        versions: {current: {label: dwCurrent}},
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        respectPrefersColorScheme: true,
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
