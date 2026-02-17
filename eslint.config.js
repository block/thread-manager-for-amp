import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Shared rule overrides for strictTypeChecked.
const sharedStrictOverrides = {
  // TODO: Re-enable when typescript-eslint supports ESLint 10 (https://github.com/typescript-eslint/typescript-eslint/issues/11952)
  '@typescript-eslint/no-deprecated': 'off',
  '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false, properties: false, arguments: false } }],
}

export default defineConfig([
  globalIgnores(['dist', 'shared/dist']),
  {
    files: ['src/**/*.{ts,tsx}', 'shared/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
      ...sharedStrictOverrides,
    },
  },
  {
    files: ['server/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
      ...sharedStrictOverrides,
    },
  },
  {
    files: ['src/contexts/**/*.tsx', 'src/components/**/*.tsx', 'src/components/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
