/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prevent dynamic routes (those using cookies/headers) from being served
    // stale from the client Router Cache. Without this, navigating back to the
    // reader after changing TTS settings serves the old cached server payload.
    staleTimes: {
      dynamic: 0,
    },
    outputFileTracingIncludes: {
      '/api/**': [
        './data/frequency/**',
      ],
    },
  },
};

export default nextConfig;
