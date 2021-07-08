const Component = require('../domain/component/entity')
const WrapperDOMElement = require('../domain/wrapperDOMElement/entity')
const renderComponent = require('./renderComponent')

module.exports = function registerComponent(ctx, viewfn, opts={}) {
  if (typeof viewfn == 'string') {
    return ctx.componentRepository.getComponentByName(viewfn)
  }

  const obj = viewfn()

  if (!obj.name) {
    throw new Error('Component should have a name.')
  }

  if (obj.template.childComponentParams) {
    ctx.componentRepository.updateDefaultParams(obj.template.childComponentParams)
  }

  const instances = obj.instances || 1;
  for (var i = 0; i < instances; i++) {
    const numName = obj.name + i
    const component = new Component(
      numName, obj.template, obj.state || undefined,
      obj.on || undefined, obj.services || undefined,
      obj.hasOwnProperty('rehydrate') ? obj.rehydrate : true,
      ctx.componentRepository.getDefaultParams(numName),
      opts.hasOwnProperty('route') ? opts.route : false
    )

    if (component.hasState) {
      if (component.rehydrate === false) {
        component.on('ready', function() {
          if (ctx.config.getInternal('rehydrate') === false) {
            component.updateState({_rehydrate_toggle: !component.getState()._rehydrate_toggle})
          }
        })
      }

      component.state.subscribe(function(currentState, prevState) {
        const wrapperElement = ctx.rootWrapperDOMElement.findChildByName(component.name)
        const componentWrapper = wrapperElement
          ? new WrapperDOMElement(wrapperElement)
          : ctx.rootWrapperDOMElement

        renderComponent(ctx, component.name, componentWrapper)
      })
    }

    ctx.componentRepository.insert(component)

    if (instances == 1) {
      return component
    }
  }

  return;
}
