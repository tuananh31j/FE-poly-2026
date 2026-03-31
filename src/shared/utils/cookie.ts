const REFRESH_TOKEN_COOKIE_KEY = 'poly2026_refresh_token'

const parseCookie = (rawCookie: string) => {
  return rawCookie
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, item) => {
      const [key, ...valueParts] = item.split('=')
      acc[key] = decodeURIComponent(valueParts.join('='))
      return acc
    }, {})
}

export const getRefreshTokenCookie = () => {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = parseCookie(document.cookie)
  return cookies[REFRESH_TOKEN_COOKIE_KEY] ?? null
}

export const setRefreshTokenCookie = (token: string) => {
  if (typeof document === 'undefined') {
    return
  }

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const securePart = isHttps ? '; Secure' : ''

  document.cookie = `${REFRESH_TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${securePart}`
}

export const clearRefreshTokenCookie = () => {
  if (typeof document === 'undefined') {
    return
  }

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const securePart = isHttps ? '; Secure' : ''

  document.cookie = `${REFRESH_TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${securePart}`
}
