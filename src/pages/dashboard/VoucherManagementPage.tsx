import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
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
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'

import {
  createAdminVoucher,
  deleteAdminVoucher,
  listAdminVouchers,
  updateAdminVoucher,
} from '@/features/admin/api/voucher-management.api'
import type {
  AdminVoucherItem,
  CreateAdminVoucherPayload,
  UpdateAdminVoucherPayload,
  VoucherDiscountType,
} from '@/features/admin/model/voucher-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const PAGE_SIZE = 10

type ActiveFilter = 'all' | 'active' | 'inactive'

interface VoucherFormValues {
  code: string
  description?: string
  discountType: VoucherDiscountType
  discountValue: number
  minOrderValue?: number
  maxDiscountAmount?: number
  activeTime: [Dayjs, Dayjs]
  usageLimit: number
  maxUsagePerUser: number
  isActive: boolean
}

const toIsActiveParam = (value: ActiveFilter) => {
  if (value === 'all') {
    return undefined
  }

  return value === 'active'
}

const isVoucherExpired = (voucher: AdminVoucherItem) => {
  return dayjs(voucher.expirationDate).isBefore(dayjs())
}

const discountTypeLabel: Record<VoucherDiscountType, string> = {
  percentage: 'Phần trăm',
  fixed_amount: 'Số tiền cố định',
}

const activeFilterOptions = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đang bật', value: 'active' },
  { label: 'Đang tắt', value: 'inactive' },
]

