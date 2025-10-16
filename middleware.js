import { NextResponse } from "next/server";

// ✅ List all domains allowed to embed your app
const ALLOWED_SITES = [
  "https://plantvsbrainrotstock.com",
  "https://plantsvsbrainrotsstocknotifier.com",
];

export function middleware(req) {
  const res = NextResponse.next();

  // ✅ Convert array into a space-separated string for CSP
  const allowedForCSP = ALLOWED_SITES.join(" ");

  // ✅ For older browsers, only one domain can be used in X-Frame-Options
  // so we just allow the first one
  const allowedForXFrame = ALLOWED_SITES[0];

  // Set headers
  res.headers.set(
    "Content-Security-Policy",
    `frame-ancestors 'self' ${allowedForCSP};`
  );
  res.headers.set("X-Frame-Options", `ALLOW-FROM ${allowedForXFrame}`);

  return res;
}

export const config = {
  matcher: "/:path*", // Apply to all routes
};

// // middleware.js (in project root)
// import { NextResponse } from "next/server";

// // Replace this with the only site allowed to embed your app
// const ALLOWED_SITE = ["https://plantvsbrainrotstock.com","https://plantsvsbrainrotsstocknotifier.com"]; // 👈 your allowed domain

// export function middleware(req) {
//   const res = NextResponse.next();

//   // Allow embedding *only* on the allowed site
//   res.headers.set(
//     "Content-Security-Policy",
//     `frame-ancestors 'self' ${ALLOWED_SITE};`
//   );

//   // Also keep X-Frame-Options as extra layer (some old browsers still use it)
//   res.headers.set("X-Frame-Options", "ALLOW-FROM " + ALLOWED_SITE);

//   return res;
// }

// export const config = {
//   matcher: "/:path*", // apply to all routes
// };
