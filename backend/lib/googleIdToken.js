import { createRemoteJWKSet, jwtVerify } from 'jose'

// Verifies Google's ID token against Google's own published keys, rather than trusting an
// unauthenticated userinfo call — signature, audience (our client), issuer, and expiry are all
// checked by jwtVerify itself; anything failing any of those throws.
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

// Returns the verified claims — sub, email, email_verified, name, picture — or throws.
export async function verifyGoogleIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_CLIENT_ID,
  })
  return payload
}
