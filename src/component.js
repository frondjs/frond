import {typekit, objectkit, validationkit, functionkit} from 'basekits'
import StateManagerObject from 'state-manager-object'
import EventEmitterObject from 'event-emitter-object'
import Frond from './frond'

function Component(config) {
  EventEmitterObject.call(this, {})

  this.config = config
  this.rootNodes = []
  this.data = {props: {}}
  this.dataTypes = {props: {}, state: {}}
  this.stateManager = undefined

  Frond.registerComponent(this)

  this.registerLifecycleEvents(config.on)
  this.readModel(config)
  this.readView(config.view, null, {
    markup: 'html',
    hasCommonComponent: Frond.hasCommonComponent(config.view)
  })
  this.registerDOMEvents(config.on)
}

Component.prototype = Object.create(EventEmitterObject.prototype)
Component.prototype.constructor = Component

Component.prototype.expressionPrefixes = [
  'case', 'otherwise', 'for'
]

Component.prototype.validExpressionOperators = [
  '='
]

Component.prototype.isExpression = function isExpression(str) {
  for (let i = 0; i < this.expressionPrefixes.length; i++) {
    const p = this.expressionPrefixes[i]
    if (str.indexOf(p) === 0) return p
  }
  return false
}

Component.prototype.isExpressionOperator = function isExpressionOperator(v) {
  return this.validExpressionOperators.indexOf(v) !== -1
}

Component.prototype.checkExpressionCondition = function checkExpressionCondition(av, iv, op) {
  switch (op) {
    case '=':
      return validationkit.isEqual(av, iv)
    break;
    default:
      return false
  }
}

Component.prototype.readModel = function readModel(config) {
  const self = this
  if (validationkit.isEmpty(config.model)) return;

  const model = typekit.isFunction(config.model) ? config.model.apply(self) : config.model

  // store props
  if (validationkit.isNotEmpty( typekit.isObject( objectkit.getProp(model, 'props') ) )) {
    self.data.props = model.props

    // remember types
    Object.keys(self.data.props).map(prop => {
      self.dataTypes.props[prop] = typekit.getType(self.data.props[prop])
    })
  }

  // store state
  if (validationkit.isNotEmpty( typekit.isObject( objectkit.getProp(model, 'state') ) )) {
    self.stateManager = new StateManagerObject(model.state)

    self.stateManager.on('update', function(curState, prevState) {
      // rebuild entire dom tree of the component
      const parent = self.rootNodes[0].parentNode
      const backupRootNodes = [].concat(self.rootNodes)
      self.readView(self.config.view, null, {
        markup: 'html',
        hasCommonComponent: Frond.hasCommonComponent(self.config.view)
      })
      for (let i = 0; i < backupRootNodes.length; i++) {
        parent.replaceChild(self.rootNodes[i], backupRootNodes[i])
      }
      self.registerDOMEvents(self.config.on)
      self.emit('update', [curState, prevState])
    })

    // remember types
    Object.keys(model.state).map(prop => {
      self.dataTypes.state[prop] = typekit.getType(model.state[prop])
    })
  }

  // apply fetch config
  if (validationkit.isNotEmpty( objectkit.getProp(model, 'fetch') )) {
    const fetchConfig = model.fetch
    if (validationkit.isNotEmpty( objectkit.getProp(fetchConfig, 'client') )) {
      Frond.activateNetworkClient(fetchConfig.client)
    }
    self.emit('beforeFetch')
    Frond.getNetworkClient().fetch(fetchConfig, function(err, response) {
      if (validationkit.isNotEmpty(objectkit.getProp(response, 'body'))) {
        self.emit('fetch', response)
      }
    })
  }

  // navigate to the initial page
  if (objectkit.getProp(config, 'router') === true) {
    Frond.getRouter().shift(self.stateManager.getState().route.id, Frond.config('locale'))
  }
}

Component.prototype.getData = function getData() {
  return Object.assign({}, this.data, {state: this.stateManager ? this.stateManager.getState() : {}})
}

Component.prototype.getDataType = function getDataType(path) {
  return objectkit.getProp(this.dataTypes, path)
}

