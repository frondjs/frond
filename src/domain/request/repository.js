const {objectkit} = require('basekits')
const eventEmitter = require('../../infrastructure/eventEmitter')

function RequestRepository() {
  this.path = null
}

RequestRepository.prototype.set = function set(payload) {
  const newPath = objectkit.getProp(payload, 'path')
  const isPathChanged = this.path != newPath
  this.path = newPath
  this.params = objectkit.getProp(payload, 'params')
  this.component = objectkit.getProp(payload, 'component')
  this.route = payload.route

  if (isPathChanged) {
    window.history.pushState(null, null, this.path)

    eventEmitter.emit('SCREEN', [{path: this.path}])
  }
}

RequestRepository.prototype.get = function get() {
  return {
    path: this.path,
    params: this.params
  }
}

module.exports = RequestRepository
