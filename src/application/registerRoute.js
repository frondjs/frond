const {typekit} = require('basekits')
const Route = require('../domain/route/entity')
const registerComponent = require('./registerComponent')

module.exports = function registerRoute(ctx, pathExp, opts, viewfn) {
  const component = registerComponent(ctx, viewfn)
  let finalPathExp = ((ctx.config.getInternal('ROUTES_PREFIX') || '') + pathExp)
  if (finalPathExp.slice(-1) == '/' && finalPathExp.length > 1) {
    finalPathExp = finalPathExp.slice(0, -1)
  }
  const route = new Route(finalPathExp, opts, component.name)
  ctx.routeRepository.insert(route)
  return route
}
