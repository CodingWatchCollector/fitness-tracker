import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const dexieRestriction = {
  paths: [{ name: 'dexie', message: 'Only src/data/db.ts imports dexie.' }],
  patterns: [{ group: ['dexie-*'], message: 'No dexie-* packages.' }],
};

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dev-dist/',
      'playwright-report/',
      'test-results/',
      '.wrangler/',
      'node_modules/',
    ],
  },
  ...tseslint.configs.recommended,
  { ...jsxA11y.flatConfigs.strict, files: ['src/**/*.tsx'] },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: true } },
      ],
      'react-hooks/exhaustive-deps': ['error', { additionalHooks: '^useStoreQuery$' }],
      'no-restricted-imports': ['error', dexieRestriction],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^dexie/]',
          message: 'Only src/data/db.ts imports dexie.',
        },
        {
          selector: "CallExpression[callee.property.name='then'][arguments.length>=2]",
          message:
            'Use .then(onFulfilled).catch(onRejected) instead of passing a rejection handler to .then().',
        },
        {
          selector: "UnaryExpression[operator='void']",
          message:
            'Do not prefix calls with void. Call the function plainly, or chain .catch() when it can reject.',
        },
        {
          selector: "JSXAttribute[name.name='aria-modal']",
          message: 'Use a native <dialog> opened with showModal() instead of aria-modal.',
        },
        {
          selector: "JSXAttribute[name.name='role'][value.value=/^(alert)?dialog$/]",
          message:
            'Use a native <dialog> opened with showModal() instead of role="dialog" or "alertdialog".',
        },
        {
          selector: "JSXOpeningElement[name.name='button'] > JSXAttribute[name.name='disabled']",
          message:
            'Use <Button disabled> from src/ui/Button.tsx; it sets aria-disabled so the button stays focusable.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    rules: {
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
    },
  },
  {
    files: ['src/data/db.ts'],
    rules: { 'no-restricted-imports': 'off', 'no-restricted-syntax': 'off' },
  },
);
