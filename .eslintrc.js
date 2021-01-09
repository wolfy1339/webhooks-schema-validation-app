module.exports = {
  'env': {
    'node': true,
    'es2021': true
  },
  'extends': [
    '@hellomouse/typescript'
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 12,
    'sourceType': 'module'
  },
  'plugins': [
    '@typescript-eslint'
  ],
  'rules': {
    'array-bracket-spacing': 'always'
  }
};
