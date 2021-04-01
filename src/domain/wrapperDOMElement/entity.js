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
  const node = this.element.querySelector('[data-frond-component="' + name + '"]')

  if (node) {
    return node
  }

  const lastchar = name.slice(-1)

  if (lastchar == 0) {
    const node2 = this.element.querySelector('[data-frond-component="' + name.slice(0, -1) + '"]')

    if (node2) {
      return node2
    }
  }

  if (/[^0-9]/.test(lastchar)) {
    const node3 = this.element.querySelector('[data-frond-component="' + name + '0"]')

    if (node3) {
      return node3
    }
  }

  return null
}

module.exports = WrapperDOMElement
