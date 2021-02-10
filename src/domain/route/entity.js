const pathtoregexp = require('path-to-regexp')

function Route(pathExpression, opts, componentname) {
  this.pathExpression = pathExpression
  this.pathMatcher = pathtoregexp.match(this.pathExpression, {decode: decodeURIComponent})
  this.pathDepth = pathtoregexp.pathToRegexp(pathExpression).length
  this.opts = opts
  this.componentname = componentname
}

Route.prototype.isMiddleware = function isMiddleware() {
  return this.opts.middleware === true
}

module.exports = Route
