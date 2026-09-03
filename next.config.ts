import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

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
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : []),
    ],
  },
};

export default nextConfig;
