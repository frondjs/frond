const {Frond} = require('../../dist/frond.cjs.js')

describe('frond container object.', function() {
  it('has window and document setters and getters.', function() {
    expect(true).toBe(true)
    expect(Frond.getWindow()).toBeTruthy()
  })
})
