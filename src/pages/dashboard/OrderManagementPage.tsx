import { EyeOutlined, SyncOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { sumBy } from 'lodash'
import { useMemo, useState } from 'react'

import { listAdminOrders, updateAdminOrderStatus } from '@/features/admin/api/order-management.api'
import type {
  AdminOrderItem,
  AdminOrderStatus,
} from '@/features/admin/model/order-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const PAGE_SIZE = 10
const ITEM_PLACEHOLDER = '/images/product-placeholder.svg'

const ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  returned: 'Hoàn trả',
}

const ORDER_STATUS_COLOR: Record<AdminOrderStatus, string> = {
  pending: 'gold',
  confirmed: 'blue',
  preparing: 'geekblue',
  shipping: 'cyan',
  delivered: 'green',
  cancelled: 'red',
  returned: 'volcano',
}

const ORDER_STATUS_TRANSITIONS: Record<AdminOrderStatus, AdminOrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipping', 'cancelled'],
  shipping: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
}

const PAYMENT_METHOD_LABEL: Record<AdminOrderItem['paymentMethod'], string> = {
  cod: 'COD',
  banking: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
}

const PAYMENT_STATUS_LABEL: Record<AdminOrderItem['paymentStatus'], string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Hoàn tiền',
}

interface UpdateStatusFormValues {
  status: AdminOrderStatus
  note?: string
}

