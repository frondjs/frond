import Frond from './frond'
import {typekit, objectkit, validationkit, functionkit} from 'basekits'
import StateManagerObject from 'state-manager-object'

function Model(component) {
  this.component = component
  this.data = {props: {}, _form:{}}
  this.dataTypes = {props: {}, state: {}}
  this.stateManager = undefined

  this.read()
}

Model.prototype.read = function read() {
  const {component} = this
  const {config} = component

  if (validationkit.isEmpty(config.model)) return;

  const model = typekit.isFunction(config.model)
    ? config.model.apply(component)
    : config.model

  // check props
  if (validationkit.isNotEmpty( typekit.isObject( objectkit.getProp(model, 'props') ) )) {
    this.data.props = model.props

    // store prop types
    Object.keys(this.data.props).map(prop => {
      this.dataTypes.props[prop] = typekit.getType(this.data.props[prop])
    })
  }

  // check state
  if (validationkit.isNotEmpty( typekit.isObject( objectkit.getProp(model, 'state') ) )) {
    this.stateManager = new StateManagerObject(model.state)

    this.stateManager.on('update', function(curState, prevState) {
      return component.rebuildDOMTree(curState, prevState)
    })

    // store state parameter types
    Object.keys(model.state).map(prop => {
      this.dataTypes.state[prop] = typekit.getType(model.state[prop])
    })
  }

  // check form schema
  if (validationkit.isNotEmpty( typekit.isObject( objectkit.getProp(model, 'form') ) )) {
    this.data._form = model.form
  }

  // check network request configuration
  if (validationkit.isNotEmpty( objectkit.getProp(model, 'fetch') )) {
    if (validationkit.isNotEmpty( objectkit.getProp(model.fetch, 'client') )) {
      Frond.activateNetworkClient(model.fetch.client)
    }

    this.emit('beforeFetch')

    Frond.getNetworkClient().fetch(model.fetch, function(err, response) {
      if (validationkit.isNotEmpty(objectkit.getProp(response, 'body'))) {
        this.emit('fetch', response)
      }
    }.bind(this))
  }
}

Model.prototype.getData = function getData() {
  return Object.assign({}, this.data, {
    state: this.stateManager ? this.stateManager.getState() : {}
  })
}

Model.prototype.getProps = function getProps() {
  return this.data.props
}

Model.prototype.getState = function getState() {
  return this.stateManager ? this.stateManager.getState() : undefined
}

Model.prototype.getForm = function getForm() {
  return objectkit.getProp(this.getData(), '_form')
}

Model.prototype.getFormFields = function getFormFields() {
  return objectkit.getProp(this.getForm(), 'fields')
}

Model.prototype.getFormField = function getFormField(name) {
  // name here is a top level property in form fields
  return objectkit.getProp(this.getFormFields(), name)
}

Model.prototype.getFormFieldValueFromInputName = function getFormFieldValueFromInputName(name) {
  // possible name values are "example", "example[0].test"
  if (/\[[0-9]+\]\./.test(name)) {
    const n = name.slice(0, name.indexOf('['))
    const ind = parseFloat(name.slice(name.indexOf('[')+1, name.indexOf(']')))
    const childn = name.slice(name.indexOf('].') + 2)

    const fieldarr = objectkit.getProp(this.data._form.fields, n)
    if (!typekit.isArray(fieldarr)) return undefined
    if (fieldarr.length - 1 < ind) return undefined
    if (!typekit.isObject(fieldarr[ind])) return undefined
    if (typekit.isUndefined(objectkit.getProp(fieldarr[ind], [childn, 'value']))) return undefined

    return this.data._form.fields[n][ind][childn].value
  }

  if (!typekit.isUndefined(objectkit.getProp(this.data._form.fields[name], 'value'))) {
    return this.data._form.fields[name].value
  }

  return undefined
}

Model.prototype.updateFormField = function updateFormField(name, payload, _opts={}) {
  // name here is a top level property in form fields
  const opts = Object.assign({}, {concat: true}, _opts)
  const fieldobj = this.data._form.fields[name]
  if (typekit.isObject(fieldobj) && typekit.isObject(payload)) {
    this.data._form.fields[name] = opts.concat === true
      ? Object.assign({}, this.data._form.fields[name], payload)
      : payload
    return true
  }
  if (typekit.isArray(fieldobj) && typekit.isArray(payload)) {
    this.data._form.fields[name] = opts.concat === true
      ? this.data._form.fields[name].concat(payload)
      : payload
    return true
  }
  return false
}

