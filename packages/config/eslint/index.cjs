/**
 * @cornerman/config · 共享 ESLint 配置（占位）
 * 各 app/package 通过 extends 复用。后续补充 React / NestJS 细则。
 */
module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  ignorePatterns: ["dist", ".next", "node_modules", "*.cjs"],
  rules: {}
};
