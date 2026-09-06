/**
 * The rules the controller applies to an application's environment, restated
 * so the console can refuse the same input before it queues a deployment.
 *
 * These are a copy of internal/ops policy, and that is deliberate: the
 * controller stays the authority and refuses anything that reaches it anyway.
 * What this buys is when the operator finds out — on the field they are
 * typing, rather than as a 422 after the rest of the form is filled in.
 */

/** internal/ops/application.go: maxApplicationEnv. */
export const MAX_VARIABLES = 50
/** internal/ops/application.go: environmentKeyPattern. */
export const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/
/** internal/ops/policy.go: secretLikeKey. */
export const SECRET_LIKE = /(password|secret|token|credential|api[_-]?key|private[_-]?key)/i
/** internal/ops/application.go: validateApplicationEnv. */
export const MAX_VALUE_LENGTH = 2048

/** keyError names why a variable name would be refused, or nothing. An empty
    name is a row still being typed, not a mistake. */
export function keyError(key: string, duplicate: boolean, reserved: string[] = []): string | undefined {
  if (key === '') return undefined
  if (duplicate) return 'This name is set twice.'
  if (!KEY_PATTERN.test(key)) return 'Letters, digits, and underscores; it cannot start with a digit.'
  if (SECRET_LIKE.test(key)) return 'This looks like a credential. Attach a managed database instead.'
  if (reserved.includes(key)) return 'A managed database already delivers this name.'
  return undefined
}

export function valueError(value: string): string | undefined {
  if (value.length > MAX_VALUE_LENGTH) return `At most ${MAX_VALUE_LENGTH} characters.`
  if (/[\0\r\n]/.test(value)) return 'A value is a single line.'
  return undefined
}

/** environmentErrors reports everything the controller would refuse about a
    whole environment, so a screen can block its own submit. */
export function environmentErrors(env: Record<string, string> | undefined, reserved: string[] = []): string[] {
  const entries = Object.entries(env ?? {})
  const problems: string[] = []
  if (entries.length > MAX_VARIABLES) problems.push(`An application may declare at most ${MAX_VARIABLES} environment variables.`)
  for (const [key, value] of entries) {
    const failure = keyError(key, false, reserved) ?? valueError(value)
    if (failure) problems.push(`${key}: ${failure}`)
  }
  return problems
}

/** reservedDatabaseNames lists what an attached engine delivers on its own.
    A variable set here and delivered there is refused by the controller as
    ambiguous, so the collision is worth showing on the field. */
export function reservedDatabaseNames(engines: string[], discovered: string[][] = []): string[] {
  const names = new Set<string>()
  for (const engine of engines) {
    names.add(`${engine.toUpperCase()}_URL`)
    names.add(`${engine.toUpperCase()}_URL_FILE`)
  }
  for (const group of discovered) for (const name of group) names.add(name)
  return [...names]
}
