import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation, type RouteObject } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../../api/auth'
import { ORDER_KEY, ORDERS_KEY } from '../../api/orders'
import { clearCookies, json, stubRoutes } from '../../test/fetchRoutes'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'
import { RequireAuth } from './RequireAuth'
import { UserMenu } from './UserMenu'

const ada: User = { id: 7, name: 'Ada Lovelace', email: 'ada@example.com' }
const UNAUTHENTICATED = () => json(401, { message: 'Unauthenticated.' })

/** Shows where the router ended up. */
function Where() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>
}

function renderAt(path: string, routes: RouteObject[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return client
}

/** Puts a previous user's order list and order (with its keys) in the cache. */
function cacheOrdersOfAnotherUser(client: QueryClient) {
  client.setQueryData([ORDERS_KEY], [{ id: 12 }])
  client.setQueryData([ORDER_KEY, '12'], { id: 12, items: [{ keys: [{ id: 1, code: 'AAAAA-BBBBB-CCCCC' }] }] })
}

function cachedOrders(client: QueryClient) {
  return [client.getQueryData([ORDERS_KEY]), client.getQueryData([ORDER_KEY, '12'])]
}

const authRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '*', element: <Where /> },
]

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
})
afterEach(() => {
  vi.unstubAllGlobals()
  clearCookies()
})

describe('RequireAuth', () => {
  const routes: RouteObject[] = [
    { element: <RequireAuth />, children: [{ path: '/orders', element: <p>Your orders</p> }] },
    { path: '*', element: <Where /> },
  ]

  it('sends a guest to /login with the page to come back to', async () => {
    stubRoutes({ 'GET /api/me': UNAUTHENTICATED })
    renderAt('/orders?page=2', routes)

    expect(await screen.findByTestId('where')).toHaveTextContent('/login?next=%2Forders%3Fpage%3D2')
  })

  it('renders the page for a signed-in user', async () => {
    stubRoutes({ 'GET /api/me': () => json(200, { data: ada }) })
    renderAt('/orders', routes)

    expect(await screen.findByText('Your orders')).toBeInTheDocument()
  })

  it('offers a retry instead of the login form when the API is down', async () => {
    stubRoutes({ 'GET /api/me': () => json(503, { message: 'Down' }) })
    renderAt('/orders', routes)

    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't check")
    expect(screen.queryByTestId('where')).not.toBeInTheDocument()
  })
})

describe('LoginPage', () => {
  function fillAndSubmit(email: string, password: string) {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  }

  it('shows the server error next to the field', async () => {
    stubRoutes({
      'GET /api/me': UNAUTHENTICATED,
      'POST /api/login': () =>
        json(422, {
          message: 'These credentials do not match our records.',
          errors: { email: ['These credentials do not match our records.'] },
        }),
    })
    renderAt('/login', authRoutes)

    fillAndSubmit('ada@example.com', 'wrong')

    const message = await screen.findByText('These credentials do not match our records.')
    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAttribute('aria-describedby', message.id)
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid')
  })

  it('returns to the page in ?next= after signing in', async () => {
    const fetchMock = stubRoutes({
      'GET /api/me': UNAUTHENTICATED,
      'POST /api/login': () => json(200, { data: ada }),
    })
    renderAt('/login?next=%2Fproduct%2Felden-ring%3Fx%3D1', authRoutes)

    fillAndSubmit('ada@example.com', 'password')

    expect(await screen.findByTestId('where')).toHaveTextContent('/product/elden-ring?x=1')
    const loginCall = fetchMock.mock.calls.find((call) => call[0] === '/api/login')
    expect(loginCall?.[1]?.body).toBe('{"email":"ada@example.com","password":"password"}')
  })

  it('drops orders cached before the sign-in, so a new user never sees the previous user’s keys', async () => {
    stubRoutes({ 'GET /api/me': UNAUTHENTICATED, 'POST /api/login': () => json(200, { data: ada }) })
    const client = renderAt('/login?next=%2Forders%2F12', authRoutes)
    cacheOrdersOfAnotherUser(client)

    fillAndSubmit('ada@example.com', 'password')

    expect(await screen.findByTestId('where')).toHaveTextContent('/orders/12')
    expect(cachedOrders(client)).toEqual([undefined, undefined])
  })

  it('ignores a ?next= that leaves the site', async () => {
    stubRoutes({ 'GET /api/me': UNAUTHENTICATED, 'POST /api/login': () => json(200, { data: ada }) })
    renderAt('/login?next=%2F%2Fevil.example', authRoutes)

    fillAndSubmit('ada@example.com', 'password')

    expect(await screen.findByTestId('where')).toHaveTextContent(/^\/$/)
  })

  it('sends an already signed-in visitor straight on', async () => {
    stubRoutes({ 'GET /api/me': () => json(200, { data: ada }) })
    renderAt('/login?next=%2Fstore', authRoutes)

    expect(await screen.findByTestId('where')).toHaveTextContent('/store')
  })

  it('shows a form-level message when the failure is not about a field', async () => {
    stubRoutes({ 'GET /api/me': UNAUTHENTICATED, 'POST /api/login': () => json(500, { message: 'Server Error' }) })
    renderAt('/login', authRoutes)

    fillAndSubmit('ada@example.com', 'password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  })
})

describe('RegisterPage', () => {
  it('shows each server error under its own field and keeps ?next= on the sign-in link', async () => {
    stubRoutes({
      'GET /api/me': UNAUTHENTICATED,
      'POST /api/register': () =>
        json(422, {
          message: 'The name field is required. (and 1 more error)',
          errors: { name: ['The name field is required.'], password: ['The password field confirmation does not match.'] },
        }),
    })
    renderAt('/register?next=%2Fstore', authRoutes)

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('The name field is required.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('The password field confirmation does not match.')
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=%2Fstore')
  })

  it('signs the new user in and goes to ?next=', async () => {
    stubRoutes({ 'GET /api/me': UNAUTHENTICATED, 'POST /api/register': () => json(201, { data: ada }) })
    renderAt('/register?next=%2Fstore', authRoutes)

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByTestId('where')).toHaveTextContent('/store')
  })
})

describe('UserMenu', () => {
  const routes: RouteObject[] = [{ path: '*', element: <UserMenu /> }]

  it('links a guest to sign in and back to the current page', async () => {
    stubRoutes({ 'GET /api/me': UNAUTHENTICATED })
    renderAt('/product/fifa?x=1', routes)

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=%2Fproduct%2Ffifa%3Fx%3D1')
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register?next=%2Fproduct%2Ffifa%3Fx%3D1')
  })

  it('shows the user and signs them out, dropping their cached orders', async () => {
    stubRoutes({ 'GET /api/me': () => json(200, { data: ada }), 'POST /api/logout': () => json(204) })
    const client = renderAt('/store', routes)
    cacheOrdersOfAnotherUser(client)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(cachedOrders(client)).toEqual([undefined, undefined])
  })
})
