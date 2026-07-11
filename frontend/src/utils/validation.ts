const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DOMAIN_RE = /^(?!https?:\/\/)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i
const URL_RE = /^(https?:\/\/)?[^\s]+\.[^\s]+$/i

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isValidDomain(value: string): boolean {
  return DOMAIN_RE.test(value.trim())
}

export function isValidUrl(value: string): boolean {
  return URL_RE.test(value.trim())
}
