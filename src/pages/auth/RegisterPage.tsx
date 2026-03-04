import { useMutation } from '@tanstack/react-query'
import { Button, Form, Input, message, Typography } from 'antd'
import { Link, useNavigate } from 'react-router-dom'

import { useAppDispatch } from '@/app/store/hooks'
import { register } from '@/features/auth/api/auth.api'
import type { RegisterPayload } from '@/features/auth/model/auth.types'
import { setAccessToken, setAuthStatus, setUser } from '@/features/auth/store/auth.slice'
import { getDefaultRouteByRole, ROUTE_PATHS } from '@/shared/constants/routes'
import { setRefreshTokenCookie } from '@/shared/utils/cookie'

interface RegisterFormValues extends RegisterPayload {
  confirmPassword: string
}

export const RegisterPage = () => {
  const [form] = Form.useForm<RegisterFormValues>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      dispatch(setAccessToken(data.tokens.accessToken))
      dispatch(setUser(data.user))
      dispatch(setAuthStatus('authenticated'))
      setRefreshTokenCookie(data.tokens.refreshToken)
      void message.success('Đăng ký thành công')
      navigate(getDefaultRouteByRole(data.user.role), { replace: true })
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const onFinish = ({ confirmPassword: _confirmPassword, ...values }: RegisterFormValues) => {
    registerMutation.mutate(values)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <Typography.Title level={3} className="!mb-0">
          Đăng ký
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0">
          Tạo tài khoản mới để bắt đầu
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
          label="Họ và tên"
          name="fullName"
          rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
        >
          <Input placeholder="Nguyen Van A" />
        </Form.Item>

        <Form.Item
          label="Mật khẩu"
          name="password"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu' },
            { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự' },
          ]}
          hasFeedback
        >
          <Input.Password placeholder="Nhập mật khẩu" />
        </Form.Item>

        <Form.Item
          label="Xác nhận mật khẩu"
          name="confirmPassword"
          dependencies={['password']}
          hasFeedback
          rules={[
            { required: true, message: 'Vui lòng xác nhận mật khẩu' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }

                return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
              },
            }),
          ]}
        >
          <Input.Password placeholder="Nhập lại mật khẩu" />
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={registerMutation.isPending}>
          Đăng ký
        </Button>
      </Form>

      <Typography.Paragraph className="!mb-0 text-center">
        Đã có tài khoản? <Link to={ROUTE_PATHS.LOGIN}>Đăng nhập</Link>
      </Typography.Paragraph>
    </div>
  )
}
