const StateManagerObject = require('state-manager-object/source')
const Navigation = require('../navigation')
const domEvents = require('../domEvents')

function FrondComponent(initialState, initialEvents) {
  StateManagerObject.call(this, initialState, initialEvents)

  this.kit = null

  /*
  * The id property is something unique across all components in the frond instance
  * It may be specified by user or frond itself.
  */
  this.id = null
  // False if id specified by user.
  this.idAutoAssigned = null

  this.parent = null
  this.roots = []
  this.index = 0
  this.input = null

  /*
  * The property _render will be filled up by user.
  * Default value is other than null because null is a valid _render value.
  */
  this._render = '__NOT_SPECIFIED__'

  this.renderFn = null
  this.renderFnResult = null
  this.children = null
  this.dontRunChildrenResolverAgain = false

  this.type = null
  this.domNodeTag = null
  this.domNodeType = null
  this.dom = null
  this.domEventListeners = {}
  this.resolvedHTMLAttrs = null
  this.needsRemount = false
  this.needsMount = true
  this.destroyed = false
  this.analytics = true
  this.router = null

  /*
  *
  * Represents the visibility of the component on the screen
  * -1 means visibility detection has not yet been run.
  * 0 means not visible.
  * 1 means partially visible.
  * 2 means fully visible.
  *
  */
  this.visibility = -1
  this.visibilityChanges = []
}

FrondComponent.prototype = Object.create(StateManagerObject.prototype)
FrondComponent.prototype.constructor = FrondComponent

FrondComponent.prototype.render = function render() {
  if (this.kit.isNull(this.dom)) {
    // initial render. dom element and event listeners will never be updated again.
    this.createDOMElement()
    this.registerDOMEventListeners()
  }

  this.updateHTMLAttrs()

  //this.updateChildren()
}

FrondComponent.prototype.createDOMElement = function createDOMElement() {
  if (this.domNodeType == 'plaintext') {
    this.dom = document.createTextNode(this.input)
  }
  else if (this.domNodeType == 'html') {
    this.dom = document.createElement(this.domNodeTag)
  }
  else if (this.domNodeType == 'svg') {
    this.dom = document.createElementNS('http://www.w3.org/2000/svg', this.domNodeTag)
  }
  else {
    this.dom = null
  }
}

FrondComponent.prototype.registerDOMEventListeners = function registerDOMEventListeners() {
  const self = this
  const names = Object.keys(self._events)
  if (!names || names.length === 0) return;

  for (let i = 0; i < names.length; i++) {
    const eventName = names[i]
    if (domEvents.hasOwnProperty(eventName)) {
      // will be fired on event propagation
      self.domEventListeners[eventName] = function(e) {
        if (eventName == 'click') {
          // prevent url bar changes on hashtag clicks
          // we also prevent auto url bar changes on clicks which is handled by viewer, not here.
          const href = self.kit.getProp(self.resolvedHTMLAttrs, 'href', '')
          if (href.slice(0, 1) == '#') e.preventDefault()
        }
        // fire all functions specified by user for eventName.
        if (self.kit.isArray(self._events[eventName])) {
          return self._events[eventName].map(function(fn) {
            return fn.apply(self, [e])
          })
        }
        else {
          return self._events[eventName].apply(self, [e])
        }
      }

      self.dom.addEventListener(eventName, self.domEventListeners[eventName], false)
    }
  }
}

FrondComponent.prototype.updateHTMLAttrs = function updateHTMLAttrs() {
  const htmlAttrs = this.kit.getProp(this.input, 'attrs', {})
  const newAttrs = this.resolveHTMLAttrs(htmlAttrs)
  if (!this.kit.isEqual(this.resolvedHTMLAttrs, newAttrs)) {
    this.resolvedHTMLAttrs = newAttrs
    this.patchHTMLAttrs()
  }
}

FrondComponent.prototype.resolveHTMLAttrs = function resolveHTMLAttrs(attrs) {
  const self = this
  const keys = self.kit.isObject(attrs)
    ? Object.keys(attrs)
    : []
  if (!keys || keys.length === 0) return {};

  return keys.reduce(function(memo, key) {
    const parsed = self.resolveHTMLAttrVal(attrs[key], key)
    if (self.kit.isString(parsed) ||
      (key == 'style' && self.kit.isObject(parsed)) ||
      self.kit.isBoolean(parsed)
    ) {
      memo[key] = parsed
    }
    return memo
  }, {})
}

FrondComponent.prototype.resolveHTMLAttrVal = function resolveHTMLAttrVal(v, key) {
  const type = this.kit.getType(v)

  if (type == 'string') return v
  else if (type == 'number') return v.toString()
  else if (type == 'object' && key == 'style') return v
  else if (type == 'object') return JSON.stringify(v)
  else if (type == 'array') return JSON.stringify(v)
  else if (type == 'boolean') return (v === true ? '' : false)
  else if (type == 'function') return this.resolveHTMLAttrVal(v.apply(this), key)
  else if (type == 'date') return v.toISOString()
  else return false
}

FrondComponent.prototype.patchHTMLAttrs = function patchHTMLAttrs() {
  const self = this
  const keys = self.kit.isObject(self.resolvedHTMLAttrs)
    ? Object.keys(self.resolvedHTMLAttrs)
    : []
  if (!keys || keys.length === 0) return;

  keys.map(function(key) {
    const parsed = self.resolvedHTMLAttrs[key]
    if (key == 'style' && self.kit.isObject(parsed)) {
      const jsStyleProps = Object.keys(parsed)
      jsStyleProps.map(function(prop) {
        if (self.dom.style[prop] != parsed[prop]) {
          self.dom.style[prop] = parsed[prop]
        }
      })
    }
    else {
      if (self.dom.hasAttribute(key)) {
        if (parsed === false) self.dom.removeAttribute(key)
        else if (self.dom.getAttribute(key) != parsed) self.dom.setAttribute(key, parsed)
        else {}
      }
      else {
        if (parsed !== false) self.dom.setAttribute(key, parsed)
      }
    }
  })

  return;
}

