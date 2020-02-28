const StateManagerObject = require('state-manager-object')
const kit = require('@basekits/core')

const FrondComponent = require('./component')
const Network = require('./network')
const frondTags = require('./frondTags')
const svgTags = require('./svgTags')
const htmlTags = require('./htmlTags')
const routeRenderer = require('./navigation/renderer')
const ff = require('./core/ff')

const errMsgs = {
  invalidCreateUICall: 'Memory is not empty. Please call createUI method once.',
  invalidInput: 'You may send object, string, number, date, regexp or error as input but the following is not valid:',
  invalidNodeType: 'Can not create a DOM element from the following input:',
  containerElemNotFound: 'Couldn\'t render the app because the container DOM element (%s) you specified is not found in the DOM.'
}

const infoMsgs = {
  creatingMem: 'Creating memory.',
  componentsInit: '%s components initiated and added to memory.'
}

function FrondJS() {
  StateManagerObject.call(this, {}, {})

  this.kit = kit
  this.kit.addKit(require('@basekits/kit-type'))
  this.kit.addKit(require('@basekits/kit-object'))
  this.kit.addKit(require('@basekits/kit-string'))
  this.kit.addKit(require('@basekits/kit-hashing'))
  this.kit.addKit(require('@basekits/kit-error'))
  this.kit.addKit(require('@basekits/kit-dom'))
  this.kit.addKit(require('@basekits/kit-function'))
  this.kit.addKit(require('@basekits/kit-validator'))
  this.kit.addKit(require('@basekits/kit-array'))
}

FrondJS.prototype = Object.create(StateManagerObject.prototype)
FrondJS.prototype.constructor = FrondJS

FrondJS.prototype.componentIDCounter = null
FrondJS.prototype.memory = []
FrondJS.prototype.debug = false
FrondJS.prototype.initTime = null
FrondJS.prototype.settings = null
FrondJS.prototype.history = []
FrondJS.prototype.throttleScrollListener = null
FrondJS.prototype.routers = []
FrondJS.prototype.networks = []

FrondJS.prototype.createUI = function createUI(obj, settings = null) {
  this.initTime = Date.now()
  this.settings = {
    listenVisibilityChanges: this.kit.getProp(
      settings, 'listenVisibilityChanges', true
    )
  }

  if (this.memory.length > 0) {
    this.log('warning', errMsgs.invalidCreateUICall, this.memory)
    return
  }

  this.log('info', infoMsgs.creatingMem)
  this.memory = this.createMemory(obj)
  this.log('info', infoMsgs.componentsInit, this.memory.length)
}

FrondJS.prototype.createMemory = function createMemory(obj) {
  // adds each component into the memory
  const self = this
  const memory = []

  function append(input, parent, index) {
    const wantedID = self.kit.getProp(input, 'id')
    const component = self.createComponent(input, parent, index, wantedID)
    if (self.kit.isUndefined(component)) return;

    memory.push(component)

    const children = self.getComponentChildren(component)
    if (self.kit.isArray(children) && children.length > 0) {
      for (let k = 0; k < children.length; k++) {
        append(children[k], component, k)
      }
    }
  }

  append(obj, null, 0)

  return memory
}

FrondJS.prototype.createComponent = function createComponent(
  input, parent = null, index = 0, id = null
) {
  const self = this

  const resolvedInput = self.resolveComponentInput(input, parent)
  if (self.kit.isUndefined(resolvedInput)) {
    self.log('warning', errMsgs.invalidInput, input)
    return undefined;
  }

  const componentType = self.findComponentType(resolvedInput)
  const domNodeTag = self.findComponentDOMNodeTag(componentType)
  const domNodeType = self.findComponentDOMNodeType(componentType, domNodeTag)
  if (!componentType || !domNodeType) {
    self.log('warning', errMsgs.invalidNodeType)
    self.log('debug', resolvedInput)
    return undefined;
  }

  const initialState = Object.assign({},
    self.kit.getProp(resolvedInput, 'state', {}),
    {_tick: false}
  )

  const initialEvents = self.createComponentInitialEventsFromInput(
    resolvedInput, initialState
  )

  // roughly set the href attribute if target specified
  const target = self.kit.getProp(resolvedInput, 'target')
  if (!self.kit.isEmpty(target)) {
    if (self.kit.isEmpty(resolvedInput.attrs)) resolvedInput.attrs = {}
    const internalLink = self.getRouter().getLink(target)
    resolvedInput.attrs.href = internalLink || target
  }

  // create a new component
  const component = new FrondComponent(initialState, initialEvents)
  component.kit = kit
  component.index = index
  component.parent = self.kit.getProp(parent, 'id', null)
  component.id = self.kit.isEmpty(id)
    ? self.getNextComponentID()
    : id
  component.idAutoAssigned = self.kit.isEmpty(id)
  component.roots = [component.id].concat(
    self.kit.getProp(parent, 'roots', [])
  )
  component.input = resolvedInput
  component.type = componentType
  component.domNodeTag = domNodeTag
  component.domNodeType = domNodeType

  const analytics = self.kit.getProp(component.input, 'analytics')
  component.analytics = analytics === true

  component.emit('init')

  component.render()

  component.emit('create')

  // check router
  if (self.kit.isObject( self.kit.getProp(component.input, 'router') )) {
    self.registerComponentRouter(component, component.input.router)
  }

  return component
}

