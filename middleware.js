import { NextResponse } from "next/server";

export function middleware(req) {
  const res = NextResponse.next();

  // ✅ Only allow iframe embedding from your WordPress domain
  res.headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://plantvsbrainrotstock.com;"
  );

  // ✅ Also set legacy X-Frame-Options header for older browsers
  res.headers.set("X-Frame-Options", "ALLOW-FROM https://plantvsbrainrotstock.com");

  return res;
}

// ✅ Apply this to all routes (you can narrow it down if needed)
export const config = {
  matcher: "/:path*",
};
