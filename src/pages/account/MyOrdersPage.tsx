import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
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
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  cancelMyOrder,
  confirmOrderReceived,
  createCancelRefundRequest,
  createMyReview,
  createReturnRequest,
  listMyOrders,
  retryMyVnpayPayment,
} from '@/features/account/api/account.api'
import type {
  CancelRefundRequestStatus,
  CreateCancelRefundRequestPayload,
  CreateReturnRequestPayload,
  MyOrderItem,
  OrderStatus,
  RefundMethod,
} from '@/features/account/model/account.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { getVietQrBankByCode, VIET_QR_BANK_OPTIONS } from '@/shared/constants/vietqr'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const ORDER_PAGE_SIZE = 8
const ITEM_PLACEHOLDER = '/images/product-placeholder.svg'

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  returned: 'Hoàn trả',
}

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
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

  return 'ZaloPay - Cổng chung'
}

const PAYMENT_STATUS_LABEL: Record<MyOrderItem['paymentStatus'], string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Hoàn tiền',
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
  return status === 'pending' || status === 'confirmed'
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
    order.status === 'pending' &&
    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed')
  )
}

const canRequestReturn = (order: MyOrderItem) => {
  if (order.status !== 'completed') {
    return false
  }

  const requestedQuantities = new Map<string, number>()

  for (const request of order.returnRequests ?? []) {
    if (request.status === 'rejected') {
      continue
    }

    for (const item of request.items) {
      requestedQuantities.set(
        item.variantId,
        (requestedQuantities.get(item.variantId) ?? 0) + item.quantity
      )
    }
  }

  return order.items.some(
    (item) => item.quantity - (requestedQuantities.get(item.variantId) ?? 0) > 0
  )
}

