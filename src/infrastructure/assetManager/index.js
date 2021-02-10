function AssetManager() {
  this.assets = Object.assign({}, window.frondjs.assetManifest || {})
}

AssetManager.prototype.get = function get(path) {
  if (!this.assets.hasOwnProperty(path)) {
    throw new Error('No such asset.')
  }
  return this.assets[path]
}

module.exports = new AssetManager()
