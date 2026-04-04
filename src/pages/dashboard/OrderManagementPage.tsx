import { DeleteOutlined, EyeOutlined, SyncOutlined, UploadOutlined } from '@ant-design/icons'
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
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { sumBy } from 'lodash'
import { useMemo, useState } from 'react'

import {
  listAdminOrders,
  updateAdminCancelRefundRequest,
  updateAdminOrderStatus,
  updateAdminReturnRequest,
} from '@/features/admin/api/order-management.api'
import type {
  AdminCancelRefundRequest,
  AdminCancelRefundRequestStatus,
  AdminOrderItem,
  AdminOrderStatus,
  AdminRefundMethod,
  AdminReturnRequest,
  AdminReturnRequestStatus,
} from '@/features/admin/model/order-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { uploadImage } from '@/shared/api/upload.api'
import { buildVietQrImageUrl } from '@/shared/constants/vietqr'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const PAGE_SIZE = 10
const ITEM_PLACEHOLDER = '/images/product-placeholder.svg'

const ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  awaiting_payment: 'Chờ thanh toán',
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  returned: 'Hoàn trả',
}

const ORDER_STATUS_COLOR: Record<AdminOrderStatus, string> = {
  awaiting_payment: 'orange',
  pending: 'gold',
  confirmed: 'blue',
  shipping: 'cyan',
  delivered: 'green',
  completed: 'green',
  cancelled: 'red',
  returned: 'volcano',
}

const ORDER_STATUS_TRANSITIONS: Record<AdminOrderStatus, AdminOrderStatus[]> = {
  awaiting_payment: ['cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered'],
  delivered: [],
  completed: [],
  cancelled: [],
  returned: [],
}

const PAYMENT_METHOD_LABEL: Record<AdminOrderItem['paymentMethod'], string> = {
  cod: 'COD',
  banking: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
}

const getPaymentMethodLabel = (order: AdminOrderItem) => {
  if (order.paymentMethod !== 'zalopay') {
    return PAYMENT_METHOD_LABEL[order.paymentMethod]
  }

  if (order.zalopayChannel === 'bank_card') {
    return 'ZaloPay - Thẻ Visa/Master/JCB'
  }

  if (order.zalopayChannel === 'atm') {
    return 'ZaloPay - Thẻ ATM/Tài khoản ngân hàng'
  }

  if (order.zalopayChannel === 'wallet') {
    return 'ZaloPay - Ví'
  }

  return 'ZaloPay - Cổng chung'
}

const PAYMENT_STATUS_LABEL: Record<AdminOrderItem['paymentStatus'], string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Hoàn tiền',
}

const RETURN_STATUS_LABEL: Record<AdminReturnRequestStatus, string> = {
  pending: 'Chờ xử lý',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  refunded: 'Đã hoàn tiền',
}

const RETURN_STATUS_COLOR: Record<AdminReturnRequestStatus, string> = {
  pending: 'gold',
  approved: 'blue',
  rejected: 'red',
  refunded: 'green',
}

const REFUND_METHOD_LABEL: Record<AdminRefundMethod, string> = {
  bank_transfer: 'Chuyển khoản',
  wallet: 'Hoàn vào ví',
}

const CANCEL_REFUND_STATUS_LABEL: Record<AdminCancelRefundRequestStatus, string> = {
  pending: 'Chờ xử lý',
  rejected: 'Từ chối',
  refunded: 'Đã hoàn tiền',
}

const CANCEL_REFUND_STATUS_COLOR: Record<AdminCancelRefundRequestStatus, string> = {
  pending: 'gold',
  rejected: 'red',
  refunded: 'green',
}

interface UpdateStatusFormValues {
  status: AdminOrderStatus
  note?: string
}

interface UpdateReturnRequestFormValues {
  status: AdminReturnRequestStatus
  refundMethod?: AdminRefundMethod
  note?: string
}

interface UpdateCancelRefundFormValues {
  status: AdminCancelRefundRequestStatus
  adminNote?: string
}