FrondJS.prototype.getComponentChildren = function getComponentChildren(component) {
  const render = this.kit.getProp(component.input, 'render', null)

  if (this.kit.isFunction(render)) {
    // executing user render function
    const renderResult = render.apply(component, [])

    if (this.kit.isArray(renderResult)) return Array.from(renderResult)
    else if (this.kit.isNull(renderResult)) return null
    else return [renderResult]
  }
  else if (this.kit.isArray(render)) return Array.from(render)
  else if (this.kit.isNull(render)) return null
  else return [render]
}

FrondJS.prototype.render = function render(ref = null) {
  const self = this

  if (self.kit.isNull(ref)) {
    // initial render

    if (self.settings.listenVisibilityChanges) {
      // track element visibility by listening scroll event
      self.throttleScrollListener = self.kit.throttle(function(event) {
        self.memory.map(function(c) {
          if (c.analytics) {
            const rect = c.dom.getBoundingClientRect()
            const {top, bottom} = rect
            const screenHeight = window.innerHeight
            const isFullyVisible = top >= 0 && bottom <= screenHeight
            const isPartiallyVisible = top < screenHeight && bottom >= 0
            if (isFullyVisible) c.isFullyVisible()
            else if (isPartiallyVisible) c.isPartiallyVisible()
            else c.isHidden()
          }
        })
      }, 300)

      window.addEventListener('scroll', self.throttleScrollListener)
    }

    const root = self.memory[0]

    const staticElement = !self.kit.isDOMElement(staticElement)
      ? document.createElement('div')
      : document.getElementById(root.id)
    staticElement.setAttribute('id', root.id)

    self.mountChildren(root)

    if (!root.dom.getAttribute('id')) root.dom.setAttribute('id', root.id)

    staticElement.parentNode.replaceChild(root.dom, staticElement)

    root.needsMount = false
    root.emit('mount')

    self.history.push(self.memory)

    self.log('info', 'Initial rendering done in ' + ((Date.now() - self.initTime)) + 'ms.')
  }
  else {
    // re-render components that are effected by change
    ref.render()
    self.remountChildren(ref)
  }
}

FrondJS.prototype.mountChildren = function mountChildren(parent) {
  const children = this.memory.filter(
    c => c.parent == parent.id && c.shouldMount()
  )
  if (!this.kit.isArray(children)) return undefined;

  const length = children.length
  if (children.length === 0) return undefined;

  for (let i = 0; i < length; i++) {
    parent.dom.insertBefore(children[i].dom, null)

    if (children[i].shouldMount()) {
      children[i].needsMount = false
      children[i].emit('mount')
    }

    this.mountChildren.apply(this, [children[i]])
  }
}

FrondJS.prototype.updateMemoryBlock = function updateMemoryBlock(component) {
  const self = this
  const memory = []

  component.needsRemount = true
  component.render()

  function append(input, parent, index) {
    let newComp = null
    if (input instanceof FrondComponent) {
      newComp = input
    }
    else {
      const wantedID = self.kit.getProp(input, 'id')
      newComp = self.createComponent(input, parent, index, wantedID)
    }
    if (self.kit.isEmpty(newComp)) return;

    memory.push(newComp)

    const children = self.getComponentChildren(newComp)
    if (self.kit.isArray(children) && children.length > 0) {
      for (let k = 0; k < children.length; k++) {
        append(children[k], newComp, k)
      }
    }
  }

  append(component, self.get(component.parent), component.index)

  return memory
}

