import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import prettier from "eslint-plugin-prettier";

export default [
  {
    ignores: ["node_modules", "dist"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      unicorn,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...unicorn.configs.recommended.rules,
      "prettier/prettier": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "unicorn/prefer-ternary-function": "off",
      "unicorn/no-null": "off",
      "no-unused-vars": "off",
      // Disable too strict rules for this project
      "unicorn/filename-case": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/prefer-dom-node-append": "off",
      "unicorn/switch-case-braces": "off",
      "unicorn/no-zero-fractions": "off",
      "unicorn/numeric-separators-style": "off",
      "unicorn/number-literal-case": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/prefer-ternary": "off",
      "unicorn/prefer-number-properties": "off",
      "unicorn/prefer-switch": "off",
      "unicorn/prefer-query-selector": "off",
      "unicorn/prefer-spread": "off",
    },
  },
];