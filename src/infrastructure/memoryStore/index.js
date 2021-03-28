const {objectkit} = require('basekits')

function MemoryStore() {
  this.store = {}
}

MemoryStore.prototype.set = function set(key, value) {
  this.store[key] = value
  return this
}

MemoryStore.prototype.get = function get(path, defaultValue=undefined) {
  return objectkit.getProp(this.store, path, defaultValue)
}

module.exports = new MemoryStore()
