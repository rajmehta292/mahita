import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security/http-headers";

const SCHWAB_POPUP_COMPATIBLE_ROUTES = [
  "/active-trader",
  "/dashboard",
  "/history",
  "/portfolio",
  "/schwab/connect",
  "/schwab/callback",
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: [
    "http://localhost:6244",
    "http://127.0.0.1:6244",
    "http://localhost:6245",
    "http://127.0.0.1:6245",
    "mahita.ai",
    "https://mahita.ai",
  ],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          isDevelopment: process.env.NODE_ENV !== "production",
          isProduction: process.env.NODE_ENV === "production",
        }),
      },
      ...SCHWAB_POPUP_COMPATIBLE_ROUTES.map((source) => ({
        source,
        headers: buildSecurityHeaders({
          isDevelopment: process.env.NODE_ENV !== "production",
          isProduction: process.env.NODE_ENV === "production",
          crossOriginOpenerPolicy: "same-origin-allow-popups",
        }),
      })),
    ];
  },
};

export default nextConfig;
