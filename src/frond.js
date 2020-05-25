import {validationkit} from 'basekits'
import EventEmitterObject from 'event-emitter-object'
import {htmlParser} from './document-parsers'

function Frond() {
  EventEmitterObject.call(this, {})

  this._config = {}
  this.registry = {
    apps: {},
    networkClients: {},
    routers: {}
  }
  this.activeApp = undefined
  this.activeNetworkClient = undefined
  this.activeRouter = undefined
  this.documentParsers = {}

  this.registerApp('initial')
  this.configure({env: 'development', locale: 'xx_XX'})
  this.registerDocumentParser('html', htmlParser)
}

Frond.prototype = Object.create(EventEmitterObject.prototype)
Frond.prototype.constructor = Frond

Frond.prototype.registerDocumentParser = function registerDocumentParser(markup, fn) {
  this.documentParsers[markup] = fn
}

Frond.prototype.hasMarkupSupport = function hasMarkupSupport(markup) {
  return this.documentParsers.hasOwnProperty(markup)
}

Frond.prototype.parseDocument = function parseDocument(markup, data, component) {
  return this.documentParsers[markup].apply(component, [data])
}

Frond.prototype.configure = function configure(payload) {
  this._config = Object.assign({}, this._config, payload)
}

Frond.prototype.config = function config(name = undefined) {
  return typeof name == 'string' ? this._config[name] : this._config
}

Frond.prototype.log = function log(type, arg, ctx = undefined) {
  this.emit(type, [arg, ctx])
}

Frond.prototype.render = function render(componentID, parentNode) {
  const nodes = this.getComponent(componentID).getDOMNodes()
  for (let i = 0; i < nodes.length; i++) {
    parentNode.insertBefore(nodes[i], null)
  }
}

Frond.prototype.activate = function activate(name) {
  if (this.registry.apps.hasOwnProperty(name)) this.activeApp = name
  return this
}

Frond.prototype.registerComponent = function registerComponent(Component) {
  this.registry.apps[this.activeApp].components[Component.config.id] = Component
}

Frond.prototype.hasComponent = function hasComponent(name) {
  return this.registry.apps[this.activeApp].components.hasOwnProperty(name)
}

Frond.prototype.getComponent = function getComponent(name) {
  return this.registry.apps[this.activeApp].components[name]
}

Frond.prototype.registerNetworkClient = function registerNetworkClient(Client) {
  this.registry.networkClients[Client.config.id] = Client

  if (!this.activeNetworkClient) this.activeNetworkClient = Client.config.id
}

Frond.prototype.activateNetworkClient = function activateNetworkClient(id) {
  if (this.registry.networkClients.hasOwnProperty(id)) this.activeNetworkClient = id
  return this
}

Frond.prototype.getNetworkClient = function getNetworkClient() {
  return this.registry.networkClients[this.activeNetworkClient]
}

Frond.prototype.registerApp = function registerApp(name, config = {}) {
  this.registry.apps[name] = {
    config: Object.assign({}, {
      window: typeof window == 'undefined' ? {} : window,
      document: typeof document == 'undefined' ? {} : document
    }, config),
    components: {}
  }

  if (!this.activeApp) this.activeApp = name
}

Frond.prototype.registerRouter = function registerRouter(id, Router) {
  this.registry.routers[id] = Router
  if (!this.activeRouter) this.activeRouter = id
}

Frond.prototype.getRouter = function getRouter(id = undefined) {
  return this.registry.routers[typeof id == 'string' ? id : this.activeRouter]
}

Frond.prototype.setWindow = function setWindow(w) {
  this.registry.apps[this.activeApp].config.window = w
}

Frond.prototype.setDocument = function setDocument(d) {
  this.registry.apps[this.activeApp].config.document = d
}

Frond.prototype.getWindow = function getWindow() {
  return this.registry.apps[this.activeApp].config.window
}

Frond.prototype.getDocument = function getDocument() {
  return this.registry.apps[this.activeApp].config.document
}

export default new Frond()
