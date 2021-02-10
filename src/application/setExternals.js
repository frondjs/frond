const {typekit} = require('basekits')
const External = require('../domain/external/entity')

module.exports = function setExternals(ctx, list) {
  const {externalsRepository} = ctx
  
  if (!typekit.isArray(list)) {
    throw new Error('Invalid type.')
  }

  const dependencies = list.map(function(item) {
    return new External(item.id, item.url, item.type, item.async || true,
      item.location || 'bodyEnd', item.attrs || {}, item.global || null)
  })

  const jobs = dependencies.map(function(Dep) {
    return externalsRepository.insert(Dep)
  })
  return Promise.all(jobs)
}