Model.prototype.updateFormFieldAttrs = function updateFormFieldAttrs(name, payload, _opts={}) {
  // possible name values are "example", "example[0].test"
  const opts = Object.assign({}, {concat: true}, _opts)

  if (/\[[0-9]+\]\./.test(name)) {
    const n = name.slice(0, name.indexOf('['))
    const ind = parseFloat(name.slice(name.indexOf('[')+1, name.indexOf(']')))
    const childn = name.slice(name.indexOf('].') + 2)

    const fieldarr = objectkit.getProp(this.data._form.fields, n)
    if (!typekit.isArray(fieldarr)) return false
    if (fieldarr.length - 1 < ind) return false
    if (!typekit.isObject(fieldarr[ind])) return false
    if (typekit.isUndefined(objectkit.getProp(fieldarr[ind], [childn, 'value']))) return false

    const prevValue = this.data._form.fields[n][ind][childn].value
    this.data._form.fields[n][ind][childn] = opts.concat === true
      ? Object.assign({}, this.data._form.fields[n][ind][childn], payload)
      : payload
    const currentValue = this.data._form.fields[n][ind][childn].value

    if (!validationkit.isEqual(prevValue, currentValue)) {
      const fieldobj = this.data._form.fields[n][ind][childn]
      if (fieldobj.qs) this.component.updateInputDOM(fieldobj, currentValue)
      this.component.emit('formUpdate', [name, currentValue, prevValue])
    }

    return true
  }

  if (!typekit.isUndefined(objectkit.getProp(this.data._form.fields[name], 'value'))) {
    const prevValue = this.data._form.fields[name].value
    this.data._form.fields[name] = opts.concat === true
      ? Object.assign({}, this.data._form.fields[name], payload)
      : payload
    const currentValue = this.data._form.fields[name].value

    if (!validationkit.isEqual(prevValue, currentValue)) {
      const fieldobj = this.data._form.fields[name]
      if (fieldobj.qs) this.component.updateInputDOM(fieldobj, currentValue)
      this.component.emit('formUpdate', [name, currentValue, prevValue])
    }

    return true
  }

  return false
}

Model.prototype.updateFormFieldValueFromInputName = function updateFormFieldValueFromInputName(name, value, _opts={}) {
  // possible name values are "example", "example[0].test"
  const opts = Object.assign({}, {updateDOM: true}, _opts)
  if (/\[[0-9]+\]\./.test(name)) {
    const n = name.slice(0, name.indexOf('['))
    const ind = parseFloat(name.slice(name.indexOf('[')+1, name.indexOf(']')))
    const childn = name.slice(name.indexOf('].') + 2)

    const fieldarr = objectkit.getProp(this.data._form.fields, n)
    if (!typekit.isArray(fieldarr)) return false
    if (fieldarr.length - 1 < ind) return false
    if (!typekit.isObject(fieldarr[ind])) return false
    if (typekit.isUndefined(objectkit.getProp(fieldarr[ind], [childn, 'value']))) return false

    const prevValue = this.data._form.fields[n][ind][childn].value
    this.data._form.fields[n][ind][childn].value = value
    if (opts.updateDOM) {
      this.component.updateInputDOM(this.data._form.fields[n][ind][childn], value)
    }
    this.component.emit('formUpdate', [name, value, prevValue])
    return true
  }

  if (!typekit.isUndefined(objectkit.getProp(this.data._form.fields[name], 'value'))) {
    const prevValue = this.data._form.fields[name].value
    this.data._form.fields[name].value = value
    if (opts.updateDOM) {
      this.component.updateInputDOM(this.data._form.fields[name], value)
    }
    this.component.emit('formUpdate', [name, value, prevValue])
    return true
  }

  return false
}

Model.prototype.isInputDefinedInFormSchema = function isInputDefinedInFormSchema(name) {
  // possible name values are "example", "example[0].test"
  if (/\[[0-9]+\]\./.test(name)) {
    const n = name.slice(0, name.indexOf('['))
    const ind = parseFloat(name.slice(name.indexOf('[')+1, name.indexOf(']')))
    const childn = name.slice(name.indexOf('].') + 2)

    const fieldarr = objectkit.getProp(this.data._form.fields, n)
    if (!typekit.isArray(fieldarr)) return false
    if (fieldarr.length - 1 < ind) return false
    if (!typekit.isObject(fieldarr[ind])) return false
    if (typekit.isUndefined(objectkit.getProp(fieldarr[ind], [childn, 'value']))) return false
    return true
  }

  if (!typekit.isUndefined(objectkit.getProp(this.data._form.fields[name], 'value'))) {
    return true
  }

  return false
}

Model.prototype.getDataType = function getDataType(path) {
  return objectkit.getProp(this.dataTypes, path)
}

Model.prototype.update = function update(payload) {
  if (this.stateManager) {
    this.component.emit('beforeUpdate', [this.stateManager.getState(), payload])
    this.stateManager.updateState(payload)
  }
}

export default Model
