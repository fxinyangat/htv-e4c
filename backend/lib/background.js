import { waitUntil } from '@vercel/functions'

// Keeps a promise running after the HTTP response has already been sent. On Vercel, Fluid
// Compute needs to be told explicitly to keep the invocation alive for this — `waitUntil`
// isn't meaningful (and isn't safe to call) outside that runtime, so locally we just let the
// promise run un-awaited: the long-lived dev process isn't going to be killed the moment a
// response is sent the way a serverless invocation would be.
export function runInBackground(promise) {
  const guarded = promise.catch(err => console.error('Background task failed:', err))
  if (process.env.VERCEL) waitUntil(guarded)
}
