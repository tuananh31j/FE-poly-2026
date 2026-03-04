import { QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import vi from 'antd/locale/vi_VN'
import { useEffect } from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { useLocation } from 'react-router-dom'

import { queryClient } from '@/app/query/queryClient'
import { router } from '@/app/router'
import { store } from '@/app/store'
import { antdTheme } from '@/app/theme/antdTheme'

import { AuthBootstrap } from './AuthBootstrap'

const useAutoScrollToTop = () => {
  const path = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }, [path])
}

export const AppProviders = () => {
  useAutoScrollToTop()
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          locale={vi}
          input={{
            autoComplete: 'off',
          }}
          componentSize={'medium'}
          theme={antdTheme}
        >
          <AuthBootstrap />
          <RouterProvider router={router} />
        </ConfigProvider>
      </QueryClientProvider>
    </Provider>
  )
}
