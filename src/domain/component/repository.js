const {ComponentNotFound} = require('./error')

function ComponentRepository() {
  this.components = []
}

ComponentRepository.prototype.insert = function insert(Component) {
  this.components.push(Component)
}

ComponentRepository.prototype.getComponentByName = function getComponentByName(name) {
  const matches = this.components.filter(c => c.name == name)
  if (!matches || matches.length < 1) {
    throw new ComponentNotFound('View component "' + name + '" not found.')
  }
  return matches[0]
}

module.exports = ComponentRepository
