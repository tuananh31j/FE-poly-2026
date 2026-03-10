import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, List, message, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'

import { cancelMyOrder, listMyOrders, retryMyVnpayPayment } from '@/features/account/api/account.api'
import type { MyOrderItem, OrderStatus } from '@/features/account/model/account.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const ORDER_PAGE_SIZE = 8
const ITEM_PLACEHOLDER = '/images/product-placeholder.svg'

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang chuẩn bị',
    shipping: 'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
    returned: 'Hoàn trả',
}

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
    pending: 'gold',
    confirmed: 'blue',
    preparing: 'geekblue',
    shipping: 'cyan',
    delivered: 'green',
    cancelled: 'red',
    returned: 'volcano'
}

const PAYMENT_METHOD_LABEL: Record<MyOrderItem['paymentMethod'], string> = {
    cod: 'COD',
    banking: 'Chuyển khoản',
    momo: 'MoMo',
    vnpay: 'VNPay',
}

const PAYMENT_STATUS_LABEL: Record<MyOrderItem['paymentStatus'], string> = {
    pending: 'Chờ thanh toán',
    paid: 'Đã thanh toán',
    failed: 'Thất bại',
    refunded: 'Hoàn tiền',
}

const canCancelOrder = (status: OrderStatus) => {
    return status === 'pending'
}

const canRetryVnpay = (order: MyOrderItem) => {
    return (
        order.paymentMethod === 'vnpay' &&
        order.status === 'pending' &&
        (order.paymentStatus === 'pending' || order.paymentStatus === 'failed')
    )
}

export const MyOrdersPage = () => {
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState<OrderStatus | 'all'>('all')

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
                render: (value: string) => <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>,
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
                title: 'Tổng tiền',
                dataIndex: 'totalAmount',
                key: 'totalAmount',
                width: 160,
                render: (value: number) => <Typography.Text strong>{formatVndCurrency(value)}</Typography.Text>,
            },
            {
                title: 'Trạng thái',
                dataIndex: 'status',
                key: 'status',
                width: 150,
                render: (value: OrderStatus) => <Tag color={ORDER_STATUS_COLOR[value]}>{ORDER_STATUS_LABEL[value]}</Tag>,
            },
            {
            title: 'Hành động',
            key: 'actions',
            width: 230,
            render: (_, record) => {
                const allowCancel = canCancelOrder(record.status)
                const allowRetryVnpay = canRetryVnpay(record)

                if (!allowCancel && !allowRetryVnpay) {
                    return <Typography.Text type="secondary">-</Typography.Text>
                }

                return (
                    <Space>
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

                        {allowCancel ? (
                        <Popconfirm
                        title="Bạn muốn hủy đơn hàng này?"
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
                    </Space>
                )
            },
        },
    ],
    [cancelOrderMutation, repayOrderMutation]
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
                    { label: ORDER_STATUS_LABEL.preparing, value: 'preparing' },
                    { label: ORDER_STATUS_LABEL.shipping, value: 'shipping' },
                    { label: ORDER_STATUS_LABEL.delivered, value: 'delivered' },
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
                expandedRowRender: (record) => (
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
                ),
            }}
        />
    </Card>
  )
}