Component.prototype.readView = function readView(view, domParentNode = null, viewContext = {}) {
  // creates dom tree recursively

  // reset rootNodes in each root rendering
  // existing rootNodes won't be just disappear, they will be replaced by the new ones.
  if (typekit.isNull(domParentNode)) {
    this.rootNodes = []
    this.numTotalRootNodes = Object.keys(view).length
  }

  // arrayify the input
  const views = typekit.isObject(view) ? [view] :
    typekit.isArray(view) ? view :
    typekit.isString(view) ? [view] :
    undefined

  if (views === undefined)
    throw new Error('Children must be one of an array, object, number or component name.')

  // iterate each input
  for (let i = 0; i < views.length; i++) {
    const input = views[i]

    // accept string only if it is a component indicator
    if (Frond.isComponentDirective(input)) {
      const component = this.parseComponentDirective(input)
      if (objectkit.getProp(viewContext, 'hasCommonComponent')) {
        component.readView(component.config.view, null, {
          markup: viewContext.markup,
          hasCommonComponent: Frond.hasCommonComponent(component.config.view)
        })
      }
      const domNodes = component.getDOMNodes()
      for (let j = 0; j < domNodes.length; j++) {
        domParentNode.insertBefore(domNodes[j], null)
      }
    }
    else if (typekit.isString(input)) {
      const domNode = Frond.getDocument().createTextNode(this.translate(input, {componentID: this.config.id}))
      domParentNode.insertBefore(domNode, null)
    }
    // object inputs require more in-depth analysis
    else if (typekit.isObject(input)) {
      // resolve input's expression
      const isExpression = this.isExpression(Object.keys(input)[0])
      const resolved = isExpression ? this.resolveExpression(input, isExpression) : input

      // do the same thing as done above for string inputs
      if (Frond.isComponentDirective(resolved)) {
        const component = this.parseComponentDirective(resolved)
        if (objectkit.getProp(viewContext, 'hasCommonComponent')) {
          component.readView(component.config.view, null, {
            markup: viewContext.markup,
            hasCommonComponent: Frond.hasCommonComponent(component.config.view)
          })
        }
        const domNodes = component.getDOMNodes()
        for (let j = 0; j < domNodes.length; j++) {
          domParentNode.insertBefore(domNodes[j], null)
        }
      }
      else if (typekit.isString(resolved)) {
        const domNode = Frond.getDocument().createTextNode(this.translate(resolved, {componentID: this.config.id}))
        domParentNode.insertBefore(domNode, null)
      }
      // a real view object.
      else if (typekit.isObject(resolved)) {
        // patch it into the dom
        const domTag = Object.keys(resolved)[0]
        if (domTag.toLowerCase() == 'svg') viewContext.markup = 'svg'
        const domNode = this.buildDOMNode(domTag, resolved[domTag], viewContext)
        if (typekit.isNull(domParentNode)) {
          this.rootNodes = this.rootNodes.concat([domNode])
          if (this.rootNodes.length === this.numTotalRootNodes) this.emit('insert')
        }
        else domParentNode.insertBefore(domNode, null)

        // handle text if value is just text
        if (typekit.isString(resolved[domTag])) {
          resolved[domTag] = {children: [resolved[domTag]]}
        }

        // continue reading it's children.
        if (validationkit.isNotEmpty(resolved[domTag].children)) {
          this.readView(this.parseComponentChildren(resolved[domTag].children), domNode, viewContext)
        }
      }
      // expressions may resolve to an array
      else if (typekit.isArray(resolved)) {
        // iterate each one but strings and objects only
        for (let j = 0; j < resolved.length; j++) {
          const resolvedItem = resolved[j]

          if (Frond.isComponentDirective(resolvedItem)) {
            const component = this.parseComponentDirective(resolvedItem)
            if (objectkit.getProp(viewContext, 'hasCommonComponent')) {
              component.readView(component.config.view, null, {
                markup: viewContext.markup,
                hasCommonComponent: Frond.hasCommonComponent(component.config.view)
              })
            }
            const domNodes = component.getDOMNodes()
            for (let k = 0; k < domNodes.length; k++) {
              domParentNode.insertBefore(domNodes[k], null)
            }
          }
          else if (typekit.isString(resolvedItem)) {
            const domNode = Frond.getDocument().createTextNode(this.translate(resolvedItem, {componentID: this.config.id}))
            domParentNode.insertBefore(domNode, null)
          }
          else if (typekit.isObject(resolvedItem)) {
            const domTag = Object.keys(resolvedItem)[0]
            if (domTag.toLowerCase() == 'svg') viewContext.markup = 'svg'
            const domNode = this.buildDOMNode(domTag, resolvedItem[domTag], viewContext)
            if (typekit.isNull(domParentNode)) {
              this.rootNodes = this.rootNodes.concat([domNode])
              if (this.rootNodes.length === this.numTotalRootNodes) this.emit('insert')
            }
            else domParentNode.insertBefore(domNode, null)

            if (validationkit.isNotEmpty(resolvedItem[domTag].children)) {
              if (domTag.toLowerCase() == 'svg') viewContext.markup = 'svg'
              this.readView(this.parseComponentChildren(resolvedItem[domTag].children), domNode, viewContext)
            }
          }
          else {
            continue
          }
        }
      }
      else {}
    }
    else {
      continue
    }
  }
}

