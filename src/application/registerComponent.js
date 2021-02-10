const Component = require('../domain/component/entity')
const WrapperDOMElement = require('../domain/wrapperDOMElement/entity')
const renderComponent = require('./renderComponent')

module.exports = function registerComponent(ctx, viewfn) {
  if (typeof viewfn == 'string') {
    return ctx.componentRepository.getComponentByName(viewfn)
  }

  const obj = viewfn()
  if (!obj.name) {
    throw new Error('Component should have a name.')
  }
  const component = new Component(
    obj.name, obj.template, obj.state || undefined,
    obj.on || undefined, obj.services || undefined)

  if (component.hasState) {
    component.state.subscribe(function(currentState, prevState) {
      const wrapperElement = ctx.rootWrapperDOMElement.findChildByName(component.name)
      const componentWrapper = wrapperElement
        ? new WrapperDOMElement(wrapperElement)
        : ctx.rootWrapperDOMElement
      renderComponent(ctx, component.name, componentWrapper)
    })
  }

  ctx.componentRepository.insert(component)

  return component
}
