import { useMutation } from '@tanstack/react-query'
import { Button, Form, Input, message,Result, Typography } from 'antd'
import { Link } from 'react-router-dom'

import { forgotPassword } from '@/features/auth/api/auth.api'
import type { ForgotPasswordPayload } from '@/features/auth/model/auth.types'
import { ROUTE_PATHS } from '@/shared/constants/routes'

export const ForgotPasswordPage = () => {
    const [form] = Form.useForm<ForgotPasswordPayload>()

    const forgotPasswordMutation = useMutation({
        mutationFn: forgotPassword,
        onSuccess: (successMessage) => {
            void message.success(successMessage)
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const onFinish = (values: ForgotPasswordPayload) => {
        forgotPasswordMutation.mutate(values)
    }

    const isSuccess = forgotPasswordMutation.isSuccess

    return (
        <div className="space-y-5">
            <div className="space-y-1 text-center">
                <Typography.Title level={3} className="!mb-0">
                Quên mật khẩu
                </Typography.Title>
                <Typography.Paragraph type="secondary" className="!mb-0">
                Nhập email để nhận liên kết đặt lại mật khẩu
                </Typography.Paragraph>
            </div>

            {isSuccess ? (
                <Result
                    status="success"
                    title="Yêu cầu đã được gửi"
                    subTitle="Nếu email tồn tại trong hệ thống, bạn sẽ nhận được liên kết đặt lại mật khẩu."
                    extra={[
                        <Button type="primary" key="login">
                            <Link to={ROUTE_PATHS.LOGIN}>Quay lại đăng nhập</Link>
                        </Button>,
                        <Button
                            key="retry"
                            onClick={() => {
                                forgotPasswordMutation.reset()
                                form.resetFields()
                            }}
                        >
                            Gửi lại
                        </Button>,
                    ]}
                    />
                    ) : (
                    <>
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

                        <Button type="primary" htmlType="submit" block loading={forgotPasswordMutation.isPending}>
                            Gửi liên kết đặt lại mật khẩu
                        </Button>
                    </Form>

                    <Typography.Paragraph className="!mb-0 text-center">
                        Đã nhớ mật khẩu? <Link to={ROUTE_PATHS.LOGIN}>Đăng nhập</Link>
                    </Typography.Paragraph>
                </>
            )}
        </div>
    )
}