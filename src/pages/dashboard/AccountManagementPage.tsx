import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useMemo, useState } from 'react'

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

type RoleFilter = AdminUserItem['role'] | 'all'
type StatusFilter = 'all' | 'active' | 'inactive'

interface CreateUserFormValues extends CreateAdminUserPayload {
  role: Extract<AdminUserItem['role'], 'customer' | 'staff'>
}

interface EditUserFormValues {
  fullName?: string
  phone?: string
  role: AdminUserItem['role']
  isActive: boolean
  avatarUrl?: string
}

interface ResetPasswordFormValues {
  password: string
  confirmPassword: string
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

const STATUS_COLORS: Record<StatusFilter, string> = {
  all: 'default',
  active: 'green',
  inactive: 'volcano',
}

const roleFilterOptions: Array<{ label: string; value: RoleFilter }> = [
  { label: 'Tất cả role', value: 'all' },
  { label: 'Customer', value: 'customer' },
  { label: 'Staff', value: 'staff' },
  { label: 'Admin', value: 'admin' },
]

const statusFilterOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'Tất cả trạng thái', value: 'all' },
  { label: 'Đang hoạt động', value: 'active' },
  { label: 'Đã khóa', value: 'inactive' },
]

const createRoleOptions = [
  { label: 'Customer', value: 'customer' },
  { label: 'Staff', value: 'staff' },
]

const editRoleOptions = [
  { label: 'Customer', value: 'customer' },
  { label: 'Staff', value: 'staff' },
  { label: 'Admin', value: 'admin', disabled: true },
]

