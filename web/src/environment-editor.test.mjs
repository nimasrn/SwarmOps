import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { environmentErrors, keyError, reservedDatabaseNames, valueError } from './lib/environment.ts'

const source = (name) => readFileSync(new URL(name, import.meta.url), 'utf8')

test('a name the controller refuses is refused here, on the field', () => {
  assert.equal(keyError('LOG_LEVEL', false), undefined)
  assert.equal(keyError('_private', false), undefined)
  assert.equal(keyError('', false), undefined, 'an empty row is being typed, not wrong')
  assert.match(keyError('9LIVES', false), /cannot start with a digit/)
  assert.match(keyError('log-level', false), /Letters, digits, and underscores/)
  assert.match(keyError('LOG_LEVEL', true), /set twice/)
})

test('a credential-shaped name is refused with the thing to do instead', () => {
  for (const key of ['DB_PASSWORD', 'apiKey', 'API_KEY', 'GITHUB_TOKEN', 'my_secret', 'PRIVATE_KEY', 'AWS_CREDENTIALS']) {
    assert.match(keyError(key, false), /credential/, `${key} was accepted`)
  }
  // A hyphenated name is refused by the name rule before the credential rule
  // ever runs, exactly as the controller orders its own checks.
  assert.match(keyError('PRIVATE-KEY', false), /Letters, digits, and underscores/)
  // The refusal names the alternative; an operator told only "no" pastes it
  // into a different field instead.
  assert.match(keyError('DB_PASSWORD', false), /managed database/)
})

test('a name a managed database already delivers cannot be set twice', () => {
  const reserved = reservedDatabaseNames(['postgres', 'redis'])
  assert.deepEqual(reserved, ['POSTGRES_URL', 'POSTGRES_URL_FILE', 'REDIS_URL', 'REDIS_URL_FILE'])
  assert.match(keyError('POSTGRES_URL', false, reserved), /already delivers/)
  assert.equal(keyError('POSTGRES_HOST', false, reserved), undefined)
})

test('discovered delivery names join the reserved set without duplicating it', () => {
  const reserved = reservedDatabaseNames(['postgres'], [['DATABASE_URL', 'POSTGRES_URL'], ['SQLALCHEMY_DATABASE_URI']])
  assert.deepEqual(reserved, ['POSTGRES_URL', 'POSTGRES_URL_FILE', 'DATABASE_URL', 'SQLALCHEMY_DATABASE_URI'])
})

test('a value is single-line and bounded', () => {
  assert.equal(valueError('debug'), undefined)
  assert.equal(valueError(''), undefined)
  assert.match(valueError('a\nb'), /single line/)
  assert.match(valueError('x'.repeat(2049)), /2048/)
  assert.equal(valueError('x'.repeat(2048)), undefined)
})

test('the whole environment is reported at once, and an empty one is fine', () => {
  assert.deepEqual(environmentErrors(undefined), [])
  assert.deepEqual(environmentErrors({}), [])
  assert.deepEqual(environmentErrors({ LOG_LEVEL: 'debug', PORT: '8080' }), [])
  const problems = environmentErrors({ DB_PASSWORD: 'x', '1BAD': 'y' })
  assert.equal(problems.length, 2)
  assert.ok(problems.some((problem) => problem.startsWith('DB_PASSWORD:')))
})

test('the fifty-first variable is refused, matching maxApplicationEnv', () => {
  const fifty = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`VAR_${index}`, 'x']))
  assert.deepEqual(environmentErrors(fifty), [])
  assert.match(environmentErrors({ ...fifty, VAR_50: 'x' })[0], /at most 50/)
})

test('the console sends the environment under the name the controller reads', () => {
  // ApplicationSpec.Env carries no JSON tag, so the wire name is the Go field
  // name. Sending "env" deploys an application with no environment at all.
  for (const screen of ['screens/apps/applications.tsx', 'screens/apps/deploy.tsx']) {
    assert.match(source(screen), /Env: Object\.keys\(environment\)\.length > 0 \? environment : undefined/, screen)
  }
  assert.match(source('data/types.ts'), /Env\?: Record<string, string>/)
})

test('both screens block their own submit rather than letting the deploy fail', () => {
  assert.match(source('screens/apps/applications.tsx'), /environmentProblems\.length > 0/)
  assert.match(source('screens/apps/deploy.tsx'), /if \(environmentProblems\.length > 0\) return/)
  assert.match(source('screens/apps/deploy-parts/parts.tsx'), /environmentProblems\.length\) result\.push/)
})

test('the editor keeps typed rows out of browser storage', () => {
  // The deploy draft is the selection, not the configuration: values here are
  // whatever the operator pasted.
  assert.doesNotMatch(source('screens/apps/deploy.tsx'), /environment,\s*\n\s*healthPath/)
  assert.match(source('screens/apps/deploy.tsx'), /environment is left out for the same reason/)
})
