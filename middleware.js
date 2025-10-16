// middleware.js (in project root)
import { NextResponse } from "next/server";

// Replace this with the only site allowed to embed your app
const ALLOWED_SITE = "https://plantvsbrainrotstock.com"; // 👈 your allowed domain

export function middleware(req) {
  const res = NextResponse.next();

  // Allow embedding *only* on the allowed site
  res.headers.set(
    "Content-Security-Policy",
    `frame-ancestors 'self' ${ALLOWED_SITE};`
  );

  // Also keep X-Frame-Options as extra layer (some old browsers still use it)
  res.headers.set("X-Frame-Options", "ALLOW-FROM " + ALLOWED_SITE);

  return res;
}

export const config = {
  matcher: "/:path*", // apply to all routes
};

// // middleware.js (in project root)
// import { NextResponse } from 'next/server';


// export function middleware(req) {
//   const res = NextResponse.next();
//   // Block all iframe embedding
//   res.headers.set("X-Frame-Options", "DENY");
//   res.headers.set("Content-Security-Policy", "frame-ancestors 'none';");
//   return res;
// }

// export const config = {
//   matcher: "/:path*", // apply to every route
// };
