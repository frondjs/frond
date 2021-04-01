const StateManagerObject = require('state-manager-object')

function Config() {
  this.internalsPrefix = 'FROND_'
  this.state = StateManagerObject.create({})
}

Config.prototype.set = function set(k, v) {
  this.state.updateState({[k]: v})
}

Config.prototype.setInternal = function setInternal(k, v) {
  return this.set(this.internalsPrefix + k, v)
}

Config.prototype.get = function get(k) {
  const state = this.state.getState()
  return !state.hasOwnProperty(k) ? undefined : state[k]
}

Config.prototype.getInternal = function getInternal(k) {
  return this.get(this.internalsPrefix + k)
}

Config.prototype.asObject = function asObject() {
  return this.state.getState()
}

module.exports = new Config()
