const EventEmitter = require('event-emitter-object')
const LocalStoragePro = require('local-storage-pro')

function Navigation(initialEvents, config) {
  EventEmitter.call(this, initialEvents)

  // configurable properties
  this.id = config.id
  this.views = config.views || []
  this.defaultViewID = config.defaultView || 'start'
  this.defaultLocale = config.defaultLocale || null
  this.activeLocale = config.activeLocale || this.defaultLocale || null
  this.basePath = config.basePath || '/'
  this.additionalViewProps = config.additionalViewProps || []
  this.viewsAreStaticByDefault = config.hasOwnProperty('viewsAreStaticByDefault')
    ? config.viewsAreStaticByDefault
    : true
  this.ignoreLocalePathForDefaultLocale = config.hasOwnProperty('ignoreLocalePathForDefaultLocale')
    ? config.ignoreLocalePathForDefaultLocale
    : true
  this.manipulateAddressBar = config.hasOwnProperty('manipulateAddressBar')
    ? config.manipulateAddressBar
    : false

  // internal properties
  this.isLocalFilesystem = window.location.protocol == 'file:'
  this.foundLocales = []
  this.history = []
  this.storeKeyPrefix = 'FROND_ROUTER_' + config.id.toUpperCase() + '_'

  // save initial location request
  this.initialLocation = {
    host: window.location.host,
    origin: window.location.origin,
    pathname: window.location.pathname,
    port: window.location.port,
    protocol: window.location.protocol,
    hash: window.location.hash && window.location.hash.length > 0
      ? window.location.hash.slice(1)
      : ''
  }
}

Navigation.prototype = Object.create(EventEmitter.prototype)
Navigation.prototype.constructor = Navigation

Navigation.prototype.browserStore = new LocalStoragePro()
Navigation.prototype.kit = null

Navigation.prototype.build = function build(components) {
  const self = this

  if (!self.kit.isArray(self.views) || self.kit.isEmpty(self.views)) return;
  if (!self.kit.isObject(components)) return;

  const addiProps = self.kit.isNotEmpty(self.additionalViewProps) && self.kit.isArray(self.additionalViewProps)
    ? self.additionalViewProps
    : []

  // validate and format view objects
  const memory = []
  const vLength = self.views.length
  for (let i = 0; i < vLength; i++) {
    const viewObj = self.views[i]
    const viewID = self.kit.getProp(viewObj, 'id')
    const componentName = self.kit.getProp(viewObj, 'component', viewID)
    const component = self.kit.getProp(components, componentName)

    if (!self.kit.isEmpty(viewID) && component) {
      const view = {
        id: viewID,
        component: component,
        static: self.kit.getProp(viewObj, 'static', self.viewsAreStaticByDefault),
        pathName: self.kit.getProp(viewObj, 'pathName', ''),
        parent: self.kit.getProp(viewObj, 'parent', null),
        authRequired: self.kit.getProp(viewObj, 'authRequired', false),
        metadata: self.kit.getProp(viewObj, 'metadata', {}),
        locale: self.kit.getProp(viewObj, 'locale', self.defaultLocale)
      }

      if (addiProps.length > 0) {
        view.additionalProps = addiProps.reduce(function(memo, prop) {
          memo[prop] = self.kit.getProp(viewObj, prop, null)
          return memo
        }, {})
      }

      if (self.foundLocales.indexOf(view.locale) === -1) {
        self.foundLocales.push(view.locale)
      }

      memory.push(view)
    }
  }

  // build paths and roots
  const list = []
  const memLength = memory.length
  for (let i = 0; i < memLength; i++) {
    const v = memory[i]

    const roots = [v.id]
    const paths = [v.pathName]

    let parentViewID = v.parent
    while (true) {
      if (self.kit.isEmpty(parentViewID)) break;

      const parentViewMatches = memory.filter(m => m.id == parentViewID && m.locale == v.locale)
      if (self.kit.isEmpty(parentViewMatches)) break;

      const parentView = parentViewMatches[0]
      paths.push(parentView.pathName)
      roots.push(parentView.id)

      parentViewID = parentView.parent
    }

    if (
      !self.kit.isEmpty(self.defaultLocale)
      && self.defaultLocale != v.locale
      && self.ignoreLocalePathForDefaultLocale
    ) {
      paths.push(v.locale.toLowerCase())
    }

    v.roots = roots
    v.fullpath = self.basePath + paths
      .filter(p => p.length > 0)
      .reverse()
      .join('/')

    list.push(v)
  }

  self.views = [].concat(list)

  return self
}

