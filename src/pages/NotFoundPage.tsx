import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

import { ROUTE_PATHS } from '@/shared/constants/routes'

export const PageNotFound = () => {

  const navigate = useNavigate()

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Result
        status="404"
        title="404"
        subTitle="Page not found"
        extra={
          <Button type="primary" onClick={() => navigate(ROUTE_PATHS.ROOT)}>
            Về trang chủ
          </Button>
        }
      />
    </main>
  )
}
