function External(id, url, type, async, location, attrs={}, g=null) {
  this.id = id
  this.url = url
  this.type = type
  this.async = async
  this.location = location
  this.attrs = attrs
  this.global = g
}

module.exports = External
