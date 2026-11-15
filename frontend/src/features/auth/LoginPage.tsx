import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useLogin, useMe } from '../../api/auth'
import { TextField } from '../../components/TextField'
import { AuthPanel } from './AuthPanel'
import { formErrors } from './formErrors'
import { authHref, safeNext } from './safeNext'

/**
 * /login?next=<path>. Once the user is known (signed in here, or already signed in), it replaces
 * itself with `next`, so Back doesn't return to the form.
 */
export function LoginPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const me = useMe()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (me.data) {
    return <Navigate to={next} replace />
  }

  const errors = formErrors(login.error)

  return (
    <AuthPanel
      title="Sign in"
      submitLabel="Sign in"
      pending={login.isPending}
      formError={errors.form}
      onSubmit={() => login.mutate({ email, password })}
      footer={
        <>
          New here?{' '}
          <Link to={authHref('register', next)} className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.fields.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={errors.fields.password}
      />
    </AuthPanel>
  )
}
