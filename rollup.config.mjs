import pkg from './package.json';

export default {
  input: 'index.mjs',
  external: Object.keys (pkg.peerDependencies),
  output: {
    format: 'umd',
    name: 'warpedComponents',
    file: 'index.js'
  }
};
