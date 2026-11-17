import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

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
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
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
