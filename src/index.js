const {typekit} = require('basekits')
const metapatcher = require('metapatcher')
const eventEmitter = require('./infrastructure/eventEmitter')
const {match} = require('path-to-regexp')
const nunjucks = require('nunjucks/browser/nunjucks-slim.min.js')
require('./infrastructure/dom/keyCode')
const DOMScripterLib = require('dom-scripter')
const ExternalRepository = require('./domain/external/repository')
const RouteRepository = require('./domain/route/repository')
const ComponentRepository = require('./domain/component/repository')
const RequestRepository = require('./domain/request/repository')
const WrapperDOMElement = require('./domain/wrapperDOMElement/entity')
const i18n = require('./infrastructure/i18n')
const config = require('./infrastructure/config')

function FrondFramework() {
  const _setExternals = require('./application/setExternals')
  const _registerRoute = require('./application/registerRoute')
  const _registerComponent = require('./application/registerComponent')
  const _goto = require('./application/goto')

  const scripter = DOMScripterLib.create()
  const externalsRepository = new ExternalRepository(scripter)
  const routeRepository = new RouteRepository()
  const componentRepository = new ComponentRepository()
  const requestRepository = new RequestRepository()

  const ctx = {
    externalsRepository: externalsRepository,
    routeRepository: routeRepository,
    componentRepository: componentRepository,
    requestRepository: requestRepository,
    nunjucks: null,
    config: config
  }

  function init(domelement, settings={}) {
    ctx.rootWrapperDOMElement = new WrapperDOMElement(domelement)

    const env = new nunjucks.Environment()
    env.addGlobal('_', function(v) {
      return window._(v)
    })
    ctx.nunjucks = env

    if (i18n.isNotDefaultLocale() && i18n.isLocaleCarriedOnAddressBar()) {
      settings.ROUTES_PREFIX = '/' + i18n.getAppLocale(true)
    }

    const validSettings = ['ROUTES_PREFIX']
    if (settings.ROUTES_PREFIX) {
      settings.ROUTES_PREFIX = ('/' + settings.ROUTES_PREFIX).replace(/\/\//, '/')
    }
    const settingKeys = Object.keys(settings)
    for (var i = 0; i < settingKeys.length; i++) {
      const k = settingKeys[i]
      if (validSettings.indexOf(k) !== -1) {
        ctx.config.setInternal(k, settings[k])
      }
    }
  }

  function setExternals(list) {
    return _setExternals(ctx, list)
  }

  function route(pathExpression, arg2, arg3=undefined) {
    const opts = arg3 === undefined ? {} : arg2
    const viewfn = arg3 === undefined ? arg2 : arg3
    if (!typekit.isObject(opts)) {
      throw new Error('Invalid route options.')
    }
    if (!typekit.isFunction(viewfn)) {
      throw new Error('Invalid route component.')
    }

    return _registerRoute(ctx, pathExpression, opts, viewfn)
  }

  function render(config={}) {
    // assumin path has given
    return _goto(ctx, config.path)
  }

  function goto(path) {
    _goto(ctx, path)
  }

  function registerComponent() {
    return _registerComponent(ctx, ...arguments)
  }

  function registerMiddleware(pathExpression, arg2, arg3) {
    const opts = arg3 === undefined ? {} : arg2
    const viewfn = arg3 === undefined ? arg2 : arg3
    if (!typekit.isObject(opts)) {
      throw new Error('Invalid route options.')
    }
    if (!typekit.isFunction(viewfn)) {
      throw new Error('Invalid route component.')
    }

    opts.middleware = true

    return _registerRoute(ctx, pathExpression, opts, viewfn)
  }

  ctx.onNativeLinkClick = function onNativeLinkClick(event, target) {
    event.preventDefault()
    return goto(target)
  }

  window.onpopstate = function(event) {
    return goto(document.location.pathname)
  }

  return {
    config: ctx.config,
    request: requestRepository,
    eventEmitter: eventEmitter,
    i18n: i18n,
    init: init,
    externals: {
      inject: setExternals
    },
    meta: metapatcher,
    scripter: scripter,
    route: route,
    component: registerComponent,
    middleware: registerMiddleware,
    render: render,
    goto: goto
  }
}

module.exports = FrondFramework()
