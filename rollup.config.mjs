import babel from 'rollup-plugin-babel';
import pkg from './package.json';

export default {
  input: 'index.mjs',
  external: (
    Object.keys (pkg.peerDependencies)
    .concat (Object.keys (pkg.dependencies))
  ),
  output: {
    format: 'umd',
    name: 'warpedComponents',
    file: 'index.js',
    interop: false
  },
  plugins: [
    babel ({
      exclude: 'node_modules/**'
    })
  ]
};
