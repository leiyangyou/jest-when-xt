const { stringContaining } = expect

const errMsg = ({ expect, actual }) =>
  new RegExp(`Expected.*${expect}.*\n.*Received.*${actual}`)

const noImplementationErrMsg = /no matching implementation/

describe('When', () => {
  let spyEquals, when, WhenMock, mockLogger

  beforeEach(() => {
    spyEquals = jest.spyOn(require('expect/build/jasmineUtils'), 'equals')

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
      when(fn).calledWith(2).mockReturnValue(undefined)

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

    it('supports chaining of when declarations', () => {
      const fn = jest.fn()

      when(fn)
        .calledWith(1)
        .mockReturnValue('x')

      when(fn).calledWith('foo', 'bar')
        .mockReturnValue('y')
        .calledWith(false, /asdf/g)
        .mockReturnValue('z')

      expect(fn(1)).toEqual('x')
      expect(fn('foo', 'bar')).toEqual('y')
      expect(fn(false, /asdf/g)).toEqual('z')
    })

    it('supports replacement of when declarations', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo', 'bar').mockReturnValue('x')
      when(fn).calledWith(false, /asdf/g).mockReturnValue('y')
      when(fn).calledWith('foo', 'bar').mockReturnValue('z')

      expect(fn('foo', 'bar')).toEqual('z')
    })

    it('returns a declared value repeatedly', () => {
      const fn = jest.fn()

      when(fn).calledWith(1).mockReturnValue('x')
      when(fn).calledWith(2).mockReturnValueOnce('x').mockReturnValue('y')

      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
      expect(fn(1)).toEqual('x')
      expect(fn(2)).toEqual('x')
      expect(fn(2)).toEqual('y')
    })

    it('throws if no declared value matches', () => {
      const fn = jest.fn()

      when(fn).calledWith(1, 2).mockReturnValue('x')

      expect(() => fn(5, 6)).toThrow(noImplementationErrMsg)
      expect(mockLogger.debug).toBeCalledWith(stringContaining('matcher: 1'))
      expect(mockLogger.debug).not.toBeCalledWith(stringContaining('matcher: 2'))
    })

    it('expectCalledWith: fails a test with error messaging if argument does not match', () => {
      const fn1 = jest.fn()
      const fn2 = jest.fn()

      when(fn1).expectCalledWith(1).mockReturnValue('x')
      when(fn2).calledWith('foo').mockReturnValue('y')

      expect(() => fn1(2)).toThrow(errMsg({ expect: 1, actual: 2 }))
      expect(() => fn2('bar')).toThrow(noImplementationErrMsg)
    })

    it('mockReturnValueOnce: should return specified value only once', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockReturnValueOnce('bar')
      when(fn).calledWith('foo').mockReturnValueOnce('cbs')

      expect(fn('foo')).toEqual('bar')
      expect(fn('foo')).toEqual('cbs')
      expect(() => fn('foo')).toThrow(noImplementationErrMsg)
    })

    it('mockReturnValueOnce: should return specified value only once and the regular value after that', () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockReturnValue('bar')
      expect(fn('foo')).toEqual('bar')

      when(fn).calledWith('foo').mockReturnValueOnce('cbs')
      expect(fn('foo')).toEqual('cbs')

      expect(fn('foo')).toEqual('bar')
    })

    it('mockReturnValueOnce: works with expectCalledWith', () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockReturnValueOnce('bar')

      expect(fn('foo')).toEqual('bar')
    })

    it('mockResolvedValue: should return a Promise', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValue('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
    })

    it('mockResolvedValue: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockResolvedValue('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
    })

    it('mockResolvedValueOnce: should return a Promise only once', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValueOnce('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
      expect(() => fn('foo')).toThrow(noImplementationErrMsg)
    })

    it('mockResolvedValueOnce: should return specified value only once and the regular value after that', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockResolvedValue('bar')
      expect(await fn('foo')).toEqual('bar')

      when(fn).calledWith('foo').mockResolvedValueOnce('cbs')
      expect(await fn('foo')).toEqual('cbs')

      expect(await fn('foo')).toEqual('bar')
    })

    it('mockResolvedValueOnce: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockResolvedValueOnce('bar')

      await expect(fn('foo')).resolves.toEqual('bar')
      expect(() => fn('foo')).toThrow(noImplementationErrMsg)
    })

    it('mockRejectedValue: should return a rejected Promise', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockRejectedValue(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
    })

    it('mockRejectedValue: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockRejectedValue(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
    })

    it('mockRejectedValueOnce: should return a rejected Promise only once', async () => {
      const fn = jest.fn()

      when(fn).calledWith('foo').mockRejectedValueOnce(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
      expect(() => fn('foo')).toThrow(noImplementationErrMsg)
    })

    it('mockRejectedValueOnce: works with expectCalledWith', async () => {
      const fn = jest.fn()

      when(fn).expectCalledWith('foo').mockRejectedValueOnce(new Error('bar'))

      await expect(fn('foo')).rejects.toThrow('bar')
      expect(() => fn('foo')).toThrow(noImplementationErrMsg)
    })

    it('mockThrowValue: should throw a value', () => {
      const fn = jest.fn()
      when(fn).calledWith('foo').mockThrowValue(new Error('error'))
      expect(() => fn('foo')).toThrow(/error/)
    })

    it('mockThrowValueOnce: should throw a value only once', () => {
      const fn = jest.fn()
      when(fn).calledWith('foo').mockThrowValueOnce(new Error('error'))
      when(fn).calledWith('foo').mockReturnValue('bar')
      try { fn('foo') } catch (err) { }
      expect(fn('foo')).toEqual('bar')
    })

    it('mockImplementation: should use the supplied implementation', () => {
      const fn = jest.fn()
      when(fn).calledWith('foo').mockImplementation(() => 'bar')
      expect(fn('foo')).toEqual('bar')
    })

    it('mockImplementationOnce: should use the supplied implementation only once', () => {
      const fn = jest.fn()
      when(fn).calledWith('foo').mockImplementationOnce(() => 'bar')
      fn('foo')
      expect(() => fn('foo')).toThrow(noImplementationErrMsg)
    })
  })
})
