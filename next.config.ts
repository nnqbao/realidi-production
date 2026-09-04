import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

function convexSitePattern() {
  const raw = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [
      {
        protocol: (url.protocol === "https:" ? "https" : "http") as "http" | "https",
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  distDir: ".next",
  allowedDevOrigins: ["*.trycloudflare.com"],
  devIndicators: false,
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  transpilePackages: ["mapbox-gl"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...convexSitePattern(),
    ],
  },
};

export default nextConfig;
