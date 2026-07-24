import { buildGoogleAuthUrl, exchangeCodeForTokens } from '../lib/googleAuth.js'
import { verifyGoogleIdToken } from '../lib/googleIdToken.js'
import { randomState, generatePkcePair } from '../lib/pkce.js'
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_MS } from '../lib/jwt.js'
import { getUserBySub, createPendingUser } from '../services/usersStore.js'
import { sendData } from '../lib/response.js'

const STATE_COOKIE = 'htv_oauth_state'
const VERIFIER_COOKIE = 'htv_oauth_verifier'

// Backend and frontend share one origin in production (vercel.json's rewrites) but not in local
// dev (Vite on 5173, this server on 8000) — Google redirects straight back to this server's own
// host, bypassing Vite's proxy, so the post-login redirect needs to explicitly target the
// frontend's dev origin locally.
const FRONTEND_ORIGIN = process.env.VERCEL ? '' : 'http://localhost:5173'

function isProd() {
  return !!process.env.VERCEL
}

function callbackRedirectUri(req) {
  return `${req.protocol}://${req.get('host')}/api/auth/google/callback`
}

function stateCookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: isProd(), path: '/api/auth', maxAge: 10 * 60 * 1000 }
}

function sessionCookieOptions() {
  return { httpOnly: true, sameSite: 'strict', secure: isProd(), path: '/', maxAge: SESSION_TTL_MS }
}

export function googleLogin(req, res) {
  const state = randomState()
  const { codeVerifier, codeChallenge } = generatePkcePair()

  res.cookie(STATE_COOKIE, state, stateCookieOptions())
  res.cookie(VERIFIER_COOKIE, codeVerifier, stateCookieOptions())

  const url = buildGoogleAuthUrl({ redirectUri: callbackRedirectUri(req), state, codeChallenge })
  res.redirect(url)
}

export async function googleCallback(req, res) {
  const clearStateCookies = () => {
    res.clearCookie(STATE_COOKIE, { path: '/api/auth' })
    res.clearCookie(VERIFIER_COOKIE, { path: '/api/auth' })
  }

  const { code, state } = req.query
  const expectedState = req.cookies?.[STATE_COOKIE]
  const codeVerifier = req.cookies?.[VERIFIER_COOKIE]

  if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
    clearStateCookies()
    return res.redirect(`${FRONTEND_ORIGIN}/login?error=state_mismatch`)
  }

  try {
    const tokens = await exchangeCodeForTokens({ code, codeVerifier, redirectUri: callbackRedirectUri(req) })
    const claims = await verifyGoogleIdToken(tokens.id_token)
    const sub = claims.sub

    let user = await getUserBySub(sub)
    if (!user) {
      user = await createPendingUser({ sub, name: claims.name, email: claims.email, picture: claims.picture })
    }

    clearStateCookies()

    if (user.status !== 'Approved') {
      return res.redirect(`${FRONTEND_ORIGIN}/login?pending=1`)
    }

    const token = signSessionToken(sub)
    res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions())
    return res.redirect(`${FRONTEND_ORIGIN}/`)
  } catch (err) {
    console.error('Google OAuth callback failed:', err)
    clearStateCookies()
    return res.redirect(`${FRONTEND_ORIGIN}/login?error=oauth_failed`)
  }
}

export function logout(req, res) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
  sendData(res, null, 'Logged out')
}

export function me(req, res) {
  sendData(res, req.user)
}
