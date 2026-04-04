import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Rate,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  cancelMyOrder,
  confirmOrderReceived,
  createCancelRefundRequest,
  createMyReview,
  listMyOrders,
  retryMyVnpayPayment,
} from '@/features/account/api/account.api'
import type {
  CancelMyOrderPayload,
  CancelRefundRequestStatus,
  CreateCancelRefundRequestPayload,
  MyOrderItem,
  OrderStatus,
} from '@/features/account/model/account.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { getVietQrBankByCode, VIET_QR_BANK_OPTIONS } from '@/shared/constants/vietqr'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const ORDER_PAGE_SIZE = 8
const ITEM_PLACEHOLDER = '/images/product-placeholder.svg'

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Chờ thanh toán',
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  returned: 'Hoàn trả',
}

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  awaiting_payment: 'orange',
  pending: 'gold',
  confirmed: 'blue',
  shipping: 'cyan',
  delivered: 'green',
  completed: 'green',
  cancelled: 'red',
  returned: 'volcano',
}

const PAYMENT_METHOD_LABEL: Record<MyOrderItem['paymentMethod'], string> = {
  cod: 'COD',
  banking: 'Chuyển khoản',
  momo: 'MoMo',
  vnpay: 'VNPay',
  zalopay: 'ZaloPay',
}

const getPaymentMethodLabel = (order: MyOrderItem) => {
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

  return 'ZaloPay '
}

const PAYMENT_STATUS_LABEL: Record<MyOrderItem['paymentStatus'], string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Hoàn tiền',
}

const formatVoucherSummary = (order: MyOrderItem) => {
  if (!order.voucher) {
    return 'Không áp dụng'
  }

  const baseValue =
    order.voucher.discountType === 'percentage'
      ? `${order.voucher.discountValue}%`
      : formatVndCurrency(order.voucher.discountValue)

  return order.voucher.maxDiscountAmount
    ? `${baseValue} · tối đa ${formatVndCurrency(order.voucher.maxDiscountAmount)}`
    : baseValue
}

const CANCEL_REFUND_STATUS_LABEL: Record<CancelRefundRequestStatus, string> = {
  pending: 'Chờ xử lý',
  rejected: 'Từ chối',
  refunded: 'Đã hoàn tiền',
}

const CANCEL_REFUND_STATUS_COLOR: Record<CancelRefundRequestStatus, string> = {
  pending: 'gold',
  rejected: 'red',
  refunded: 'green',
}

// worklog: 2026-03-04 17:03:09 | ducanh | feature | canCancelOrder
// worklog: 2026-03-04 21:16:19 | ducanh | cleanup | canCancelOrder
// worklog: 2026-03-04 12:58:05 | trantu | fix | canCancelOrder
const canCancelOrder = (status: OrderStatus) => {
  return status === 'awaiting_payment' || status === 'pending' || status === 'confirmed'
}

const canConfirmReceived = (status: OrderStatus) => {
  return status === 'delivered'
}

const canReviewOrder = (order: MyOrderItem) => {
  return order.status === 'completed' && order.items.some((item) => !item.isReviewed)
}

const canRetryVnpay = (order: MyOrderItem) => {
  return (
    (order.paymentMethod === 'vnpay' || order.paymentMethod === 'zalopay') &&
    order.status === 'awaiting_payment' &&
    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed')
  )
}

const canRequestCancelRefund = (order: MyOrderItem) => {
  if (
    order.status !== 'cancelled' ||
    order.paymentMethod === 'cod' ||
    order.paymentStatus !== 'paid'
  ) {
    return false
  }

  return !order.cancelRefundRequest || order.cancelRefundRequest.status === 'rejected'
}

const getCancelOrderNote = (order: MyOrderItem) => {
  const cancelledHistory = [...order.statusHistory]
    .reverse()
    .find((history) => history.status === 'cancelled')

  return cancelledHistory?.note?.trim() || undefined
}