export const VoucherManagementPage = () => {
  const queryClient = useQueryClient()
  const [form] = Form.useForm<VoucherFormValues>()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState<AdminVoucherItem | null>(null)

  const vouchersQuery = useQuery({
    queryKey: queryKeys.admin.vouchers({
      page,
      limit: PAGE_SIZE,
      code: searchTerm,
      isActive: toIsActiveParam(activeFilter),
    }),
    queryFn: () =>
      listAdminVouchers({
        page,
        limit: PAGE_SIZE,
        code: searchTerm || undefined,
        isActive: toIsActiveParam(activeFilter),
      }),
  })

  const invalidateVouchers = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['admin', 'vouchers'],
    })
  }

  const createMutation = useMutation({
    mutationFn: createAdminVoucher,
    onSuccess: async () => {
      await invalidateVouchers()
      void message.success('Tạo voucher thành công')
      setModalOpen(false)
      setEditingVoucher(null)
      form.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAdminVoucherPayload }) =>
      updateAdminVoucher(id, payload),
    onSuccess: async () => {
      await invalidateVouchers()
      void message.success('Cập nhật voucher thành công')
      setModalOpen(false)
      setEditingVoucher(null)
      form.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAdminVoucher,
    onSuccess: async () => {
      await invalidateVouchers()
      void message.success('Đã xóa voucher')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const columns: ColumnsType<AdminVoucherItem> = useMemo(
    () => [
      {
        title: 'Mã voucher',
        dataIndex: 'code',
        key: 'code',
        width: 140,
        render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
      },
      {
        title: 'Giảm giá',
        key: 'discount',
        width: 220,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>
              {record.discountType === 'percentage'
                ? `${record.discountValue}%`
                : formatVndCurrency(record.discountValue)}
            </Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              {discountTypeLabel[record.discountType]}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Điều kiện',
        key: 'conditions',
        width: 240,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              Đơn tối thiểu: {formatVndCurrency(record.minOrderValue)}
            </Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              Giảm tối đa:{' '}
              {typeof record.maxDiscountAmount === 'number'
                ? formatVndCurrency(record.maxDiscountAmount)
                : 'Không giới hạn'}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Lượt dùng',
        key: 'usage',
        width: 220,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>
              {record.usedCount}/{record.usageLimit}
            </Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              Tối đa / tài khoản: {record.maxUsagePerUser}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Hiệu lực',
        key: 'validity',
        width: 260,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text type="secondary" className="text-xs">
              Từ: {formatDateTime(record.startDate)}
            </Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              Đến: {formatDateTime(record.expirationDate)}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Trạng thái',
        key: 'status',
        width: 180,
        render: (_, record) => (
          <Space wrap>
            <Tag color={record.isActive ? 'green' : 'default'}>
              {record.isActive ? 'Đang bật' : 'Đang tắt'}
            </Tag>
            {isVoucherExpired(record) ? <Tag color="red">Hết hạn</Tag> : null}
          </Space>
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
                setEditingVoucher(record)
                form.setFieldsValue({
                  code: record.code,
                  description: record.description,
                  discountType: record.discountType,
                  discountValue: record.discountValue,
                  minOrderValue: record.minOrderValue,
                  maxDiscountAmount: record.maxDiscountAmount,
                  activeTime: [dayjs(record.startDate), dayjs(record.expirationDate)],
                  usageLimit: record.usageLimit,
                  maxUsagePerUser: record.maxUsagePerUser,
                  isActive: record.isActive,
                })
                setModalOpen(true)
              }}
            ></Button>

            <Popconfirm
              title={`Xóa voucher "${record.code}"?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                deleteMutation.mutate(record.id)
              }}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}></Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteMutation, form]
  )

  const discountTypeValue = Form.useWatch('discountType', form) ?? 'percentage'

  const openCreateModal = () => {
    setEditingVoucher(null)
    form.setFieldsValue({
      code: '',
      description: undefined,
      discountType: 'percentage',
      discountValue: 10,
      minOrderValue: 0,
      maxDiscountAmount: undefined,
      activeTime: [dayjs(), dayjs().add(7, 'day')],
      usageLimit: 100,
      maxUsagePerUser: 1,
      isActive: true,
    })
    setModalOpen(true)
  }

  const handleSubmit = (values: VoucherFormValues) => {
    const payloadBase = {
      description: values.description?.trim() || undefined,
      discountType: values.discountType,
      discountValue: values.discountValue,
      minOrderValue: values.minOrderValue ?? 0,
      maxDiscountAmount:
        typeof values.maxDiscountAmount === 'number' ? values.maxDiscountAmount : undefined,
      startDate: values.activeTime[0].toISOString(),
      expirationDate: values.activeTime[1].toISOString(),
      usageLimit: values.usageLimit,
      maxUsagePerUser: values.maxUsagePerUser,
      isActive: values.isActive,
    }

    if (!editingVoucher) {
      const createPayload: CreateAdminVoucherPayload = {
        code: values.code.trim().toUpperCase(),
        ...payloadBase,
      }
      createMutation.mutate(createPayload)
      return
    }

    updateMutation.mutate({
      id: editingVoucher.id,
      payload: payloadBase,
    })
  }

  return (
    <div className="space-y-5">
      <Typography.Title level={3} className="!mb-0">
        Admin - Quản lý voucher
      </Typography.Title>
      <Typography.Paragraph className="!mb-0" type="secondary">
        Tạo và quản lý voucher giảm giá để áp dụng cho đơn hàng.
      </Typography.Paragraph>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input.Search
            allowClear
            className="w-full md:max-w-sm"
            placeholder="Tìm theo mã voucher"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              if (!event.target.value.trim()) {
                setSearchTerm('')
                setPage(1)
              }
            }}
            onSearch={(value) => {
              setSearchTerm(value.trim())
              setPage(1)
            }}
          />

          <Select
            className="w-full md:w-44"
            value={activeFilter}
            options={activeFilterOptions}
            onChange={(value) => {
              setActiveFilter(value)
              setPage(1)
            }}
          />

          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Tạo voucher
          </Button>
        </div>

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={vouchersQuery.data?.items ?? []}
          loading={vouchersQuery.isFetching}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: vouchersQuery.data?.totalItems ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => {
              setPage(nextPage)
            },
          }}
        />
      </Card>

      <Modal
        title={editingVoucher ? `Cập nhật voucher ${editingVoucher.code}` : 'Tạo voucher mới'}
        open={modalOpen}
        destroyOnHidden
        okText={editingVoucher ? 'Cập nhật' : 'Tạo mới'}
        cancelText="Đóng"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        onCancel={() => {
          if (createMutation.isPending || updateMutation.isPending) {
            return
          }

          setModalOpen(false)
          setEditingVoucher(null)
          form.resetFields()
        }}
        onOk={() => {
          void form.submit()
        }}
      >
        <Form<VoucherFormValues> form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Mã voucher"
            name="code"
            rules={[
              { required: true, message: 'Vui lòng nhập mã voucher' },
              { min: 2, message: 'Mã voucher tối thiểu 2 ký tự' },
            ]}
          >
            <Input
              placeholder="VD: BILLAR10"
              disabled={Boolean(editingVoucher)}
              onChange={(event) => {
                const upperCode = event.target.value.toUpperCase().replace(/\s+/g, '')
                form.setFieldValue('code', upperCode)
              }}
            />
          </Form.Item>

          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn về voucher" />
          </Form.Item>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              label="Loại giảm giá"
              name="discountType"
              rules={[{ required: true, message: 'Vui lòng chọn loại giảm giá' }]}
            >
              <Select
                placeholder="Chọn loại giảm giá"
                options={[
                  { label: 'Phần trăm (%)', value: 'percentage' },
                  { label: 'Số tiền cố định (VND)', value: 'fixed_amount' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Giá trị giảm"
              name="discountValue"
              rules={[{ required: true, message: 'Vui lòng nhập giá trị giảm' }]}
            >
              <InputNumber
                min={0}
                max={discountTypeValue === 'percentage' ? 100 : undefined}
                className="!w-full"
                placeholder={discountTypeValue === 'percentage' ? '0 - 100' : 'Số tiền giảm'}
              />
            </Form.Item>

            <Form.Item label="Đơn tối thiểu" name="minOrderValue">
              <InputNumber min={0} className="!w-full" placeholder="0" />
            </Form.Item>

            <Form.Item label="Giảm tối đa" name="maxDiscountAmount">
              <InputNumber min={0} className="!w-full" placeholder="Không giới hạn nếu bỏ trống" />
            </Form.Item>

            <Form.Item
              label="Lượt sử dụng tối đa"
              name="usageLimit"
              rules={[
                { required: true, message: 'Vui lòng nhập lượt sử dụng' },
                {
                  validator: async (_, value) => {
                    const maxUsagePerUser = form.getFieldValue('maxUsagePerUser')

                    if (
                      typeof value === 'number' &&
                      typeof maxUsagePerUser === 'number' &&
                      value <= maxUsagePerUser
                    ) {
                      throw new Error('Lượt sử dụng tối đa phải lớn hơn giới hạn theo tài khoản')
                    }
                  },
                },
              ]}
            >
              <InputNumber
                min={1}
                className="!w-full"
                placeholder="Nhập tổng lượt sử dụng tối đa"
              />
            </Form.Item>

            <Form.Item
              label="Lượt tối đa / tài khoản"
              name="maxUsagePerUser"
              dependencies={['usageLimit']}
              rules={[
                { required: true, message: 'Vui lòng nhập giới hạn theo tài khoản' },
                {
                  validator: async (_, value) => {
                    const usageLimit = form.getFieldValue('usageLimit')

                    if (
                      typeof value === 'number' &&
                      typeof usageLimit === 'number' &&
                      value >= usageLimit
                    ) {
                      throw new Error('Giới hạn theo tài khoản phải nhỏ hơn lượt sử dụng tối đa')
                    }
                  },
                },
              ]}
            >
              <InputNumber min={1} className="!w-full" placeholder="Nhập giới hạn theo tài khoản" />
            </Form.Item>

            <Form.Item label="Kích hoạt" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <Form.Item
            label="Thời gian hiệu lực"
            name="activeTime"
            rules={[{ required: true, message: 'Vui lòng chọn thời gian hiệu lực' }]}
          >
            <DatePicker.RangePicker
              showTime
              className="!w-full"
              placeholder={['Bắt đầu', 'Kết thúc']}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
