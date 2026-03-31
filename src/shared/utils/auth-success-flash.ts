export type AuthSuccessFlash = 'login' | 'register'

const AUTH_SUCCESS_FLASH_KEY = 'auth-success-flash'

export const setAuthSuccessFlash = (value: AuthSuccessFlash) => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(AUTH_SUCCESS_FLASH_KEY, value)
}

export const consumeAuthSuccessFlash = (): AuthSuccessFlash | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const value = window.sessionStorage.getItem(AUTH_SUCCESS_FLASH_KEY)
  window.sessionStorage.removeItem(AUTH_SUCCESS_FLASH_KEY)

  if (value === 'login' || value === 'register') {
    return value
  }

  return null
}
