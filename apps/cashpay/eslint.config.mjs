import nextConfig from 'eslint-config-next/core-web-vitals';

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
  ...nextConfig,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
];
export default config;
