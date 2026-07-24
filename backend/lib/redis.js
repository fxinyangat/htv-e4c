import { Redis } from '@upstash/redis'

// REST-based client — no persistent TCP connection, which fits Vercel's request-scoped
// Fluid Compute model better than a traditional Redis driver (e.g. ioredis).
// Not Redis.fromEnv(): Vercel's Upstash Marketplace integration names its env vars
// UPSTASH_REDIS_REST_KV_REST_API_URL / _TOKEN, not the plain UPSTASH_REDIS_REST_URL / _TOKEN
// that fromEnv() looks for — so the client is built explicitly against the real names.
// (KV_URL / REDIS_URL, also provided by the integration, are for TCP-based clients like
// ioredis, not this REST client — deliberately unused here.)
//
// enableAutoPipelining is off deliberately: the SDK's auto-pipelining batches commands via a
// background mechanism whose failures aren't tied to the awaiting caller's promise, which can
// surface as an unhandled rejection instead of a normal rejected promise our try/catch blocks
// can catch. Each command being a plain, directly-awaited request keeps failure handling
// predictable.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
  enableAutoPipelining: false,
})
