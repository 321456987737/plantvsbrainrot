/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // ✅ This is the real protection: only allow this one domain
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://plantvsbrainrotstock.com;",
          },
          {
            // Optional: older browser fallback
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://plantvsbrainrotstock.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   async headers() {
//     return [
//       {
//         source: '/(.*)',
//         headers: [
//           { key: 'X-Frame-Options', value: 'DENY' },
//           { key: 'Content-Security-Policy', value: "frame-ancestors 'none';" },
//         ],
//       },
//     ];
//   },
// };


// export default nextConfig;
