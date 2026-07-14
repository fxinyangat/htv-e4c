const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i
const URL_RE = /^(https?:\/\/)?[^\s]+\.[^\s]+$/i

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

// Strips protocol, "www.", and any path/query so "https://www.foo.com/bar" and "foo.com"
// both normalize to the bare hostname the rest of the app stores and links against.
export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]
}

export function isValidDomain(value: string): boolean {
  return DOMAIN_RE.test(normalizeDomain(value))
}

export function isValidUrl(value: string): boolean {
  return URL_RE.test(value.trim())
}
