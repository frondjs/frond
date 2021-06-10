function AssetManager() {
  this.assets = Object.assign({}, window.frondjs.assetManifest || {})
}

AssetManager.prototype.has = function has(path) {
  return this.assets.hasOwnProperty(path)
}

AssetManager.prototype.get = function get(path) {
  if (!this.assets.hasOwnProperty(path)) {
    throw new Error('No such asset.')
  }
  return this.assets[path]
}

AssetManager.prototype.asObject = function asObject() {
  return this.assets
}

module.exports = new AssetManager()
