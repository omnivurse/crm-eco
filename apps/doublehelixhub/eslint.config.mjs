import nextConfig from "eslint-config-next/core-web-vitals";

/**
 * doublehelixhub.com lint config.
 *
 * Mirrors apps/admin/eslint.config.mjs so the marketing sites lint the same
 * way. `npm run lint` in this app previously errored out with "all of the
 * files matching the glob pattern '.' are ignored" because the repo-root
 * eslint.config.js ignores `apps/**` and this app shipped no config of its
 * own — every app that lints has its own.
 */
/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
  ...nextConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
    },
  },
];
export default config;
