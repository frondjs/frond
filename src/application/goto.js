const renderComponent = require('./renderComponent')

module.exports = function goto(ctx, path) {
  const prefix = ctx.config.getInternal('ROUTES_PREFIX') || ''
  // add ROUTES_PREFIX if it doesn't exist in the path
  if (prefix && path.indexOf(prefix) !== 0) {
    path = prefix + path
  }
  if (path.length > 1 && path.slice(-1) == '/') {
    path = path.slice(0, -1)
  }

  // match middleware
  const middleware = ctx.routeRepository.matchMiddleware(path)

  // match route
  let actualRoute = null
  try {
    actualRoute = ctx.routeRepository.match(path)
  } catch (e) {
    if (e.name == 'RouteNotFound') {
      const notFoundPath = ctx.routeRepository.getRouteByTag('notFound').pathExpression

      if (path != notFoundPath) {
        return goto(ctx, notFoundPath);
      }
    }

    throw e
  }

  window.scrollTo(0, 0);

  if (middleware.length > 0) {
    // pushing the same path again to correctly handle back button.
    window.history.pushState(null, null, ctx.requestRepository.path)
    const [mroute, mroutematch] = middleware
    renderComponent(ctx, mroute.componentname, ctx.rootWrapperDOMElement, actualRoute)
    return;
  }

  ctx.requestRepository.set({
    path: actualRoute[1].path,
    params: actualRoute[1].params,
    component: actualRoute[0].componentname,
    route: actualRoute[0]
  })

  renderComponent(ctx, actualRoute[0].componentname, ctx.rootWrapperDOMElement)
  return;
}
