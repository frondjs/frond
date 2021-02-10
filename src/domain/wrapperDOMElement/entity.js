const {validationkit} = require('basekits')

function WrapperDOMElement(domelement) {
  this.element = domelement
}

WrapperDOMElement.prototype.cleanup = function cleanup() {
  this.element.innerHTML = ''
}

WrapperDOMElement.prototype.patch = function patch(htmlstr) {
  this.element.innerHTML = htmlstr
}

WrapperDOMElement.prototype.findChildren = function findChildren() {
  const matches = this.element.querySelectorAll('[data-frond-component]')
  return validationkit.isEmpty(matches) ? [] : matches
}

WrapperDOMElement.prototype.findChildByName = function findChildByName(name) {
  return this.element.querySelector('[data-frond-component="' + name + '"]')
}

module.exports = WrapperDOMElement
