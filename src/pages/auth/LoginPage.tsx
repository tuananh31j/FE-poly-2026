import { useMutation } from '@tanstack/react-query'
import { Button, Form, Input, message, Typography } from 'antd'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAppDispatch } from '@/app/store/hooks'
import { login } from '@/features/auth/api/auth.api'
import type { LoginPayload } from '@/features/auth/model/auth.types'
import { setAccessToken, setAuthStatus, setUser } from '@/features/auth/store/auth.slice'
import { getDefaultRouteByRole, ROUTE_PATHS } from '@/shared/constants/routes'
import { setRefreshTokenCookie } from '@/shared/utils/cookie'

export const LoginPage = () => {
  const [form] = Form.useForm<LoginPayload>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectPath = searchParams.get('redirect')?.trim()

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      dispatch(setAccessToken(data.tokens.accessToken))
      dispatch(setUser(data.user))
      dispatch(setAuthStatus('authenticated'))
      setRefreshTokenCookie(data.tokens.refreshToken)
      void message.success('Đăng nhập thành công')
      const nextPath =
        redirectPath && redirectPath.startsWith('/') ? redirectPath : getDefaultRouteByRole(data.user.role)
      navigate(nextPath, { replace: true })
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const onFinish = (values: LoginPayload) => {
    loginMutation.mutate(values)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <Typography.Title level={3} className="!mb-0">
          Đăng nhập
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0">
          Truy cập hệ thống quản trị của bạn
        </Typography.Paragraph>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input placeholder="you@example.com" />
        </Form.Item>

        <Form.Item
          label="Mật khẩu"
          name="password"
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
        >
          <Input.Password placeholder="Nhập mật khẩu" />
        </Form.Item>

        <div className="mb-4 text-right">
          <Link to={ROUTE_PATHS.FORGOT_PASSWORD}>Quên mật khẩu?</Link>
        </div>

        <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
          Đăng nhập
        </Button>
      </Form>

      <Typography.Paragraph className="!mb-0 text-center">
        Chưa có tài khoản? <Link to={ROUTE_PATHS.REGISTER}>Đăng ký</Link>
      </Typography.Paragraph>
    </div>
  )
}
