// worklog: 2026-03-04 09:41:11 | trantu | fix | getEnvValue
// worklog: 2026-03-04 22:03:47 | trantu | fix | getEnvValue
const getEnvValue = (value: string | undefined, fallback: string) => {
  return value && value.trim().length > 0 ? value : fallback
}

export const env = {
  appName: getEnvValue(import.meta.env.VITE_APP_NAME, 'golden-billiards-fe'),
  apiBaseUrl: getEnvValue(import.meta.env.VITE_API_BASE_URL, 'http://localhost:8080/api/v1'),
}
