function RouteNotFound(message, fileName, lineNumber) {
  const instance = new Error(message, fileName, lineNumber)
  instance.name = 'RouteNotFound';

  Object.setPrototypeOf(instance, Object.getPrototypeOf(this));

  if (Error.captureStackTrace) {
    Error.captureStackTrace(instance, RouteNotFound)
  }

  return instance
}

RouteNotFound.prototype = Object.create(Error.prototype, {
  constructor: {
    value: Error,
    enumerable: false,
    writable: true,
    configurable: true
  }
});

if (Object.setPrototypeOf) {
  Object.setPrototypeOf(RouteNotFound, Error);
}
else {
  RouteNotFound.__proto__ = Error
}

module.exports = {
  RouteNotFound: RouteNotFound
}
