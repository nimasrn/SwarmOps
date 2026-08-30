import { APIError } from '../data/api'

/**
 * One reading of a thrown value, so a failure always reaches the operator as a
 * sentence rather than as `[object Object]`.
 */

export interface ConnectionError {
  detail?: string
  message: string
  requestID?: string
}

export function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Unexpected operation failure'
}

/**
 * The same failure with the two fields an operator needs when they have to ask
 * someone else about it: the server's own detail line and the request ID that
 * ties this browser attempt to a controller audit record.
 */
export function connectionErrorOf(reason: unknown): ConnectionError {
  if (reason instanceof APIError) return { detail: reason.detail, message: reason.message, requestID: reason.requestID }
  return { message: messageOf(reason) }
}

export function isExpiredSession(reason: unknown) {
  return reason instanceof APIError && reason.status === 401
}
