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
    this.data._form.fields = objectkit.flatten(this.data._form.fields)
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
  const flatName = name.indexOf('.value') === -1 ? name + '.value' : name
  const match = objectkit.getProp(this.getFormFields(), flatName)
  if (typekit.isUndefined(match)) {
    const match2 = objectkit.getProp(objectkit.unflatten(this.getFormFields()), name)
    const match2Formatted = match2.map(function(obj) {
      return Object.keys(obj).reduce(function(memo, key) {
        memo[key] = objectkit.getProp(obj[key], 'value', obj[key])
        return memo
      }, {})
    })
    return match2Formatted
  }
  return match
}

Model.prototype.updateFormDataFlat = function updateFormDataFlat(name, value) {
  const prevValue = this.data._form.fields[name]
  if (!validationkit.isEqual(prevValue, value)) {
    this.data._form.fields[name] = value
    const field = name.indexOf('.value') !== -1 ? name.replace('.value', '') : name
    this.component.emit('formUpdate', [field, value, prevValue])
  }
}

Model.prototype.updateFormData = function updateFormData(payload, opts={}) {
  const _opts = Object.assign({}, opts || {})
  const updatedFormData = objectkit.assignDeep([objectkit.unflatten(this.getFormFields()), payload], _opts)
  this.data._form.fields = objectkit.flatten(updatedFormData)
}

Model.prototype.inFormSchema = function inFormSchema(name) {
  const fields = this.getFormFields()
  return validationkit.isNotEmpty(fields) && fields.hasOwnProperty(name)
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
