import { DeleteOutlined, EditOutlined, PlusOutlined, StarFilled } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Button,
    Card,
    Form,
    Input,
    List,
    message,
    Modal,
    Popconfirm,
    Select,
    Space,
    Spin,
    Switch,
    Tag,
    Typography,
} from 'antd'
import { useState } from 'react'

import {
    createMyAddress,
    deleteMyAddress,
    listMyAddresses,
    updateMyAddress,
} from '@/features/account/api/account.api'
import type { AddressItem, UpsertAddressPayload } from '@/features/account/model/account.types'
import { queryKeys } from '@/shared/api/queryKeys'

type AddressFormValues = UpsertAddressPayload

const defaultAddressFormValues: AddressFormValues = {
    label: 'Nhà riêng',
    recipientName: '',
    phone: '',
    street: '',
    city: '',
    district: '',
    ward: '',
    isDefault: false,
}

export const AddressesPage = () => {
    const [form] = Form.useForm<AddressFormValues>()
    const queryClient = useQueryClient()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAddress, setEditingAddress] = useState<AddressItem | null>(null)

    const addressesQuery = useQuery({
        queryKey: queryKeys.account.addresses,
        queryFn: listMyAddresses,
    })

    const createAddressMutation = useMutation({
        mutationFn: createMyAddress,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.account.addresses,
            })
            void message.success('Đã thêm địa chỉ mới')
            setIsModalOpen(false)
            setEditingAddress(null)
            form.resetFields()
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const updateAddressMutation = useMutation({
        mutationFn: ({ addressId, payload }: { addressId: string; payload: Partial<UpsertAddressPayload> }) =>
            updateMyAddress(addressId, payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.account.addresses,
            })
            void message.success('Đã cập nhật địa chỉ')
            setIsModalOpen(false)
            setEditingAddress(null)
            form.resetFields()
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const deleteAddressMutation = useMutation({
        mutationFn: deleteMyAddress,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.account.addresses,
            })
            void message.success('Đã xóa địa chỉ')
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const openCreateModal = () => {
        setEditingAddress(null)
        form.setFieldsValue(defaultAddressFormValues)
        setIsModalOpen(true)
    }

    const openEditModal = (address: AddressItem) => {
        setEditingAddress(address)
        form.setFieldsValue({
            label: address.label,
            recipientName: address.recipientName,
            phone: address.phone,
            street: address.street,
            city: address.city,
            district: address.district,
            ward: address.ward,
            isDefault: address.isDefault,
        })
        setIsModalOpen(true)
    }

    const isSubmitting = createAddressMutation.isPending || updateAddressMutation.isPending

    const onSubmitAddress = (values: AddressFormValues) => {
        if (editingAddress) {
            updateAddressMutation.mutate({
                addressId: editingAddress.id,
                payload: values,
            })
            return
        }

        createAddressMutation.mutate(values)
    }

    return (
        <Card>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Typography.Title level={4} className="!mb-1">
                        Sổ địa chỉ
                    </Typography.Title>
                    <Typography.Text type="secondary">
                        Quản lý địa chỉ giao hàng để đặt đơn nhanh hơn.
                    </Typography.Text>
                </div>

                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                    Thêm địa chỉ
                </Button>
            </div>

            {addressesQuery.isLoading ? (
                <div className="py-10 text-center">
                <Spin />
                </div>
            ) : null}

            <List
                dataSource={addressesQuery.data ?? []}
                split={false}
                renderItem={(address) => (
                <List.Item className="!px-0">
                    <Card className="w-full">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <Space direction="vertical" size={4}>
                            <Space size={8} wrap>
                            <Typography.Text strong>{address.label || 'Địa chỉ'}</Typography.Text>
                            {address.isDefault ? (
                            <Tag color="gold" icon={<StarFilled />}>
                                Mặc định
                            </Tag>
                            ) : null}
                            </Space>

                            <Typography.Text>{address.recipientName}</Typography.Text>
                            <Typography.Text type="secondary">{address.phone}</Typography.Text>
                            <Typography.Text type="secondary">
                                {address.street}, {address.ward}, {address.district}, {address.city}
                            </Typography.Text>
                        </Space>

                        <Space wrap>
                            {!address.isDefault ? (
                                <Button
                                onClick={() => {
                                    updateAddressMutation.mutate({
                                    addressId: address.id,
                                    payload: { isDefault: true },
                                    })
                                }}
                                loading={updateAddressMutation.isPending}
                                >
                                Đặt mặc định
                                </Button>
                            ) : null}

                            <Button icon={<EditOutlined />} onClick={() => openEditModal(address)}>
                                Sửa
                            </Button>

                            <Popconfirm
                                title="Xóa địa chỉ này?"
                                okText="Xóa"
                                cancelText="Hủy"
                                onConfirm={() => {
                                deleteAddressMutation.mutate(address.id)
                                }}
                            >
                                <Button danger icon={<DeleteOutlined />} loading={deleteAddressMutation.isPending}>
                                Xóa
                                </Button>
                            </Popconfirm>
                        </Space>
                    </div>
                    </Card>
                </List.Item>
                )}
            />

            <Modal
                title={editingAddress ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
                open={isModalOpen}
                onCancel={() => {
                setIsModalOpen(false)
                setEditingAddress(null)
                form.resetFields()
                }}
                footer={null}
                destroyOnHidden
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onSubmitAddress}
                    initialValues={defaultAddressFormValues}
                >
                    <Form.Item label="Nhãn địa chỉ" name="label">
                        <Select
                        options={[
                            { value: 'home', label: 'Nhà riêng' },
                            { value: 'work', label: 'Văn phòng' },
                        ]}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Người nhận"
                        name="recipientName"
                        rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Số điện thoại"
                        name="phone"
                        rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Địa chỉ cụ thể"
                        name="street"
                        rules={[{ required: true, message: 'Vui lòng nhập số nhà, tên đường' }]}
                    >
                        <Input />
                    </Form.Item>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Form.Item
                        label="Tỉnh/Thành phố"
                        name="city"
                        rules={[{ required: true, message: 'Vui lòng nhập tỉnh/thành phố' }]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item
                        label="Quận/Huyện"
                        name="district"
                        rules={[{ required: true, message: 'Vui lòng nhập quận/huyện' }]}
                        >
                            <Input />
                        </Form.Item>
                    </div>

                    <Form.Item
                        label="Phường/Xã"
                        name="ward"
                        rules={[{ required: true, message: 'Vui lòng nhập phường/xã' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item label="Đặt làm mặc định" name="isDefault" valuePropName="checked">
                        <Switch />
                    </Form.Item>

                    <div className="flex justify-end gap-2">
                        <Button
                            onClick={() => {
                                setIsModalOpen(false)
                                setEditingAddress(null)
                                form.resetFields()
                            }}
                        >
                            Hủy
                        </Button>

                        <Button type="primary" htmlType="submit" loading={isSubmitting}>
                            {editingAddress ? 'Lưu thay đổi' : 'Thêm địa chỉ'}
                        </Button>
                    </div>
                </Form>
            </Modal>

        </Card>
    )

}