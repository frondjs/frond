const {validationkit, objectkit} = require('basekits')
const WrapperDOMElement = require('../domain/wrapperDOMElement/entity')
const assetManager = require('../infrastructure/assetManager')

module.exports = function renderComponent(
  ctx, componentname, wrapperDOMElement, actualRoute=[], opts={}) {

  // find component
  let component = null
  try {
    component = ctx.componentRepository.getComponentByName(componentname)
  } catch (e) {
    if (e.name == 'ComponentNotFound') {
      // TODO render not found page
    }
    throw e
  }

  const rehydrate = ctx.config.getInternal('rehydrate')
  if (!rehydrate) {
    const literals = Object.assign({}, {
      frond: ctx.config.asObject(),
      assets: assetManager.asObject(),
      params: objectkit.getProp(opts, 'params', {})
    }, component.getState())

    if (component.hasState() && validationkit.isNotEmpty(opts.params)) {
      const state = component.getState()
      const payload = Object.keys(state).reduce(function(memo, p) {
        if (opts.params.hasOwnProperty(p)) {
          memo[p] = opts.params[p]
        }
        return memo
      }, {})
      if (validationkit.isNotEmpty(payload)) {
        component.updateState(payload)
      }
    }

    const htmlstr = ctx.nunjucks.render(component.template.name, literals)
    wrapperDOMElement.patch(htmlstr)
  }
  else {
    if (opts.initialRender) {
      ctx.config.setInternal('rehydrate', false) // so it will patch next time
    }
  }

  // find references
  component.restoreInputValues(wrapperDOMElement.element)
  component.rememberInputs(wrapperDOMElement.element)
  component.findReferences(wrapperDOMElement.element)
  component.findNativeLinks(wrapperDOMElement.element, ctx.routeRepository,
    ctx.onNativeLinkClick, (ctx.config.getInternal('ROUTES_PREFIX') || ''))
  component.registerServices(wrapperDOMElement.element)

  // render children
  const elements = wrapperDOMElement.findChildren()
  for (let i = 0; i < elements.length; i++) {
    const childComponentName = elements[i].dataset.frondComponent
    const params = Object.keys(elements[i].dataset).reduce(function(memo, attr) {
      const a = attr.slice(5) // removed "frond"
      if (a.length > 5 && a.indexOf('Param') !== -1) {
        const param = a.slice(5)
        memo[param.slice(0, 1).toLowerCase() + param.slice(1)] = elements[i].dataset[attr]
      }
      return memo
    }, {})
    renderComponent(ctx, childComponentName, new WrapperDOMElement(elements[i]), [], {params: params})
  }

  if (actualRoute.length > 0) component.eventEmitter.once('_next', function() {
    ctx.requestRepository.set({
      path: actualRoute[1].path,
      params: actualRoute[1].params,
      component: actualRoute[0].componentname
    })

    renderComponent(ctx, actualRoute[0].componentname, wrapperDOMElement)
  })

  component.emit('update', [component.getPrevState(), component.getState()])
  component.emit('ready')
  component.emit('render')
}
