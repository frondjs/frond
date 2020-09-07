import {typekit, objectkit, validationkit, functionkit} from 'basekits'
import EventEmitterObject from 'event-emitter-object'
import scripter from 'dom-scripter'
import {htmlParser} from './document-parsers'

function resolveDependencyTestFunction(recipe) {
  if (!recipe.hasOwnProperty('test')) return Promise.resolve(null)
  if (!validationkit.isFunction(recipe.test)) return Promise.resolve(recipe.test)

  const result = recipe.test()

  if (validationkit.isPromise(result)) {
    return result
  }
  else {
    return Promise.resolve(result)
  }
}

function Frond() {
  EventEmitterObject.call(this, {})

  this._config = {}
  this.registry = {
    apps: {},
    networkClients: {},
    routers: {}
  }
  this.multilingual = false
  this.activeApp = undefined
  this.activeNetworkClient = undefined
  this.activeRouter = undefined
  this.documentParsers = {}
  this.translations = {}

  this.reDirectiveMatcher = /(@)((router)|(props)|(state))(\.)[a-zA-Z0-9_\-.]+(@((props)|(state))\.[a-zA-Z0-9_\-.]+)?/gm
  this.reComponentDirectiveMatcher = /(@)(component)(\.)[a-zA-Z0-9_\-.]+/m
  this.reRouterDirectiveMatcher = /(@)(router)(\.)[a-zA-Z0-9_\-.]+/
  this.reDocumentDirectiveMatcher = /(@)(document)(\.)[a-zA-Z0-9_\-.]+/
  this.domNodeAttrNamespaceMap = {
    'xlink:href': 'http://www.w3.org/1999/xlink',
    'xmlns': 'http://www.w3.org/2000/xmlns/'
  }
  this.commonComponentCandidates = []
  this.commonComponents = []

  this.registerApp('initial')
  this.configure({env: 'development', locale: 'xx_XX'})
  this.registerDocumentParser('html', htmlParser)

  if (this.getWindow().__FROND_SSR__) this.getWindow().Frond = this
}

Frond.prototype = Object.create(EventEmitterObject.prototype)
Frond.prototype.constructor = Frond

Frond.prototype.componentLifecycleEvents = [
  'init', 'insert', 'beforeUpdate', 'update', 'beforeFetch', 'fetch'
]

Frond.prototype.translate = function translate(locale, component, input) {
  if (typekit.isString(input) && input == '') return input

  const translation = objectkit.getProp(this.translations, [locale, component, input])

  if (!translation) {
    if (locale != this.config('locale'))
      this.log('warning', 'Translation not found for the following input.', {input: input, locale: locale})
    return input
  }

  return translation[1]
}

Frond.prototype._ = function _(input, component) {
  // translates for default locale
  const locale = this.config('locale')
  const translation = objectkit.getProp(this.translations, [locale, component, input])
  if (!translation) {
    return input
  }
  return translation[1]
}

Frond.prototype.loadTranslation = function loadTranslation(locale, obj) {
  this.translations[locale] = obj
  return this
}

Frond.prototype.isMultilingual = function isMultilingual() {
  return this.multilingual
}

Frond.prototype.inject = function inject(arg1, arg2) {
  return scripter.inject(arg1, arg2)
}

Frond.prototype.loadDependencies = function loadDependencies(obj) {
  const self = this
  const names = Object.keys(obj)
  const jobs = names.map(function(name) {
    return new Promise(function(resolve, reject) {
      const recipe = obj[name]

      resolveDependencyTestFunction(recipe)
        .then(function(testResult) {
          if (testResult === false || validationkit.isNull(testResult)) {
            const assetJobs = recipe.assets.map(function(asset) {
              return new Promise(function(res, rej) {
                if (validationkit.isEmpty(asset.id)) asset.id = name
                scripter.inject(asset.url, asset)
                  .then(function() {
                    return res()
                  })
                  .catch(function(err) {
                    self.emit('error', [err, {type: 'DEPENDENCY_LOAD_ERROR', name: name}])
                    return res()
                  })
              })
            })
            Promise
              .all(assetJobs)
              .then(function() {
                if (validationkit.isNotEmpty(recipe.waitForIt)) {
                  const interval = objectkit.getProp(recipe.waitForIt, 'interval')
                  const timeout = objectkit.getProp(recipe.waitForIt, 'timeout')
                  const cb = function() {return resolve(name)}
                  functionkit.waitForIt(recipe.waitForIt.condition, cb, interval, timeout)
                }
                else {
                  return resolve(name)
                }
              })
          }
          else {
            return resolve(name)
          }
        })
        .catch(function(err) {
          self.emit('error', [err, {type: 'DEPENDENCY_TEST_RESOLVE_ERROR', name: name}])
          return resolve()
        })
    })
  })

  return Promise.all(jobs)
}

