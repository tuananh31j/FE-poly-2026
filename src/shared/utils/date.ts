import dayjs from 'dayjs'

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) {
    return 'N/A'
  }

  return dayjs(value).format('DD/MM/YYYY HH:mm:ss')
}
