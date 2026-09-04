import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Be_Vietnam_Pro, Fraunces } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Toaster } from "sonner";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Realidi — Trải nghiệm thật, từ người thật",
    template: "%s · Realidi",
  },
  description:
    "Mạng xã hội trải nghiệm du lịch: người, khoảnh khắc, nơi chốn, mood và trải nghiệm đã xác minh.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    siteName: "Realidi",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>
            <a className="skip-link" href="#main">
              Bỏ qua nội dung
            </a>
            {children}
            <Toaster position="top-center" />
          </ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
