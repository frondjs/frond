const resolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')
const babel = require('rollup-plugin-babel')
const json = require('@rollup/plugin-json')
const {terser} = require('rollup-plugin-terser')

const suffix = process.env.USE_POLYFILLS == 'on' ? '.polyfilled' : ''

module.exports = {
  external: [
    'basekits', 'event-emitter-object', 'state-manager-object'
  ],
  input: 'src/index.js',
  output: [
    {
      format: 'amd',
      file: 'dist/frond.amd' + suffix + '.js'
    },
    {
      format: 'cjs',
      file: 'dist/frond.cjs' + suffix + '.js'
    },
    {
      format: 'es',
      file: 'dist/frond.es' + suffix + '.js'
    },
    {
      format: 'iife',
      file: 'dist/frond.iife' + suffix + '.js',
      name: 'Frond',
      globals: {
        'basekits': 'Basekits',
        'event-emitter-object': 'EventEmitterObject',
        'state-manager-object': 'StateManagerObject'
      }
    },
    {
      format: 'umd',
      file: 'dist/frond.umd' + suffix + '.js',
      name: 'Frond',
      globals: {
        'basekits': 'Basekits',
        'event-emitter-object': 'EventEmitterObject',
        'state-manager-object': 'StateManagerObject'
      }
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    babel(),
    json(),
    terser({sourcemap: false})
  ]
}
