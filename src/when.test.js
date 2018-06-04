const { stringContaining } = expect

const errMsg = ({ expect, actual }) =>
  new RegExp(`Expected.*\\n.*${expect}.*\\nReceived.*\\n.*${actual}`)

describe('When', () => {
  let spyEquals, when, WhenMock, mockLogger

  beforeEach(() => {
    spyEquals = jest.spyOn(require('expect/build/jasmine_utils'), 'equals')

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      trace: jest.fn()
    }

    jest.mock('./log', () => () => mockLogger)

    when = require('./when').when
    WhenMock = require('./when').WhenMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.resetModules()
  })

  describe('when', () => {
    it('returns a WhenMock', () => {
      const fn = jest.fn()
      const whenFn = when(fn)

      expect(whenFn).toBeInstanceOf(WhenMock)
      expect(whenFn.fn).toBe(fn)
    })

    it('returns existing WhenMock if fn was already whenified', () => {
      const fn = jest.fn()
      const whenFn1 = when(fn)
      const whenFn2 = when(fn)

      expect(whenFn1).toBeInstanceOf(WhenMock)
      expect(whenFn2).toBeInstanceOf(WhenMock)
      expect(whenFn1).toBe(whenFn2)
    })
  })

  describe('mock implementation', () => {
    it('offloads equality check to jasmine equals helper', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('x')

      expect(fn(1)).toEqual('x')
      expect(spyEquals).toBeCalledWith(1, 1)

      expect(fn(2)).toEqual(undefined)
      expect(spyEquals).toBeCalledWith(2, 1)
    })

    it('works with multiple args', () => {
      const fn = jest.fn()

      const anyString = expect.any(String)

      when(fn)
        .calledWith(1, 'foo', true, anyString, undefined)
        .mockReturnValue('x')

      expect(fn(1, 'foo', true, 'whatever')).toEqual('x')
      expect(spyEquals).toBeCalledWith(1, 1)
      expect(spyEquals).toBeCalledWith('foo', 'foo')
      expect(spyEquals).toBeCalledWith(true, true)
      expect(spyEquals).toBeCalledWith('whatever', anyString)
      expect(spyEquals).toBeCalledWith(undefined, undefined)
    })

    it('supports compound when declarations', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('x')
      when(fn).calledWith('foo', 'bar').mockReturnValue('y')
      when(fn).calledWith(false, /asdf/g).mockReturnValue('z')

      expect(fn(1)).toEqual('x')
      expect(fn('foo', 'bar')).toEqual('y')
      expect(fn(false, /asdf/g)).toEqual('z')
    })

    it('returns a declared value repeatedly', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('x')

      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
    })

    it('returns nothing if no declared value matches', () => {
      const fn = jest.fn()

      when(fn).calledWith(1, 2).mockReturnValue('x')

      expect(fn(5, 6)).toBeUndefined()
      expect(mockLogger.debug).toBeCalledWith(stringContaining('matcher: 1'))
      expect(mockLogger.debug).not.toBeCalledWith(stringContaining('matcher: 2'))
    })

    it('expectCalledWith: fails a test with error messaging if argument does not match', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      when(fn1).expectCalledWith(1).mockReturnValue('x')
      when(fn2).calledWith('foo').mockReturnValue('y')

      expect(() => fn1(2)).toThrow(errMsg({ expect: 1, actual: 2 }))
      expect(() => fn2('bar')).not.toThrow()
    })

    it('mockReturnValueOnce: should return specified value only once', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockReturnValueOnce('bar')
      when(fn).calledWith('foo').mockReturnValueOnce('cbs')
      when(fn).calledWith('extra training').mockReturnValueOnce(' for mutation test vs expectCalledWith')

      expect(fn('foo')).toEqual('bar')
      expect(fn('foo')).toEqual('cbs')
      expect(fn('foo')).toBeUndefined()
    })

    it('mockReturnValueOnce: works with expectCalledWith', done => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockReturnValueOnce('bar')
      when(fn).expectCalledWith('extra training').mockReturnValueOnce(' for mutation test vs expectCalledWith')

      expect(fn('foo')).toEqual('bar')

      try {
        fn('for mutation test vs calledWith')
      } catch (e) {
        expect(e.message).toMatch(errMsg({ expect: 'extra training', actual: 'for mutation test vs calledWith' }))
        done()
      }
    })

    it('mockResolvedValue: should return a Promise', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValue('bar')

      expect(typeof fn('foo').then).toBe('function')
      expect(await fn('mutation test vs expectCalledWith')).toBeUndefined()
    })

    it('mockResolvedValue: works with expectCalledWith', async done => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockResolvedValue('bar')

      expect(await fn('foo')).toEqual('bar')

      try {
        await fn('for mutation test vs calledWith')
      } catch (e) {
        expect(e.message).toMatch(errMsg({ expect: 'foo', actual: 'for mutation test vs calledWith' }))
        done()
      }
    })

    it('mockResolvedValueOnce: should return a Promise only once', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValueOnce('bar')
      when(fn).calledWith('foo').mockResolvedValueOnce('bar')
      when(fn).calledWith('extra training').mockResolvedValueOnce(' for mutation test vs expectCalledWith')

      expect(typeof fn('foo').then).toBe('function')
      expect(await fn('foo')).toEqual('bar')
      expect(await fn('foo')).toBeUndefined()
    })

    it('mockResolvedValueOnce: works with expectCalledWith', async done => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockResolvedValueOnce('bar')

      try {
        await fn('for mutation test vs calledWith')
      } catch (e) {
        expect(e.message).toMatch(errMsg({ expect: 'foo', actual: 'for mutation test vs calledWith' }))
        done()
      }

      expect(await fn('foo')).toBeUndefined()
    })
  })
})