export const AccountManagementPage = () => {
  const queryClient = useQueryClient()
  const [createForm] = Form.useForm<CreateUserFormValues>()
  const [editForm] = Form.useForm<EditUserFormValues>()
  const [resetPasswordForm] = Form.useForm<ResetPasswordFormValues>()

  const [page, setPage] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null)
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: queryKeys.admin.users({
      page,
      limit: PAGE_SIZE,
      search: searchTerm,
      role: roleFilter === 'all' ? undefined : roleFilter,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
    }),
    queryFn: () =>
      listAdminUsers({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      }),
  })

  const invalidateUsers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  }, [queryClient])

  const createUserMutation = useMutation({
    mutationFn: createAdminUser,
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAdminUserPayload }) =>
      updateAdminUser(userId, payload),
  })

  const deleteUserMutation = useMutation({
    mutationFn: deleteAdminUser,
  })

  const totalUsers = usersQuery.data?.totalItems ?? 0
  const activeUsers = usersQuery.data?.items.filter((item) => item.isActive).length ?? 0
  const inactiveUsers = usersQuery.data?.items.filter((item) => !item.isActive).length ?? 0

  const columns: ColumnsType<AdminUserItem> = useMemo(
    () => [
      {
        title: 'Tài khoản',
        key: 'account',
        render: (_, record) => (
          <div className="flex w-full items-center gap-3">
            <Avatar src={record.avatarUrl} size={40} className="shrink-0">
              {record.email.slice(0, 1).toUpperCase()}
            </Avatar>
            <Space direction="vertical" size={0} className="min-w-0">
              <Typography.Text strong className="line-clamp-1">
                {record.fullName || 'Chưa cập nhật'}
              </Typography.Text>
              <Typography.Text type="secondary" className="text-xs line-clamp-1">
                {record.email}
              </Typography.Text>
            </Space>
          </div>
        ),
      },
      {
        title: 'Role',
        dataIndex: 'role',
        key: 'role',
        width: 120,
        render: (value: AdminUserItem['role']) => (
          <Tag color={ROLE_COLORS[value]}>{ROLE_LABELS[value]}</Tag>
        ),
      },
      {
        title: 'Trạng thái',
        key: 'isActive',
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={6}>
            <Tag color={record.isActive ? 'green' : 'volcano'}>
              {record.isActive ? 'Đang hoạt động' : 'Đã khóa'}
            </Tag>
            <Switch
              checkedChildren="Mở"
              unCheckedChildren="Khóa"
              checked={record.isActive}
              disabled={record.role === 'admin'}
              loading={statusUpdatingUserId === record.id}
              onChange={async (nextValue) => {
                setStatusUpdatingUserId(record.id)
                try {
                  await updateUserMutation.mutateAsync({
                    userId: record.id,
                    payload: { isActive: nextValue },
                  })
                  await invalidateUsers()
                  void message.success(nextValue ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản')
                } catch (error) {
                  void message.error((error as Error).message)
                } finally {
                  setStatusUpdatingUserId(null)
                }
              }}
            />
          </Space>
        ),
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
        width: 290,
        render: (_, record) => (
          <Space wrap>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedUser(record)
                editForm.setFieldsValue({
                  fullName: record.fullName,
                  phone: record.phone,
                  role: record.role,
                  isActive: record.isActive,
                  avatarUrl: record.avatarUrl,
                })
                setEditModalOpen(true)
              }}
            ></Button>

            <Button
              icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />}
              disabled={record.role === 'admin'}
              loading={statusUpdatingUserId === record.id}
              onClick={async () => {
                setStatusUpdatingUserId(record.id)
                try {
                  await updateUserMutation.mutateAsync({
                    userId: record.id,
                    payload: { isActive: !record.isActive },
                  })
                  await invalidateUsers()
                  void message.success(
                    record.isActive ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản'
                  )
                } catch (error) {
                  void message.error((error as Error).message)
                } finally {
                  setStatusUpdatingUserId(null)
                }
              }}
            >
              {record.isActive ? 'Khóa' : 'Mở'}
            </Button>

            <Popconfirm
              title={`Xóa tài khoản ${record.email}?`}
              description="Hành động này không thể hoàn tác."
              okText="Xóa"
              cancelText="Hủy"
              disabled={record.role === 'admin'}
              onConfirm={async () => {
                try {
                  await deleteUserMutation.mutateAsync(record.id)
                  await invalidateUsers()
                  void message.success('Đã xóa tài khoản')
                } catch (error) {
                  void message.error((error as Error).message)
                }
              }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleteUserMutation.isPending}
                disabled={record.role === 'admin'}
              ></Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [
      deleteUserMutation,
      editForm,
      invalidateUsers,
      resetPasswordForm,
      statusUpdatingUserId,
      updateUserMutation,
    ]
  )

  return (
    <div className="space-y-5">
      <Typography.Title level={3} className="!mb-0">
        Admin - Quản lý tài khoản
      </Typography.Title>
      <Typography.Paragraph className="!mb-0" type="secondary">
        Quản lý thông tin người dùng, khóa/mở khóa tài khoản và reset mật khẩu nhanh cho
        customer/staff.
      </Typography.Paragraph>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <Typography.Text type="secondary">Tổng tài khoản (theo filter)</Typography.Text>
          <Typography.Title level={4} className="!mb-0 !mt-2">
            {totalUsers}
          </Typography.Title>
        </Card>
        <Card>
          <Typography.Text type="secondary">Đang hoạt động (trang hiện tại)</Typography.Text>
          <Typography.Title level={4} className="!mb-0 !mt-2">
            <Badge color={STATUS_COLORS.active} text={activeUsers} />
          </Typography.Title>
        </Card>
        <Card>
          <Typography.Text type="secondary">Đã khóa (trang hiện tại)</Typography.Text>
          <Typography.Title level={4} className="!mb-0 !mt-2">
            <Badge color={STATUS_COLORS.inactive} text={inactiveUsers} />
          </Typography.Title>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            allowClear
            className="w-full md:max-w-sm"
            placeholder="Tìm theo email, fullName"
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
            className="w-full md:w-44"
            value={roleFilter}
            options={roleFilterOptions}
            onChange={(value) => {
              setPage(1)
              setRoleFilter(value)
            }}
          />

          <Select
            className="w-full md:w-48"
            value={statusFilter}
            options={statusFilterOptions}
            onChange={(value) => {
              setPage(1)
              setStatusFilter(value)
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
            onChange: (nextPage) => setPage(nextPage),
          }}
        />
      </Card>

      <Modal
        title="Tạo tài khoản"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          createForm.resetFields()
        }}
        onOk={() => {
          void createForm.submit()
        }}
        okText="Tạo"
        cancelText="Hủy"
        confirmLoading={createUserMutation.isPending}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ role: 'customer' }}
          onFinish={async (values) => {
            try {
              await createUserMutation.mutateAsync(values)
              await invalidateUsers()
              void message.success('Tạo tài khoản thành công')
              setCreateModalOpen(false)
              createForm.resetFields()
            } catch (error) {
              void message.error((error as Error).message)
            }
          }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Vui lòng nhập email' }, { type: 'email' }]}
          >
            <Input placeholder="staff@billar.vn" />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }, { min: 8 }]}
          >
            <Input.Password placeholder="Tối thiểu 8 ký tự" />
          </Form.Item>

          <Form.Item label="Họ tên" name="fullName">
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item label="Số điện thoại" name="phone">
            <Input placeholder="09xxxxxxxx" />
          </Form.Item>

          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: 'Vui lòng chọn role' }]}
          >
            <Select placeholder="Chọn role" options={createRoleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Cập nhật tài khoản"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false)
          setSelectedUser(null)
          editForm.resetFields()
        }}
        onOk={() => {
          void editForm.submit()
        }}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={updateUserMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!selectedUser) {
              return
            }

            const payload: UpdateAdminUserPayload = {
              fullName: values.fullName,
              phone: values.phone,
              avatarUrl: values.avatarUrl,
            }

            if (
              selectedUser.role !== 'admin' &&
              (values.role === 'customer' || values.role === 'staff')
            ) {
              payload.role = values.role
              payload.isActive = values.isActive
            }

            try {
              await updateUserMutation.mutateAsync({
                userId: selectedUser.id,
                payload,
              })
              await invalidateUsers()
              void message.success('Cập nhật tài khoản thành công')
              setEditModalOpen(false)
              setSelectedUser(null)
              editForm.resetFields()
            } catch (error) {
              void message.error((error as Error).message)
            }
          }}
        >
          <Typography.Paragraph type="secondary" className="!mb-3">
            {selectedUser?.email}
          </Typography.Paragraph>

          <Form.Item label="Họ tên" name="fullName">
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>

          <Form.Item label="Số điện thoại" name="phone">
            <Input placeholder="09xxxxxxxx" />
          </Form.Item>

          <Form.Item
            label="Avatar URL"
            name="avatarUrl"
            rules={[{ type: 'url', warningOnly: true }]}
          >
            <Input placeholder="https://..." />
          </Form.Item>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              label="Role"
              name="role"
              rules={[{ required: true, message: 'Vui lòng chọn role' }]}
            >
              <Select
                placeholder="Chọn role"
                options={editRoleOptions}
                disabled={selectedUser?.role === 'admin'}
              />
            </Form.Item>

            <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
              <Switch
                disabled={selectedUser?.role === 'admin'}
                checkedChildren="Hoạt động"
                unCheckedChildren="Khóa"
              />
            </Form.Item>
          </div>

        </Form>
      </Modal>

      <Modal
        title="Reset mật khẩu"
        open={resetPasswordModalOpen}
        onCancel={() => {
          setResetPasswordModalOpen(false)
          setSelectedUser(null)
          resetPasswordForm.resetFields()
        }}
        onOk={() => {
          void resetPasswordForm.submit()
        }}
        okText="Cập nhật"
        cancelText="Hủy"
        confirmLoading={updateUserMutation.isPending}
      >
        <Typography.Paragraph type="secondary">{selectedUser?.email}</Typography.Paragraph>

        <Form
          form={resetPasswordForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!selectedUser) {
              return
            }

            try {
              await updateUserMutation.mutateAsync({
                userId: selectedUser.id,
                payload: {
                  password: values.password,
                },
              })
              await invalidateUsers()
              void message.success('Đã reset mật khẩu tài khoản')
              setResetPasswordModalOpen(false)
              setSelectedUser(null)
              resetPasswordForm.resetFields()
            } catch (error) {
              void message.error((error as Error).message)
            }
          }}
        >
          <Form.Item
            label="Mật khẩu mới"
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới' }, { min: 8 }]}
          >
            <Input.Password placeholder="Tối thiểu 8 ký tự" />
          </Form.Item>

          <Form.Item
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng nhập lại mật khẩu' },
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
            <Input.Password placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