FrondJS.prototype.mergeMemoryBlock = function mergeMemoryBlock(memory) {
  /*
  * Merges new fork of the memory with the active memory.
  */

  const self = this

  const beRemoved = []
  const beInserted = []
  const beRemounted = []

  function update(c) {
    const ochildren = this.memory.filter(comp => comp.parent == c.id)
    const children = memory.filter(comp => comp.parent == c.id)

    const oclen = self.kit.isArray(ochildren) ? ochildren.length : 0
    const clen = self.kit.isArray(children) ? children.length : 0

    if (oclen > clen) {
      // remove redundant active children
      for (let j = 0; j < ochildren.length; j++) {
        if (j >= clen) {
          beRemoved.push(ochildren[j].id)
        }
      }
    }

    if (this.kit.isArray(children) && children.length > 0) {
      for (let i = 0; i < children.length; i++) {
        const isItemExistInOldMemory = oclen > i
        if (isItemExistInOldMemory) {
          // equality check
          const oid = this.kit.getProp(ochildren[i].input, 'id')
          const id = this.kit.getProp(children[i].input, 'id')
          if (this.kit.isString(id) && oid == id) {
            this.log('debug', 'Treated as same:', ochildren[i], children[i])
            beRemounted.push(id)
            //children[i].index = ochildren[i].index
            //children[i].parent = ochildren[i].parent
            //children[i].roots = ochildren[i].roots
            update.apply(this, [children[i]])
          }
          else {
            beRemoved.push(ochildren[i].id)
            beInserted.push(children[i])
            update.apply(this, [children[i]])
          }
        }
        else {
          beInserted.push(children[i])
          update.apply(this, [children[i]])
        }
      }
    }
  }

  update.apply(this, [memory[0]])

  // cleanup
  const beRemovedFamily = this.memory
    .filter(c => !self.kit.isEmpty(
      beRemoved.filter(rid => c.roots.indexOf(rid) !== -1)
    ))
    .map(c => c.id)
  this.removeComponents(beRemovedFamily)

  // insert new components
  this.appendComponents(beInserted)

  // be remounted
  if (beRemounted.length > 0) {
    for (let i = 0; i < this.memory.length; i++) {
      if (beRemounted.indexOf(this.memory[i].id) !== -1) {
        this.memory[i].needsRemount = true
      }
    }
  }
}

FrondJS.prototype.registerComponentRouter = function registerComponentRouter(
  component, routerConfig
) {
  const self = this

  routerConfig.id = component.id

  const initialEvents = {
    initialShift: function() {
      const v = this
      if (v.useAddressBar()) {
        // catch native address bar changes
        window.addEventListener('popstate', function(e) {
          if (v.useAddressBar()) {
            v.shift( v.matchPath(window.location.pathname) )
          }
        })
      }
    },
    afterShift: [
      function() {
        self.log('info', 'View changed to ' + this.getActiveView().id)
        self.get(routerConfig.id).rerender()
        window.scrollTo({top:0, behavior: 'smooth'})
      }
    ]
  }

  if (self.kit.isFunction(self.kit.getProp(routerConfig, ['on', 'initialShift']))) {
    initialEvents.initialShift.push(routerConfig.on.initialShift)
  }

  if (self.kit.isFunction(self.kit.getProp(routerConfig, ['on', 'afterShift']))) {
    initialEvents.afterShift.push(routerConfig.on.afterShift)
  }

  component.createRouter(initialEvents, routerConfig)

  self.routers.push(component.id)
}

