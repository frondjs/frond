function ExternalRepository(scripter) {
  this.scripter = scripter
}

ExternalRepository.prototype.insert = function insert(External) {
  switch (External.type) {
    case 'text/javascript':
      return this.scripter.injectjs(External.url, {
        id: External.id,
        async: External.async,
        attrs: External.attrs,
        location: External.location,
        global: External.global
      })
    break;
    case 'text/css':
      return this.scripter.injectcss(External.url, {
        id: External.id,
        attrs: External.attrs,
        location: External.location,
      })
    break;
    default:
      throw new Error('Invalid External type.')
  }
}

module.exports = ExternalRepository
