import nextConfig from "eslint-config-next/core-web-vitals";

/**
 * FB-2 — toast copy guard (decision D9: "error on walked-path globs, warn
 * elsewhere; the vitest ratchet is the load-bearing guard").
 *
 * Flags `toast.success('…')` / `toast.error(`…`)` — a *literal* first argument
 * means the wording was typed at the call site instead of coming from
 * `toastCopy.*`, which is how the CRM ended up with five phrasings for
 * "note added". A local rule rather than another `no-restricted-syntax`
 * selector because (a) severity has to differ per path and `no-restricted-syntax`
 * is one rule with one severity — folding the toast selectors into the existing
 * block would have dragged the `auth.getUser()` guard down to "warn" outside the
 * walked paths — and (b) the AST check also catches `toast?.success('…')`, which
 * a selector string misses.
 *
 * It is bypassable on purpose (`const m = '…'; toast.success(m)`): the load-bearing
 * guard is `src/lib/crm/toast-raw-ratchet.test.ts`, which counts raw sites per
 * directory and fails when a count goes up.
 */
const TOAST_METHODS = new Set(["success", "error", "info", "warning", "loading"]);

/** @type {import("eslint").Rule.RuleModule} */
const noRawToastCopy = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Toast wording must come from toastCopy.* so one outcome has one phrasing.",
    },
    schema: [],
    messages: { raw: "Use toastCopy.* from @/lib/crm/toast-copy" },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed) return;
        if (callee.object.type !== "Identifier" || callee.object.name !== "toast") return;
        if (callee.property.type !== "Identifier") return;
        if (!TOAST_METHODS.has(callee.property.name)) return;
        const first = node.arguments[0];
        if (!first) return;
        const isRaw =
          first.type === "TemplateLiteral" ||
          (first.type === "Literal" && typeof first.value === "string");
        if (!isRaw) return;
        context.report({ node, messageId: "raw" });
      },
    };
  },
};

const crmToastPlugin = { rules: { "no-raw-toast-copy": noRawToastCopy } };

/**
 * Paths the persona walk covers. Patterns are `**\/`-prefixed on purpose: flat
 * config resolves relative `files` globs against the *cwd*, not the config file,
 * so a bare "src/…" pattern silently stops matching when the hook runs eslint
 * from the repo root (`--config apps/crm/eslint.config.mjs`).
 */
const WALKED_PATHS = [
  "**/src/components/zoho/ModuleShell.tsx",
  "**/src/components/zoho/QuickCreateDrawer.tsx",
  "**/src/components/crm/records/**/*.{ts,tsx}",
  "**/src/components/crm/views/**/*.{ts,tsx}",
  "**/src/components/crm/filters/**/*.{ts,tsx}",
  "**/src/components/crm/shell/**/*.{ts,tsx}",
  "**/src/components/crm/create/**/*.{ts,tsx}",
  "**/src/app/crm/r/**/*.{ts,tsx}",
  "**/src/app/crm/modules/**/*.{ts,tsx}",
];

/** Files whose whole job is to hold the copy. */
const TOAST_COPY_SOURCES = [
  "**/src/lib/crm/toast-copy.ts",
  "**/src/lib/crm/undo-delete.ts",
  "**/src/lib/crm/list-empty-state.ts",
];

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextConfig,
  {
    plugins: { "crm-toast": crmToastPlugin },
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "react/self-closing-comp": "warn",
      "react/jsx-no-undef": "error",
      // Everywhere outside the walked paths: visible, not blocking (FB-10, the
      // repo-wide codemod, is owner-gated and explicitly not part of this wave).
      "crm-toast/no-raw-toast-copy": "warn",
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
  // The persona walk's own surface: raw toast copy is an error there.
  {
    files: WALKED_PATHS,
    rules: { "crm-toast/no-raw-toast-copy": "error" },
  },
  // The copy modules themselves are where the literals are supposed to live.
  {
    files: TOAST_COPY_SOURCES,
    rules: { "crm-toast/no-raw-toast-copy": "off" },
  },
  // Override: allow direct auth.getUser() in auth infrastructure files
  {
    files: [
      "**/src/lib/supabase-server.ts",
      "**/src/lib/crm/mutations.ts",
      "**/src/middleware.ts",
      "**/src/lib/auth.ts",
      "**/src/hooks/useClientAuth.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
export default config;