Component.prototype.translate = function translate(input, topts) {
  const locale = Frond.config('locale')

  const w = Frond.getWindow()
  if (w.__FROND_LOCALIZE__) {
    w.__FROND_LOCALE__ = locale
    if (!w.__FROND_TRANSLATION_KEYS__.hasOwnProperty(topts.componentID))
      w.__FROND_TRANSLATION_KEYS__[topts.componentID] = []
    const t = {input: input}
    if (validationkit.isNotEmpty(topts.componentID)) t.componentID = topts.componentID
    if (validationkit.isNotEmpty(topts.note)) t.note = topts.note
    w.__FROND_TRANSLATION_KEYS__[topts.componentID].push(t)
  }

  return Frond.translate(locale, topts.componentID, input)
}

Component.prototype.isParsableDocumentExpression = function isParsableDocumentExpression(str) {
  return Frond.reDocumentDirectiveMatcher.test(str)
}

Component.prototype.applyDocumentContent = function applyDocumentContent(node, str, data) {
  const arr = str.slice(1).split('.')
  const markup = arr[1]
  if (Frond.hasMarkupSupport(markup)) {
    const html = Frond.parseDocument(markup, data, this)
    node.innerHTML = this.parseValue(this.parseValue(html))
    return;
  }
}

Component.prototype.buildDOMNode = function buildDOMNode(tag, obj, context) {
  const self = this
  const node =
    context.markup == 'html' ? Frond.getDocument().createElement(tag) :
    context.markup == 'svg' ? Frond.getDocument().createElementNS('http://www.w3.org/2000/svg', tag) :
    undefined
  if (typekit.isEmpty(node))
    throw new Error('Invalid markup (' + context.markup + ') represented.')

  if (!typekit.isObject(obj)) return node

  const excludedAttrs = ['children']
  Object
    .keys(obj)
    .filter(attr => excludedAttrs.indexOf(attr) === -1)
    .map(function(attr) {
      if (self.isParsableDocumentExpression(attr)) self.applyDocumentContent(node, attr, obj[attr])
      else self.setAttribute(node, attr, obj[attr], context)
    })
  return node
}

Component.prototype.getDOMNodes = function getDOMNodes() {
  return this.rootNodes
}

Component.prototype.getDOMNode = function getDOMNode() {
  return this.rootNodes[0]
}

Component.prototype.dom = function dom() {
  return this.rootNodes[0]
}

