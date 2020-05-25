import {typekit, objectkit, validationkit} from 'basekits'
import localstore from 'local-storage-pro'
import Frond from './frond'

function NetworkClient(config) {
  this.config = undefined
  this.configure(config)

  Frond.registerNetworkClient(this)
}

NetworkClient.prototype.configure = function configure(userConfig = {}) {
  const defaultConfig = {
    id: 'initial',
    userCache: {
      lifetime: 0
    },
    url: '',
    method: 'GET',
    headers: {
      Origin: Frond.getWindow().location.origin
    }
  }

  this.config = Object.assign(
    {},
    defaultConfig,
    userConfig,
    {
      headers: Object.assign({}, defaultConfig.headers, objectkit.getProp(userConfig, 'headers', {})),
      userCache: Object.assign({}, defaultConfig.userCache, objectkit.getProp(userConfig, 'userCache', {}))
    }
  )

  this.urlObject = new URL(this.config.url)
  this.config.url = this.urlObject.toString()
}

NetworkClient.prototype.objectifyFormData = function objectifyFormData(formdata) {
  const obj = {}

  for (var pair of formdata.entries()) {
    const name = pair[0]
    const value = pair[1]

    if (obj.hasOwnProperty(name)) {
      obj[name] = [obj[name]]
      obj[name].push(value)
    }
    else {
      obj[name] = value
    }
  }

  return obj
}

NetworkClient.prototype.buildFetchOptions = function buildFetchOptions(config) {
  const opts = {
    method: config.method,
    headers: config.headers
  }

  // correct origin
  if (validationkit.isEmpty(opts.headers.Origin)) {
    opts.headers.Origin = Frond.getWindow().location.origin
  }

  const bodyMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
  if (validationkit.isNotEmpty(config.body) && bodyMethods.indexOf(opts.method) !== -1)
    opts.body = config.body
  if (validationkit.isNotEmpty(config.mode)) opts.mode = config.mode
  if (validationkit.isNotEmpty(config.credentials)) opts.credentials = config.credentials
  if (validationkit.isNotEmpty(config.cache)) opts.cache = config.cache
  if (validationkit.isNotEmpty(config.redirect)) opts.redirect = config.redirect
  if (validationkit.isNotEmpty(config.referrer)) opts.referrer = config.referrer
  if (validationkit.isNotEmpty(config.referrerPolicy)) opts.referrerPolicy = config.referrerPolicy
  if (validationkit.isNotEmpty(config.integrity)) opts.integrity = config.integrity
  if (validationkit.isNotEmpty(config.keepalive)) opts.keepalive = config.keepalive
  if (validationkit.isNotEmpty(config.signal)) opts.signal = config.signal

  return opts
}

NetworkClient.prototype.fetch = function fetch(cfg, callback) {
  const self = this
  const config = Object.assign({}, self.config, cfg)

  // body
  const isFormData = objectkit.getProp(config, 'body') instanceof FormData
  if (isFormData && objectkit.getProp(config.headers, 'Content-Type') == 'application/json') {
    config.body = self.objectifyFormData(config.body)
  }
  if (config.method == 'GET' && validationkit.isNotEmpty(config.body) && typekit.isObject(config.body)) {
    Object.keys(config.body).map(k => self.urlObject.searchParams.set(k, config.body[k]))
  }

  // url
  const url = new URL(config.url)
  url.pathname += validationkit.isNotEmpty(cfg.path) ? '/' + cfg.path : ''
  url.pathname = url.pathname.replace(/[\/]{2,}/g, '/')

  // cache in user local storage
  const enabledCache = config.userCache.lifetime > 0 && validationkit.isNotEmpty(cfg.id)
  const date = {}
  if (enabledCache) {
    date.timestamp = Date.now()

    const latestTimestamp = self.getLatestTimestampInStore()
    const latestData = self.getLatestDataInStore()
    if (latestTimestamp && (date.timestamp - latestTimestamp > config.userCache.lifetime * 1000)) {
      localstore.removeItem(self.getTimestampKeyName())
      localstore.removeItem(self.getDataKeyName())
    }
    if (latestData) {
      return callback(null, {status: 304, body: latestData})
    }
  }

  const fetchOptions = self.buildFetchOptions(config)
  let responseStatus = undefined

  Frond
    .getWindow()
    .fetch(url.toString(), fetchOptions)
    .then(function(response) {
      responseStatus = response.status
      const isJSON = response.headers.get('Content-Type') == 'application/json'
      return isJSON ? response.json() : response.text()
    })
    .then(function(data) {
      if (enabledCache) {
        localstore.setItem(self.getTimestampKeyName(), date.timestamp)
        localstore.setItem(self.getDataKeyName(), data)
      }
      return callback(null, {status: responseStatus, body: data})
    })
    .catch(function(err) {
      Frond.log('error', err, {fetchOptions: fetchOptions})
      return callback(err, null)
    })
}

NetworkClient.prototype.getLatestTimestampInStore = function getLatestTimestampInStore(id) {
  return localstore.getItem( this.getTimestampKeyName(id) )
}

NetworkClient.prototype.getLatestDataInStore = function getLatestDataInStore(id) {
  return localstore.getItem( this.getDataKeyName(id) )
}

NetworkClient.prototype.getTimestampKeyName = function getTimestampKeyName(id) {
  return 'FROND_FETCH_TIMESTAMP_' + id.toUpperCase()
}

NetworkClient.prototype.getDataKeyName = function getDataKeyName(id) {
  return 'FROND_FETCH_DATA_' + id.toUpperCase()
}

export default NetworkClient
