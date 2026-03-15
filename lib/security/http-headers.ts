const DEFAULT_CONNECT_SOURCES = [
  "'self'",
  "https:",
  "wss:",
]

export function buildSecurityHeaders(options?: {
  isDevelopment?: boolean
  isProduction?: boolean
  crossOriginOpenerPolicy?: string
}) {
  const isDevelopment = options?.isDevelopment ?? process.env.NODE_ENV !== "production"
  const isProduction = options?.isProduction ?? process.env.NODE_ENV === "production"
  const crossOriginOpenerPolicy = options?.crossOriginOpenerPolicy ?? "same-origin"

  const connectSources = [...DEFAULT_CONNECT_SOURCES]

  if (isDevelopment) {
    connectSources.push("http://localhost:11434", "http://127.0.0.1:11434", "ws:")
  }

  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
  ].join("; ")

  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: crossOriginOpenerPolicy },
    { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
  ]

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    })
  }

  return headers
}