Component.prototype.resolveExpression = function resolveExpression(obj, expression) {
  const keys = Object.keys(obj)
  switch (expression) {
    case 'for':
      const k = keys[0]
      const fk = k.trim().replace(/[\s]{2,}/g, ' ')
      const arr = fk.slice(9).split(' ')
      if (arr.length !== 3) throw new Error('Invalid statement: ' + k)
      const [varNameStr, operator, dataPathStr] = arr
      const actualValue = this.parseDirective(dataPathStr)
      if (validationkit.isNotEmpty(actualValue) && typekit.isArray(actualValue)) {
        const literalPaths = Object.keys(objectkit.flatten(actualValue[0]))
        const iterTemplate = obj[k]
        const iterTemplateStr = JSON.stringify(iterTemplate)

        return actualValue.map(function(o) {
          const templateStr = literalPaths.reduce(function(memo, literalPath) {
            memo = memo.replace(
              new RegExp('@' + varNameStr + '.' + literalPath, 'gm'),
              objectkit.getProp(o, literalPath.split('.'))
            )
            return memo
          }, iterTemplateStr)

          return JSON.parse(templateStr)
        })
      }

      if (keys.length > 1 && keys[1] == 'otherwise') {
        return obj[keys[1]]
      }

      return ''
    break;
    case 'case':
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]
        const fk = k.trim().replace(/[\s]{2,}/g, ' ')
        if (fk == 'otherwise') {
          return obj[k]
        }
        const arr = fk.slice(5).split(' ')
        if (arr.length < 3) throw new Error('Invalid statement: ' + k)
        const [dataPathStr, operator, valueStr] = arr
        if (!this.isExpressionOperator(operator)) throw new Error('Invalid expression operator: ' + operator)
        const actualValue = this.parseDirective(dataPathStr)
        const inputValue = functionkit.destringify(valueStr, typekit.getType(actualValue))
        if (this.checkExpressionCondition(actualValue, inputValue, operator) === true) {
          return obj[k]
        }
      }

      throw new Error('All cases failed and no otherwise statement found.')
    break;
    default:
      throw new Error('Invalid expression: ' + expression)
  }
}

Component.prototype.parseDirective = function parseDirective(str) {
  const arr = str.slice(1).split('.')
  const [resource, ...rest] = arr
  if (resource == 'router') {
    return Frond.getRouter(arr[1]).get(arr[2]).fullpath
  }
  else if (resource == 'state') {
    return objectkit.getProp(this.stateManager.getState(), rest)
  }
  else if (resource == 'props') {
    return objectkit.getProp(this.getData().props, rest)
  }
  else if (resource == 'component') {
    if (Frond.hasComponent(rest[0]) !== true)
      throw new Error('The component (' + rest[0] + ') not found inside Frond.')
    return Frond.getComponent(rest[0])
  }
  else {
    return str
  }
}

Component.prototype.parseValue = function parseValue(str) {
  const self = this
  if (!typekit.isString(str))
    throw new Error('Couldnt parse the value because of it is ' + typekit.getType(str))

  // match directives
  if (Frond.reDirectiveMatcher.test(str) !== true) return str
  const matches = str.match(Frond.reDirectiveMatcher)
  if (validationkit.isEmpty(matches)) return str

  return matches.reduce(function(memo, directive) {
    const result = self.parseDirective(directive)
    memo = memo.replace(directive, result)
    return memo
  }, str)
}

Component.prototype.parseComponentChildren = function parseComponentChildren(input) {
  if (typekit.isString(input)) return this.parseValue(input)
  else if (typekit.isArray(input)) return input
    .map(inp => typekit.isString(inp) ? this.parseValue(inp) : inp)
  else return input
}

Component.prototype.parseComponentDirective = function parseComponentDirective(input) {
  const matches = input.match(Frond.reComponentDirectiveMatcher)
  if (validationkit.isEmpty(matches)) return input
  return this.parseDirective(matches[0])
}

Component.prototype.isRouteDescription = function isRouteDescription(str) {
  return Frond.reRouterDirectiveMatcher.test(str)
}

Component.prototype.resolveRouteDescription = function resolveRouteDescription(str) {
  const arr = str.slice(1).split('.')
  return {routerID: arr[1], routeID: arr[2]}
}

