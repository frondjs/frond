const EventEmitter = require('event-emitter-object')

function Network(initialEvents, config) {
  EventEmitter.call(this, initialEvents)

  this.id = config.id
  this.resolver = config.resolver
}

Network.prototype = Object.create(EventEmitter.prototype)
Network.prototype.constructor = Network

Network.prototype.request = function request(payload, component) {
  const self = this

  component.emit('beforeFetch')
  self.emit('beforeFetch')

  self.resolver
    .apply(self, [payload])
    .then(function(data) {
      component.updateState({ _data: data })

      component.emit('afterFetch')
      self.emit('afterFetch')
    })
    .catch(function(err) {
      self.emit('error', [err])
    })
}

module.exports = Network
