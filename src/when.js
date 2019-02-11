const utils = require('expect/build/jasmineUtils')
const logger = require('./log')('when')
const { printReceived } = require('jest-matcher-utils')

const checkArgumentMatchers = (assertCall, args) => (match, matcher, i) => {
  logger.debug(`matcher check, match: ${match}, index: ${i}`)

  // Propagate failure to the end
  if (!match) {
    return false
  }

  const arg = args[i]

  logger.debug(`   matcher: ${matcher}`)
  logger.debug(`   arg: ${arg}`)

  // Assert the match for better messaging during a failure
  if (assertCall) {
    expect(arg).toEqual(matcher)
  }

  return utils.equals(arg, matcher)
}
class WhenMock {
  constructor (fn) {
    this.fn = fn
    this.callMocks = []

    const mockImplmentation = (matchers, assertCall, once = false) => (valImpl) => {
      // To enable dynamic replacement during a test:
      // * call mocks with equal matchers are removed
      // * `once` mocks are used prioritized
      this.callMocks = this.callMocks
        .filter((callMock) => once || callMock.once || !utils.equals(callMock.matchers, matchers))
        .concat({ matchers, valImpl, assertCall, once })
        .sort((a, b) => b.once - a.once)

      this.fn.mockImplementation((...args) => {
        logger.debug('mocked impl', args)

        for (let i = 0; i < this.callMocks.length; i++) {
          const { matchers, valImpl, assertCall } = this.callMocks[i]
          const match = matchers.reduce(checkArgumentMatchers(assertCall, args), true)

          if (match) {
            let removedOneItem = false
            this.callMocks = this.callMocks.filter(mock => {
              if (mock.once && utils.equals(mock.matchers, matchers) && !removedOneItem) {
                removedOneItem = true
                return false
              }
              return true
            })
            return valImpl(...args)
          }
        }

        throw new Error(`no matching implementation for args: ${printReceived(args)}`)
      })

      return {
        ...this,
        ...mockFunctions(matchers, assertCall)
      }
    }

    const mockFunctions = (matchers, assertCall) => ({
      mockReturnValue: val => mockImplmentation(matchers, assertCall)(() => val),
      mockReturnValueOnce: val => mockImplmentation(matchers, assertCall, true)(() => val),
      mockResolvedValue: val => mockImplmentation(matchers, assertCall)(() => Promise.resolve(val)),
      mockResolvedValueOnce: val => mockImplmentation(matchers, assertCall, true)(() => Promise.resolve(val)),
      mockRejectedValue: err => mockImplmentation(matchers, assertCall)(() => Promise.reject(err)),
      mockRejectedValueOnce: err => mockImplmentation(matchers, assertCall, true)(() => Promise.reject(err)),
      mockThrowValue: err => mockImplmentation(matchers, assertCall)(() => { throw err }),
      mockThrowValueOnce: err => mockImplmentation(matchers, assertCall, true)(() => { throw err }),
      mockImplementation: impl => mockImplmentation(matchers, assertCall)(impl),
      mockImplementationOnce: impl => mockImplmentation(matchers, assertCall, true)(impl)
    })

    this.calledWith = (...matchers) => ({ ...mockFunctions(matchers, false) })

    this.expectCalledWith = (...matchers) => ({ ...mockFunctions(matchers, true) })
  }
}

const when = (fn) => {
  if (fn.__whenMock__ instanceof WhenMock) return fn.__whenMock__
  fn.__whenMock__ = new WhenMock(fn)
  return fn.__whenMock__
}

module.exports = {
  when,
  WhenMock
}
