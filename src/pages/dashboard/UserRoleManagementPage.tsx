import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Button,
    Card,
    Form,
    Input,
    message,
    Modal,
    Popconfirm,
    Select,
    Space,
    Table,
    Tag,
    Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'

import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '@/features/admin/api/user-management.api'
import type {
  AdminUserItem,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
} from '@/features/admin/model/user-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatDateTime } from '@/shared/utils/date'

type RoleValue = 'customer' | 'staff'

interface CreateUserFormValues extends CreateAdminUserPayload {
  role: RoleValue
}

interface UpdateRoleFormValues {
  role: RoleValue
}

const PAGE_SIZE = 10

const ROLE_LABELS: Record<AdminUserItem['role'], string> = {
  customer: 'Customer',
  staff: 'Staff',
  admin: 'Admin',
}

const ROLE_COLORS: Record<AdminUserItem['role'], string> = {
  customer: 'default',
  staff: 'blue',
  admin: 'gold',
}

const creatableRoleOptions = [
  { label: 'Customer', value: 'customer' },
  { label: 'Staff', value: 'staff' },
]

const roleFilterOptions: Array<{ label: string; value: AdminUserItem['role'] | 'all' }> = [
  { label: 'Tất cả role', value: 'all' },
  { label: 'Customer', value: 'customer' },
  { label: 'Staff', value: 'staff' },
  { label: 'Admin', value: 'admin' },
]

