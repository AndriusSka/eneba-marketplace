import { ApiError } from '../../api/client'

export type FormErrors = {
  /** The first server message per field, shown under that field. */
  fields: Record<string, string>
  /** A message for the whole form when the failure isn't about a field (network, 500, 419…). */
  form: string | null
}

export const NO_ERRORS: FormErrors = { fields: {}, form: null }

export function formErrors(error: unknown): FormErrors {
  if (error === null || error === undefined) {
    return NO_ERRORS
  }

  if (error instanceof ApiError) {
    const fields: Record<string, string> = {}
    for (const [field, messages] of Object.entries(error.errors)) {
      if (messages[0]) {
        fields[field] = messages[0]
      }
    }
    if (Object.keys(fields).length > 0) {
      return { fields, form: null }
    }
  }

  return { fields: {}, form: 'Something went wrong. Please try again.' }
}