FrondComponent.prototype.updateChildren = function updateChildren() {
  if (this.dontRunChildrenResolverAgain) {
    this.dontRunChildrenResolverAgain = false
    return;
  }

  const resolved = this.resolveChildren()

  if (!this.kit.isEqual(resolved, this.getChildren())) {
    this.children = resolved
  }
}

FrondComponent.prototype.resolveChildren = function resolveChildren() {
  if (this._render == '__NOT_SPECIFIED__') {
    // initial render
    this._render = this.kit.getProp(this.input, 'render', null)
  }

  if (this.kit.isFunction(this._render)) {
    this.renderFn = this._render
    this.renderFnResult = this.renderFn.apply(this, [])

    if (this.kit.isArray(this.renderFnResult)) return Array.from(this.renderFnResult)
    else if (this.kit.isNull(this.renderFnResult)) return null
    else return [this.renderFnResult]
  }
  else if (this.kit.isArray(this._render)) return Array.from(this._render)
  else if (this.kit.isNull(this._render)) return null
  else return [this._render]
}

FrondComponent.prototype.getChildren = function getChildren() {
  return this.children
}

FrondComponent.prototype.haveChildrenChanged = function haveChildrenChanged() {
  this.dontRunChildrenResolverAgain = true

  const resolved = this.resolveChildren()
  if (!this.kit.isEqual(resolved, this.getChildren())) {
    this.children = resolved
    return true;
  }
  else {
    return false;
  }
}

FrondComponent.prototype.shouldRemount = function shouldRemount() {
  return this.needsRemount
}

FrondComponent.prototype.shouldMount = function shouldMount() {
  return this.needsMount
}

FrondComponent.prototype.getClassNames = function getClassNames() {
  if (this.dom && this.domNodeType != 'plaintext') {
    const dc = this.dom.getAttribute('class')
    if (this.kit.isEmpty(dc)) return ''
    return dc
  }
  else {
    return this.kit.getProp(this.resolvedHTMLAttrs, 'class', '')
  }
}

FrondComponent.prototype.removeAllEventListeners = function removeAllEventListeners() {
  const self = this
  const names = Object.keys(self._events)
  if (!names || names.length === 0) return;

  for (let i = 0; i < names.length; i++) {
    const eventName = names[i]
    if (domEvents.hasOwnProperty(eventName)) {
      self.dom.removeEventListener(eventName, self.domEventListeners[eventName], false)
    }

    self.removeListeners(eventName)
  }
}

FrondComponent.prototype.removeDOMElement = function removeDOMElement() {
  if (this.dom && this.dom.parentNode) {
    this.dom.parentNode.removeChild(this.dom)
  }
}

FrondComponent.prototype.isFullyVisible = function isFullyVisible() {
  if (this.visibility !== 2) {
    this.visibility = 2
    this.visibilityChanges.push({v: 2, t: Date.now()})
    this.emit('visible')
  }
}

FrondComponent.prototype.isPartiallyVisible = function isPartiallyVisible() {
  if (this.visibility !== 1) {
    this.visibility = 1
    this.visibilityChanges.push({v: 1, t: Date.now()})
    this.emit('partiallyVisible')
  }
}

FrondComponent.prototype.isHidden = function isHidden() {
  if (this.visibility !== 0) {
    this.visibility = 0
    this.visibilityChanges.push({v: 0, t: Date.now()})
    this.emit('hidden')
  }
}

FrondComponent.prototype.destroy = function destroy() {
  this.emit('beforeDestroy')
  this.removeAllEventListeners()
  this.removeDOMElement()
  this.destroyed = true
  this.emit('destroy')
}

FrondComponent.prototype.isStatic = function isStatic() {
  return this.kit.isEqual(this.getState(), {_tick: false})
}

FrondComponent.prototype.getTextContent = function getTextContent() {
  if (this.type == 'plaintext') {
    if (this.dom) return this.dom.textContent
  }
  else {
    if (this.dom) return this.dom.innerText
  }
  return null
}

FrondComponent.prototype.haveState = function haveState() {
  return !this.kit.isEqual({_tick: false}, this.getState())
}

FrondComponent.prototype.createRouter = function createRouter(
  initialEvents, routerConfig
) {
  this.router = new Navigation(initialEvents, routerConfig)
  this.router.kit = this.kit
  this.router.build(routerConfig.components)

  return this.router
}

FrondComponent.prototype.getRouter = function getRouter() {
  return this.router
}

FrondComponent.prototype.rerender = function rerender() {
  this.updateState({ _tick: !this.getState()._tick })
}

FrondComponent.prototype.isFetching = function isFetching() {
  return this.kit.isNull(this.getState()._data)
}

FrondComponent.prototype.hasFetchError = function hasFetchError(nodeName) {
  const d = this.getState()._data

  if (!this.kit.isEmpty(nodeName)) {
    if (this.kit.getProp(d, [nodeName, 'error'])) {
      return true
    }
  }
  else {
    if (this.kit.getProp(d, 'error')) {
      return true
    }
  }

  return false
}

FrondComponent.prototype.data = function data() {
  return this.getState()._data
}

FrondComponent.prototype.exportAs = function exportAs(format = 'json') {

}

module.exports = FrondComponent
