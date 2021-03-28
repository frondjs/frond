const {validationkit, typekit} = require('basekits')
const assetManager = require('../assetManager')
const Gettext = require('../gettext')

function I18n() {
  this.gettext = null
  this.appLocale = null
  this.opts = {}
  this.multilingual = false

  window._ = function(arg) {
    return arg
  }
}

I18n.prototype.defaultOptions = {
  localStorageKeyName: 'frond_locale',
  carryAppLocaleIn: 'ADDRESS_BAR', // or LOCAL_STORAGE
  translationsURI: window.location.protocol + '//' + window.location.hostname
    + (window.location.port ? ':' + window.location.port: '')
    + '/static'
}

I18n.prototype.reMatchLocaleInPath = /^(\/[a-zA-Z]{2}(-[a-zA-Z]{2})?)\/?(?![a-zA-Z0-9]+)/g

I18n.prototype.isMultilingual = function isMultilingual() {
  return this.multilingual === true
}

I18n.prototype.getAppLocale = function getAppLocale(slugify=false) {
  return slugify === true ? this.slugifyLocale(this.appLocale) : this.appLocale
}

I18n.prototype.isLocaleCarriedOnAddressBar = function isLocaleCarriedOnAddressBar() {
  return this.opts.carryAppLocaleIn == 'ADDRESS_BAR'
}

I18n.prototype.isNotDefaultLocale = function isNotDefaultLocale() {
  if (!this.isMultilingual()) return false;
  if (this.getAppLocale() != this.opts.defaultLocale) return true;
  return false;
}

I18n.prototype.configure = function configure(payload={}) {
  const self = this
  const {supportedLocales} = window.frondjs

  return new Promise(function(resolve, reject) {
    if (validationkit.isEmpty(supportedLocales)) {
      return reject(new Error('You set i18n but there is no translation found. \
Did you forget to translate the files inside translations folder?'))
    }

    if (validationkit.isEmpty(payload.defaultLocale)) {
      return reject(new Error('You should set defaultLocale.'))
    }

    if (supportedLocales.length > 0 || supportedLocales[0] != self.opts.defaultLocale) {
      self.multilingual = true
    }

    self.opts = Object.assign({}, self.defaultOptions, payload)
    self.appLocale = self.detectAppLocale(supportedLocales)
    self.loadTranslation().then(function(json) {
      if (!typekit.isObject(json)) return resolve()

      self.gettext = new Gettext({'domain': 'messages', 'locale_data': {messages: json}})

      window._ = function(arg) {
        return self.gettext.gettext(arg)
      }

      return resolve()
    })
  })
}

I18n.prototype.detectAppLocale = function detectAppLocale(supportedLocales) {
  let possibleLocale = null

  if (this.opts.carryAppLocaleIn == 'ADDRESS_BAR') {
    const path = window.location.pathname
    if (!this.reMatchLocaleInPath.test(path))
      return this.opts.defaultLocale;

    possibleLocale = path.match(this.reMatchLocaleInPath)[0].replace(/\/+/g, '')
  }
  else if (this.opts.carryAppLocaleIn == 'LOCAL_STORAGE') {
    possibleLocale = localStorage.getItem(this.localStorageKeyName)
  }
  else {
    throw new Error('The carryAppLocaleIn option seems invalid.')
  }

  return supportedLocales.indexOf(this.formatLocale(possibleLocale)) !== -1
    ? possibleLocale
    : this.opts.defaultLocale
}

I18n.prototype.loadTranslation = function loadTranslation() {
  let path = null
  try {
    path = assetManager.get('translations/' + this.appLocale + '.json')
  } catch (e) {
    return Promise.resolve(null)
  }

  return fetch(this.opts.translationsURI + '/' + path).then(function(resp) {
    return resp.json()
  })
}

I18n.prototype.slugifyLocale = function slugifyLocale(locale) {
  return locale.toLowerCase().replace('_', '-')
}

I18n.prototype.formatLocale = function formatLocale(locale) {
  return locale.split('-')[0] + '_' + locale.split('-')[1].toUpperCase()
}

module.exports = new I18n()
