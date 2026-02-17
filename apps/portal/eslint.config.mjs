import nextConfig from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
];
export default config;
