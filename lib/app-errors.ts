export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "MONACO_INIT_FAILED"
  | "RUNTIME_SCHEMA_MISMATCH"
  | "RUNTIME_HEALTH_UNAVAILABLE"
  | "UPSTREAM_FETCH_FAILED"
  | "UNKNOWN_ERROR"

export interface AppErrorOptions {
  code?: AppErrorCode
  status?: number
  details?: Record<string, unknown> | null
  hint?: string | null
  recoverable?: boolean
}

export interface AppErrorPayload {
  success: false
  error: string
  code: AppErrorCode
  status: number
  details: Record<string, unknown> | null
  hint: string | null
  recoverable: boolean
}

export class AppError extends Error {
  code: AppErrorCode
  status: number
  details: Record<string, unknown> | null
  hint: string | null
  recoverable: boolean

  constructor(message: string, options?: AppErrorOptions) {
    super(message)
    this.name = "AppError"
    this.code = options?.code ?? "UNKNOWN_ERROR"
    this.status = options?.status ?? 500
    this.details = options?.details ?? null
    this.hint = options?.hint ?? null
    this.recoverable = options?.recoverable ?? this.status < 500
  }
}

function stringifyUnknownObject(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function isEventLikeObject(value: unknown): value is {
  type?: unknown
  message?: unknown
  error?: unknown
  name?: unknown
  isTrusted?: unknown
} {
  return Boolean(value && typeof value === "object")
}

export function normalizeUnknownError(
  error: unknown,
  fallbackMessage = "Mahita hit an unexpected error.",
  options?: AppErrorOptions
): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError(error.message || fallbackMessage, {
      ...options,
      details:
        options?.details ??
        ("cause" in error && error.cause && typeof error.cause === "object"
          ? (error.cause as Record<string, unknown>)
          : null),
    })
  }

  if (typeof Event !== "undefined" && error instanceof Event) {
    const eventLike = error as Event & { message?: string }
    return new AppError(
      eventLike.message?.trim() || fallbackMessage,
      {
        ...options,
        details: {
          ...(options?.details ?? {}),
          eventType: error.type,
        },
        hint:
          options?.hint ??
          "Refresh the page once. If the problem repeats, open the runtime health endpoint.",
      }
    )
  }

  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; type?: unknown; name?: unknown }

    if (typeof maybeError.message === "string" && maybeError.message.trim()) {
      return new AppError(maybeError.message.trim(), {
        ...options,
        details: {
          ...(options?.details ?? {}),
          rawType: typeof maybeError.type === "string" ? maybeError.type : undefined,
          rawName: typeof maybeError.name === "string" ? maybeError.name : undefined,
        },
      })
    }
  }

  if (isEventLikeObject(error)) {
    const eventType = typeof error.type === "string" ? error.type : null
    const nestedError =
      error.error instanceof Error
        ? error.error.message
        : typeof error.error === "string"
          ? error.error
          : null

    return new AppError(nestedError || fallbackMessage, {
      ...options,
      details: {
        ...(options?.details ?? {}),
        eventType,
        rawName: typeof error.name === "string" ? error.name : undefined,
        isTrusted: typeof error.isTrusted === "boolean" ? error.isTrusted : undefined,
      },
      hint:
        options?.hint ??
        "Mahita converted a browser event failure into a readable error. Retry once, then inspect the affected panel health if it repeats.",
    })
  }

  if (typeof error === "string" && error.trim()) {
    return new AppError(error.trim(), options)
  }

  const serialized = stringifyUnknownObject(error)
  return new AppError(fallbackMessage, {
    ...options,
    details: serialized
      ? {
          ...(options?.details ?? {}),
          raw: serialized,
        }
      : options?.details ?? null,
  })
}

export function toAppErrorPayload(error: unknown, fallbackMessage?: string): AppErrorPayload {
  const normalized = normalizeUnknownError(error, fallbackMessage)

  return {
    success: false,
    error: normalized.message,
    code: normalized.code,
    status: normalized.status,
    details: normalized.details,
    hint: normalized.hint,
    recoverable: normalized.recoverable,
  }
}

export async function parseResponseError(
  response: Response,
  fallbackMessage: string
): Promise<AppError> {
  let payload: Partial<AppErrorPayload> | null = null

  try {
    payload = (await response.json()) as Partial<AppErrorPayload>
  } catch {
    payload = null
  }

  return new AppError(payload?.error || fallbackMessage, {
    code: payload?.code ?? "UPSTREAM_FETCH_FAILED",
    status: response.status || payload?.status || 500,
    details: payload?.details ?? null,
    hint: payload?.hint ?? null,
    recoverable: payload?.recoverable ?? response.status < 500,
  })
}
