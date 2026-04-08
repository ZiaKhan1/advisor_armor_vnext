export type BackendErrorType = 'http' | 'timeout' | 'network' | 'application' | 'unknown'

export class BackendError extends Error {
  type: BackendErrorType
  statusCode?: number
  details?: unknown
  retryable: boolean

  constructor(
    type: BackendErrorType,
    message: string,
    options?: { statusCode?: number; details?: unknown; retryable?: boolean }
  ) {
    super(message)
    this.name = 'BackendError'
    this.type = type
    this.statusCode = options?.statusCode
    this.details = options?.details
    this.retryable = options?.retryable ?? type !== 'application'
  }
}

export function isBackendError(error: unknown): error is BackendError {
  return error instanceof BackendError
}
