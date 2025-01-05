import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs['recommended'].rules,
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/consistent-type-assertions': 'error'
    }
  }
]; 