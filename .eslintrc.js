module.exports = {
  extends: 'standard',
  rules: {
    'comma-dangle': [
      'error',
      {
        arrays: 'never',
        objects: 'always-multiline',
        imports: 'never',
        exports: 'never',
        functions: 'never',
      },
    ],
    'space-before-function-paren': false,
  },
}
