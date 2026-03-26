import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Popconfirm,
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
  createReturnRequest,
  listMyOrders,
  retryMyVnpayPayment,
} from '@/features/account/api/account.api'
import type {
  CancelRefundRequestStatus,
  CreateCancelRefundRequestPayload,
  MyOrderItem,
  OrderStatus,
  RefundMethod,
} from '@/features/account/model/account.types'
import { queryKeys } from '@/shared/api/queryKeys'
import {
  getVietQrBankByCode,
  VIET_QR_BANK_OPTIONS,
} from '@/shared/constants/vietqr'
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

const canRequestReturn = (status: OrderStatus) => {
  return status === 'completed'
}

const canRetryVnpay = (order: MyOrderItem) => {
  return (
    (order.paymentMethod === 'vnpay' || order.paymentMethod === 'zalopay') &&
    order.status === 'pending' &&
    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed')
  )
}

const canRequestCancelRefund = (order: MyOrderItem) => {
  if (order.status !== 'cancelled' || order.paymentMethod === 'cod' || order.paymentStatus !== 'paid') {
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
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState<MyOrderItem | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('bank_transfer')
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [cancelRefundModalOpen, setCancelRefundModalOpen] = useState(false)
  const [cancelRefundOrder, setCancelRefundOrder] = useState<MyOrderItem | null>(null)
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

  const returnRequestMutation = useMutation({
    mutationFn: (payload: { orderId: string; items: Array<{ variantId: string; quantity: number }>; reason?: string; refundMethod?: RefundMethod }) =>
      createReturnRequest(payload.orderId, {
        items: payload.items,
        reason: payload.reason,
        refundMethod: payload.refundMethod,
      }),
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
    if (!focusOrderId || !ordersQuery.data?.items?.length) {
      return
    }

    const exists = ordersQuery.data.items.some((item) => item.id === focusOrderId)

    if (!exists) {
      return
    }

    setExpandedOrderIds((current) =>
      current.includes(focusOrderId) ? current : [...current, focusOrderId]
    )
  }, [focusOrderId, ordersQuery.data?.items])

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderIds((current) => {
      if (current.includes(orderId)) {
        return current.filter((id) => id !== orderId)
      }

      return [...current, orderId]
    })
  }

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
          const allowReturn = canRequestReturn(record.status)
          const allowCancelRefund = canRequestCancelRefund(record)
          const isExpanded = expandedOrderIds.includes(record.id)

          return (
            <Space wrap>
              <Button
                size="small"
                onClick={() => {
                  toggleOrderDetails(record.id)
                }}
              >
                {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
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

              {allowReturn ? (
                <Button
                  size="small"
                  onClick={() => {
                    setReturnOrder(record)
                    setReturnModalOpen(true)
                    const initialQuantities: Record<string, number> = {}
                    record.items.forEach((item) => {
                      initialQuantities[item.variantId] = 0
                    })
                    setReturnQuantities(initialQuantities)
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
                  {record.cancelRefundRequest?.status === 'rejected' ? 'Gửi lại hoàn tiền' : 'Hoàn tiền'}
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
          expandedRowRender: (record) => (
            <div className="space-y-4">
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
                        <Typography.Text strong className="block line-clamp-1">
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
                    {record.refundedAt ? formatDateTime(record.refundedAt) : formatDateTime(record.updatedAt)}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="mt-1 block text-xs">
                    Hệ thống đã ghi nhận hoàn tiền cho đơn hàng này.


                  </Typography.Text>
                </div>
              ) : null}
            </div>
          ),
        }}
      />

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
              <Input.TextArea
                rows={3}
                placeholder="Ví dụ: hoàn tiền vào tài khoản chính của tôi"
              />
            </Form.Item>
          </Form>

          {selectedCancelRefundBankCode ? (
            <Typography.Text type="secondary" className="text-xs">
              Ngân hàng đã chọn:{' '}
              {getVietQrBankByCode(selectedCancelRefundBankCode)?.name ?? selectedCancelRefundBankCode}
            </Typography.Text>
          ) : null}
        </Space>
      </Modal>

      <Modal
        open={returnModalOpen}
        title={`Yêu cầu hoàn hàng${returnOrder ? ` · ${returnOrder.orderCode}` : ''}`}
        okText="Gửi yêu cầu"
        cancelText="Đóng"
        onCancel={() => {
          setReturnModalOpen(false)
          setReturnOrder(null)
        }}
        onOk={() => {
          if (!returnOrder) {
            return
          }

          const items = returnOrder.items
            .map((item) => ({
              variantId: item.variantId,
              quantity: returnQuantities[item.variantId] ?? 0,
            }))
            .filter((item) => item.quantity > 0)

          if (items.length === 0) {
            void message.error('Vui lòng chọn số lượng hoàn hàng')
            return
          }

          returnRequestMutation.mutate({
            orderId: returnOrder.id,
            items,
            reason: returnReason.trim() ? returnReason.trim() : undefined,
            refundMethod,
          })
        }}
        confirmLoading={returnRequestMutation.isPending}
      >
        {!returnOrder ? null : (
          <Space direction="vertical" size={16} className="w-full">
            <Typography.Text type="secondary">
              Chọn số lượng muốn hoàn cho từng sản phẩm (có thể hoàn một phần).
            </Typography.Text>
            <List
              dataSource={returnOrder.items}
              locale={{ emptyText: 'Không có sản phẩm' }}
              renderItem={(item) => (
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
                        SKU: {item.variantSku}
                      </Typography.Text>
                    </div>
                    <InputNumber
                      min={0}
                      max={item.quantity}
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
              )}
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
              <textarea
                className="w-full rounded-md border border-slate-200 p-2 text-sm"
                rows={3}
                placeholder="Lý do hoàn hàng (tùy chọn)"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
              />
            </Space>
          </Space>
        )}
      </Modal>
    </Card>
  )
}