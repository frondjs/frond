function ComponentNotFound(message, fileName, lineNumber) {
  const instance = new Error(message, fileName, lineNumber)
  instance.name = 'ComponentNotFound';

  Object.setPrototypeOf(instance, Object.getPrototypeOf(this));

  if (Error.captureStackTrace) {
    Error.captureStackTrace(instance, ComponentNotFound)
  }

  return instance
}

ComponentNotFound.prototype = Object.create(Error.prototype, {
  constructor: {
    value: Error,
    enumerable: false,
    writable: true,
    configurable: true
  }
});

if (Object.setPrototypeOf) {
  Object.setPrototypeOf(ComponentNotFound, Error);
}
else {
  ComponentNotFound.__proto__ = Error
}

module.exports = {
  ComponentNotFound: ComponentNotFound
}
