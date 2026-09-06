import { useEffect, useRef, useState } from 'react'
import { Body, Button, IconButton, Inline, Input, Stack as Rows } from '@nim.zone/ui'
import { MAX_VARIABLES, keyError, valueError } from '../lib/environment'

export interface EnvironmentEditorProps {
  disabled?: boolean
  /** Names the application already receives from elsewhere — a managed
      database delivers its URI under these — so a collision the controller
      would refuse is visible here instead. */
  reserved?: string[]
  onChange: (env: Record<string, string>) => void
  value: Record<string, string> | undefined
}

interface Row {
  id: number
  key: string
  value: string
}

/**
 * The application's environment, as an editable list.
 *
 * It is a list of rows rather than a map because a map has no order to type
 * into: rebuilding the rows from the value on every keystroke collapses a
 * half-typed name onto the row above it. The rows are the editing surface; the
 * map is only what leaves.
 *
 * Every rule enforced here is one the controller enforces too. Repeating them
 * is not duplication for its own sake — a name it will refuse, a value it will
 * refuse, or a fifty-first variable should be visible now, not returned as a
 * 422 after the operator has finished the rest of the form.
 */
export function EnvironmentEditor({ disabled, onChange, reserved = [], value }: EnvironmentEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => rowsOf(value))
  const nextID = useRef(rows.length + 1)
  // A spec arriving from elsewhere — a selected application, a restored
  // revision — replaces the rows. What the operator has typed does not, which
  // is why the incoming map is compared rather than assigned every render.
  const applied = useRef(serialize(value))

  useEffect(() => {
    const incoming = serialize(value)
    if (incoming === applied.current) return
    applied.current = incoming
    const next = rowsOf(value)
    nextID.current = next.length + 1
    setRows(next)
  }, [value])

  const commit = (next: Row[]) => {
    setRows(next)
    const env: Record<string, string> = {}
    for (const row of next) {
      const key = row.key.trim()
      if (key !== '') env[key] = row.value
    }
    applied.current = serialize(env)
    onChange(env)
  }

  const update = (id: number, patch: Partial<Row>) => commit(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const remove = (id: number) => commit(rows.filter((row) => row.id !== id))
  const add = () => {
    const row = { id: nextID.current++, key: '', value: '' }
    setRows((current) => [...current, row])
  }

  const named = rows.filter((row) => row.key.trim() !== '').length

  return (
    <Rows gap="tight">
      {rows.length === 0
        ? <Body size="sm" tone="muted">This application declares no environment variables.</Body>
        : null}
      {rows.map((row) => {
        const key = row.key.trim()
        const duplicate = key !== '' && rows.some((other) => other.id !== row.id && other.key.trim() === key)
        return (
          <Inline gap="tight" key={row.id}>
            <Input
              autoComplete="off"
              disabled={disabled}
              error={keyError(key, duplicate, reserved)}
              onChange={(event) => update(row.id, { key: event.target.value })}
              placeholder="LOG_LEVEL"
              spellCheck={false}
              value={row.key}
            />
            <Input
              autoComplete="off"
              disabled={disabled}
              error={valueError(row.value)}
              onChange={(event) => update(row.id, { value: event.target.value })}
              placeholder="info"
              spellCheck={false}
              value={row.value}
            />
            <IconButton
              disabled={disabled}
              label={`Remove ${key || 'this variable'}`}
              name="trash"
              onClick={() => remove(row.id)}
              size="sm"
              variant="ghost"
            />
          </Inline>
        )
      })}
      <Inline gap="tight">
        <Button disabled={disabled || rows.length >= MAX_VARIABLES} onClick={add} size="sm" variant="secondary">Add variable</Button>
        <Body size="sm" tone="muted">{named} of {MAX_VARIABLES} · values are visible to anyone who can inspect the service, so attach a managed database for credentials.</Body>
      </Inline>
    </Rows>
  )
}

function rowsOf(env: Record<string, string> | undefined): Row[] {
  return Object.entries(env ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value], index) => ({ id: index + 1, key, value }))
}

function serialize(env: Record<string, string> | undefined): string {
  return JSON.stringify(Object.entries(env ?? {}).sort(([left], [right]) => left.localeCompare(right)))
}
