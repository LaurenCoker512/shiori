/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@patdx/kuromoji'],
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
        './node_modules/@patdx/kuromoji/dict/**',
      ],
    },
  },
};

export default nextConfig;
