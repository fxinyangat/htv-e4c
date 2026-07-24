// Plain fetch()-based Google OAuth2 code exchange — consistent with notion.js/dust.js's
// hand-rolled fetch wrappers rather than pulling in an official client library.
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Loaded independently here (matching notion.js/dust.js's pattern) — this file reads its env
// vars at module-load time, so it can't assume some other module already ran dotenv.config().
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
if (!GOOGLE_CLIENT_ID) console.warn('WARNING: GOOGLE_CLIENT_ID is not set')
if (!GOOGLE_CLIENT_SECRET) console.warn('WARNING: GOOGLE_CLIENT_SECRET is not set')

export function buildGoogleAuthUrl({ redirectUri, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`
}

// Exchanges the authorization code for tokens, including the PKCE code_verifier. Returns
// { id_token, access_token, ... } — id_token is the one that actually matters (see
// googleIdToken.js for verification); the others aren't used by this app.
export async function exchangeCodeForTokens({ code, codeVerifier, redirectUri }) {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Google token exchange failed')
    err.status = res.status
    throw err
  }
  return data
}
