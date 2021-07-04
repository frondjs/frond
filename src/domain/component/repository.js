const {ComponentNotFound} = require('./error')

function ComponentRepository() {
  this.components = []
  this.defaultParamsStore = {}
}

ComponentRepository.prototype.insert = function insert(Component) {
  this.components.push(Component)
}

ComponentRepository.prototype.getComponentByName = function getComponentByName(name) {
  if (/[^0-9]/.test(name.slice(-1))) {
    name = name + '0'
  }

  const matches = this.components.filter(c => c.name == name)

  if (!matches || matches.length < 1) {
    throw new ComponentNotFound('View component "' + name + '" not found.')
  }

  return matches[0]
}

ComponentRepository.prototype.updateDefaultParams = function updateDefaultParams(payload) {
  this.defaultParamsStore = Object.assign({}, this.defaultParamsStore, payload)
}

ComponentRepository.prototype.getDefaultParams = function getDefaultParams(insname) {
  return this.defaultParamsStore[insname]
}

module.exports = ComponentRepository
