/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // ✅ Add multiple allowed domains separated by spaces
            value:
              "frame-ancestors 'self' https://plantvsbrainrotstock.com https://plantsvsbrainrotsstocknotifier.com;",
          },
          {
            // ⚠️ Note: X-Frame-Options only supports ONE domain
            // So keep it for backward compatibility (optional)
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
//         source: "/(.*)",
//         headers: [
//           {
//             // ✅ This is the real protection: only allow this one domain
//             key: "Content-Security-Policy",
//             value: "frame-ancestors 'self' https://plantvsbrainrotstock.com;",
//           },
//           {
//             // Optional: older browser fallback
//             key: "X-Frame-Options",
//             value: "ALLOW-FROM https://plantvsbrainrotstock.com",
//           },
//         ],
//       },
//     ];
//   },
// };

// export default nextConfig;