FrondJS.prototype.createComponentInitialEventsFromInput = function createComponentInitialEventsFromInput(input, initialState) {
  const self = this

  const events = self.kit.getProp(input, 'on', {})

  // re-render on state update only if component have state
  if (!self.kit.isEqual({_tick: false}, initialState)) {
    if (!events.hasOwnProperty('afterUpdate')) events.afterUpdate = []
    if (!self.kit.isArray(events.afterUpdate)) {
      events.afterUpdate = [events.afterUpdate]
    }
    events.afterUpdate.unshift(function() {
      // here, this refers to the component and self refers to the frond
      const memory = self.updateMemoryBlock(this)
      self.mergeMemoryBlock(memory)
      self.render(this)
      self.history.push(self.memory)
    })
  }

  // navigate application without reloading the page on link click
  const target = self.kit.getProp(input, 'target')
  const href = self.kit.getProp(input, ['attrs', 'href'])
  if (!self.kit.isEmpty(target)) {
    const internalLink = self.getRouter().getLink(target)
    // register click handler for links
    if (!events.hasOwnProperty('click')) events.click = []
    if (!self.kit.isArray(events.click)) events.click = [events.click]
    events.click.unshift(function(event) {
      // TODO event handler for external link clicks for better tracking
      if (internalLink) {
        event.preventDefault()
        self.getRouter().shift(target)
      }
    })
  }

  // initiate router if component have router config
  if (self.kit.isObject( self.kit.getProp(input, 'router') )) {
    if (!events.hasOwnProperty('mount')) events.mount = []
    if (!self.kit.isArray(events.mount)) events.mount = [events.mount]

    events.mount.unshift(function() {
      // here, this refers to the component and self refers to the frond
      const c = this
      const initialView = c.getRouter().matchPath()
      // give viewer time to render its empty children
      setTimeout(function() {
        // show initial view
        c.getRouter().shift(initialView.id)
      }, 1)
    })
  }

  // make network request only if component have a valid network request property
  const network = self.kit.getProp(input, 'network', null)
  if (!self.kit.isEmpty(network)) {
    let networkName = null
    let networkPayload = null
    if (self.kit.isArray(network)) {
      if (network.length === 1) {
        networkPayload = network[0]
      }
      else if (network.length === 2) {
        networkName = network[0]
        networkPayload = network[1]
      }
    }
    else {
      networkPayload = network
    }
    if (!events.hasOwnProperty('mount')) events.mount = []
    if (!self.kit.isArray(events.mount)) {
      events.mount = [events.mount]
    }
    events.mount.unshift(function() {
      const c = this
      // give component time to render its empty children
      setTimeout(function() {
        self.getNetwork(networkName).request(networkPayload, c)
      }, 1)
    })
  }

  return events
}

FrondJS.prototype.resolveComponentInput = function resolveComponentInput(input, parent) {
  const langType = this.kit.getType(input)
  const whitelist = ['string', 'number', 'object', 'date', 'regexp', 'error']
  if (whitelist.indexOf(langType) === -1) {
    return undefined
  }

  switch (langType) {
    case 'object':
      if (this.kit.isObject( this.kit.getProp(input, 'router') )) {
        if (this.kit.isEmpty(input.id)) {
          throw new Error('A router component must have an id.')
        }

        input.state = Object.assign(
          {}, this.kit.getProp(input, 'state', {}), {_router: true}
        )
        input.render = routeRenderer
      }

      const network = this.kit.getProp(input, 'network', null)
      if (!this.kit.isEmpty(network)) {
        input.state = Object.assign(
          {}, this.kit.getProp(input, 'state', {}), {_data: null}
        )
      }

      return input
      break;

    case 'string':
      return input
      break;

    case 'number':
    case 'regexp':
      return input.toString()
      break;

    case 'date':
      return input.toISOString()
      break;

    case 'error':
      return this.kit.stringifyError(input)
      break;

    default:
      return undefined
  }
}

FrondJS.prototype.findComponentType = function findComponentType(input) {
  const langType = this.kit.getType(input)

  switch (langType) {
    case 'string':
    case 'number':
      return 'plaintext'
      break;

    case 'object':
      const userType = this.kit.getProp(input, 'type')
      if (userType) return userType

      const target = this.kit.getProp(input, 'target')
      if (target) return 'link'

      return 'component'
      break;

    default:
      return undefined
  }
}

FrondJS.prototype.findComponentDOMNodeTag = function findComponentDOMNodeTag(type) {
  if (!this.kit.isString(type)) return undefined
  if (frondTags.hasOwnProperty(type)) return frondTags[type]
  return type
}

FrondJS.prototype.findComponentDOMNodeType = function findComponentDOMNodeType(componentType, tag) {
  if (componentType == 'plaintext') return 'plaintext'
  else if (htmlTags.indexOf(tag) !== -1) return 'html'
  else if (svgTags.indexOf(tag) !== -1) return 'svg'
  else return undefined
}

