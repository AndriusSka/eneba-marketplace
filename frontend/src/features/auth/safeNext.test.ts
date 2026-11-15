import { describe, expect, it } from 'vitest'
import { authHref, safeNext } from './safeNext'

describe('safeNext', () => {
  it.each([
    ['/store', '/store'],
    ['/store?platform[]=steam&sort=price_asc', '/store?platform[]=steam&sort=price_asc'],
    ['/product/elden-ring-steam-global#offers', '/product/elden-ring-steam-global#offers'],
    ['/orders/12', '/orders/12'],
  ])('keeps the site path %s', (next, expected) => {
    expect(safeNext(next)).toBe(expected)
  })

  it.each([
    [null],
    [undefined],
    [''],
    ['store'],
    ['https://evil.example/steal'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['/\t/evil.example'],
    ['javascript:alert(1)'],
    ['/login'],
    ['/login?next=/store'],
    ['/register'],
  ])('falls back to / for %j', (next) => {
    expect(safeNext(next)).toBe('/')
  })
})

describe('authHref', () => {
  it('carries the page to return to', () => {
    expect(authHref('login', '/product/fifa?x=1')).toBe('/login?next=%2Fproduct%2Ffifa%3Fx%3D1')
    expect(authHref('register', '/store')).toBe('/register?next=%2Fstore')
  })

  it('leaves out next when it would just be the homepage or unsafe', () => {
    expect(authHref('login', '/')).toBe('/login')
    expect(authHref('login', '//evil.example')).toBe('/login')
  })
})
