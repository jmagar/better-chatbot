import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ESLint 9 flat config for Next.js 15 + TypeScript.
 *
 * - Adapts the classic `extends: ["next/core-web-vitals", "next/typescript"]`
 *   config via FlatCompat.
 * - Applies local overrides equivalent to the previous .eslintrc.json only to
 *   JS/TS source files.
 */
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Previous extends: ["next/core-web-vitals", "next/typescript"].
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),

  // Local project overrides.
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default eslintConfig;
