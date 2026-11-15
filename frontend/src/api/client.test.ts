import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCookies, headersOf, json, stubRoutes } from '../test/fetchRoutes'
import { ApiError, readCookie, sendJson } from './client'

beforeEach(() => clearCookies())
afterEach(() => {
  vi.unstubAllGlobals()
  clearCookies()
})

describe('sendJson', () => {
  it('echoes the decoded XSRF-TOKEN cookie as X-XSRF-TOKEN, with a JSON body on the same origin', async () => {
    document.cookie = 'XSRF-TOKEN=abc%3D%3D; path=/'
    const fetchMock = stubRoutes({ 'POST /api/login': () => json(200, { ok: true }) })

    await expect(sendJson('POST', '/api/login', { email: 'a@b.c' })).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.credentials).toBe('same-origin')
    expect(init?.body).toBe('{"email":"a@b.c"}')
    expect(headersOf(init)).toMatchObject({
      'X-XSRF-TOKEN': 'abc==',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    })
  })

  it('fetches the CSRF cookie first when there is none', async () => {
    const fetchMock = stubRoutes({
      'GET /sanctum/csrf-cookie': () => {
        document.cookie = 'XSRF-TOKEN=fresh; path=/'
        return json(204)
      },
      'POST /api/logout': () => json(204),
    })

    await expect(sendJson('POST', '/api/logout')).resolves.toBeNull()

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(['/sanctum/csrf-cookie', '/api/logout'])
    expect(headersOf(fetchMock.mock.calls[1]?.[1])['X-XSRF-TOKEN']).toBe('fresh')
    expect(headersOf(fetchMock.mock.calls[1]?.[1])['Content-Type']).toBeUndefined()
  })

  it('refreshes the CSRF cookie and retries once after a 419', async () => {
    document.cookie = 'XSRF-TOKEN=expired; path=/'
    const tokensSent: string[] = []
    stubRoutes({
      'GET /sanctum/csrf-cookie': () => {
        document.cookie = 'XSRF-TOKEN=renewed; path=/'
        return json(204)
      },
      'POST /api/login': (init) => {
        tokensSent.push(headersOf(init)['X-XSRF-TOKEN'] ?? '')
        return tokensSent.length === 1 ? json(419, { message: 'CSRF token mismatch.' }) : json(200, { ok: true })
      },
    })

    await expect(sendJson('POST', '/api/login', {})).resolves.toEqual({ ok: true })
    expect(tokensSent).toEqual(['expired', 'renewed'])
  })

  it('gives up after a second 419', async () => {
    document.cookie = 'XSRF-TOKEN=x; path=/'
    const fetchMock = stubRoutes({
      'GET /sanctum/csrf-cookie': () => json(204),
      'POST /api/login': () => json(419, { message: 'CSRF token mismatch.' }),
    })

    await expect(sendJson('POST', '/api/login', {})).rejects.toMatchObject({ status: 419 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('turns a 422 into an ApiError with the field errors', async () => {
    document.cookie = 'XSRF-TOKEN=x; path=/'
    stubRoutes({
      'POST /api/register': () =>
        json(422, { message: 'The email has already been taken.', errors: { email: ['The email has already been taken.'], bad: 'x' } }),
    })

    const error = await sendJson('POST', '/api/register', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      message: 'The email has already been taken.',
      errors: { email: ['The email has already been taken.'] },
    })
  })
})

describe('error details', () => {
  it('carries the error code and the offer of a checkout 409', async () => {
    document.cookie = 'XSRF-TOKEN=t; path=/'
    stubRoutes({
      'POST /api/checkout': () =>
        json(409, { message: 'Elden Ring from PixelVault is out of stock.', code: 'out_of_stock', offer_id: 12 }),
    })

    const error = await sendJson('POST', '/api/checkout', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      message: 'Elden Ring from PixelVault is out of stock.',
      code: 'out_of_stock',
      offerId: 12,
      errors: {},
    })
  })

  it('leaves code and offer undefined when the body has none or the wrong types', async () => {
    document.cookie = 'XSRF-TOKEN=t; path=/'
    stubRoutes({ 'POST /api/checkout': () => json(409, { message: 'Conflict', code: 7, offer_id: '12' }) })

    const error = await sendJson('POST', '/api/checkout', {}).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 409, code: undefined, offerId: undefined })
  })
})

describe('readCookie', () => {
  it('finds one cookie among several', () => {
    document.cookie = 'other=1; path=/'
    document.cookie = 'XSRF-TOKEN=a%2Fb; path=/'
    expect(readCookie('XSRF-TOKEN')).toBe('a/b')
    expect(readCookie('missing')).toBeUndefined()
  })
})
