const config = require('./electron-builder.config.cjs')

if (!process.env.ORCA_LOCAL_BUILD_VERSION?.includes('colors.')) {
  throw new Error('Build Orca Colors using config/scripts/build-orca-colors.mjs.')
}

module.exports = {
  ...config,
  productName: 'Orca Colors',
  extraMetadata: {
    ...config.extraMetadata,
    productName: 'Orca Colors',
    version: process.env.ORCA_LOCAL_BUILD_VERSION
  },
  publish: null
}
