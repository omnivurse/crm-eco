import nextConfig from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "react/self-closing-comp": "warn",
      "react/jsx-no-undef": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.property.name='auth'][property.name='getUser']",
          message:
            "Direct supabase.auth.getUser() calls are prohibited. Use useClientAuth() hook for client components or getAuthUser()/verifyCrmAccess() from @/lib/supabase-server for server components.",
        },
        {
          selector:
            "CallExpression[callee.property.name='getUser'][callee.object.property.name='auth']",
          message:
            "Direct supabase.auth.getUser() calls are prohibited. Use useClientAuth() hook for client components or getAuthUser()/verifyCrmAccess() from @/lib/supabase-server for server components.",
        },
      ],
    },
  },
  // Override: allow direct auth.getUser() in auth infrastructure files
  {
    files: [
      "src/lib/supabase-server.ts",
      "src/lib/crm/mutations.ts",
      "src/middleware.ts",
      "src/lib/auth.ts",
      "src/hooks/useClientAuth.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
export default config;
