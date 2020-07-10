import {typekit, objectkit, validationkit} from 'basekits'
import EventEmitterObject from 'event-emitter-object'
import getSlug from 'speakingurl'
import localstore from 'local-storage-pro'
import Frond from './frond'

function Router(config) {
  EventEmitterObject.call(this, {})

  this.config = config
  this.config.defaultLocale = Frond.formatLocale(this.config.defaultLocale)
  this.config.appLocale = Frond.formatLocale(this.config.appLocale)
  this.config.availableLocales = this.config.availableLocales.map(lo => Frond.formatLocale(lo))

  this.activeRouteIndex = undefined
  this.routes = []
  this.supportHistoryAPI = validationkit.isNotEmpty(Frond.getWindow().history)
  this.isLocalFilesystem = Frond.getWindow().location.protocol == 'file:'
  this.initialShiftDone = false
  this.stats = []
  this.registerEvents(this.config.on)
  this.readInitialLocation()
  this.build()

  Frond.registerRouter(this.config.id, this)
}

Router.prototype = Object.create(EventEmitterObject.prototype)
Router.prototype.constructor = Router

Router.prototype.registerEvents = function registerEvents(obj = {}) {
  this.on('initialShift', function() {
    // handle browser's back and forward buttons
    Frond.getWindow().addEventListener('popstate', function() {
      Frond.getRouter().shift( Frond.getRouter().match(Frond.getWindow().location.pathname).id )
    })
  })

  this.on('afterShift', function() {
    // wait for view to render and scroll to top
    setTimeout(function() {
      Frond.getWindow().scrollTo({top:0, behavior: 'smooth'})
    }, 300)
  })

  if (!validationkit.isObject(obj)) return;

  Object
    .keys(obj)
    .filter(name => typekit.isFunction(obj[name]))
    .map(name => this.on(name, obj[name]))
}

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
  // if it doesn't have a parent, then it is the root
  if (validationkit.isEmpty(obj.parent)) obj.parent = null
  // it also may not have a path
  if (validationkit.isEmpty(obj.path)) obj.path = ''

  // can't allow it to continue without required props
  const requiredProps = ['id', 'component']
  if (validationkit.isNotEmpty(requiredProps.filter(p => !obj.hasOwnProperty(p))))
    throw new Error('The following fields are required for a route object: ' + requiredProps.join(', '))

  // metadata object for title, description etc.
  if (!obj.hasOwnProperty('metadata')) obj.metadata = {}

  // access setting can be used by the ssr script and application
  // public by default
  obj.access = objectkit.getProp(obj, 'access', 'public')

  // check locale and set slug lib options since all paths will be slugified
  const slugOpts = {maintainCase: true, lang: this.config.appLocale.slice(0, 2), custom: {'_': '-'}}

  // all parent ids in order
  const roots = [obj.id]
  // all parent paths in order
  const paths = [getSlug(Frond.translate(this.config.appLocale, 'routes', obj.path), slugOpts)]

  // find parent roots and paths
  let parentID = obj.parent
  while (true) {
    if (validationkit.isEmpty(parentID)) break;
    const parentRoutes = this.config.routes.filter(r => r.id == parentID)
    if (validationkit.isEmpty(parentRoutes)) break;

    const parentRoute = parentRoutes[0]
    roots.push(parentRoute.id)
    paths.push(getSlug(Frond.translate(this.config.appLocale, 'routes', parentRoute.path), slugOpts))

    parentID = parentRoute.parent
  }

  // include locale path as base path
  if (objectkit.getProp(this.config, 'useLocalePaths') === true) {
    const omit = objectkit.getProp(this.config, 'omitDefaultLocalePath') === true &&
      this.config.defaultLocale == this.config.appLocale
    if (omit === false) paths.push(this.slugifyLocale(this.config.appLocale))
  }

  // roots and fullpath useful for breadcrumbs and links
  obj.roots = roots
  obj.fullpath = this.config.basePath + paths.filter(p => validationkit.isNotEmpty(p)).reverse().join('/')

  // we have a valid, formatted route object.
  // any additional props the developer add hasn't removed
  this.routes.push(obj)

  // check localization mode
  const w = Frond.getWindow()
  if (w.__FROND_LOCALIZE__) {
    if (!w.__FROND_TRANSLATION_KEYS__.hasOwnProperty('routes'))
      w.__FROND_TRANSLATION_KEYS__.routes = []
    if (validationkit.isNotEmpty(obj.path))
      w.__FROND_TRANSLATION_KEYS__.routes.push({
        input: obj.path,
        note: 'This should be a path name. As a part of the URL. (No spaces or non-alphanumeric characters, except dash.) Do not change this unless you know what you are doing. Choose carefully and wisely if you are translating this for the first time.'
      })
    if (validationkit.isNotEmpty(obj.metadata.title))
      w.__FROND_TRANSLATION_KEYS__.routes.push({
        input: obj.metadata.title,
        note: 'Title of the page: "' + obj.fullpath + '". This will appear on the site, search engines and social media sites.'
      })
    if (validationkit.isNotEmpty(obj.metadata.description))
      w.__FROND_TRANSLATION_KEYS__.routes.push({
        input: obj.metadata.description,
        note: 'Short description of the page: "' + obj.fullpath + '". (Not more than 255 characters in general.) This will appear on the site, search engines and social media sites.'
      })
    if (validationkit.isNotEmpty(objectkit.getProp(obj.metadata, ['richcontent', 'html'])))
      w.__FROND_TRANSLATION_KEYS__.routes.push({
        input: obj.metadata.richcontent.html,
        note: 'HTML Content of the page: "' + obj.fullpath + '". Translator must have a basic knowledge about HTML markup.'
      })
  }

  return this
}