Component.prototype.setAttribute = function setAttribute(node, attr, value, context) {
  const self = this
  const isExpression = typekit.isObject(value) && self.isExpression(Object.keys(value)[0])
  const resolved = isExpression ? self.resolveExpression(value, isExpression) : value

  let formatted;
  switch (attr) {
    case 'class':
      if (typekit.isString(resolved)) formatted = self.parseValue(resolved)
      if (typekit.isArray(resolved)) formatted = resolved
        .map(item => self.parseValue(item))
        .join(' ')
    break;
    case 'style':
      if (typekit.isString(resolved)) formatted = self.parseValue(resolved)
      if (typekit.isObject(resolved)) formatted = Object
        .keys(resolved)
        .map(function(prop) {
          node.style[prop] = self.parseValue(resolved[prop])
        })
      return;
    break;
    case 'dataset':
      if (typekit.isObject(resolved)) formatted = Object
        .keys(resolved)
        .map(function(prop) {
          node.dataset[prop] = self.parseValue(resolved[prop])
        })
      return;
    break;
    case 'text':
      const textnode = Frond.getDocument().createTextNode(
        self.parseValue(
          self.translate(resolved, {componentID: this.config.id})
        )
      )
      node.insertBefore(textnode, null)
      return;
    break;
    case 'href':
      if (typekit.isString(resolved)) {
        if (self.isRouteDescription(resolved)) {
          const directive = self.resolveRouteDescription(resolved)
          node.addEventListener('click', function(event) {
            event.preventDefault()
            Frond.getRouter(directive.routerID).shift(directive.routeID)
            return false
          })
        }

        formatted = self.parseValue(resolved)

        if (node.tagName.toLowerCase() != 'a') return;
      }
    break;
    default:
      formatted = self.parseValue(resolved)
  }

  if (typekit.isUndefined(formatted)) {
    return;
  }

  if (attr.length > 11 && 'translator-' == attr.slice(0, 11)) {
    return;
  }

  if (context.markup == 'html')
    return node.setAttribute(attr, formatted)

  if (context.markup == 'svg')
    return node.setAttributeNS(self.findDOMNodeAttrNamespace(attr, context), attr, formatted)
}

Component.prototype.findDOMNodeAttrNamespace = function findDOMNodeAttrNamespace(attr, context) {
  return Frond.domNodeAttrNamespaceMap.hasOwnProperty(attr) ? Frond.domNodeAttrNamespaceMap[attr] : null
}

Component.prototype.update = function update(payload) {
  if (this.stateManager) {
    this.emit('beforeUpdate', [this.stateManager.getState(), payload])
    this.stateManager.updateState(payload)
  }
}

Component.prototype.registerLifecycleEvents = function registerLifecycleEvents(obj) {
  if (!validationkit.isObject(obj)) return;

  Object
    .keys(obj)
    .filter(name => typekit.isFunction(obj[name]))
    .map(name => this.on(name, obj[name]))

  this.emit('init')
}

Component.prototype.registerDOMEvents = function registerDOMEvents(obj) {
  if (!validationkit.isObject(obj)) return;
  const self = this
  const rootDomNode = this.rootNodes[0]
  Object
    .keys(obj)
    .filter(qs => typekit.isObject(obj[qs]))
    .map(function(qs) {
      const matches = rootDomNode.querySelectorAll(qs)
      if (validationkit.isNotEmpty(matches)) {
        for (let i = 0; i < matches.length; i++) {
          const domNode = matches[i]
          Object.keys(obj[qs]).map(eventName => domNode.addEventListener(eventName, obj[qs][eventName]))
        }
      }
    })
}

Component.prototype.registerComponentDOMEventListeners = function registerComponentDOMEventListeners(qs, obj) {
  const rootDomNode = this.rootNodes[0]
  const matches = rootDomNode.querySelectorAll(qs)
  if (validationkit.isNotEmpty(matches)) {
    for (let i = 0; i < matches.length; i++) {
      const domNode = matches[i]
      Object.keys(obj).map(eventName => domNode.addEventListener(eventName, obj[eventName]))
    }
  }
}

Component.prototype.registerDOMEventListener = function registerDOMEventListener(qs, obj) {
  const rootDomNode = this.rootNodes[0]
  const matches = rootDomNode.querySelectorAll(qs)
  if (validationkit.isNotEmpty(matches)) {
    for (let i = 0; i < matches.length; i++) {
      const domNode = matches[i]
      Object.keys(obj).map(eventName => domNode.addEventListener(eventName, obj[eventName]))
    }
  }
}

export default Component
