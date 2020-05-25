import {typekit, objectkit, validationkit} from 'basekits'
import EventEmitterObject from 'event-emitter-object'
import getSlug from 'speakingurl'
import localstore from 'local-storage-pro'
import Frond from './frond'

function Router(config) {
  EventEmitterObject.call(this, {})

  if (validationkit.isEmpty(config.defaultLocale) && validationkit.isNotEmpty(Frond.config('locale')))
    config.defaultLocale = Frond.config('locale')

  this.config = config
  this.activeRouteIndex = undefined
  this.routes = []
  this.supportHistoryAPI = validationkit.isNotEmpty(Frond.getWindow().history)
  this.isLocalFilesystem = Frond.getWindow().location.protocol == 'file:'
  this.initialShiftDone = false
  this.stats = []
  this.readInitialLocation()
  this.build()

  Frond.registerRouter(this.config.id, this)
}

Router.prototype = Object.create(EventEmitterObject.prototype)
Router.prototype.constructor = Router

Router.prototype.readInitialLocation = function readInitialLocation() {
  this.initialLocationURL = new URL(Frond.getWindow().location.href)
}

Router.prototype.getInitialLocation = function getInitialLocation() {
  return this.initialLocationURL
}

Router.prototype.build = function build() {
  for (let i = 0; i < this.config.routes.length; i++) {
    this.insertRoute(this.config.routes[i])
  }
}

Router.prototype.insertRoute = function insertRoute(obj) {
  const requiredProps = ['id', 'component', 'path', 'locale']

  // if it doesn't have a parent, then it is the root
  if (validationkit.isEmpty(obj.parent)) obj.parent = null

  // can't allow it to continue without required props
  if (validationkit.isNotEmpty(requiredProps.filter(p => !obj.hasOwnProperty(p))))
    throw new Error('The following fields are required for a route object: ' + requiredProps.join(', '))

  // check component's existence
  /*
  if (Frond.hasComponent(obj.component) !== true)
    throw new Error('The component you specified couldn\'t found. (' + obj.component + ')')*/

  // metadata object for title, description etc.
  if (!obj.hasOwnProperty('metadata')) obj.metadata = {}

  // access setting can be used by the ssr script and application
  // public by default
  obj.access = objectkit.getProp(obj, 'access', 'public')

  // set slug lib options since all paths will be slugified
  obj.locale = this.formatLocale(obj.locale)
  const slugOpts = {maintainCase: true, lang: obj.locale.slice(0, 2)}

  // all parent ids in order
  const roots = [obj.id]
  // all parent paths in order
  const paths = [getSlug(obj.path, slugOpts)]

  // find parent roots and paths
  let parentID = obj.parent
  while (true) {
    if (validationkit.isEmpty(parentID)) break;
    const parentRoutes = this.config.routes.filter(r => r.id == parentID && r.locale == obj.locale)
    if (validationkit.isEmpty(parentRoutes)) break;

    const parentRoute = parentRoutes[0]
    roots.push(parentRoute.id)
    paths.push(getSlug(parentRoute.path, slugOpts))

    parentID = parentRoute.parent
  }

  // include locale path as base path
  if (objectkit.getProp(this.config, 'useLocalePaths') === true) {
    const omit = objectkit.getProp(this.config, 'omitDefaultLocalePath') === true &&
      this.config.defaultLocale == obj.locale
    if (omit === false) paths.push(getSlug(obj.locale, {maintainCase: false}))
  }

  // roots and fullpath useful for breadcrumbs and links
  obj.roots = roots
  obj.fullpath = this.config.basePath + paths.filter(p => validationkit.isNotEmpty(p)).reverse().join('/')

  // we have a valid, formatted route object.
  // any additional props the develer add hasn't removed
  this.routes.push(obj)
/*
  if (this.activeRouteIndex === undefined) {
    const initialLocale = objectkit.getProp(this.config, 'initialLocale', this.config.defaultLocale)
    if (initialLocale == obj.locale) {
      if (this.config.)
    }
  }
*/
  return this
}

Router.prototype.formatLocale = function formatLocale(str) {
  if (str.length === 2) return str
  const f = str.replace(/(_)/g, '-')
  if (f.indexOf('-') === -1) return f
  return f.split('-')[0] + '_' + f.split('-')[1].toUpperCase()
}

