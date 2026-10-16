import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// The offline page and install files hold no personal data and must load without a session.
const isPublic = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/health", "/offline", "/manifest.webmanifest", "/icon(.*)", "/apple-icon(.*)", "/sw.js"]);
const isApi = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return;
  // APIs answer with the error envelope; a redirect to an HTML sign-in page means nothing to fetch().
  if (isApi(req)) {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: { code: "unauthorized", message: "Please sign in first." } }, { status: 401 });
    return;
  }
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
