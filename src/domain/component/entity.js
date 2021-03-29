const {typekit} = require('basekits')
const StateManagerObject = require('state-manager-object')
const EventEmitterObject = require('event-emitter-object')

function Component(name, template, state=undefined, on=undefined, services=undefined) {
  this.name = name
  this.state = state
  this.on = on
  this.services = services
  this.template = template
  this.eventEmitter = EventEmitterObject.create()
  this.ready = false
  this.refs = {}

  this.initState()
  this.registerEvents()
}

Component.prototype.origin = window.location.origin

Component.prototype.initState = function initState() {
  if (typekit.isObject(this.state)) {
    this.hasState = true
    this.state = StateManagerObject.create(this.state)
  }
  else if (typekit.isFunction(this.state)) {
    this.hasState = true
    this.state = this.state.apply(this)
  }
  else {
    this.hasState = false
    this.state = undefined
  }
}

Component.prototype.getState = function getState() {
  return this.state ? this.state.getState() : {}
}

Component.prototype.updateState = function updateState(payload) {
  this.state.updateState(payload)
}

Component.prototype.hasState = function hasState() {
  return this.state ? true : false
}

Component.prototype.registerEvents = function registerEvents() {
  if (typekit.isObject(this.on)) {
    this.hasEvents = true
    Object.keys(this.on).map(k => this.eventEmitter.on(k, this.on[k]))
  }
  else {
    this.hasEvents = false
  }
}

Component.prototype.emit = function emit(name) {
  if (name == 'update' && this.ready === false) return;
  if (name == 'ready' && this.ready === true) return;
  if (name == 'ready') this.ready = true;

  return this.eventEmitter.emit.apply(this, [name])
}

Component.prototype.next = function next() {
  this.eventEmitter.emit('_next')
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
  const elements = parentDOMElement.querySelectorAll('[data-frond-services]')
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i]
    const description = element.dataset.frondServices.trim()
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
