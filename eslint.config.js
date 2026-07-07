const tseslint = require('typescript-eslint')

module.exports = tseslint.config(
  {
    ignores: ['node_modules/', 'out/', 'dev-dist/', '.claude/', 'eslint.config.js'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.web.json'],
        tsconfigRootDir: __dirname,
      },
    },
  },
)
