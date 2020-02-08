module.exports = function ff(idStr, _settings = null, _children = null) {
  const re = /([a-zA-Z0-9]+)?(#[a-zA-Z0-9\-\_]+)?(\.[a-zA-Z0-9\.\-\_]+)?/g
  const matches = idStr.split(re)
  if (!matches || matches.length === 0) {
    this.log('warning', 'Couldn\'t parse the selector you spesified for ff(selector) method.')
    this.log('debug', idStr)
    return ''
  }

  const settings = this.utility.isObject(_settings) ? _settings : {}
  const attrs = this.utility.getProp(settings, 'attrs', {})
  const children = _children === null ? '' : _children

  const object = matches
    .filter(m => typeof m == 'string' && m.length > 0)
    .reduce(function(memo, str) {
      const fc = str.slice(0, 1)
      if (fc == '#' && !memo.attrs.hasOwnProperty('id')) {
        memo.attrs.id = str.slice(1)
      }
      else if (fc == '.' && !memo.attrs.hasOwnProperty('class')) {
        memo.attrs.class = str.slice(1).split('.').join(' ')
      }
      else {
        if (!memo.hasOwnProperty('type')) {
          memo.type = str
        }
      }

      return memo
    }, {attrs: attrs})

  return Object.assign({}, object, settings, {render: children})
}
