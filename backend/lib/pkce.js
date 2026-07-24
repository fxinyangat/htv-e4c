import { randomBytes, createHash } from 'crypto'

export function randomState() {
  return randomBytes(24).toString('base64url')
}

// RFC 7636 PKCE — code_verifier is a random string, code_challenge is its SHA256 hash
// (S256 method). Sent as code_challenge on the auth redirect, code_verifier on the token
// exchange, so Google can confirm the same client that started the flow is the one finishing it.
export function generatePkcePair() {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}
