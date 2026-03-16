/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: true,
  env: {
    // Frontend must point at Cloud Run URLs in production.
    // In development we fall back to local defaults.
    NEXT_PUBLIC_PERSONA_SERVICE_URL:
      process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL ||
      (!isProd ? "http://localhost:8080" : undefined),
    NEXT_PUBLIC_PROFILE_SERVICE_URL:
      process.env.NEXT_PUBLIC_PROFILE_SERVICE_URL ||
      (!isProd ? "http://localhost:8081" : undefined),
    NEXT_PUBLIC_SYNTHESIS_SERVICE_URL:
      process.env.NEXT_PUBLIC_SYNTHESIS_SERVICE_URL ||
      (!isProd ? "http://localhost:8082" : undefined),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
};

module.exports = nextConfig;