FrondJS.prototype.getNextComponentID = function getNextComponentID() {
  if (!this.kit.isNumber(this.componentIDCounter)) this.componentIDCounter = 0

  this.componentIDCounter += 1

  return this.componentIDCounter.toString()
}

FrondJS.prototype.remountChildren = function remountChildren(parent) {
  const children = this.memory.filter(
    c => c.parent == parent.id && (c.shouldMount() || c.shouldRemount())
  )
  if (!this.kit.isArray(children)) return undefined;

  const length = children.length
  if (children.length === 0) return undefined;

  for (let i = 0; i < length; i++) {
    const ref = parent.dom.childNodes.length > children[i].index
      ? parent.dom.childNodes[children[i].index]
      : null
    parent.dom.insertBefore(children[i].dom, ref)

    if (children[i].shouldMount()) {
      children[i].needsMount = false
      children[i].emit('mount')
    }
    else if (children[i].shouldRemount()) {
      children[i].needsRemount = false
      children[i].emit('remount')
    }

    this.remountChildren(children[i])
  }
}

FrondJS.prototype.isSame = function isSame(o, n) {
  const sameID = o.id == n.id
  const bothIDAuto = o.idAutoAssigned === true && n.idAutoAssigned === true

  if (!bothIDAuto && !sameID) return false;

  const oIsStatic = o.isStatic()
  const nIsStatic = n.isStatic()
  const bothStatic = oIsStatic && nIsStatic
  const bothDynamic = !oIsStatic && !nIsStatic

  if (bothStatic && sameID) return true;

  const oClassNames = o.getClassNames()
  const nClassNames = n.getClassNames()
  const sameClassNames = this.kit.isEqual(oClassNames, nClassNames)

  const oText = o.getTextContent()
  const nText = n.getTextContent()
  const sameTextContent = this.kit.isEqual(oText, nText)

  const sameNodeTag = o.domNodeTag == n.domNodeTag

  if (bothStatic && sameTextContent && sameNodeTag && sameClassNames) return true;

  const sameState = this.kit.isEqual(o.getState(), n.getState())

  if (bothDynamic && sameID && sameState) return true;

  return false;
}

FrondJS.prototype.replaceComponents = function replaceComponents(map) {
  if (!this.kit.isObject(map)) return;

  const oldIds = Object.keys(map)
  if (oldIds.length === 0) return;

  const memLen = this.memory.length
  for (let i = 0; i < memLen; i++) {
    const oldIDIndex = oldIds.indexOf(this.memory[i].id)
    if (oldIDIndex !== -1) {
      // destroy old one and replace it with the new one
      const oldID = oldIds[oldIDIndex]
      this.memory[i].destroy()
      this.memory[i] = map[oldID]
    }

    const parentIndex = oldIds.indexOf(this.memory[i].parent)
    if (parentIndex !== -1) {
      // update components which are child of the old one
      const oldParentID = oldIds[parentIndex]
      this.memory[i].parent = map[oldParentID].id
    }

    // also update ids in roots property
    const has = this.memory[i].roots.filter(rid => oldIds.indexOf(rid) !== -1)
    if (has && has.length > 0) {
      this.memory[i].roots = this.memory[i].roots.map(function(rid) {
        const oldRootIndex = oldIds.indexOf(rid)
        if (oldRootIndex === -1) return rid
        const oldRootID = oldIds[oldRootIndex]
        return map[oldRootID].id
      })
    }
  }
}

FrondJS.prototype.destroyComponents = function destroyComponents(list) {
  if (!this.kit.isArray(list)) return;
  if (list.length === 0) return;

  const sorted = this.memory
    .filter(c => list.indexOf(c.id) !== -1)
    .sort(function(a, b) {
      // begin removing from the highest depth in dom tree
      // that's how "element.parentNode.removeChild" seamlessly work.
      return a.roots.length > b.roots.length ? -1 :
        a.roots.length < b.roots.length ? 1 :
        0
    })
    .map(c => c.id)

  // destroy components one by one
  const memoLen = this.memory.length
  const destroyedMemoryIndexes = []
  for (let i = 0; i < sorted.length; i++) {
    const removeID = sorted[i]
    for (let j = 0; j < memoLen; j++) {
      if (this.memory[j].id == removeID) {
        this.memory[j].destroy()
        destroyedMemoryIndexes.push(j)
      }
    }
  }
}

