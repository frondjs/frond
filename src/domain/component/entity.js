const {typekit, objectkit, functionkit} = require('basekits')
const StateManagerObject = require('state-manager-object')
const EventEmitterObject = require('event-emitter-object')

function Component(
  name, template, state=undefined, on=undefined, services=undefined, rehydrate=true,
  stateDefaults=undefined
) {
  this.name = name
  this.prevState = null
  this.state = state
  this.initialEvents = on
  this.services = services
  this.template = template
  this.eventEmitter = EventEmitterObject.create()
  this.ready = false
  this.refs = {}
  this.rehydrate = rehydrate

  this.initState(stateDefaults)
  this.registerEvents()
}


Component.prototype.origin = window.location.origin

Component.prototype.initState = function initState(stateDefaults) {
  if (typekit.isObject(this.state)) {
    this._hasState = true
    if (this.rehydrate === false) this.state._rehydrate_toggle = true
    this.state = StateManagerObject.create(Object.assign({}, this.state, stateDefaults || {}))
  }
  else if (typekit.isFunction(this.state)) {
    this._hasState = true
    const result = this.state.apply(this)
    if (this.rehydrate === false) result._rehydrate_toggle = true
    this.state = StateManagerObject.create(Object.assign({}, result, stateDefaults || {}))
  }
  else {
    this._hasState = false
    this.state = undefined
  }
}

Component.prototype.getState = function getState() {
  return this.state ? this.state.getState() : {}
}

Component.prototype.getPrevState = function getPrevState() {
  return this.prevState
}

Component.prototype.updateState = function updateState(payload) {
  this.prevState = this.getState()
  this.state.updateState(payload)
}

Component.prototype.hasState = function hasState() {
  return this._hasState
}

Component.prototype.registerEvents = function registerEvents() {
  if (typekit.isObject(this.initialEvents)) {
    this.hasEvents = true
    Object.keys(this.initialEvents).map(k => this.eventEmitter.on(k, this.initialEvents[k]))
  }
  else {
    this.hasEvents = false
  }
}

Component.prototype.on = function on(eventName, fn) {
  this.eventEmitter.on(eventName, fn)
}

Component.prototype.emit = function emit(name, args=[]) {
  if (name == 'update' && this.ready === false) return;
  if (name == 'ready' && this.ready === true) return;
  if (name == 'ready') this.ready = true

  return this.eventEmitter.emit.apply(this, [name, args])
}

Component.prototype.next = function next() {
  this.eventEmitter.emit('_next')
}

Component.prototype.restoreInputValues = function restoreInputValues(parentDOMElement) {
  const state = window.history.state

  if (state) {
    Object.keys(state).map(function(name) {
      const selector = `input[name="${name}"], select[name="${name}"], textarea[name="${name}"]`
      const node = parentDOMElement.querySelector(selector)
      if (node) {
        node.value = state[name]
      }
    })
  }
}

Component.prototype.rememberInputs = function rememberInputs(parentDOMElement) {
  const inputs = parentDOMElement.querySelectorAll('input,select,textarea')

  if (!inputs) return;

  const typesNotToBeTracked = [
    'file', 'button', 'checkbox', 'hidden', 'image', 'password', 'radio', 'reset',
    'submit'
  ]

  for (var i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const tagname = input.tagName.toLowerCase()

    if (!input.getAttribute('name')) continue;

    if (input.dataset.frondUncontrolled == 1) continue;

    const type = input.getAttribute('type')
    if (tagname == 'input' && typesNotToBeTracked.indexOf(type) !== -1) continue;

    const name = input.getAttribute('name')
    input.addEventListener('change', function(e) {
      const state = Object.assign({}, window.history.state || {}, {
        [name]: e.target.value
      })
      window.history.replaceState(state, null)
    })
  }
}

Component.prototype.findReferences = function findReferences(parentDOMElement) {
  const matches = parentDOMElement.querySelectorAll('[data-frond-ref]')
  for (var i = 0; i < matches.length; i++) {
    const name = matches[i].dataset.frondRef
    const multiple = name.indexOf('[]') !== -1
    if (multiple) {
      const nameFormatted = name.replace('[]', '')
      if (typekit.isArray(this.refs[nameFormatted])) this.refs[nameFormatted].push(matches[i])
      else this.refs[nameFormatted] = [matches[i]]
    }
    else {
      this.refs[name] = matches[i]
    }
  }
}

Component.prototype.findNativeLinks = function findNativeLinks(parentDOMElement,
    routeRepo, onNativeLinkClick, routesPrefix='') {
  const matches = parentDOMElement.querySelectorAll('a[href]')
  for (var i = 0; i < matches.length; i++) {
    const element = matches[i]
    const href = element.getAttribute('href')
    if (!href || href.slice(0, 1) == '#') continue;

    const startsWithSlash = href.slice(0, 1) == '/'
    const inAbsoluteFormat = href.indexOf(this.origin) !== -1
    if (!startsWithSlash && !inAbsoluteFormat) continue;

    const targetPath = routesPrefix + (inAbsoluteFormat ? href.slice(this.origin.length) : href)
    element.setAttribute('href', targetPath)
    if (routeRepo.hasMatch(targetPath)) {
      element.addEventListener('click', function(e) {
        return onNativeLinkClick(e, targetPath);
      })
    }
  }
}

Component.prototype.registerServices = function registerServices(parentDOMElement) {
  const elements = parentDOMElement.querySelectorAll('[data-frond-service]')
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]
    const description = element.dataset.frondService.trim()
    const items = description.split(' ')
    for (let j = 0; j < items.length; j++) {
      const [name, service] = items[j].split(':')
      this.registerService(element, name, service)
    }
  }
}

Component.prototype.registerService = function registerService(element, name, service) {
  const self = this

  switch (name) {
    case 'enter':
      element.addEventListener('keydown', function(event) {
        const ename = window.KeyCode.hot_key(window.KeyCode.translate_event(event))
        if ('Enter' == ename) {
          return self.services[service].apply(self, [event])
        }
      })
    break;
    case 'keydown':
      element.addEventListener('keydown', function(event) {
        const ename = window.KeyCode.hot_key(window.KeyCode.translate_event(event))
        return self.services[service].apply(self, [event, ename])
      })
    break;
    case 'keyup':
      element.addEventListener('keyup', function(event) {
        const ename = window.KeyCode.hot_key(window.KeyCode.translate_event(event))
        return self.services[service].apply(self, [event, ename])
      })
    break;
    case 'hover':
      element.addEventListener('mouseover', functionkit.debounce(function(event) {
        return self.services[service].apply(self, [event, true])
      }, 200, {trailing: true}))
      element.addEventListener('mouseleave', functionkit.debounce(function(event) {
        return self.services[service].apply(self, [event, false])
      }, 200, {trailing: true}))
    break;
    case 'change':
      if (element.tagName == 'INPUT' || element.tagName == 'TEXTAREA') {
        element.addEventListener('input', functionkit.debounce(function(event) {
          return self.services[service].apply(self, [event])
        }, 200, {trailing: true}))
      }

      if (element.tagName == 'SELECT') {
        element.addEventListener('change', function(event) {
          return self.services[service].apply(self, [event])
        })
      }
    break;
    default:
      element.addEventListener(name, function(event) {
        return self.services[service].apply(self, [event])
      })
  }
}

Component.prototype.call = function call(name, args=[]) {
  const services = this.services
  if (typeof services[name] != 'function') {
    throw new Error('No service found with the name ' + name)
  }
  return services[name].apply(this, args)
}

module.exports = Component