Frond.prototype.registerDocumentParser = function registerDocumentParser(markup, fn) {
  this.documentParsers[markup] = fn
  return this
}

Frond.prototype.hasMarkupSupport = function hasMarkupSupport(markup) {
  return this.documentParsers.hasOwnProperty(markup)
}

Frond.prototype.parseDocument = function parseDocument(markup, data, component) {
  return this.documentParsers[markup].apply(component, [data])
}

Frond.prototype.configure = function configure(payload) {
  if (payload.hasOwnProperty('locale')) {
    payload.locale = this.getWindow().__FROND_SSR_LOCALE__
      ? this.getWindow().__FROND_SSR_LOCALE__
      : this.formatLocale(payload.locale)
  }
  if (payload.hasOwnProperty('locales')) {
    payload.locales = payload.locales.map(lo => this.formatLocale(lo))
    if (payload.locales.length > 0) this.multilingual = true
  }

  this._config = Object.assign({}, this._config, payload)

  return this
}

Frond.prototype.config = function config(name = undefined) {
  return typeof name == 'string' ? this._config[name] : this._config
}

Frond.prototype.isProd = function isProd() {
  return this.config('env') == 'production'
}

Frond.prototype.log = function log(type, arg, ctx = undefined) {
  this.emit(type, [arg, ctx])
}

Frond.prototype.render = function render(componentID, parentNode) {
  // renders root component
  const nodes = this.getComponent(componentID).render().getDOMNodes()
  parentNode.innerHTML = ''
  for (let i = 0; i < nodes.length; i++) {
    parentNode.insertBefore(nodes[i], null)
  }

  // rendering done but
  // view needs to be updated if there is a router configured to work with address bar
  const router = this.getRouter()
  if (validationkit.isNotEmpty(router)) {
    const reqpath = router.config.useAddressBar === true ? this.getWindow().location.pathname : ''
    const matchedRoute = router.match(reqpath)
    const defaultRoute = router.get(this.getComponent('router').getState().route.id)
    const route = validationkit.isEmpty(matchedRoute) ? defaultRoute : matchedRoute
    router.shift(route.id)
  }
}

Frond.prototype.activate = function activate(name) {
  if (this.registry.apps.hasOwnProperty(name)) this.activeApp = name
  return this
}

Frond.prototype.isComponentDirective = function isComponentDirective(input) {
  if (!typekit.isString(input)) return false
  return this.reComponentDirectiveMatcher.test(input)
}

Frond.prototype.registerComponent = function registerComponent(Component) {
  this.registry.apps[this.activeApp].components[Component.config.id] = Component

  // read component dependencies. track common components across parent components
  const matches = JSON
    .stringify(Component.config.view)
    .match(this.reComponentDirectiveMatcher)
  if (validationkit.isNotEmpty(matches)) {
    const names = matches.filter(s => this.isComponentDirective(s))
    names.map(
      n => this.commonComponentCandidates.indexOf(n) !== -1
        ? this.commonComponents.push(n)
        : this.commonComponentCandidates.push(n)
    )
  }
}

Frond.prototype.isCommonComponent = function isCommonComponent(n) {
  return this.commonComponents.indexOf(n) !== -1
}

Frond.prototype.hasCommonComponent = function hasCommonComponent(view) {
  const matches = JSON
    .stringify(view)
    .match(this.reComponentDirectiveMatcher)
  if (validationkit.isEmpty(matches)) return false
  const names = matches.filter(s => this.isComponentDirective(s))
  return names && names.length > 0
}

Frond.prototype.hasComponent = function hasComponent(name) {
  return this.registry.apps[this.activeApp].components.hasOwnProperty(name)
}

Frond.prototype.getComponent = function getComponent(name) {
  return this.registry.apps[this.activeApp].components[name]
}

Frond.prototype.getComponents = function getComponents() {
  return this.registry.apps[this.activeApp].components
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

Frond.prototype.formatLocale = function formatLocale(str) {
  str = str.toLowerCase()
  const parts = str.split(/[_\-]+/g)
  return parts.length === 1 ? str : parts[0] + '_' + parts[1].toUpperCase()
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
