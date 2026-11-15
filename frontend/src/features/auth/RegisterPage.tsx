import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useMe, useRegister, type RegisterInput } from '../../api/auth'
import { TextField } from '../../components/TextField'
import { AuthPanel } from './AuthPanel'
import { formErrors } from './formErrors'
import { authHref, safeNext } from './safeNext'

const EMPTY: RegisterInput = { name: '', email: '', password: '', password_confirmation: '' }

/** /register?next=<path>. Registering signs the user in, then goes to `next` like /login does. */
export function RegisterPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const me = useMe()
  const register = useRegister()
  const [input, setInput] = useState<RegisterInput>(EMPTY)

  if (me.data) {
    return <Navigate to={next} replace />
  }

  const errors = formErrors(register.error)
  const set = (field: keyof RegisterInput) => (event: { target: { value: string } }) =>
    setInput((current) => ({ ...current, [field]: event.target.value }))

  return (
    <AuthPanel
      title="Create an account"
      submitLabel="Create account"
      pending={register.isPending}
      formError={errors.form}
      onSubmit={() => register.mutate(input)}
      footer={
        <>
          Already have an account?{' '}
          <Link to={authHref('login', next)} className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <TextField label="Name" name="name" autoComplete="name" value={input.name} onChange={set('name')} error={errors.fields.name} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={input.email}
        onChange={set('email')}
        error={errors.fields.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={input.password}
        onChange={set('password')}
        error={errors.fields.password}
      />
      <TextField
        label="Confirm password"
        name="password_confirmation"
        type="password"
        autoComplete="new-password"
        value={input.password_confirmation}
        onChange={set('password_confirmation')}
        error={errors.fields.password_confirmation}
      />
    </AuthPanel>
  )
}
