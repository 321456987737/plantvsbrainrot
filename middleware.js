// middleware.js (in project root)
import { NextResponse } from 'next/server';


export function middleware(req) {
  const res = NextResponse.next();
  // Block all iframe embedding
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none';");
  return res;
}

export const config = {
  matcher: "/:path*", // apply to every route
};
