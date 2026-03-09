import { useMutation } from '@tanstack/react-query'
import { Button, Form, Input, message,Result, Typography } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'

import { resetPassword } from '@/features/auth/api/auth.api'
import type { ResetPasswordPayload } from '@/features/auth/model/auth.types'
import { ROUTE_PATHS } from '@/shared/constants/routes'

interface ResetPasswordFormValues {
    newPassword: string
    confirmPassword: string
}

export const ResetPasswordPage = () => {
    const [form] = Form.useForm<ResetPasswordFormValues>()
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')?.trim() ?? ''

    const resetPasswordMutation = useMutation({
        mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
        onSuccess: (successMessage) => {
            void message.success(successMessage)
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const onFinish = ({ newPassword }: ResetPasswordFormValues) => {
        resetPasswordMutation.mutate({
            token,
            newPassword,
        })
    }

    if (!token) {
        return (
            <Result
                status="error"
                title="Liên kết không hợp lệ"
                subTitle="Không tìm thấy token đặt lại mật khẩu. Vui lòng gửi lại yêu cầu quên mật khẩu."
                extra={
                    <Button type="primary">
                        <Link to={ROUTE_PATHS.FORGOT_PASSWORD}>Quên mật khẩu</Link>
                    </Button>
                }
            />
        )
    }

    if (resetPasswordMutation.isSuccess) {
        return (
            <Result
                status="success"
                title="Đặt lại mật khẩu thành công"
                subTitle="Bạn có thể đăng nhập bằng mật khẩu mới."
                extra={
                    <Button type="primary">
                        <Link to={ROUTE_PATHS.LOGIN}>Đăng nhập ngay</Link>
                    </Button>
                }
            />
        )
    }


    return (
        <div className="space-y-5">
            <div className="space-y-1 text-center">
                <Typography.Title level={3} className="!mb-0">
                    Đặt lại mật khẩu
                </Typography.Title>

                <Typography.Paragraph type="secondary" className="!mb-0">
                    Nhập mật khẩu mới cho tài khoản của bạn
                </Typography.Paragraph>
            </div>

            <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
                <Form.Item
                label="Mật khẩu mới"
                name="newPassword"
                rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                    { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự' },
                ]}
                hasFeedback
                >
                    <Input.Password placeholder="Nhập mật khẩu mới" />
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
                    <Input.Password placeholder="Nhập lại mật khẩu mới" />
                </Form.Item>

                <Button type="primary" htmlType="submit" block loading={resetPasswordMutation.isPending}>
                    Cập nhật mật khẩu
                </Button>

            </Form>

            <Typography.Paragraph className="!mb-0 text-center">
                Đã nhớ mật khẩu? <Link to={ROUTE_PATHS.LOGIN}>Đăng nhập</Link>
            </Typography.Paragraph>
            
        </div>
    )
}