export const OrderManagementPage = () => {
  const queryClient = useQueryClient()
  const [statusForm] = Form.useForm<UpdateStatusFormValues>()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatus | 'all'>('all')
  const [userIdInput, setUserIdInput] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [detailOrder, setDetailOrder] = useState<AdminOrderItem | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<AdminOrderItem | null>(null)

  const ordersQuery = useQuery({
    queryKey: queryKeys.admin.orders({
      page,
      limit: PAGE_SIZE,
      status: statusFilter === 'all' ? undefined : statusFilter,
      userId: userIdFilter || undefined,
      search: searchTerm || undefined,
    }),
    queryFn: () =>
      listAdminOrders({
        page,
        limit: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
        userId: userIdFilter || undefined,
        search: searchTerm || undefined,
      }),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, payload }: { orderId: string; payload: UpdateStatusFormValues }) =>
      updateAdminOrderStatus(orderId, payload),
    onSuccess: async (updatedOrder) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void message.success('Đã cập nhật trạng thái đơn hàng')
      setStatusModalOpen(false)
      setUpdatingOrder(null)
      statusForm.resetFields()

      if (detailOrder?.id === updatedOrder.id) {
        setDetailOrder(updatedOrder)
      }
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const availableStatusOptions = useMemo(() => {
    if (!updatingOrder) {
      return []
    }

    return ORDER_STATUS_TRANSITIONS[updatingOrder.status].map((status) => ({
      label: ORDER_STATUS_LABEL[status],
      value: status,
    }))
  }, [updatingOrder])

  const openUpdateStatusModal = (order: AdminOrderItem) => {
    const nextStatuses = ORDER_STATUS_TRANSITIONS[order.status]

    if (nextStatuses.length === 0) {
      return
    }

    setUpdatingOrder(order)
    statusForm.setFieldsValue({
      status: nextStatuses[0],
      note: undefined,
    })
    setStatusModalOpen(true)
  }

  const handleSubmitStatus = (values: UpdateStatusFormValues) => {
    if (!updatingOrder) {
      return
    }

    updateStatusMutation.mutate({
      orderId: updatingOrder.id,
      payload: {
        status: values.status,
        note: values.note?.trim() || undefined,
      },
    })
  }

  const columns: ColumnsType<AdminOrderItem> = [
    {
      title: 'Mã đơn',
      key: 'order',
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.orderCode}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {formatDateTime(record.createdAt)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Khách nhận hàng',
      key: 'customer',
      width: 280,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.shippingRecipientName}</Typography.Text>
          <Typography.Text type="secondary">{record.shippingPhone}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            UID: {record.userId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Thanh toán',
      key: 'payment',
      width: 170,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue" className="!m-0 w-fit">
            {PAYMENT_METHOD_LABEL[record.paymentMethod]}
          </Tag>
          <Typography.Text type="secondary" className="text-xs">
            {PAYMENT_STATUS_LABEL[record.paymentStatus]}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Số lượng SP',
      key: 'itemCount',
      dataIndex: 'items',
      width: 120,
      render: (items: AdminOrderItem['items']) => items.length,
    },
    {
      title: 'Tổng tiền',
      key: 'total',
      dataIndex: 'totalAmount',
      width: 160,
      render: (value: number) => (
        <Typography.Text strong>{formatVndCurrency(value)}</Typography.Text>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      dataIndex: 'status',
      width: 150,
      render: (value: AdminOrderStatus) => (
        <Tag color={ORDER_STATUS_COLOR[value]}>{ORDER_STATUS_LABEL[value]}</Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 230,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setDetailOrder(record)
            }}
          ></Button>
          <Button
            type="primary"
            ghost
            icon={<SyncOutlined />}
            onClick={() => {
              openUpdateStatusModal(record)
            }}
            disabled={ORDER_STATUS_TRANSITIONS[record.status].length === 0}
          ></Button>
        </Space>
      ),
    },
  ]

  const orders = ordersQuery.data?.items ?? []
  const totalRevenue = sumBy(orders, (order) => order.totalAmount)
  const pendingCount = orders.filter((order) => order.status === 'pending').length

  const sortedStatusHistory = useMemo(() => {
    if (!detailOrder) {
      return []
    }

    return [...detailOrder.statusHistory].sort((left, right) => {
      return new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime()
    })
  }, [detailOrder])

  return (
    <div className="space-y-5">
      <div>
        <Typography.Title level={3} className="!mb-1">
          Quản lý đơn hàng
        </Typography.Title>
        <Typography.Text type="secondary">
          Theo dõi toàn bộ đơn hàng, lọc theo trạng thái và cập nhật luồng xử lý.
        </Typography.Text>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <Statistic title="Tổng đơn (theo filter)" value={ordersQuery.data?.totalItems ?? 0} />
        </Card>
        <Card>
          <Statistic title="Đơn chờ xác nhận (trang hiện tại)" value={pendingCount} />
        </Card>
        <Card>
          <Statistic
            title="Doanh thu trang hiện tại"
            value={totalRevenue}
            formatter={(value) => formatVndCurrency(Number(value ?? 0))}
          />
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            allowClear
            className="w-full md:max-w-sm"
            placeholder="Tìm mã đơn / người nhận / số điện thoại"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
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

          <Input.Search
            allowClear
            className="w-full md:max-w-xs"
            placeholder="Lọc theo userId"
            value={userIdInput}
            onChange={(event) => {
              setUserIdInput(event.target.value)
              if (!event.target.value.trim()) {
                setPage(1)
                setUserIdFilter('')
              }
            }}
            onSearch={(value) => {
              setPage(1)
              setUserIdFilter(value.trim())
            }}
          />

          <Select
            value={statusFilter}
            className="w-full md:w-56"
            options={[
              { label: 'Tất cả trạng thái', value: 'all' },
              { label: ORDER_STATUS_LABEL.pending, value: 'pending' },
              { label: ORDER_STATUS_LABEL.confirmed, value: 'confirmed' },
              { label: ORDER_STATUS_LABEL.preparing, value: 'preparing' },
              { label: ORDER_STATUS_LABEL.shipping, value: 'shipping' },
              { label: ORDER_STATUS_LABEL.delivered, value: 'delivered' },
              { label: ORDER_STATUS_LABEL.cancelled, value: 'cancelled' },
              { label: ORDER_STATUS_LABEL.returned, value: 'returned' },
            ]}
            onChange={(value) => {
              setPage(1)
              setStatusFilter(value as AdminOrderStatus | 'all')
            }}
          />
        </div>

        {ordersQuery.isLoading ? (
          <div className="py-10 text-center">
            <Spin />
          </div>
        ) : null}

        {!ordersQuery.isLoading && orders.length === 0 ? (
          <Empty description="Không có đơn hàng phù hợp" />
        ) : null}

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={orders}
          loading={ordersQuery.isFetching}
          scroll={{ x: 1280 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: ordersQuery.data?.totalItems ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => {
              setPage(nextPage)
            },
          }}
        />
      </Card>

      <Modal
        open={statusModalOpen}
        title={`Cập nhật trạng thái: ${updatingOrder?.orderCode ?? ''}`}
        okText="Cập nhật"
        cancelText="Hủy"
        onCancel={() => {
          setStatusModalOpen(false)
          setUpdatingOrder(null)
          statusForm.resetFields()
        }}
        onOk={() => {
          void statusForm.submit()
        }}
        okButtonProps={{
          loading: updateStatusMutation.isPending,
          disabled: availableStatusOptions.length === 0,
        }}
      >
        {availableStatusOptions.length === 0 ? (
          <Empty description="Đơn hàng này không còn trạng thái khả dụng để chuyển tiếp" />
        ) : (
          <Form<UpdateStatusFormValues>
            form={statusForm}
            layout="vertical"
            onFinish={handleSubmitStatus}
          >
            <Form.Item
              label="Trạng thái mới"
              name="status"
              rules={[{ required: true, message: 'Vui lòng chọn trạng thái mới' }]}
            >
              <Select placeholder="Chọn trạng thái mới" options={availableStatusOptions} />
            </Form.Item>
            <Form.Item label="Ghi chú" name="note">
              <Input.TextArea
                rows={3}
                showCount
                maxLength={255}
                placeholder="Nhập ghi chú (tùy chọn)"
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        open={Boolean(detailOrder)}
        title={detailOrder ? `Chi tiết đơn ${detailOrder.orderCode}` : 'Chi tiết đơn hàng'}
        footer={null}
        width={920}
        onCancel={() => {
          setDetailOrder(null)
        }}
      >
        {!detailOrder ? null : (
          <div className="space-y-5">
            <Descriptions
              bordered
              size="small"
              column={2}
              items={[
                {
                  key: 'orderCode',
                  label: 'Mã đơn',
                  children: detailOrder.orderCode,
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  children: (
                    <Tag color={ORDER_STATUS_COLOR[detailOrder.status]}>
                      {ORDER_STATUS_LABEL[detailOrder.status]}
                    </Tag>
                  ),
                },
                {
                  key: 'customerName',
                  label: 'Người nhận',
                  children: detailOrder.shippingRecipientName,
                },
                {
                  key: 'customerPhone',
                  label: 'Số điện thoại',
                  children: detailOrder.shippingPhone,
                },
                {
                  key: 'address',
                  label: 'Địa chỉ giao hàng',
                  span: 2,
                  children: detailOrder.shippingAddress,
                },
                {
                  key: 'paymentMethod',
                  label: 'Phương thức thanh toán',
                  children: PAYMENT_METHOD_LABEL[detailOrder.paymentMethod],
                },
                {
                  key: 'paymentStatus',
                  label: 'Trạng thái thanh toán',
                  children: PAYMENT_STATUS_LABEL[detailOrder.paymentStatus],
                },
                {
                  key: 'createdAt',
                  label: 'Ngày tạo',
                  children: formatDateTime(detailOrder.createdAt),
                },
                {
                  key: 'updatedAt',
                  label: 'Cập nhật gần nhất',
                  children: formatDateTime(detailOrder.updatedAt),
                },
                {
                  key: 'amount',
                  label: 'Tổng tiền',
                  children: (
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>
                        {formatVndCurrency(detailOrder.totalAmount)}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="text-xs">
                        Tạm tính: {formatVndCurrency(detailOrder.subtotal)} · Giảm giá:{' '}
                        {formatVndCurrency(detailOrder.discountAmount)} · Phí ship:{' '}
                        {formatVndCurrency(detailOrder.shippingFee)}
                      </Typography.Text>
                    </Space>
                  ),
                  span: 2,
                },
              ]}
            />

            <div>
              <Typography.Title level={5} className="!mb-3">
                Danh sách sản phẩm
              </Typography.Title>
              <List
                dataSource={detailOrder.items}
                locale={{
                  emptyText: 'Không có sản phẩm trong đơn',
                }}
                renderItem={(item) => (
                  <List.Item>
                    <div className="flex w-full items-center gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                        <img
                          src={item.productImage ?? ITEM_PLACEHOLDER}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <Typography.Text strong className="block">
                          {item.productName}
                        </Typography.Text>
                        <Typography.Text type="secondary" className="text-xs">
                          SKU: {item.variantSku} · Màu: {item.variantColor}
                        </Typography.Text>
                      </div>

                      <Space direction="vertical" size={0} align="end">
                        <Typography.Text>Số lượng: {item.quantity}</Typography.Text>
                        <Typography.Text strong>{formatVndCurrency(item.total)}</Typography.Text>
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            </div>

            <div>
              <Typography.Title level={5} className="!mb-3">
                Lịch sử trạng thái
              </Typography.Title>
              <Timeline
                items={sortedStatusHistory.map((history) => ({
                  children: (
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{ORDER_STATUS_LABEL[history.status]}</Typography.Text>
                      <Typography.Text type="secondary" className="text-xs">
                        {formatDateTime(history.changedAt)}
                      </Typography.Text>
                      {history.note ? (
                        <Typography.Text type="secondary" className="text-xs">
                          {history.note}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  ),
                }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
