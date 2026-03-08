const getEnvValue = (value: string | undefined, fallback: string) => {
    return value && value.trim().length > 0 ? value : fallback
}

export const env = {
    appName: getEnvValue(import.meta.env.VITE_APP_NAME, 'golden-billiards-fe'),
    apiBaseUrl: getEnvValue(import.meta.env.VITE_API_BASE_URL, 'http://localhost:8080/api/v1'),
}