export const UserRoleManagementPage = () => {
    const queryClient = useQueryClient()
    const [createForm] = Form.useForm<CreateUserFormValues>()
    const [updateRoleForm] = Form.useForm<UpdateRoleFormValues>()

    const [page, setPage] = useState(1)
    const [searchValue, setSearchValue] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [roleFilter, setRoleFilter] = useState<AdminUserItem['role'] | 'all'>('all')
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [updateRoleModalOpen, setUpdateRoleModalOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null)

    const usersQuery = useQuery({
        queryKey: queryKeys.admin.users({
        page,
        limit: PAGE_SIZE,
        search: searchTerm,
        role: roleFilter === 'all' ? undefined : roleFilter,
        }),
        queryFn: () =>
            listAdminUsers({
                page,
                limit: PAGE_SIZE,
                search: searchTerm || undefined,
                role: roleFilter === 'all' ? undefined : roleFilter,
            }),
    })

    const createUserMutation = useMutation({
        mutationFn: createAdminUser,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.admin.users(),
            })
            void message.success('Tạo tài khoản thành công')
            setCreateModalOpen(false)
            createForm.resetFields()
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const updateUserMutation = useMutation({
        mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAdminUserPayload }) =>
            updateAdminUser(userId, payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.admin.users(),
            })
            void message.success('Cập nhật role thành công')
            setUpdateRoleModalOpen(false)
            setSelectedUser(null)
            updateRoleForm.resetFields()
        },
         onError: (error) => {
            void message.error(error.message)
        },
    })

    const deleteUserMutation = useMutation({
        mutationFn: deleteAdminUser,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.admin.users(),
            })
            void message.success('Đã xóa tài khoản')
        },
        onError: (error) => {
            void message.error(error.message)
        },
    })

    const columns: ColumnsType<AdminUserItem> = useMemo(
        () => [
            {
                title: 'Người dùng',
                key: 'user',
                render: (_, record) => (
                <Space direction="vertical" size={0}>
                    <Typography.Text strong>{record.fullName || record.username || 'N/A'}</Typography.Text>
                    <Typography.Text type="secondary" className="text-xs">
                    {record.email}
                    </Typography.Text>
                </Space>
                ),
            },
            {
                title: 'SĐT',
                dataIndex: 'phone',
                key: 'phone',
                width: 150,
                render: (value: string | undefined) => value || '-',
            },
            {
                title: 'Role',
                dataIndex: 'role',
                key: 'role',
                width: 120,
                render: (value: AdminUserItem['role']) => <Tag color={ROLE_COLORS[value]}>{ROLE_LABELS[value]}</Tag>,
            },
            {
                title: 'Ngày tạo',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 180,
                render: (value: string) => (
                <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
                ),
            },
            {
                title: 'Hành động',
                key: 'actions',
                width: 220,
                render: (_, record) => (
                    <Space>
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => {
                                setSelectedUser(record)
                                updateRoleForm.setFieldsValue({
                                role: record.role === 'admin' ? 'staff' : record.role,
                                })
                                setUpdateRoleModalOpen(true)
                            }}
                            disabled={record.role === 'admin'}
                        >
                            Phân role
                        </Button>

                        <Popconfirm
                            title={`Xóa tài khoản ${record.email}?`}
                            description="Hành động này không thể hoàn tác."
                            okText="Xóa"
                            cancelText="Hủy"
                            onConfirm={() => {
                                deleteUserMutation.mutate(record.id)
                            }}
                            disabled={record.role === 'admin'}
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                loading={deleteUserMutation.isPending}
                                disabled={record.role === 'admin'}
                            >
                                Xóa
                            </Button>
                        </Popconfirm>
                    </Space>
                ),
            },
        ],
        [deleteUserMutation, updateRoleForm]
    )

    const totalUsers = usersQuery.data?.totalItems ?? 0
    const staffCount = usersQuery.data?.items.filter((item) => item.role === 'staff').length ?? 0
    const customerCount = usersQuery.data?.items.filter((item) => item.role === 'customer').length ?? 0

    return (
        <div className="space-y-5">
            <Typography.Title level={3} className="!mb-0">
                Admin - Quản lý phân role
            </Typography.Title>

            <Typography.Paragraph className="!mb-0" type="secondary">
                Tạo tài khoản nhân sự và phân quyền giữa `customer` / `staff`. Role `admin` không tạo bằng UI.
            </Typography.Paragraph>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <Typography.Text type="secondary">Tổng user (theo filter)</Typography.Text>
                    <Typography.Title level={4} className="!mb-0 !mt-2">
                        {totalUsers}
                    </Typography.Title>
                </Card>

                <Card>
                    <Typography.Text type="secondary">Staff (trang hiện tại)</Typography.Text>
                    <Typography.Title level={4} className="!mb-0 !mt-2">
                        {staffCount}
                    </Typography.Title>
                </Card>

                <Card>
                    <Typography.Text type="secondary">Customer (trang hiện tại)</Typography.Text>
                    <Typography.Title level={4} className="!mb-0 !mt-2">
                        {customerCount}
                    </Typography.Title>
                </Card>
            </div>

            <Card>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <Input.Search
                        allowClear
                        className="w-full md:max-w-sm"
                        placeholder="Tìm theo email, username, fullName"
                        value={searchValue}
                        onChange={(event) => {
                        setSearchValue(event.target.value)
                        if (!event.target.value.trim()) {
                            setPage(1)
                            setSearchTerm('')
                        }
                        }}
                        onSearch={(value) => {
                        setPage(1)
                        setSearchTerm(value.trim())
                        }}
                    />

                    <Select
                        className="w-full md:w-48"
                        value={roleFilter}
                        options={roleFilterOptions}
                        onChange={(value) => {
                        setPage(1)
                        setRoleFilter(value)
                        }}
                    />

                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                        createForm.resetFields()
                        createForm.setFieldsValue({ role: 'customer' })
                        setCreateModalOpen(true)
                        }}
                    >
                        Tạo tài khoản
                    </Button>
                </div>

                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={usersQuery.data?.items ?? []}
                    loading={usersQuery.isLoading || usersQuery.isFetching}
                    pagination={{
                        current: page,
                        pageSize: PAGE_SIZE,
                        total: usersQuery.data?.totalItems ?? 0,
                        showSizeChanger: false,
                        onChange: (nextPage) => {
                        setPage(nextPage)
                        },
                    }}
                />
            </Card>

            <Modal
                title="Tạo tài khoản mới"
                open={createModalOpen}
                onCancel={() => {
                setCreateModalOpen(false)
                createForm.resetFields()
                }}
                footer={null}
                destroyOnHidden
            >
                <Form<CreateUserFormValues>
                    form={createForm}
                    layout="vertical"
                    initialValues={{ role: 'customer' }}
                    onFinish={(values) => {
                        createUserMutation.mutate(values)
                    }}
                >
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                        { required: true, message: 'Vui lòng nhập email' },
                        { type: 'email', message: 'Email không hợp lệ' },
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="Mật khẩu"
                        rules={[
                        { required: true, message: 'Vui lòng nhập mật khẩu' },
                        { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item name="fullName" label="Họ tên">
                        <Input />
                    </Form.Item>

                    <Form.Item name="username" label="Username">
                        <Input />
                    </Form.Item>

                    <Form.Item name="phone" label="Số điện thoại">
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="Role"
                        rules={[{ required: true, message: 'Vui lòng chọn role' }]}
                    >
                        <Select options={creatableRoleOptions} />
                    </Form.Item>

                    <div className="flex justify-end gap-2">
                        <Button
                            onClick={() => {
                                setCreateModalOpen(false)
                                createForm.resetFields()
                            }}
                        >
                            Hủy
                        </Button>

                        <Button type="primary" htmlType="submit" loading={createUserMutation.isPending}>
                            Tạo mới
                        </Button>
                    </div>
                </Form>
            </Modal>

            <Modal
                title="Phân role người dùng"
                open={updateRoleModalOpen}
                onCancel={() => {
                setUpdateRoleModalOpen(false)
                setSelectedUser(null)
                updateRoleForm.resetFields()
                }}
                footer={null}
                destroyOnHidden
            >
                <Space direction="vertical" size={12} className="w-full">
                    <div>
                        <Typography.Text strong>{selectedUser?.fullName || selectedUser?.email}</Typography.Text>
                        <Typography.Paragraph className="!mb-0" type="secondary">
                        {selectedUser?.email}
                        </Typography.Paragraph>
                    </div>

                    <Form<UpdateRoleFormValues>
                        form={updateRoleForm}
                        layout="vertical"
                        onFinish={(values) => {
                        if (!selectedUser) {
                            return
                        }

                        updateUserMutation.mutate({
                            userId: selectedUser.id,
                            payload: values,
                        })
                        }}
                    >
                        <Form.Item
                            name="role"
                            label="Role mới"
                            rules={[{ required: true, message: 'Vui lòng chọn role' }]}
                        >
                            <Select options={creatableRoleOptions} />
                        </Form.Item>

                        <div className="flex justify-end gap-2">
                            <Button
                                onClick={() => {
                                setUpdateRoleModalOpen(false)
                                setSelectedUser(null)
                                updateRoleForm.resetFields()
                                }}
                            >
                                Hủy
                            </Button>

                            <Button type="primary" htmlType="submit" loading={updateUserMutation.isPending}>
                                Cập nhật role
                            </Button>
                        </div>
                    </Form>
                </Space>
            </Modal>
        </div>
    )
}