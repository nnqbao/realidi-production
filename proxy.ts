import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { safeReturnPath } from "@/lib/auth/return-to";

const proxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const path = request.nextUrl.pathname;
    const isAdminPath = path.startsWith("/admin");
    const isAuthPath =
      path === "/login" || path === "/signup" || path === "/reset-password";

    if (isAdminPath && !(await convexAuth.isAuthenticated())) {
      const next = path + request.nextUrl.search;
      return nextjsMiddlewareRedirect(
        request,
        `/login?next=${encodeURIComponent(next)}`,
      );
    }

    if (isAuthPath && (await convexAuth.isAuthenticated())) {
      const next = safeReturnPath(request.nextUrl.searchParams.get("next"), "/home");
      return nextjsMiddlewareRedirect(request, next);
    }
  },
  {
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
  },
);

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
