module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react'],
  extends: ['eslint:recommended'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
    'no-unused-vars': 'off',
    'no-constant-condition': ['error', { checkLoops: false }],
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};
