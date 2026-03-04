import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, message,Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

import { useAppDispatch } from '@/app/store/hooks'
import { changeMyPassword } from '@/features/account/api/account.api'
import type { ChangePasswordPayload } from '@/features/account/model/account.types'
import { clearAuth } from '@/features/auth/store/auth.slice'
import { ROUTE_PATHS } from '@/shared/constants/routes'
import { clearRefreshTokenCookie } from '@/shared/utils/cookie'

interface ChangePasswordFormValues extends ChangePasswordPayload {
  confirmPassword: string
}

export const ChangePasswordPage = () => {
  const [form] = Form.useForm<ChangePasswordFormValues>()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const changePasswordMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: () => {
      clearRefreshTokenCookie()
      dispatch(clearAuth())
      queryClient.clear()
      void message.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại')
      navigate(ROUTE_PATHS.LOGIN, { replace: true })
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const onSubmit = ({ confirmPassword: _confirmPassword, ...values }: ChangePasswordFormValues) => {
    changePasswordMutation.mutate(values)
  }

  return (
    <Card>
      <Typography.Title level={4} className="!mb-1">
        Đổi mật khẩu
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Mật khẩu mới nên có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.
      </Typography.Paragraph>

      <Form form={form} layout="vertical" onFinish={onSubmit} autoComplete="off">
        <Form.Item
          label="Mật khẩu hiện tại"
          name="currentPassword"
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          label="Mật khẩu mới"
          name="newPassword"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu mới' },
            { min: 8, message: 'Mật khẩu mới cần ít nhất 8 ký tự' },
          ]}
          hasFeedback
        >
          <Input.Password />
        </Form.Item>

        <Form.Item
          label="Xác nhận mật khẩu mới"
          name="confirmPassword"
          dependencies={['newPassword']}
          hasFeedback
          rules={[
            { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve()
                }

                return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={changePasswordMutation.isPending}>
          Cập nhật mật khẩu
        </Button>
      </Form>
    </Card>
  )
}