// worklog: 2026-03-04 12:32:16 | trantu | refactor | MyOrdersPage
// worklog: 2026-03-04 14:54:15 | ducanh | refactor | MyOrdersPage
// worklog: 2026-03-04 10:16:25 | quochuy | cleanup | MyOrdersPage
// worklog: 2026-03-04 20:41:46 | quochuy | fix | MyOrdersPage
export const MyOrdersPage = () => {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [cancelOrderForm] = Form.useForm<CancelMyOrderPayload>()
  const [cancelRefundForm] = Form.useForm<CreateCancelRefundRequestPayload>()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([])
  const focusOrderId = searchParams.get('orderId')?.trim() ?? ''
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewOrder, setReviewOrder] = useState<MyOrderItem | null>(null)
  const [selectedReviewProductId, setSelectedReviewProductId] = useState<string | null>(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewContent, setReviewContent] = useState('')
  const [cancelOrderModalOpen, setCancelOrderModalOpen] = useState(false)
  const [cancelOrderTarget, setCancelOrderTarget] = useState<MyOrderItem | null>(null)
  const [cancelRefundModalOpen, setCancelRefundModalOpen] = useState(false)
  const [cancelRefundOrder, setCancelRefundOrder] = useState<MyOrderItem | null>(null)
  const [detailOrder, setDetailOrder] = useState<MyOrderItem | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [hasHandledFocusOrder, setHasHandledFocusOrder] = useState(false)
  const selectedCancelRefundBankCode = Form.useWatch('bankCode', cancelRefundForm)

  const ordersQuery = useQuery({
    queryKey: queryKeys.account.orders({
      page,
      limit: ORDER_PAGE_SIZE,
      status,
    }),
    queryFn: () =>
      listMyOrders({
        page,
        limit: ORDER_PAGE_SIZE,
        status: status === 'all' ? undefined : status,
      }),
  })

  const cancelOrderMutation = useMutation({
    mutationFn: (payload: { orderId: string; body: CancelMyOrderPayload }) =>
      cancelMyOrder(payload.orderId, payload.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.orders(),
      })
      void message.success('Đã hủy đơn hàng')
      setCancelOrderModalOpen(false)
      setCancelOrderTarget(null)
      cancelOrderForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const repayOrderMutation = useMutation({
    mutationFn: (orderId: string) => retryMyVnpayPayment(orderId),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.orders(),
      })

      if (order.paymentUrl) {
        window.location.assign(order.paymentUrl)
        return
      }

      void message.warning('Không tạo được liên kết thanh toán')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const confirmReceivedMutation = useMutation({
    mutationFn: (orderId: string) => confirmOrderReceived(orderId),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.orders(),
      })
      void message.success(`Đã xác nhận nhận hàng ${order.orderCode}`)
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const createReviewMutation = useMutation({
    mutationFn: createMyReview,
    onSuccess: async (_, payload) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.orders(),
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.products.reviews(payload.productId),
      })
      void message.success('Đã gửi đánh giá sản phẩm')
      setReviewModalOpen(false)
      setReviewOrder(null)
      setSelectedReviewProductId(null)
      setReviewRating(0)
      setReviewContent('')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const cancelRefundRequestMutation = useMutation({
    mutationFn: (payload: { orderId: string; body: CreateCancelRefundRequestPayload }) =>
      createCancelRefundRequest(payload.orderId, payload.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.orders(),
      })
      void message.success('Đã gửi yêu cầu hoàn tiền')
      setCancelRefundModalOpen(false)
      setCancelRefundOrder(null)
      cancelRefundForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  useEffect(() => {
    if (!focusOrderId || hasHandledFocusOrder || !ordersQuery.data?.items?.length) {
      return
    }

    const focusedOrder = ordersQuery.data.items.find((item) => item.id === focusOrderId)

    if (!focusedOrder) {
      return
    }

    const timer = window.setTimeout(() => {
      setExpandedOrderIds((current) =>
        current.includes(focusOrderId) ? current : [...current, focusOrderId]
      )
      setDetailOrder(focusedOrder)
      setDetailModalOpen(true)
      setHasHandledFocusOrder(true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [focusOrderId, hasHandledFocusOrder, ordersQuery.data?.items])

  const openCancelRefundModal = useCallback(
    (order: MyOrderItem) => {
      setCancelRefundOrder(order)
      setCancelRefundModalOpen(true)
      const existingRequest = order.cancelRefundRequest
      cancelRefundForm.setFieldsValue({
        bankCode: existingRequest?.bankCode,
        bankName: existingRequest?.bankName,
        accountNumber: existingRequest?.accountNumber,
        accountHolder: existingRequest?.accountHolder,
        note: existingRequest?.note,
      })
    },
    [cancelRefundForm]
  )

  const openCancelOrderModal = useCallback(
    (order: MyOrderItem) => {
      setCancelOrderTarget(order)
      setCancelOrderModalOpen(true)
      cancelOrderForm.setFieldsValue({
        note: '',
      })
    },
    [cancelOrderForm]
  )

  const openReviewModal = useCallback((order: MyOrderItem) => {
    const firstPendingReviewItem = order.items.find((item) => !item.isReviewed)

    setReviewOrder(order)
    setSelectedReviewProductId(
      firstPendingReviewItem?.productId ?? order.items[0]?.productId ?? null
    )
    setReviewRating(0)
    setReviewContent('')
    setReviewModalOpen(true)
  }, [])

  const selectedReviewItem =
    reviewOrder?.items.find((item) => item.productId === selectedReviewProductId) ?? null
  const pendingReviewItems = reviewOrder?.items.filter((item) => !item.isReviewed) ?? []

  const renderOrderItems = (record: MyOrderItem) => (
    <List
      size="small"
      dataSource={record.items}
      locale={{
        emptyText: 'Không có sản phẩm trong đơn',
      }}
      renderItem={(item) => (
        <List.Item>
          <div className="flex w-full items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              <img
                src={item.productImage ?? ITEM_PLACEHOLDER}
                alt={item.productName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Space size={8} wrap className="mb-1">
                <Typography.Text strong className="block line-clamp-1">
                  {item.productName}
                </Typography.Text>
                {item.isReviewed ? (
                  <Tag color="green" className="!m-0">
                    Đã đánh giá
                  </Tag>
                ) : null}
              </Space>
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
  )

  const renderOrderRefundBlocks = (record: MyOrderItem) => (
    <>
      {record.cancelRefundRequest ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Typography.Text strong className="block">
                Yêu cầu hoàn tiền đơn hủy
              </Typography.Text>
              <Space size={[8, 8]} wrap className="mt-2">
                <Tag color={CANCEL_REFUND_STATUS_COLOR[record.cancelRefundRequest.status]}>
                  {CANCEL_REFUND_STATUS_LABEL[record.cancelRefundRequest.status]}
                </Tag>
                <Typography.Text strong>
                  {formatVndCurrency(record.cancelRefundRequest.refundAmount)}
                </Typography.Text>
                <Typography.Text type="secondary" className="text-xs">
                  Gửi lúc: {formatDateTime(record.cancelRefundRequest.requestedAt)}
                </Typography.Text>
              </Space>
            </div>

            {record.cancelRefundRequest.status === 'rejected' ? (
              <Button
                size="small"
                onClick={() => {
                  openCancelRefundModal(record)
                }}
              >
                Cập nhật thông tin hoàn tiền
              </Button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <Typography.Text>
              Ngân hàng: <strong>{record.cancelRefundRequest.bankName}</strong>
            </Typography.Text>
            <Typography.Text>
              Số tài khoản: <strong>{record.cancelRefundRequest.accountNumber}</strong>
            </Typography.Text>
            <Typography.Text>
              Chủ tài khoản: <strong>{record.cancelRefundRequest.accountHolder}</strong>
            </Typography.Text>
            <Typography.Text>
              Mã ngân hàng: <strong>{record.cancelRefundRequest.bankCode}</strong>
            </Typography.Text>
          </div>

          {record.cancelRefundRequest.note ? (
            <Typography.Text className="mt-2 block text-sm text-slate-700">
              Ghi chú của bạn: {record.cancelRefundRequest.note}
            </Typography.Text>
          ) : null}

          {record.cancelRefundRequest.adminNote ? (
            <Typography.Text className="mt-1 block text-sm text-slate-700">
              Ghi chú cửa hàng: {record.cancelRefundRequest.adminNote}
            </Typography.Text>
          ) : null}

          {record.cancelRefundRequest.refundEvidenceImages?.length ? (
            <div className="mt-3">
              <Typography.Text strong className="mb-2 block">
                Bill hoàn tiền
              </Typography.Text>
              <div className="flex flex-wrap gap-2">
                {record.cancelRefundRequest.refundEvidenceImages.map((url) => (
                  <a
                    key={`${record.id}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={url}
                      alt="Bill hoàn tiền"
                      className="h-16 w-16 rounded border border-slate-200 object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {record.paymentStatus === 'refunded' && !record.cancelRefundRequest ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Typography.Text strong className="block text-emerald-700">
            Hoàn tiền đơn hàng
          </Typography.Text>
          <Typography.Text className="mt-1 block text-sm text-slate-700">
            Số tiền hoàn: {formatVndCurrency(record.totalAmount)}
          </Typography.Text>
          <Typography.Text className="block text-sm text-slate-700">
            Thời gian ghi nhận:{' '}
            {record.refundedAt
              ? formatDateTime(record.refundedAt)
              : formatDateTime(record.updatedAt)}
          </Typography.Text>
          <Typography.Text type="secondary" className="mt-1 block text-xs">
            Hệ thống đã ghi nhận hoàn tiền cho đơn hàng này.
          </Typography.Text>
        </div>
      ) : null}
    </>
  )

  const renderOrderDetailContent = (record: MyOrderItem, withSummary = false) => (
    <div className="space-y-4">
      {withSummary ? (
        <Descriptions
          column={1}
          size="small"
          bordered
          items={[
            {
              key: 'orderCode',
              label: 'Mã đơn',
              children: record.orderCode,
            },
            {
              key: 'createdAt',
              label: 'Ngày đặt',
              children: formatDateTime(record.createdAt),
            },
            {
              key: 'shippingRecipientName',
              label: 'Người nhận',
              children: record.shippingRecipientName,
            },
            {
              key: 'shippingPhone',
              label: 'Số điện thoại',
              children: record.shippingPhone,
            },
            {
              key: 'shippingAddress',
              label: 'Địa chỉ nhận hàng',
              children: record.shippingAddress,
            },
            {
              key: 'paymentMethod',
              label: 'Thanh toán',
              children: (
                <Space wrap>
                  <Tag color="blue">{getPaymentMethodLabel(record)}</Tag>
                  <Typography.Text>{PAYMENT_STATUS_LABEL[record.paymentStatus]}</Typography.Text>
                </Space>
              ),
            },
            {
              key: 'voucher',
              label: 'Voucher áp dụng',
              children: record.voucher ? (
                <Space direction="vertical" size={2}>
                  <Space size={[8, 8]} wrap>
                    <Tag color="purple" className="!m-0">
                      {record.voucher.code}
                    </Tag>
                    <Typography.Text strong>{formatVoucherSummary(record)}</Typography.Text>
                  </Space>
                  {record.voucher.description ? (
                    <Typography.Text type="secondary" className="text-xs">
                      {record.voucher.description}
                    </Typography.Text>
                  ) : null}
                </Space>
              ) : (
                'Không áp dụng'
              ),
            },
            {
              key: 'subtotal',
              label: 'Tạm tính',
              children: formatVndCurrency(record.subtotal),
            },
            {
              key: 'shippingFee',
              label: 'Phí vận chuyển',
              children: formatVndCurrency(record.shippingFee),
            },
            {
              key: 'discountAmount',
              label: 'Giảm giá thực tế',
              children: formatVndCurrency(record.discountAmount),
            },
            {
              key: 'status',
              label: 'Trạng thái đơn',
              children: (
                <Tag color={ORDER_STATUS_COLOR[record.status]}>
                  {ORDER_STATUS_LABEL[record.status]}
                </Tag>
              ),
            },
            ...(record.status === 'cancelled' && getCancelOrderNote(record)
              ? [
                  {
                    key: 'cancelNote',
                    label: 'Lý do hủy',
                    children: getCancelOrderNote(record),
                  },
                ]
              : []),
            {
              key: 'totalAmount',
              label: 'Tổng tiền',
              children: formatVndCurrency(record.totalAmount),
            },
            {
              key: 'paymentTxnRef',
              label: 'Mã giao dịch hệ thống',
              children: record.paymentTxnRef ?? '—',
            },
            {
              key: 'paymentTransactionNo',
              label: 'Mã giao dịch cổng thanh toán',
              children: record.paymentTransactionNo ?? '—',
            },
            {
              key: 'paymentGatewayResponseCode',
              label: 'Mã phản hồi cổng thanh toán',
              children: record.paymentGatewayResponseCode ?? '—',
            },
            {
              key: 'paidAt',
              label: 'Thời gian thanh toán',
              children: record.paidAt ? formatDateTime(record.paidAt) : 'Chưa thanh toán',
            },
          ]}
        />
      ) : null}

      <div>
        <Typography.Text strong className="mb-2 block">
          Sản phẩm trong đơn
        </Typography.Text>
        {renderOrderItems(record)}
      </div>

      {renderOrderRefundBlocks(record)}
    </div>
  )

  const columns: ColumnsType<MyOrderItem> = useMemo(
    () => [
      {
        title: 'Mã đơn',
        dataIndex: 'orderCode',
        width: 100,
        key: 'orderCode',
        render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
      },
      {
        title: 'Ngày đặt',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value: string) => (
          <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
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
        title: 'Tổng tiền',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        width: 160,
        render: (value: number) => (
          <Typography.Text strong>{formatVndCurrency(value)}</Typography.Text>
        ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'status',
        key: 'status',
        width: 150,
        render: (value: OrderStatus) => (
          <Tag color={ORDER_STATUS_COLOR[value]}>{ORDER_STATUS_LABEL[value]}</Tag>
        ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 330,
        render: (_, record) => {
          const allowCancel = canCancelOrder(record.status)
          const allowRetryVnpay = canRetryVnpay(record)
          const allowConfirmReceived = canConfirmReceived(record.status)
          const allowReview = canReviewOrder(record)
          const allowCancelRefund = canRequestCancelRefund(record)
          return (
            <Space wrap>
              <Button
                size="small"
                onClick={() => {
                  setDetailOrder(record)
                  setDetailModalOpen(true)
                }}
              >
                Xem chi tiết
              </Button>

              {allowRetryVnpay ? (
                <Button
                  size="small"
                  type="primary"
                  loading={repayOrderMutation.isPending}
                  onClick={() => {
                    repayOrderMutation.mutate(record.id)
                  }}
                >
                  Thanh toán lại
                </Button>
              ) : null}

              {allowConfirmReceived ? (
                <Popconfirm
                  title="Xác nhận bạn đã nhận đủ hàng?"
                  okText="Đã nhận"
                  cancelText="Đóng"
                  onConfirm={() => {
                    confirmReceivedMutation.mutate(record.id)
                  }}
                >
                  <Button size="small" type="primary" ghost>
                    Đã nhận hàng
                  </Button>
                </Popconfirm>
              ) : null}

              {allowReview ? (
                <Button
                  size="small"
                  onClick={() => {
                    openReviewModal(record)
                  }}
                >
                  Đánh giá sản phẩm
                </Button>
              ) : null}

              {allowCancel ? (
                <Button
                  size="small"
                  danger
                  loading={cancelOrderMutation.isPending && cancelOrderTarget?.id === record.id}
                  onClick={() => {
                    openCancelOrderModal(record)
                  }}
                >
                  Hủy đơn
                </Button>
              ) : null}

              {allowCancelRefund ? (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={() => {
                    openCancelRefundModal(record)
                  }}
                >
                  {record.cancelRefundRequest?.status === 'rejected'
                    ? 'Gửi lại hoàn tiền'
                    : 'Hoàn tiền'}
                </Button>
              ) : null}
            </Space>
          )
        },
      },
    ],
    [
      cancelOrderMutation,
      cancelOrderTarget?.id,
      confirmReceivedMutation,
      openCancelOrderModal,
      openCancelRefundModal,
      openReviewModal,
      repayOrderMutation,
    ]
  )

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={4} className="!mb-1">
            Đơn hàng của tôi
          </Typography.Title>
          <Typography.Text type="secondary">
            Theo dõi tiến trình xử lý và lịch sử mua hàng của bạn.
          </Typography.Text>
        </div>

        <Select
          value={status}
          className="w-full md:w-52"
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
            setStatus(value as OrderStatus | 'all')
            setPage(1)
          }}
        />
      </div>

      {ordersQuery.isLoading ? (
        <div className="py-10 text-center">
          <Spin />
        </div>
      ) : null}

      <Table
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={ordersQuery.data?.items ?? []}
        loading={ordersQuery.isFetching}
        pagination={{
          current: page,
          pageSize: ORDER_PAGE_SIZE,
          total: ordersQuery.data?.totalItems ?? 0,
          showSizeChanger: false,
          onChange: (nextPage) => {
            setPage(nextPage)
          },
        }}
        expandable={{
          expandedRowKeys: expandedOrderIds,
          onExpand: (expanded, record) => {
            setExpandedOrderIds((current) => {
              if (expanded) {
                if (current.includes(record.id)) {
                  return current
                }

                return [...current, record.id]
              }

              return current.filter((id) => id !== record.id)
            })
          },
          expandedRowRender: (record) => renderOrderDetailContent(record),
        }}
      />

      <Modal
        open={detailModalOpen}
        title={`Chi tiết đơn hàng${detailOrder ? ` · ${detailOrder.orderCode}` : ''}`}
        footer={[
          detailOrder && canRetryVnpay(detailOrder) ? (
            <Button
              key="repay"
              type="primary"
              loading={repayOrderMutation.isPending}
              onClick={() => {
                repayOrderMutation.mutate(detailOrder.id)
              }}
            >
              Thanh toán lại
            </Button>
          ) : null,
          <Button
            key="close"
            onClick={() => {
              setDetailModalOpen(false)
              setDetailOrder(null)
            }}
          >
            Đóng
          </Button>,
        ]}
        width={880}
        onCancel={() => {
          setDetailModalOpen(false)
          setDetailOrder(null)
        }}
      >
        {detailOrder ? renderOrderDetailContent(detailOrder, true) : null}
      </Modal>

      <Modal
        open={cancelOrderModalOpen}
        title={`Hủy đơn hàng${cancelOrderTarget ? ` · ${cancelOrderTarget.orderCode}` : ''}`}
        okText="Xác nhận hủy"
        cancelText="Đóng"
        confirmLoading={cancelOrderMutation.isPending}
        onCancel={() => {
          setCancelOrderModalOpen(false)
          setCancelOrderTarget(null)
          cancelOrderForm.resetFields()
        }}
        onOk={() => {
          if (!cancelOrderTarget) {
            return
          }

          cancelOrderForm
            .validateFields()
            .then((values) => {
              cancelOrderMutation.mutate({
                orderId: cancelOrderTarget.id,
                body: {
                  note: values.note.trim(),
                },
              })
            })
            .catch(() => undefined)
        }}
      >
        <Space direction="vertical" size={16} className="w-full">
          {cancelOrderTarget ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <Typography.Text strong className="block text-slate-900">
                {cancelOrderTarget.orderCode}
              </Typography.Text>
              <Typography.Text className="block">
                Tổng tiền: {formatVndCurrency(cancelOrderTarget.totalAmount)}
              </Typography.Text>
              {cancelOrderTarget.paymentStatus === 'paid' &&
              cancelOrderTarget.paymentMethod !== 'cod' ? (
                <Typography.Text type="secondary" className="mt-1 block text-xs">
                  Sau khi hủy đơn, bạn có thể gửi yêu cầu hoàn tiền và cung cấp thông tin tài khoản
                  ngân hàng.
                </Typography.Text>
              ) : null}
            </div>
          ) : null}

          <Form<CancelMyOrderPayload> form={cancelOrderForm} layout="vertical">
            <Form.Item
              label="Lý do hủy đơn"
              name="note"
              rules={[
                { required: true, message: 'Vui lòng nhập lý do hủy đơn' },
                { max: 255, message: 'Lý do hủy tối đa 255 ký tự' },
              ]}
            >
              <Input.TextArea
                rows={4}
                maxLength={255}
                showCount
                placeholder="Ví dụ: tôi muốn đổi địa chỉ nhận hàng, đặt nhầm sản phẩm hoặc cần đổi phương thức thanh toán"
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        open={cancelRefundModalOpen}
        title={`Yêu cầu hoàn tiền${cancelRefundOrder ? ` · ${cancelRefundOrder.orderCode}` : ''}`}
        okText="Gửi yêu cầu"
        cancelText="Đóng"
        confirmLoading={cancelRefundRequestMutation.isPending}
        onCancel={() => {
          setCancelRefundModalOpen(false)
          setCancelRefundOrder(null)
          cancelRefundForm.resetFields()
        }}
        onOk={() => {
          if (!cancelRefundOrder) {
            return
          }

          cancelRefundForm
            .validateFields()
            .then((values) => {
              const bank = getVietQrBankByCode(values.bankCode)

              if (!bank) {
                void message.error('Vui lòng chọn ngân hàng hợp lệ')
                return
              }

              cancelRefundRequestMutation.mutate({
                orderId: cancelRefundOrder.id,
                body: {
                  bankCode: bank.code,
                  bankName: bank.name,
                  accountNumber: values.accountNumber.trim(),
                  accountHolder: values.accountHolder.trim(),
                  note: values.note?.trim() || undefined,
                },
              })
            })
            .catch(() => undefined)
        }}
      >
        <Space direction="vertical" size={16} className="w-full">
          {cancelRefundOrder ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <Typography.Text strong className="block text-slate-900">
                {cancelRefundOrder.orderCode}
              </Typography.Text>
              <Typography.Text className="block">
                Số tiền cần hoàn: {formatVndCurrency(cancelRefundOrder.totalAmount)}
              </Typography.Text>
              <Typography.Text type="secondary" className="block text-xs">
                Sau khi gửi yêu cầu, nhân viên sẽ chuyển khoản và cập nhật bill hoàn tiền cho bạn.
              </Typography.Text>
            </div>
          ) : null}

          <Form<CreateCancelRefundRequestPayload> form={cancelRefundForm} layout="vertical">
            <Form.Item
              label="Ngân hàng"
              name="bankCode"
              rules={[{ required: true, message: 'Vui lòng chọn ngân hàng' }]}
            >
              <Select
                showSearch
                placeholder="Chọn ngân hàng nhận tiền"
                optionFilterProp="label"
                options={VIET_QR_BANK_OPTIONS.map((bank) => ({
                  label: bank.name,
                  value: bank.code,
                }))}
              />
            </Form.Item>

            <Form.Item
              label="Số tài khoản"
              name="accountNumber"
              rules={[{ required: true, message: 'Vui lòng nhập số tài khoản' }]}
            >
              <Input placeholder="Nhập số tài khoản nhận hoàn tiền" />
            </Form.Item>

            <Form.Item
              label="Chủ tài khoản"
              name="accountHolder"
              rules={[{ required: true, message: 'Vui lòng nhập tên chủ tài khoản' }]}
            >
              <Input placeholder="Nhập họ tên chủ tài khoản" />
            </Form.Item>

            <Form.Item label="Ghi chú" name="note">
              <Input.TextArea rows={3} placeholder="Ví dụ: hoàn tiền vào tài khoản chính của tôi" />
            </Form.Item>
          </Form>

          {selectedCancelRefundBankCode ? (
            <Typography.Text type="secondary" className="text-xs">
              Ngân hàng đã chọn:{' '}
              {getVietQrBankByCode(selectedCancelRefundBankCode)?.name ??
                selectedCancelRefundBankCode}
            </Typography.Text>
          ) : null}
        </Space>
      </Modal>

      <Modal
        open={reviewModalOpen}
        title={`Đánh giá sản phẩm${reviewOrder ? ` · ${reviewOrder.orderCode}` : ''}`}
        okText="Gửi đánh giá"
        cancelText="Đóng"
        confirmLoading={createReviewMutation.isPending}
        onCancel={() => {
          setReviewModalOpen(false)
          setReviewOrder(null)
          setSelectedReviewProductId(null)
          setReviewRating(0)
          setReviewContent('')
        }}
        onOk={() => {
          if (!reviewOrder || !selectedReviewItem) {
            void message.error('Vui lòng chọn sản phẩm cần đánh giá')
            return
          }

          if (selectedReviewItem.isReviewed) {
            void message.warning('Sản phẩm này đã được đánh giá trước đó')
            return
          }

          if (reviewRating < 1) {
            void message.error('Vui lòng chọn số sao đánh giá')
            return
          }

          createReviewMutation.mutate({
            orderId: reviewOrder.id,
            productId: selectedReviewItem.productId,
            rating: reviewRating,
            content: reviewContent.trim() || undefined,
          })
        }}
      >
        {!reviewOrder ? null : (
          <Space direction="vertical" size={16} className="w-full">
            <Typography.Text type="secondary">
              Chỉ có thể đánh giá các sản phẩm trong đơn đã hoàn thành. Mỗi sản phẩm chỉ được đánh
              giá một lần cho mỗi đơn hàng.
            </Typography.Text>

            <List
              dataSource={reviewOrder.items}
              locale={{ emptyText: 'Không có sản phẩm' }}
              renderItem={(item) => {
                const isSelected = item.productId === selectedReviewProductId

                return (
                  <List.Item>
                    <button
                      type="button"
                      disabled={item.isReviewed}
                      onClick={() => {
                        if (!item.isReviewed) {
                          setSelectedReviewProductId(item.productId)
                        }
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        item.isReviewed
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                          : isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                        <img
                          src={item.productImage ?? ITEM_PLACEHOLDER}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Space size={8} wrap className="mb-1">
                          <Typography.Text strong className="block line-clamp-1">
                            {item.productName}
                          </Typography.Text>
                          <Tag color={item.isReviewed ? 'green' : isSelected ? 'blue' : 'default'}>
                            {item.isReviewed
                              ? 'Đã đánh giá'
                              : isSelected
                                ? 'Đang chọn'
                                : 'Chưa đánh giá'}
                          </Tag>
                        </Space>
                        <Typography.Text type="secondary" className="text-xs">
                          SKU: {item.variantSku} · Màu: {item.variantColor}
                        </Typography.Text>
                      </div>
                    </button>
                  </List.Item>
                )
              }}
            />

            {pendingReviewItems.length === 0 ? (
              <Typography.Text type="secondary">
                Tất cả sản phẩm trong đơn này đã được đánh giá.
              </Typography.Text>
            ) : (
              <Space direction="vertical" size={8} className="w-full">
                <Typography.Text strong>
                  {selectedReviewItem
                    ? `Đánh giá cho ${selectedReviewItem.productName}`
                    : 'Chọn sản phẩm để đánh giá'}
                </Typography.Text>
                <Rate value={reviewRating} onChange={setReviewRating} />
                <Input.TextArea
                  rows={4}
                  placeholder="Chia sẻ cảm nhận của bạn về sản phẩm"
                  value={reviewContent}
                  onChange={(event) => setReviewContent(event.target.value)}
                />
              </Space>
            )}
          </Space>
        )}
      </Modal>
    </Card>
  )
}