export const OrderManagementPage = () => {
  const queryClient = useQueryClient()
  const [statusForm] = Form.useForm<UpdateStatusFormValues>()
  const [returnForm] = Form.useForm<UpdateReturnRequestFormValues>()
  const [cancelRefundForm] = Form.useForm<UpdateCancelRefundFormValues>()
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnContext, setReturnContext] = useState<{
    orderId: string
    request: AdminReturnRequest
  } | null>(null)
  const [refundEvidenceImages, setRefundEvidenceImages] = useState<string[]>([])
  const [uploadingRefundEvidence, setUploadingRefundEvidence] = useState(false)
  const [cancelRefundModalOpen, setCancelRefundModalOpen] = useState(false)
  const [cancelRefundContext, setCancelRefundContext] = useState<{
    orderId: string
    request: AdminCancelRefundRequest
  } | null>(null)
  const [cancelRefundEvidenceImages, setCancelRefundEvidenceImages] = useState<string[]>([])
  const [uploadingCancelRefundEvidence, setUploadingCancelRefundEvidence] = useState(false)

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
        setDetailOrder({
          ...updatedOrder,
          user: detailOrder.user ?? updatedOrder.user,
        })
      }
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateReturnRequestMutation = useMutation({
    mutationFn: (payload: {
      orderId: string
      returnRequestId: string
      payload: {
        status: AdminReturnRequestStatus
        refundMethod?: AdminRefundMethod
        note?: string
        refundEvidenceImages?: string[]
      }
    }) => updateAdminReturnRequest(payload.orderId, payload.returnRequestId, payload.payload),
    onSuccess: async (updatedOrder) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void message.success('Đã cập nhật hoàn hàng')
      setReturnModalOpen(false)
      setReturnContext(null)
      returnForm.resetFields()

      if (detailOrder?.id === updatedOrder.id) {
        setDetailOrder({
          ...updatedOrder,
          user: detailOrder.user ?? updatedOrder.user,
        })
      }
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateCancelRefundMutation = useMutation({
    mutationFn: (payload: {
      orderId: string
      payload: {
        status: AdminCancelRefundRequestStatus
        adminNote?: string
        refundEvidenceImages?: string[]
      }
    }) => updateAdminCancelRefundRequest(payload.orderId, payload.payload),
    onSuccess: async (updatedOrder) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void message.success('Đã cập nhật yêu cầu hoàn tiền')
      setCancelRefundModalOpen(false)
      setCancelRefundContext(null)
      cancelRefundForm.resetFields()

      if (detailOrder?.id === updatedOrder.id) {
        setDetailOrder({
          ...updatedOrder,
          user: detailOrder.user ?? updatedOrder.user,
        })
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

  const openReturnModal = (orderId: string, request: AdminReturnRequest) => {
    setReturnContext({ orderId, request })
    setReturnModalOpen(true)
    setRefundEvidenceImages(request.refundEvidenceImages ?? [])
    returnForm.setFieldsValue({
      status: request.status,
      refundMethod: request.refundMethod,
      note: request.note,
    })
  }

  const openCancelRefundModal = (orderId: string, request: AdminCancelRefundRequest) => {
    setCancelRefundContext({ orderId, request })
    setCancelRefundModalOpen(true)
    setCancelRefundEvidenceImages(request.refundEvidenceImages ?? [])
    cancelRefundForm.setFieldsValue({
      status: request.status,
      adminNote: request.adminNote,
    })
  }

  const handleUploadRefundEvidence = async (file: File) => {
    setUploadingRefundEvidence(true)
    try {
      const uploaded = await uploadImage(file, 'others')
      setRefundEvidenceImages((prev) => [...prev, uploaded.url])
      void message.success('Tải ảnh minh chứng thành công')
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Upload ảnh thất bại'
      void message.error(messageText)
    } finally {
      setUploadingRefundEvidence(false)
    }

    return false
  }

  const removeRefundEvidence = (url: string) => {
    setRefundEvidenceImages((prev) => prev.filter((item) => item !== url))
  }

  const handleUploadCancelRefundEvidence = async (file: File) => {
    setUploadingCancelRefundEvidence(true)
    try {
      const uploaded = await uploadImage(file, 'others')
      setCancelRefundEvidenceImages((prev) => [...prev, uploaded.url])
      void message.success('Tải bill chuyển khoản thành công')
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Upload bill chuyển khoản thất bại'
      void message.error(messageText)
    } finally {
      setUploadingCancelRefundEvidence(false)
    }

    return false
  }

  const removeCancelRefundEvidence = (url: string) => {
    setCancelRefundEvidenceImages((prev) => prev.filter((item) => item !== url))
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
            {record.user?.fullName ? `${record.user.fullName} · ` : ''}
            {record.user?.email ?? `UID: ${record.userId}`}
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
            {getPaymentMethodLabel(record)}
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
  const awaitingPaymentCount = orders.filter((order) => order.status === 'awaiting_payment').length
  const pendingCount = orders.filter((order) => order.status === 'pending').length

  const sortedStatusHistory = useMemo(() => {
    if (!detailOrder) {
      return []
    }

    return [...detailOrder.statusHistory].sort((left, right) => {
      return new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime()
    })
  }, [detailOrder])

  const returnRequests = detailOrder?.returnRequests ?? []
  const cancelRefundRequest = detailOrder?.cancelRefundRequest
  const cancelRefundVietQrUrl = buildVietQrImageUrl({
    bankCode: cancelRefundRequest?.bankCode,
    accountNumber: cancelRefundRequest?.accountNumber,
    accountHolder: cancelRefundRequest?.accountHolder,
    amount: cancelRefundRequest?.refundAmount,
    orderCode: detailOrder?.orderCode,
  })

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <Statistic title="Tổng đơn (theo filter)" value={ordersQuery.data?.totalItems ?? 0} />
        </Card>
        <Card>
          <Statistic title="Đơn chờ thanh toán" value={awaitingPaymentCount} />
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
              { label: ORDER_STATUS_LABEL.awaiting_payment, value: 'awaiting_payment' },
              { label: ORDER_STATUS_LABEL.pending, value: 'pending' },
              { label: ORDER_STATUS_LABEL.confirmed, value: 'confirmed' },
              { label: ORDER_STATUS_LABEL.shipping, value: 'shipping' },
              { label: ORDER_STATUS_LABEL.delivered, value: 'delivered' },
              { label: ORDER_STATUS_LABEL.completed, value: 'completed' },
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
                  key: 'accountId',
                  label: 'Tài khoản',
                  children: detailOrder.user?.email ?? detailOrder.userId,
                },
                {
                  key: 'accountName',
                  label: 'Tên tài khoản',
                  children: detailOrder.user?.fullName ?? '—',
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
                  children: getPaymentMethodLabel(detailOrder),
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
                Yêu cầu hoàn hàng
              </Typography.Title>
              {returnRequests.length === 0 ? (
                <Empty description="Chưa có yêu cầu hoàn hàng" />
              ) : (
                <List
                  dataSource={returnRequests}
                  renderItem={(request) => (
                    <List.Item
                      actions={[
                        <Button
                          key="update"
                          size="small"
                          onClick={() => openReturnModal(detailOrder.id, request)}
                        >
                          Cập nhật
                        </Button>,
                      ]}
                    >
                      <div className="w-full space-y-2">
                        <Space wrap>
                          <Tag color={RETURN_STATUS_COLOR[request.status]}>
                            {RETURN_STATUS_LABEL[request.status]}
                          </Tag>
                          <Typography.Text type="secondary">
                            {REFUND_METHOD_LABEL[request.refundMethod]}
                          </Typography.Text>
                          <Typography.Text strong>
                            {formatVndCurrency(request.refundAmount)}
                          </Typography.Text>
                        </Space>
                        {request.reason ? (
                          <Typography.Text type="secondary">{request.reason}</Typography.Text>
                        ) : null}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {request.items.map((item) => (
                            <span key={`${request.id}-${item.variantId}`}>
                              {item.productName} x{item.quantity}
                            </span>
                          ))}
                        </div>
                        {request.refundEvidenceImages?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {request.refundEvidenceImages.map((url) => (
                              <img
                                key={`${request.id}-${url}`}
                                src={url}
                                alt="Minh chứng hoàn tiền"
                                className="h-12 w-12 rounded border border-slate-200 object-cover"
                              />
                            ))}
                          </div>
                        ) : null}
                        <Typography.Text type="secondary" className="text-xs">
                          Tạo lúc: {formatDateTime(request.createdAt)}
                        </Typography.Text>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>

            <div>
              <Typography.Title level={5} className="!mb-3">
                Hoàn tiền đơn hủy
              </Typography.Title>
              {!cancelRefundRequest ? (
                <Empty description="Chưa có yêu cầu hoàn tiền cho đơn hủy" />
              ) : (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Space wrap>
                      <Tag color={CANCEL_REFUND_STATUS_COLOR[cancelRefundRequest.status]}>
                        {CANCEL_REFUND_STATUS_LABEL[cancelRefundRequest.status]}
                      </Tag>
                      <Typography.Text strong>
                        {formatVndCurrency(cancelRefundRequest.refundAmount)}
                      </Typography.Text>
                    </Space>
                    <Button
                      size="small"
                      onClick={() => openCancelRefundModal(detailOrder.id, cancelRefundRequest)}
                    >
                      Xử lý hoàn tiền
                    </Button>
                  </div>

                  <Descriptions
                    bordered
                    size="small"
                    column={2}
                    items={[
                      {
                        key: 'refundBankName',
                        label: 'Ngân hàng',
                        children: cancelRefundRequest.bankName,
                      },
                      {
                        key: 'refundBankCode',
                        label: 'Mã ngân hàng',
                        children: cancelRefundRequest.bankCode,
                      },
                      {
                        key: 'refundAccountNumber',
                        label: 'Số tài khoản',
                        children: cancelRefundRequest.accountNumber,
                      },
                      {
                        key: 'refundAccountHolder',
                        label: 'Chủ tài khoản',
                        children: cancelRefundRequest.accountHolder,
                      },
                      {
                        key: 'refundRequestedAt',
                        label: 'Thời gian gửi yêu cầu',
                        children: formatDateTime(cancelRefundRequest.requestedAt),
                      },
                      {
                        key: 'refundProcessedAt',
                        label: 'Thời gian xử lý',
                        children: cancelRefundRequest.processedAt
                          ? formatDateTime(cancelRefundRequest.processedAt)
                          : 'Chưa xử lý',
                      },
                      {
                        key: 'refundCustomerNote',
                        label: 'Ghi chú khách hàng',
                        span: 2,
                        children: cancelRefundRequest.note ?? '—',
                      },
                      {
                        key: 'refundAdminNote',
                        label: 'Ghi chú nhân viên',
                        span: 2,
                        children: cancelRefundRequest.adminNote ?? '—',
                      },
                    ]}
                  />

                  {cancelRefundVietQrUrl ? (
                    <div>
                      <Typography.Text strong className="mb-2 block">
                        VietQR chuyển khoản
                      </Typography.Text>
                      <img
                        src={cancelRefundVietQrUrl}
                        alt="VietQR hoàn tiền"
                        className="h-48 w-48 rounded border border-slate-200 bg-white object-contain"
                      />
                    </div>
                  ) : null}

                  {cancelRefundRequest.refundEvidenceImages?.length ? (
                    <div>
                      <Typography.Text strong className="mb-2 block">
                        Bill chuyển khoản
                      </Typography.Text>
                      <div className="flex flex-wrap gap-2">
                        {cancelRefundRequest.refundEvidenceImages.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            <img
                              src={url}
                              alt="Bill chuyển khoản"
                              className="h-16 w-16 rounded border border-slate-200 object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
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
                      <Typography.Text type="secondary" className="text-xs">
                        UID cập nhật: {history.changedBy}
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

      <Modal
        open={returnModalOpen}
        title="Cập nhật yêu cầu hoàn hàng"
        okText="Lưu"
        cancelText="Đóng"
        confirmLoading={updateReturnRequestMutation.isPending}
        onCancel={() => {
          setReturnModalOpen(false)
          setReturnContext(null)
          returnForm.resetFields()
        }}
        onOk={() => {
          if (!returnContext) {
            return
          }

          returnForm
            .validateFields()
            .then((values) => {
              const effectiveRefundMethod =
                values.refundMethod ?? returnContext.request.refundMethod

              if (
                values.status === 'refunded' &&
                effectiveRefundMethod === 'bank_transfer' &&
                refundEvidenceImages.length === 0
              ) {
                void message.error('Cần ảnh minh chứng hoàn tiền khi chuyển khoản')
                return
              }

              updateReturnRequestMutation.mutate({
                orderId: returnContext.orderId,
                returnRequestId: returnContext.request.id,
                payload: {
                  status: values.status,
                  refundMethod: values.refundMethod,
                  note: values.note?.trim() || undefined,
                  refundEvidenceImages,
                },
              })
            })
            .catch(() => undefined)
        }}
      >
        <Form layout="vertical" form={returnForm}>
          <Form.Item
            label="Trạng thái"
            name="status"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
          >
            <Select
              placeholder="Chọn trạng thái"
              options={Object.entries(RETURN_STATUS_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item label="Phương thức hoàn tiền" name="refundMethod">
            <Select
              placeholder="Chọn phương thức"
              options={Object.entries(REFUND_METHOD_LABEL).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea rows={3} placeholder="Nhập ghi chú (tuỳ chọn)" />
          </Form.Item>
          <Form.Item label="Ảnh minh chứng hoàn tiền (bắt buộc nếu chuyển khoản)">
            <Space direction="vertical" size={8} className="w-full">
              <Upload
                multiple
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => handleUploadRefundEvidence(file as File)}
              >
                <Button icon={<UploadOutlined />} loading={uploadingRefundEvidence}>
                  Tải ảnh minh chứng
                </Button>
              </Upload>
              {refundEvidenceImages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {refundEvidenceImages.map((url) => (
                    <div
                      key={url}
                      className="flex w-[90px] flex-col items-center gap-1 rounded border border-slate-200 p-2"
                    >
                      <img
                        src={url}
                        alt="Minh chứng hoàn tiền"
                        className="h-12 w-12 rounded object-cover"
                      />
                      <Button
                        danger
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeRefundEvidence(url)}
                      >
                        Xóa
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography.Text type="secondary">Chưa có ảnh minh chứng.</Typography.Text>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={cancelRefundModalOpen}
        title="Xử lý hoàn tiền đơn hủy"
        okText="Lưu"
        cancelText="Đóng"
        confirmLoading={updateCancelRefundMutation.isPending}
        onCancel={() => {
          setCancelRefundModalOpen(false)
          setCancelRefundContext(null)
          cancelRefundForm.resetFields()
        }}
        onOk={() => {
          if (!cancelRefundContext) {
            return
          }

          cancelRefundForm
            .validateFields()
            .then((values) => {
              if (values.status === 'refunded' && cancelRefundEvidenceImages.length === 0) {
                void message.error('Cần upload bill chuyển khoản trước khi xác nhận hoàn tiền')
                return
              }

              updateCancelRefundMutation.mutate({
                orderId: cancelRefundContext.orderId,
                payload: {
                  status: values.status,
                  adminNote: values.adminNote?.trim() || undefined,
                  refundEvidenceImages: cancelRefundEvidenceImages,
                },
              })
            })
            .catch(() => undefined)
        }}
      >
        {!cancelRefundContext ? null : (
          <Space direction="vertical" size={16} className="w-full">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'cancelRefundOrderId',
                  label: 'Đơn hàng',
                  children: detailOrder?.orderCode ?? cancelRefundContext.orderId,
                },
                {
                  key: 'cancelRefundAmount',
                  label: 'Số tiền hoàn',
                  children: formatVndCurrency(cancelRefundContext.request.refundAmount),
                },
                {
                  key: 'cancelRefundBank',
                  label: 'Ngân hàng',
                  children: `${cancelRefundContext.request.bankName} (${cancelRefundContext.request.bankCode})`,
                },
                {
                  key: 'cancelRefundAccountNumber',
                  label: 'Số tài khoản',
                  children: cancelRefundContext.request.accountNumber,
                },
                {
                  key: 'cancelRefundAccountHolder',
                  label: 'Chủ tài khoản',
                  children: cancelRefundContext.request.accountHolder,
                },
                {
                  key: 'cancelRefundCustomerNote',
                  label: 'Ghi chú khách hàng',
                  children: cancelRefundContext.request.note ?? '—',
                },
              ]}
            />

            {cancelRefundVietQrUrl ? (
              <div>
                <Typography.Text strong className="mb-2 block">
                  VietQR chuyển khoản
                </Typography.Text>
                <img
                  src={cancelRefundVietQrUrl}
                  alt="VietQR chuyển khoản"
                  className="h-56 w-56 rounded border border-slate-200 bg-white object-contain"
                />
              </div>
            ) : null}

            <Form layout="vertical" form={cancelRefundForm}>
              <Form.Item
                label="Trạng thái"
                name="status"
                rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
              >
                <Select
                  placeholder="Chọn trạng thái"
                  options={Object.entries(CANCEL_REFUND_STATUS_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
              <Form.Item label="Ghi chú nhân viên" name="adminNote">
                <Input.TextArea rows={3} placeholder="Nhập ghi chú xử lý hoàn tiền" />
              </Form.Item>
              <Form.Item label="Bill chuyển khoản">
                <Space direction="vertical" size={8} className="w-full">
                  <Upload
                    multiple
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => handleUploadCancelRefundEvidence(file as File)}
                  >
                    <Button icon={<UploadOutlined />} loading={uploadingCancelRefundEvidence}>
                      Tải bill chuyển khoản
                    </Button>
                  </Upload>
                  {cancelRefundEvidenceImages.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {cancelRefundEvidenceImages.map((url) => (
                        <div
                          key={url}
                          className="flex w-[90px] flex-col items-center gap-1 rounded border border-slate-200 p-2"
                        >
                          <img
                            src={url}
                            alt="Bill chuyển khoản"
                            className="h-12 w-12 rounded object-cover"
                          />
                          <Button
                            danger
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeCancelRefundEvidence(url)}
                          >
                            Xóa
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Typography.Text type="secondary">Chưa có bill chuyển khoản.</Typography.Text>
                  )}
                </Space>
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>
    </div>
  )
}