FrondJS.prototype.removeComponents = function removeComponents(list) {
  /*
  * Removes list of components from the memory and the dom
  */

  if (!this.kit.isArray(list)) return;
  if (list.length === 0) return;

  const sorted = this.memory
    .filter(c => list.indexOf(c.id) !== -1)
    .sort(function(a, b) {
      // begin removing from the highest depth in dom tree
      // that's how "element.parentNode.removeChild" seamlessly work.
      return a.roots.length > b.roots.length ? -1 :
        a.roots.length < b.roots.length ? 1 :
        0
    })
    .map(c => c.id)

  // destroy components one by one
  const memoLen = this.memory.length
  const destroyedMemoryIndexes = []
  for (let i = 0; i < sorted.length; i++) {
    const removeID = sorted[i]
    for (let j = 0; j < memoLen; j++) {
      if (this.memory[j].id == removeID) {
        this.memory[j].destroy()
        destroyedMemoryIndexes.push(j)
      }
    }
  }

  // remove components from memory one by one
  // sorting memory indexes required for .splice to work.
  const destroyedMemoryIndexesSorted = destroyedMemoryIndexes
    .sort(function(a, b) {
      return a < b ? -1 : a > b ? 1 : 0
    })
  for (let k = destroyedMemoryIndexesSorted.length - 1; k >= 0; k--) {
    this.memory.splice(destroyedMemoryIndexesSorted[k], 1)
  }
}

FrondJS.prototype.appendComponents = function appendComponents(list = null) {
  /*
  * Simple appends list of components into the memory.
  */

  if (!this.kit.isArray(list)) return;
  if (list.length === 0) return;

  for (let i = 0; i < list.length; i++) {
    this.memory.push(list[i])
  }
}

FrondJS.prototype.get = function get(id) {
  if (this.kit.isEmpty(id) || !this.kit.isString(id)) return undefined;

  const len = this.memory.length
  for (let i = 0; i < len; i++) {
    if (this.memory[i].id == id) return this.memory[i]
  }

  return undefined;
}

// deprecated, use getViewer
FrondJS.prototype.getViewer = function(cid = null) {
  return this.getRouter(cid)
}

FrondJS.prototype.getRouter = function getRouter(cid = null) {
  const _cid = this.kit.isEmpty(cid) ? this.routers[0] : cid

  const component = this.get(_cid)
  if (!component) return false

  return component.getRouter()
}

FrondJS.prototype.createNetwork = function createNetwork(settings) {
  const initEvents = {
    error: [function() {}]
  }
  if (!initEvents.hasOwnProperty('beforeFetch')) initEvents.beforeFetch = []
  initEvents.beforeFetch.push(settings.beforeFetch)
  if (!initEvents.hasOwnProperty('afterFetch')) initEvents.afterFetch = []
  initEvents.afterFetch.push(settings.afterFetch)

  this.networks.push(new Network(initEvents, settings))
}

FrondJS.prototype.getNetwork = function getNetwork(nid) {
  if (this.kit.isEmpty(nid)) {
    return this.networks[0]
  }
  else {
    for (let i = 0; i < this.networks.length; i++) {
      if (this.networks[i].id == nid) {
        return this.networks[i]
      }
    }
    return undefined
  }
}

FrondJS.prototype.ff = ff

FrondJS.prototype.log = function log(type, msg, args = [], ...rest) {
  if (typeof console == 'undefined') return;
  if (!this.debug) return;

  const method =
    type == 'warning' ? 'warn' :
    type == 'debug' ? 'warn' :
    type == 'info' ? 'info' :
    'log'
  const cargs = []

  const prefix = ['[FrondJS]', '[' + type.toUpperCase() + ']', ': '].join('')

  if (this.kit.isString(msg) && this.kit.isArray(args)) {
    msg = this.kit.sprintf(msg, args)
    cargs.push(prefix + msg)
  }
  else {
    if (this.kit.isString(msg)) cargs.push(prefix + msg)
    else cargs.push(prefix, msg)
    if (!this.kit.isEmpty(args)) cargs.push(args)
    if (!this.kit.isEmpty(rest)) cargs.push.apply(cargs, rest)
  }

  console.log.apply(console, cargs)
}

module.exports = FrondJS