Router.prototype.match = function match(input = undefined) {
  // returns matched route or undefined, against a path
  if (validationkit.isEmpty(input)) return undefined

  // format path
  const path = [this.config.basePath]
    .concat(input.split('/'))
    .filter(p => validationkit.isNotEmpty(p))
    .join('/')
  // locale may be omitted
  const omitDefaultLocalePath = objectkit.getProp(this.config, 'useLocalePaths') === true &&
    objectkit.getProp(this.config, 'omitDefaultLocalePath') === true
  const aliasPath = [this.config.basePath, this.config.defaultLocale]
    .concat(input.split('/'))
    .filter(p => validationkit.isNotEmpty(p))
    .join('/')

  // match
  const len = this.routes.length
  for (let i = 0; i < len; i++) {
    const route = this.routes[i]
    // match
    if (route.fullpath == path) return route
    // locale may be omitted
    if (omitDefaultLocalePath === true &&
      this.config.defaultLocale == route.locale &&
      aliasPath == route.fullpath
    ) {
      return route
    }
  }

  return undefined
}

Router.prototype.get = function get(id, locale = undefined) {
  // returns matched route or undefined against a route id and locale
  if (validationkit.isEmpty(id)) return undefined
  if (validationkit.isEmpty(locale)) {
    const activeRoute = this.getActiveRoute()
    locale = activeRoute ? activeRoute.locale : this.config.defaultLocale
  }

  // match
  const len = this.routes.length
  for (let i = 0; i < len; i++) {
    const route = this.routes[i]
    if (route.id == id && route.locale == locale) {
      return route
    }
  }

  return undefined
}

Router.prototype.getActiveRoute = function getActiveRoute() {
  return typekit.isNumber(this.activeRouteIndex) ? this.routes[this.activeRouteIndex] : undefined
}

Router.prototype.shift = function shift(id, locale = undefined) {
  if (validationkit.isEmpty(id)) return undefined

  const activeRoute = this.getActiveRoute()
  if (validationkit.isEmpty(locale)) locale = activeRoute ? activeRoute.locale : this.config.defaultLocale

  const nextRoute = this.get(id, locale)

  this.emit('beforeShift', [activeRoute, nextRoute])

  // shift
  this.activeRouteIndex = this.findRouteIndex(nextRoute.id, nextRoute.locale)

  if (this.config.useAddressBar === true && this.supportHistoryAPI && !this.isLocalFilesystem) {
    Frond.getWindow().history.pushState(null, null, nextRoute.fullpath)
  }

  Frond.getComponent(this.config.componentID).update({route: id})

  this.emit('afterShift', [nextRoute, activeRoute])

  if (this.initialShiftDone === false) {
    this.emit('initialShift', nextRoute)
    this.initialShiftDone = true
  }

  this.addStat(nextRoute)
}

Router.prototype.findRouteIndex = function findRouteIndex(id, locale) {
  const len = this.routes.length
  for (let i = 0; i < len; i++) {
    const route = this.routes[i]
    if (route.id == id && route.locale == locale) {
      return i
    }
  }
}

Router.prototype.addStat = function addStat(route) {
  const len = this.stats.length
  const newStat = {
    id: route.id,
    locale: route.locale,
    timestamp: Date.now(),
    duration: undefined
  }
  if (len > 0) this.stats[len - 1].duration = newStat.timestamp - this.stats[len - 1].timestamp
  this.stats.push(newStat)
}

Router.prototype.findAlternates = function findAlternates(id) {
  return this.routes.filter(r => r.id == id)
}

Router.prototype.genHierarchy = function genHierarchy(id = null, locale = undefined) {
  const self = this
  if (validationkit.isEmpty(locale)) {
    const activeRoute = self.getActiveRoute()
    locale = activeRoute ? activeRoute.locale : self.config.defaultLocale
  }

  function getChildren(route) {
    route.children = self.routes
      .filter(r => r.locale == locale && r.parent == route.id)
      .map(r => getChildren(r))
    return route
  }

  return self.routes
    .filter(r => r.locale == locale && (validationkit.isEmpty(id) ? typekit.isNull(r.parent) : r.id == id))
    .map(r => getChildren(r))
}

Router.prototype.genBreadcrumb = function genBreadcrumb(route) {
  return [].concat(route.roots).reverse().map(id => this.get(id, route.locale))
}

Router.prototype.rememberLastLocation = function rememberLastLocation(id = null, locale = undefined) {
  if (validationkit.isEmpty(locale)) locale = self.getActiveRoute().locale
  const route = validationkit.isEmpty(id) ? this.getActiveRoute() : this.get(id, locale)
  localstore.setItem(this.getRestoreKeyName(), route.id)
}

Router.prototype.restore = function restore() {
  const id = localstore.getItem(this.getRestoreKeyName())
  localstore.removeItem(this.getRestoreKeyName())

  if (validationkit.isNotEmpty(id)) this.shift(id)
}

Router.prototype.getRestoreKeyName = function getRestoreKeyName() {
  return 'FROND_ROUTER_RESTORE'
}

export default Router