Navigation.prototype.matchPath = function matchPath(inputPath) {
  const self = this

  const defaultView = self.getViewByID(self.defaultViewID, self.activeLocale)

  // check restores
  const resViewID = self.browserStore.getItem(self.storeKeyPrefix + 'RESTORE_VIEW_ID')
  if (!self.kit.isEmpty(resViewID)) {
    const restoreView = self.getViewByID(resViewID, self.activeLocale)
    self.browserStore.removeItem(self.storeKeyPrefix + 'RESTORE_VIEW_ID')
    if (restoreView) {
      return restoreView
    }
  }

  // automatically detect
  let foundPathname = null
  if (self.kit.isEmpty(inputPath)) {
    if (self.useAddressBar()) {
      try {
        const url = new URL(window.location.href)
        foundPathname = url.pathname
      } catch (e) {}
    }
    else {
      foundPathname = self.browserStore.getItem(self.storeKeyPrefix + 'ACTIVE_PATH')
    }
  }
  else {
    foundPathname = inputPath
  }
  if (self.kit.isEmpty(foundPathname)) return defaultView

  const _pathnames = foundPathname.split('/')
  const pathnames = _pathnames.filter(p => p.length > 0).join('/')
  const pathname = self.basePath + pathnames

  const matches = []
  const viewsLength = self.views.length
  for (let i = 0; i < viewsLength; i++) {
    const v = self.views[i]

    if (pathname == v.fullpath) {
      return v
    }

    if (
      !self.kit.isEmpty(self.defaultLocale)
      && self.defaultLocale == v.locale
      && self.ignoreLocalePathForDefaultLocale
    ) {
      const pathnameAlias = self.basePath + self.defaultLocale + '/' + pathnames
      if (pathnameAlias == v.fullpath) {
        return v
      }
    }
  }

  return defaultView
}

Navigation.prototype.getViewByID = function getViewByID(id, locale = null) {
  const self = this

  const matches = self.views.filter(function(v) {
    if (self.kit.isNotEmpty(locale) && self.foundLocales.indexOf(locale) !== -1) {
      return v.id == id && v.locale == locale
    }
    else if (self.kit.isNotEmpty(self.activeLocale)) {
      return v.id == id && v.locale == self.activeLocale
    }
    else if (self.kit.isNotEmpty(self.defaultLocale)) {
      return v.id == id && v.locale == self.defaultLocale
    }
    else {
      return v.id == id
    }
  })

  if (self.kit.isNotEmpty(matches)) {
    return matches[0]
  }

  return undefined;
}

Navigation.prototype.shift = function shift(target, locale = null) {
  const self = this

  if (!self.kit.isString(target)) return undefined;

  // before
  const beforeView = self.getActiveView()
  const wantedLocale = !self.kit.isEmpty(locale) && self.foundLocales.indexOf(locale) !== -1
    ? locale
    : self.activeLocale
  const targetView = self.getViewByID(target, wantedLocale)
  if (self.kit.isEmpty(targetView)) return undefined;

  self.emit('beforeShift', [beforeView, targetView])

  // shift
  self.history.unshift(targetView)

  if (self.useAddressBar()) {
    try {
      window.history.pushState(null, null, targetView.fullpath)
    } catch (e) {}
  }

  // after
  const afterView = self.getActiveView()
  self.browserStore.setItem(self.storeKeyPrefix + 'ACTIVE_PATH', afterView.fullpath)

  self.emit('afterShift', [afterView, self.getPrevView()])
  if (self.kit.isEmpty(beforeView)) {
    self.emit('initialShift', [afterView])
  }

  return true;
}

Navigation.prototype.useAddressBar = function useAddressBar() {
  return this.manipulateAddressBar === true && this.isLocalFilesystem === false
}

Navigation.prototype.getActiveView = function getActiveView() {
  return this.history.length > 0 ? this.history[0] : null
}

Navigation.prototype.getPrevView = function getPrevView() {
  return this.history.length > 1 ? this.history[1] : null
}

Navigation.prototype.getLink = function getLink(id, prefix, locale) {
  const self = this

  if (!self.kit.isString(id)) return undefined;

  const userPrefix = !self.kit.isEmpty(prefix) && self.kit.isString(prefix)
    ? prefix
    : ''
  const wantedLocale = !self.kit.isEmpty(locale)
    ? locale
    : self.getActiveView().locale

  const view = self.getViewByID(id, wantedLocale)
  if (self.kit.isEmpty(view)) return undefined;

  return userPrefix + view.fullpath
}

Navigation.prototype.findAlternates = function findAlternates(id, host) {
  const self = this

  if (!self.kit.isString(id) || self.kit.isEmpty(self.defaultLocale)) {
    return [];
  }

  const hostname = self.kit.isEmpty(host) ? '' : host
  const views = self.views.filter(v => v.id == id)
  if (self.kit.isEmpty(views)) return [];

  const re = /[-_]/
  return views.map(function(v) {
    return {
      lang: v.locale,
      url: hostname + v.fullpath
    }
  })
}

Navigation.prototype.genHierarchicalMap = function genHierarchicalMap(id, locale) {
  const self = this

  const wantedLocale = !self.kit.isEmpty(locale)
    ? locale
    : self.getActiveView().locale

  function getChildren(view) {
    const children = self.views.filter(
      v => v.parent == view.id && v.locale == wantedLocale
    )
    view.children = !self.kit.isEmpty(children)
      ? children.map(v => getChildren(v))
      : []
    return view
  }

  return self.views
    .filter(
      v => v.locale == wantedLocale && (
        self.kit.isEmpty(id)
          ? self.kit.isEmpty(v.parent)
          : (v.parent == id)
      )
    )
    .map(v => getChildren(v))
}

Navigation.prototype.breadcrumb = function breadcrumb(view, url) {
  const self = this

  return view.roots
    .reverse()
    .map(function(id) {
      const v = self.getViewByID(id, view.locale)

      return {
        url: url + v.fullpath,
        title: v.metadata.title
      }
    })
}

Navigation.prototype.getInitialLocation = function getInitialLocation() {
  return this.initialLocation
}

module.exports = Navigation
