module.exports = {
  parser: 'babel-eslint',
  extends: 'standard',
  env: {
    node: true,
    es6: true,
    mocha: true
  },
  rules: {
    'space-before-function-paren': ['error', 'never']
  }
}
