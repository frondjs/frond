import {typekit, objectkit, validationkit, functionkit} from 'basekits'
import EventEmitterObject from 'event-emitter-object'
import Model from './model'
import Frond from './frond'

function Component(config) {
  EventEmitterObject.call(this, {})

  this.config = config
  this.rootNodes = []
  this.initialRenderDone = false
  this.model = undefined

  Frond.registerComponent(this)
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
    const spaceSuffix = p != 'otherwise' ? ' ' : ''
    if (str.indexOf(p + spaceSuffix) === 0) return p
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

Component.prototype.render = function render() {
  if (this.initialRenderDone !== true) {
    this.registerLifecycleEvents(this.config.on)
    this.model = new Model(this)
  }

  this.readView(this.config.view, null, {
    markup: 'html',
    hasCommonComponent: Frond.hasCommonComponent(this.config.view)
  })
  this.registerDOMEvents(this.config.on)
  this.initialRenderDone = true
  return this
}

Component.prototype.rebuildDOMTree = function rebuildDOMTree(curState, prevState) {
  const parent = this.rootNodes[0].parentNode
  const backupRootNodes = [].concat(this.rootNodes)

  this.render()

  for (let i = 0; i < backupRootNodes.length; i++) {
    parent.replaceChild(this.rootNodes[i], backupRootNodes[i])
  }

  this.emit('update', [curState, prevState])
}

Component.prototype.getState = function getState() {
  return this.model.getState()
}

Component.prototype.update = function update(payload) {
  return this.model.update(payload)
}

Component.prototype.getForm = function getForm() {
  return this.model.getForm()
}

Component.prototype.getInput = function getInput(name) {
  return this.model.getFormFieldValueFromInputName(name)
}

Component.prototype.updateInput = function updateInput(name, value) {
  this.model.updateFormFieldValueFromInputName(name, value, {updateDOM: true})
}

Component.prototype.updateInputDOM = function updateInputDOM(field, value) {
  if (!field.qs) return false

  const element = this.dom().querySelector(field.qs)
  if (!element) return false

  // input, textarea, checkbox, radio, select
  if (!field.type) return false
  const {type} = field
  if (type == 'input') {
    element.value = value
  }
  else if (type == 'textarea') {
    element.value = value
  }
  else if (type == 'checkbox') {
    element.checked = value === true ? true : false
  }
  else if (type == 'radio') {
    const radioqs = 'input[name="' + field.name + '"][value="' + value + '"]'
    const radioElement = this.dom().querySelector(radioqs)
    if (radioElement) {
      radioElement.checked = true
    }
  }
  else if (type == 'select') {
    if (field.multiple) {
      let isChanged = false
      for (let j = 0; j < element.options.length; j++) {
        const opt = element.options[j]
        const v = opt.getAttribute('value')
        if (opt.selected === true && value.indexOf(v) === -1) {
          opt.selected = false
          isChanged = true
        }
        if (opt.selected === false && value.indexOf(v) !== -1) {
          opt.selected = true
          isChanged = true
        }
      }
      if (isChanged) element.dispatchEvent(new Event('change'))
    }
    else {
      const prevValue = element.value
      element.value = value
      if (prevValue != value) element.dispatchEvent(new Event('change'))
    }
  }
  else {
    return false
  }

  return true
}

Component.prototype.readView = function readView(view, domParentNode = null, viewContext = {}) {
  // creates dom tree of the component, recursively

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
      const _isExpression = this.isExpression(Object.keys(input)[0])
      const _resolved = _isExpression ? this.resolveExpression(input, _isExpression) : input
      // double check. sometimes a for loop came after case expression.
      const isExpression = typekit.isObject(_resolved) ? this.isExpression(Object.keys(_resolved)[0]) : false
      const resolved = isExpression ? this.resolveExpression(_resolved, isExpression) : _resolved

      // do the same thing as done above for string inputs
      if (Frond.isComponentDirective(resolved)) {
        const component = this.parseComponentDirective(resolved)
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
          if (this.rootNodes.length === this.numTotalRootNodes && !this.initialRenderDone) this.emit('insert')
        }
        else domParentNode.insertBefore(domNode, null)

        // handle text if value is just text
        if (typekit.isString(resolved[domTag])) {
          resolved[domTag] = {children: [this.translate(resolved[domTag], {componentID: this.config.id})]}
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
              if (this.rootNodes.length === this.numTotalRootNodes && !this.initialRenderDone) this.emit('insert')
            }
            else domParentNode.insertBefore(domNode, null)

            // handle text if value is just text
            if (typekit.isString(resolvedItem[domTag])) {
              resolvedItem[domTag] = {children: [this.translate(resolvedItem[domTag], {componentID: this.config.id})]}
            }

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
  return Frond.translate(Frond.config('locale'), topts.componentID, input)
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

  // check form inputs
  // values of the form inputs controlled internally if there is form schema defined

  // control all input elements except $exceptionalInputTypes
  const exceptionalInputTypes = ['checkbox', 'radio', 'file']
  if (
    tag == 'input' &&
    obj.hasOwnProperty('name') &&
    obj.hasOwnProperty('type') &&
    exceptionalInputTypes.indexOf(obj.type) === -1 &&
    self.model.isInputDefinedInFormSchema(obj.name)
  ) {
    self.model.updateFormFieldAttrs(obj.name, {
      type: 'input',
      qs: 'input[name="' + obj.name + '"]'
    })
    // set value
    obj.value = self.model.getFormFieldValueFromInputName(obj.name)
    // track value
    self.updateEventListenerConfig({
      fieldName: obj.name,
      querySelector: 'input[name="' + obj.name + '"]',
      eventName: 'input',
      fn: function(e, component) {
        self.model.updateFormFieldValueFromInputName(obj.name, e.target.value)
      }
    })
  }

  // textarea
  if (
    tag == 'textarea' &&
    obj.hasOwnProperty('name') &&
    self.model.isInputDefinedInFormSchema(obj.name)
  ) {
    self.model.updateFormFieldAttrs(obj.name, {
      type: 'textarea',
      qs: 'textarea[name="' + obj.name + '"]'
    })
    // set value
    obj.text = self.model.getFormFieldValueFromInputName(obj.name)
    // track value
    self.updateEventListenerConfig({
      fieldName: obj.name,
      querySelector: 'textarea[name="' + obj.name + '"]',
      eventName: 'input',
      fn: function(e, component) {
        self.model.updateFormFieldValueFromInputName(obj.name, e.target.value)
      }
    })
  }

  // file inputs
  if (
    tag == 'input' &&
    obj.hasOwnProperty('name') &&
    obj.hasOwnProperty('type') &&
    obj.type == 'file' &&
    self.model.isInputDefinedInFormSchema(obj.name)
  ) {
    self.updateEventListenerConfig({
      fieldName: obj.name,
      querySelector: 'input[name="' + obj.name + '"]',
      eventName: 'change',
      fn: function(e, component) {
        self.model.updateFormFieldValueFromInputName(obj.name, e.target.files)
      }
    })
  }

  // checkboxes
  if (
    tag == 'input' &&
    obj.hasOwnProperty('name') &&
    obj.hasOwnProperty('type') &&
    obj.type == 'checkbox' &&
    self.model.isInputDefinedInFormSchema(obj.name)
  ) {
    self.model.updateFormFieldAttrs(obj.name, {
      type: 'checkbox',
      qs: 'input[name="' + obj.name + '"]'
    })
    // set value
    const cvalue = self.model.getFormFieldValueFromInputName(obj.name)
    obj.checked = cvalue ? true : false
    // track value
    self.updateEventListenerConfig({
      fieldName: obj.name,
      querySelector: 'input[name="' + obj.name + '"]',
      eventName: 'click',
      fn: function(e, component) {
        self.model.updateFormFieldValueFromInputName(obj.name, e.target.checked === true)
      }
    })
  }

  // radio buttons
  if (
    tag == 'input' &&
    obj.hasOwnProperty('name') &&
    obj.hasOwnProperty('type') &&
    obj.type == 'radio' &&
    self.model.isInputDefinedInFormSchema(obj.name)
  ) {
    self.model.updateFormFieldAttrs(obj.name, {
      type: 'radio',
      qs: 'input[id="' + obj.id + '"]',
      name: obj.name
    })
    // set value
    const rvalue = self.model.getFormFieldValueFromInputName(obj.name)
    obj.checked = rvalue == obj.value ? true : false
    // track value
    self.updateEventListenerConfig({
      fieldName: obj.name,
      querySelector: 'input[id="' + obj.id + '"]',
      eventName: 'click',
      fn: function(e, component) {
        self.model.updateFormFieldValueFromInputName(obj.name, e.target.value)
      }
    })
  }

  // select elements
  if (
    tag == 'select' &&
    obj.hasOwnProperty('name') &&
    self.model.isInputDefinedInFormSchema(obj.name)
  ) {
    self.model.updateFormFieldAttrs(obj.name, {
      type: 'select',
      qs: 'select[name="' + obj.name + '"]',
      multiple: obj.hasOwnProperty('multiple')
    })
    // set value
    self.updateEventListenerConfig({
      fieldName: obj.name,
      querySelector: 'select[name="' + obj.name + '"]',
      eventName: 'ready',
      fn: function(elem, component) {
        if (obj.hasOwnProperty('multiple')) {
          const values = self.model.getFormFieldValueFromInputName(obj.name)
          for (var i = 0; i < elem.options.length; i++) {
            const o = elem.options[i]
            if (values.indexOf(o.getAttribute('value')) !== -1) o.selected = true
          }
        }
        else {
          elem.value = self.model.getFormFieldValueFromInputName(obj.name)
        }
      }
    })
    self.updateEventListenerConfig({
      fieldName: obj.name,
      querySelector: 'select[name="' + obj.name + '"]',
      eventName: 'change',
      fn: function(e, component) {
        if (obj.hasOwnProperty('multiple')) {
          const values = []
          for (var i = 0; i < e.target.options.length; i++) {
            const o = e.target.options[i]
            if (o.selected === true) values.push(o.getAttribute('value'))
          }
          self.model.updateFormFieldValueFromInputName(obj.name, values)
        }
        else {
          self.model.updateFormFieldValueFromInputName(obj.name, e.target.value)
        }
      }
    })
  }

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

Component.prototype.updateEventListenerConfig = function updateEventListenerConfig(opts) {
  const self = this
  const {fieldName, querySelector, eventName, fn} = opts
  if (validationkit.isEmpty(self.config.on)) {
    self.config.on = {}
  }
  if (validationkit.isEmpty(self.config.on[querySelector])) {
    self.config.on[querySelector] = {}
  }
  if (validationkit.isEmpty(objectkit.getProp(self.config, ['on', querySelector, eventName]))) {
    self.config.on[querySelector][eventName] = []
  }
  if (!typekit.isArray(self.config.on[querySelector][eventName])) {
    self.config.on[querySelector][eventName] = [self.config.on[querySelector][eventName]]
  }
  self.config.on[querySelector][eventName].unshift(fn)
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
      const [varNames, operator, dataPathStr] = arr
      const actualValue = this.parseDirective(dataPathStr)
      if (validationkit.isNotEmpty(actualValue)) {
        const literalPaths = typekit.isObject(actualValue)
          ? Object.keys(objectkit.flatten(actualValue))
          : typekit.isArray(actualValue)
            ? (
                typekit.isObject(actualValue[0])
                  ? Object.keys(objectkit.flatten(actualValue[0]))
                  : actualValue
              )
            : typekit.isNumber(actualValue)
              ? new Array(actualValue).fill(0).map((v,i) => i)
              : []
        const iterTemplate = obj[k]
        const iterTemplateStr = JSON.stringify(iterTemplate)
        const varNamesArr = varNames.split(',')
        const varNameStr = varNamesArr[0]
        const indexVarName = varNamesArr.length > 1 ? varNamesArr[1] : undefined
        const iterActualValue = typekit.isNumber(actualValue)
          ? Array(actualValue).fill(0).map((v,i) => i.toString())
          : actualValue

        return iterActualValue.map(function(o, ind) {
          // replace index numbers
          const preparsedTemplateStr = indexVarName
            ? iterTemplateStr.replace(new RegExp('@' + indexVarName, 'gm'), ind)
            : iterTemplateStr
          //const reLiteralExpr = /@{[\S]+\s[+]\s[\S]+}/g
          const templateStr = literalPaths.reduce(function(memo, literalPath) {
            if (typekit.isString(o)) {
              memo = memo.replace(new RegExp('@' + varNameStr, 'gm'), o)
            }
            else if (typekit.isObject(o)) {
              memo = memo.replace(
                new RegExp('@' + varNameStr + '.' + literalPath, 'gm'),
                objectkit.getProp(o, literalPath.split('.'))
              )
            }
            else {}
            return memo
          }, preparsedTemplateStr)

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
        if (arr.length === 1) {
          // case $var: checks $var for non-emptiness
          if (validationkit.isNotEmpty(this.parseDirective(arr[0]))) {
            return obj[k]
          }
        }
        else if (arr.length === 3) {
          const [dataPathStr, operator, valueStr] = arr
          if (!this.isExpressionOperator(operator)) throw new Error('Invalid expression operator: ' + operator)
          const actualValue = this.parseDirective(dataPathStr)
          if (!typekit.isUndefined(actualValue)) {
            const inputValue = functionkit.destringify(this.parseDirective(valueStr), typekit.getType(actualValue))
            if (this.checkExpressionCondition(actualValue, inputValue, operator) === true) {
              return obj[k]
            }
          }
        }
        else {
          throw new Error('Invalid statement: ' + k)
        }
      }

      throw new Error('All cases failed and no otherwise statement found.')
    break;
    default:
      throw new Error('Invalid expression: ' + expression)
  }
}

Component.prototype.parseDirective = function parseDirective(str) {
  if (str.length === 0) return str
  if (str.slice(0, 1) != '@') return str
  const directives = str.split('@').filter(s => s)
  if (directives.length > 1) {
    const final = '@' + directives
      .map((d, i) => i == directives.length-1 ? this.parseDirective('@' + directives[directives.length-1]) : d)
      .join('')
    return this.parseDirective(final)
  }
  const arr = str.slice(1).split('.')
  const [resource, ...rest] = arr
  if (resource == 'router') {
    const routeid = arr[2]
    const routelocale = arr.length > 3 ? arr[3] : undefined
    return Frond.getRouter(arr[1]).get(routeid, routelocale).fullpath
  }
  else if (resource == 'state') {
    return objectkit.getProp(this.model.getState(), rest)
  }
  else if (resource == 'props') {
    return objectkit.getProp(this.model.getData().props, rest)
  }
  else if (resource == 'form') {
    return this.model.getFormFieldValueFromInputName(rest)
  }
  else if (resource == 'component') {
    if (Frond.hasComponent(rest[0]) !== true)
      throw new Error('The component (' + rest[0] + ') not found inside Frond.')
    return Frond.getComponent(rest[0]).render()
  }
  else {
    return str
  }
}

Component.prototype.parseValue = function parseValue(str) {
  const self = this

  if (typekit.isNumber(str)) return str.toString()
  if (typekit.isBoolean(str)) return str

  if (!typekit.isString(str)) {
    Frond.log('error', str)
    throw new Error('Couldnt parse the value because of it is ' + typekit.getType(str))
  }

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
          self.translate(resolved, {componentID: self.config.id})
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
    case 'title':
    case 'alt':
      formatted = self.parseValue(self.translate(resolved, {componentID: self.config.id}))
    break;
    case 'translate':
      const keys = typekit.isString(resolved) ? [resolved] : resolved
      keys.map(k => self.translate(k, {componentID: self.config.id}))
      return;
    break;
    default:
      formatted = self.parseValue(resolved)
  }

  if (typekit.isUndefined(formatted) || formatted === false) {
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

Component.prototype.registerLifecycleEvents = function registerLifecycleEvents(obj) {
  if (!validationkit.isObject(obj)) return;

  Object
    .keys(obj)
    .filter(name => typekit.isFunction(obj[name]))
    .map(name => this.on(name, obj[name]))

  this.emit('init')
}

Component.prototype.registerDOMEvents = function registerDOMEvents(obj) {
  const self = this

  if (!validationkit.isObject(obj)) return self;

  const rootDomNode = this.rootNodes[0]

  const querystrings = Object.keys(obj).filter(qs => typekit.isObject(obj[qs]))
  for (let i = 0; i < querystrings.length; i++) {
    const qs = querystrings[i]
    const matches = rootDomNode.querySelectorAll(qs)
    if (validationkit.isNotEmpty(matches)) {
      for (let j = 0; j < matches.length; j++) {
        const match = matches[j]
        const events = Object.keys(obj[qs])
        for (let k = 0; k < events.length; k++) {
          const evname = events[k]
          const evlisteners = !typekit.isArray(obj[qs][evname]) ? [obj[qs][evname]] : obj[qs][evname]

          if (evname == 'ready') {
            delete obj[qs][evname]
            functionkit.waitForIt(
              () => validationkit.isNotEmpty(Frond.getDocument().querySelector(qs)),
              () => evlisteners.map(f => f.call(self, match, self)),
              100,
              500
            )
          }
          else {
            match.addEventListener(evname, function(e) {
              evlisteners.map(f => f.call(this, e, self))
            })
          }
        }
      }
    }
  }

  return self
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
