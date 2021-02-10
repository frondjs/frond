const pathtoregexp = require('path-to-regexp')
const {RouteNotFound} = require('./error')

function RouteRepository() {
  this.routes = []
  this.middlewares = []
}

RouteRepository.prototype.insert = function insert(Route) {
  if (Route.isMiddleware()) this.middlewares.push(Route)
  else this.routes.push(Route)

  this.sortByDepth()
}

RouteRepository.prototype.match = function match(reqpath) {
  for (var i = 0; i < this.routes.length; i++) {
    const routematch = this.routes[i].pathMatcher(reqpath)
    if (routematch) return [this.routes[i], routematch]
  }

  throw new RouteNotFound('Invalid request path: ' + reqpath)
}

RouteRepository.prototype.matchMiddleware = function matchMiddleware(reqpath) {
  for (var i = 0; i < this.middlewares.length; i++) {
    const mroutematch = this.middlewares[i].pathMatcher(reqpath)
    if (mroutematch) return [this.middlewares[i], mroutematch]
  }

  return []
}

RouteRepository.prototype.hasMatch = function hasMatch(reqpath) {
  for (var i = 0; i < this.routes.length; i++) {
    const routematch = this.routes[i].pathMatcher(reqpath)
    if (routematch) {
      return true;
    }
  }

  return false;
}

RouteRepository.prototype.sortByDepth = function sortByDepth() {
  this.routes.sort(function(a, b) {
    if (a.pathDepth > b.pathDepth) return -1
    else if (a.pathDepth < b.pathDepth) return 1
    else return 0
  })

  this.middlewares.sort(function(a, b) {
    if (a.pathDepth > b.pathDepth) return -1
    else if (a.pathDepth < b.pathDepth) return 1
    else return 0
  })
}

module.exports = RouteRepository