const getReturnableQuantity = (
  order: MyOrderItem,
  variantId: string,
  purchasedQuantity: number
) => {
  const requestedQuantity = (order.returnRequests ?? [])
    .filter((request) => request.status !== 'rejected')
    .flatMap((request) => request.items)
    .filter((item) => item.variantId === variantId)
    .reduce((sum, item) => sum + item.quantity, 0)

  return Math.max(0, purchasedQuantity - requestedQuantity)
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

// worklog: 2026-03-04 12:32:16 | trantu | refactor | MyOrdersPage
// worklog: 2026-03-04 14:54:15 | ducanh | refactor | MyOrdersPage
// worklog: 2026-03-04 10:16:25 | quochuy | cleanup | MyOrdersPage
// worklog: 2026-03-04 20:41:46 | quochuy | fix | MyOrdersPage
export const MyOrdersPage = () => {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
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
  const [cancelRefundModalOpen, setCancelRefundModalOpen] = useState(false)
  const [cancelRefundOrder, setCancelRefundOrder] = useState<MyOrderItem | null>(null)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState<MyOrderItem | null>(null)
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('bank_transfer')
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
    mutationFn: (orderId: string) => cancelMyOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.orders(),
      })
      void message.success('Đã hủy đơn hàng')
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

      void message.warning('Không tạo được liên kết thanh toán VNPay')
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

  const returnRequestMutation = useMutation({
    mutationFn: (payload: { orderId: string; body: CreateReturnRequestPayload }) =>
      createReturnRequest(payload.orderId, payload.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.orders(),
      })
      void message.success('Đã gửi yêu cầu hoàn hàng')
      setReturnModalOpen(false)
      setReturnOrder(null)
      setReturnQuantities({})
      setReturnReason('')
      setRefundMethod('bank_transfer')
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

    setExpandedOrderIds((current) =>
      current.includes(focusOrderId) ? current : [...current, focusOrderId]
    )
    setDetailOrder(focusedOrder)
    setDetailModalOpen(true)
    setHasHandledFocusOrder(true)
  }, [focusOrderId, hasHandledFocusOrder, ordersQuery.data?.items])

  const openCancelRefundModal = (order: MyOrderItem) => {
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
  }

  const openReviewModal = (order: MyOrderItem) => {
    const firstPendingReviewItem = order.items.find((item) => !item.isReviewed)

    setReviewOrder(order)
    setSelectedReviewProductId(
      firstPendingReviewItem?.productId ?? order.items[0]?.productId ?? null
    )
    setReviewRating(0)
    setReviewContent('')
    setReviewModalOpen(true)
  }

  const openReturnModal = (order: MyOrderItem) => {
    const initialQuantities: Record<string, number> = {}

    order.items.forEach((item) => {
      const returnableQuantity = getReturnableQuantity(order, item.variantId, item.quantity)
      initialQuantities[item.variantId] = returnableQuantity > 0 ? 1 : 0
    })

    setReturnOrder(order)
    setReturnModalOpen(true)
    setReturnQuantities(initialQuantities)
    setReturnReason('')
    setRefundMethod('bank_transfer')
  }

  const closeReturnModal = () => {
    setReturnModalOpen(false)
    setReturnOrder(null)
    setReturnQuantities({})
    setReturnReason('')
    setRefundMethod('bank_transfer')
  }

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
              key: 'status',
              label: 'Trạng thái đơn',
              children: (
                <Tag color={ORDER_STATUS_COLOR[record.status]}>
                  {ORDER_STATUS_LABEL[record.status]}
                </Tag>
              ),
            },
            {
              key: 'totalAmount',
              label: 'Tổng tiền',
              children: formatVndCurrency(record.totalAmount),
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
          const allowReturn = canRequestReturn(record)
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

              {allowReturn ? (
                <Button
                  size="small"
                  onClick={() => {
                    openReturnModal(record)
                  }}
                >
                  Hoàn hàng
                </Button>
              ) : null}

              {allowCancel ? (
                <Popconfirm
                  title="Bạn muốn hủy đơn hàng này?"
                  description={
                    record.paymentStatus === 'paid' && record.paymentMethod !== 'cod'
                      ? 'Sau khi hủy đơn, bạn có thể gửi yêu cầu hoàn tiền và cung cấp thông tin tài khoản ngân hàng.'
                      : undefined
                  }
                  okText="Hủy đơn"
                  cancelText="Đóng"
                  onConfirm={() => {
                    cancelOrderMutation.mutate(record.id)
                  }}
                >
                  <Button size="small" danger loading={cancelOrderMutation.isPending}>
                    Hủy đơn
                  </Button>
                </Popconfirm>
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
      confirmReceivedMutation,
      expandedOrderIds,
      openCancelRefundModal,
      repayOrderMutation,
      returnRequestMutation,
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
        open={returnModalOpen}
        title={`Yêu cầu hoàn hàng${returnOrder ? ` · ${returnOrder.orderCode}` : ''}`}
        okText="Gửi yêu cầu"
        cancelText="Đóng"
        confirmLoading={returnRequestMutation.isPending}
        onCancel={closeReturnModal}
        onOk={() => {
          if (!returnOrder) {
            return
          }

          const items = returnOrder.items
            .map((item) => ({
              variantId: item.variantId,
              quantity: Math.min(
                returnQuantities[item.variantId] ?? 0,
                getReturnableQuantity(returnOrder, item.variantId, item.quantity)
              ),
            }))
            .filter((item) => item.quantity > 0)

          if (items.length === 0) {
            void message.error('Vui lòng chọn số lượng hoàn hàng')
            return
          }

          returnRequestMutation.mutate({
            orderId: returnOrder.id,
            body: {
              items,
              reason: returnReason.trim() ? returnReason.trim() : undefined,
              refundMethod,
            },
          })
        }}
      >
        {!returnOrder ? null : (
          <Space direction="vertical" size={16} className="w-full">
            <Typography.Text type="secondary">
              Chọn số lượng muốn hoàn cho từng sản phẩm. Hệ thống sẽ khóa các sản phẩm đã gửi yêu
              cầu hoàn trước đó.
            </Typography.Text>

            <List
              dataSource={returnOrder.items}
              locale={{ emptyText: 'Không có sản phẩm' }}
              renderItem={(item) => {
                const maxReturnableQuantity = getReturnableQuantity(
                  returnOrder,
                  item.variantId,
                  item.quantity
                )

                return (
                  <List.Item>
                    <div className="flex w-full items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200">
                        <img
                          src={item.productImage ?? ITEM_PLACEHOLDER}
                          alt={item.productName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Typography.Text strong className="block line-clamp-1">
                          {item.productName}
                        </Typography.Text>
                        <Typography.Text type="secondary" className="text-xs">
                          SKU: {item.variantSku} · Còn có thể hoàn: {maxReturnableQuantity}
                        </Typography.Text>
                      </div>
                      <InputNumber
                        min={0}
                        max={maxReturnableQuantity}
                        disabled={maxReturnableQuantity === 0}
                        value={returnQuantities[item.variantId] ?? 0}
                        onChange={(value) => {
                          setReturnQuantities((current) => ({
                            ...current,
                            [item.variantId]: Number(value ?? 0),
                          }))
                        }}
                      />
                    </div>
                  </List.Item>
                )
              }}
            />

            <Space direction="vertical" size={8} className="w-full">
              <Typography.Text strong>Phương thức hoàn tiền</Typography.Text>
              <Select
                value={refundMethod}
                onChange={(value) => setRefundMethod(value as RefundMethod)}
                options={[
                  { label: 'Chuyển khoản', value: 'bank_transfer' },
                  { label: 'Hoàn vào ví', value: 'wallet' },
                ]}
              />

              <Typography.Text strong>Ghi chú</Typography.Text>
              <Input.TextArea
                rows={3}
                placeholder="Lý do hoàn hàng (tùy chọn)"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
              />
            </Space>
          </Space>
        )}
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
