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

function isPrismaSchemaMismatchError(value: unknown): value is {
  code?: unknown
  name?: unknown
  message?: unknown
  meta?: unknown
} {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as {
    code?: unknown
    name?: unknown
    message?: unknown
    meta?: unknown
  }

  if (candidate.code === "P2022") {
    return true
  }

  if (typeof candidate.message === "string" && candidate.message.includes("does not exist in the current database")) {
    return true
  }

  return false
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
  if (isPrismaSchemaMismatchError(error)) {
    return new AppError("Mahita detected a Prisma schema/client mismatch.", {
      code: "RUNTIME_SCHEMA_MISMATCH",
      status: 503,
      details:
        typeof error === "object" && error && "meta" in error && error.meta && typeof error.meta === "object"
          ? (error.meta as Record<string, unknown>)
          : options?.details ?? null,
      hint:
        options?.hint ??
        "Run `npx prisma generate`, apply the current Prisma schema to the active database, and restart the app so runtime models and database columns match.",
      recoverable: true,
    })
  }

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

export async function readJsonResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  const expectsJson = contentType.includes("application/json")

  if (expectsJson) {
    let payload: unknown

    try {
      payload = await response.json()
    } catch {
      throw new AppError(fallbackMessage, {
        code: "UPSTREAM_FETCH_FAILED",
        status: response.status || 500,
        hint: "Mahita expected JSON but could not parse the response body.",
        recoverable: true,
      })
    }

    if (!response.ok) {
      const errorPayload = payload as Partial<AppErrorPayload> | null
      throw new AppError(errorPayload?.error || fallbackMessage, {
        code: errorPayload?.code ?? "UPSTREAM_FETCH_FAILED",
        status: response.status || errorPayload?.status || 500,
        details: errorPayload?.details ?? null,
        hint: errorPayload?.hint ?? null,
        recoverable: errorPayload?.recoverable ?? response.status < 500,
      })
    }

    return payload as T
  }

  const text = await response.text().catch(() => "")
  const looksLikeHtml = /^\s*</.test(text)
  const unauthorized = response.status === 401 || response.status === 403

  if (looksLikeHtml) {
    throw new AppError(
      unauthorized
        ? "Your session expired. Refresh and sign in again."
        : "Mahita received an HTML document instead of JSON.",
      {
        code: unauthorized ? "UNAUTHORIZED" : "UPSTREAM_FETCH_FAILED",
        status: response.status || 500,
        details: {
          contentType,
          preview: text.slice(0, 160),
        },
        hint: unauthorized
          ? "An auth redirect or expired session intercepted an API request."
          : "Check the upstream route or proxy; a JSON API returned an HTML document.",
        recoverable: true,
      }
    )
  }

  throw new AppError(fallbackMessage, {
    code: "UPSTREAM_FETCH_FAILED",
    status: response.status || 500,
    details: {
      contentType,
      preview: text.slice(0, 160),
    },
    recoverable: response.status < 500,
  })
}

interface FetchJsonWithTimeoutOptions extends RequestInit {
  timeoutMs?: number
  fallbackMessage: string
  timeoutMessage?: string
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  options: FetchJsonWithTimeoutOptions
): Promise<T> {
  const {
    timeoutMs = 15_000,
    fallbackMessage,
    timeoutMessage = "Mahita timed out while waiting for a JSON response.",
    signal,
    ...requestInit
  } = options

  const controller = new AbortController()
  const resolvedTimeoutMs = Math.max(1_000, Math.floor(timeoutMs))
  let timedOut = false

  const abortFromParent = () => controller.abort()
  if (signal) {
    if (signal.aborted) {
      abortFromParent()
    } else {
      signal.addEventListener("abort", abortFromParent, { once: true })
    }
  }

  const timeoutHandle = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, resolvedTimeoutMs)

  try {
    const response = await fetch(input, {
      ...requestInit,
      signal: controller.signal,
    })

    return await readJsonResponse<T>(response, fallbackMessage)
  } catch (error) {
    if (timedOut) {
      throw new AppError(timeoutMessage, {
        code: "UPSTREAM_FETCH_FAILED",
        status: 504,
        hint: `The request exceeded the ${Math.round(resolvedTimeoutMs / 1000)}s timeout.`,
        recoverable: true,
      })
    }

    throw error
  } finally {
    clearTimeout(timeoutHandle)
    if (signal) {
      signal.removeEventListener("abort", abortFromParent)
    }
  }
}
