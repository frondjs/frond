const WrapperDOMElement = require('../domain/wrapperDOMElement/entity')

module.exports = function renderComponent(
  ctx, componentname, wrapperDOMElement, actualRoute=[]) {

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

  const literals = Object.assign({}, {frond: ctx.config}, component.getState())
  const htmlstr = ctx.nunjucks.render(component.template.name, literals)

  wrapperDOMElement.patch(htmlstr)

  // find references
  component.findReferences(wrapperDOMElement.element)
  component.findNativeLinks(wrapperDOMElement.element, ctx.routeRepository,
    ctx.onNativeLinkClick, (ctx.config.getInternal('ROUTES_PREFIX') || ''))
  component.registerServices(wrapperDOMElement.element)

  // render children
  const elements = wrapperDOMElement.findChildren()
  for (let i = 0; i < elements.length; i++) {
    const childComponentName = elements[i].dataset.frondComponent
    renderComponent(ctx, childComponentName, new WrapperDOMElement(elements[i]))
  }

  if (actualRoute.length > 0) component.eventEmitter.once('_next', function() {
    ctx.requestRepository.set({
      path: actualRoute[1].path,
      params: actualRoute[1].params,
      component: actualRoute[0].componentname
    })

    renderComponent(ctx, actualRoute[0].componentname, wrapperDOMElement)
  })

  component.emit('update')
  component.emit('ready')
  component.emit('render')
}