Router.prototype.getRoutes = function getRoutes() {
  return this.routes
}

Router.prototype.slugifyLocale = function slugifyLocale(locale) {
  return getSlug(locale, {maintainCase: false, custom: {'_': '-'}})
}

Router.prototype.match = function match(input = undefined) {
  // returns matched route or undefined, against a path
  if (validationkit.isEmpty(input)) return undefined

  // format path
  const path = [this.config.basePath]
    .concat(input.split('/'))
    .filter(p => validationkit.isNotEmpty(p))
    .join('/')
    .replace(/[\/]{2,}/g, '/')
  // locale may be omitted
  const omitDefaultLocalePath = objectkit.getProp(this.config, 'useLocalePaths') === true &&
    objectkit.getProp(this.config, 'omitDefaultLocalePath') === true
  const aliasPath = [this.config.basePath, this.config.defaultLocale]
    .concat(input.split('/'))
    .filter(p => validationkit.isNotEmpty(p))
    .join('/')
    .replace(/[\/]{2,}/g, '/')

  // match
  const len = this.routes.length
  for (let i = 0; i < len; i++) {
    const route = this.routes[i]
    // match
    if (route.fullpath == path) return route
    // locale may be omitted
    if (omitDefaultLocalePath === true &&
      this.config.defaultLocale == this.config.appLocale &&
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
  if (validationkit.isEmpty(locale)) locale = this.config.appLocale

  // match
  const len = this.routes.length
  for (let i = 0; i < len; i++) {
    const route = this.routes[i]
    if (route.id == id) {
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
  if (validationkit.isEmpty(locale)) locale = this.config.appLocale

  const activeRoute = this.getActiveRoute()
  const nextRoute = this.get(id, locale)

  this.emit('beforeShift', [activeRoute, nextRoute])

  // shift
  this.activeRouteIndex = this.findRouteIndex(nextRoute.id)

  if (this.config.useAddressBar === true && this.supportHistoryAPI && !this.isLocalFilesystem) {
    Frond.getWindow().history.pushState(null, null, nextRoute.fullpath)
  }

  Frond.getComponent(this.config.componentID).update({route: {id: id, component: nextRoute.component}})

  this.emit('afterShift', [nextRoute, activeRoute])

  if (this.initialShiftDone === false) {
    this.emit('initialShift', nextRoute)
    this.initialShiftDone = true
  }

  this.addStat(nextRoute)
}

Router.prototype.findRouteIndex = function findRouteIndex(id) {
  const len = this.routes.length
  for (let i = 0; i < len; i++) {
    const route = this.routes[i]
    if (route.id) {
      return i
    }
  }
}

Router.prototype.addStat = function addStat(route) {
  const len = this.stats.length
  const newStat = {
    id: route.id,
    locale: this.config.appLocale,
    timestamp: Date.now(),
    duration: undefined
  }
  if (len > 0) this.stats[len - 1].duration = newStat.timestamp - this.stats[len - 1].timestamp
  this.stats.push(newStat)
}

Router.prototype.findAlternates = function findAlternates(id) {
  return this.routes.filter(r => r.id == id)
}

Router.prototype.genHierarchy = function genHierarchy(id = null) {
  const self = this

  function getChildren(route) {
    route.children = self.routes
      .filter(r => r.parent == route.id)
      .map(r => getChildren(r))
    return route
  }

  return self.routes
    .filter(r => validationkit.isEmpty(id) ? typekit.isNull(r.parent) : r.id == id)
    .map(r => getChildren(r))
}

Router.prototype.genBreadcrumb = function genBreadcrumb(route) {
  return [].concat(route.roots).reverse().map(id => this.get(id))
}

Router.prototype.rememberLastLocation = function rememberLastLocation(id = null) {
  const route = validationkit.isEmpty(id) ? this.getActiveRoute() : this.get(id)
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
