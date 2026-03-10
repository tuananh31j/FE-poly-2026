import { UploadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UploadProps } from 'antd'
import { Avatar, Button, Card, Form, Input, message, Space, Typography, Upload } from 'antd'
import { useEffect } from 'react'

import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { updateMyProfile } from '@/features/account/api/account.api'
import type { UpdateMyProfilePayload } from '@/features/account/model/account.types'
import { useMeQuery } from '@/features/auth/hooks/useMeQuery'
import { setUser } from '@/features/auth/store/auth.slice'
import { queryKeys } from '@/shared/api/queryKeys'
import { uploadImage } from '@/shared/api/upload.api'

export const AccountProfilePage = () => {
    const [form] = Form.useForm<UpdateMyProfilePayload>()
    const dispatch = useAppDispatch()
    const queryClient = useQueryClient()
    const cachedUser = useAppSelector((state) => state.auth.user)
    const meQuery = useMeQuery()
    const user = meQuery.data ?? cachedUser
    const avatarUrl = Form.useWatch('avatarUrl', form) as string | undefined

    useEffect(() => {
        if (!user) {
            return
        }

        form.setFieldsValue({
            username: user.username,
            fullName: user.fullName,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
        })
    }, [form, user])

    const updateProfileMutation = useMutation({
        mutationFn: updateMyProfile,
        onSuccess: (updatedUser) => {
            dispatch(setUser(updatedUser))
            queryClient.setQueryData(queryKeys.auth.me, updatedUser)
            void message.success('Cập nhật thông tin tài khoản thành công')
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const uploadAvatarMutation = useMutation({
        mutationFn: (file: File) => uploadImage(file, 'avatars'),
            onSuccess: (data) => {
            form.setFieldValue('avatarUrl', data.url)
            void message.success('Tải ảnh thành công. Nhấn "Lưu thay đổi" để cập nhật hồ sơ.')
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
        if (!file.type.startsWith('image/')) {
            void message.error('Chỉ chấp nhận file ảnh')
            return Upload.LIST_IGNORE
        }

        const isValidSize = file.size / 1024 / 1024 <= 5

        if (!isValidSize) {
            void message.error('Kích thước ảnh tối đa là 5MB')
            return Upload.LIST_IGNORE
        }

        uploadAvatarMutation.mutate(file)
        return Upload.LIST_IGNORE
    }

    const onFinish = (values: UpdateMyProfilePayload) => {
        updateProfileMutation.mutate(values)
    }

    return (
        <Card>
            <Typography.Title level={4} className="!mb-1">
                Quản lý tài khoản
            </Typography.Title>

            <Typography.Paragraph type="secondary">
                Cập nhật thông tin hồ sơ để thuận tiện khi mua hàng và giao nhận.
            </Typography.Paragraph>

            <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
                <Form.Item label="Email">
                    <Input disabled value={user?.email ?? ''} />
                </Form.Item>

                <Form.Item
                    hidden
                    label="Username"
                    name="username"
                    rules={[
                        { min: 3, message: 'Username tối thiểu 3 ký tự' },
                        { max: 50, message: 'Username tối đa 50 ký tự' },
                    ]}
                >
                    <Input hidden placeholder="your-username" />
                </Form.Item>

                <Form.Item
                    label="Họ và tên"
                    name="fullName"
                    rules={[
                        { required: true, message: 'Vui lòng nhập họ tên' },
                        { max: 120, message: 'Họ tên tối đa 120 ký tự' },
                    ]}
                >
                    <Input placeholder="Nguyen Van A" />
                </Form.Item>

                <Form.Item
                    label="Số điện thoại"
                    name="phone"
                    rules={[{ min: 8, message: 'Số điện thoại không hợp lệ' }]}
                >
                    <Input placeholder="09xxxxxxxx" />
                </Form.Item>

                <Form.Item label="Ảnh đại diện">
                    <Space size={16} align="center" wrap>
                        <Avatar size={84} src={avatarUrl}>
                        {(user?.fullName ?? user?.email ?? 'U').charAt(0).toUpperCase()}
                        </Avatar>

                        <Space vertical size={6}>
                        <Upload accept="image/*" showUploadList={false} beforeUpload={handleBeforeUpload}>
                            <Button icon={<UploadOutlined />} loading={uploadAvatarMutation.isPending}>
                            Tải ảnh lên
                            </Button>
                        </Upload>

                        <Typography.Text type="secondary" className="text-xs">
                            Hỗ trợ JPG/PNG/WebP, tối đa 5MB.
                        </Typography.Text>
                        </Space>
                    </Space>
                </Form.Item>

                <Form.Item
                    name="avatarUrl"
                    hidden
                    rules={[{ type: 'url', message: 'Avatar URL không hợp lệ' }]}
                >
                    <Input />
                </Form.Item>

                <Button type="primary" htmlType="submit" loading={updateProfileMutation.isPending}>
                    Lưu thay đổi
                </Button>

            </Form>
        </Card>
    )
}