import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist/"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },
  },
  {
    // config files run in Node
    files: ["*.config.js"],
    languageOptions: { globals: globals.node },
  },
  // turn off rules that conflict with Prettier
  prettier,
];
