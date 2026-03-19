import { useMutation } from '@tanstack/react-query'
import { Button, Card, message, Result, Space, Spin, Typography } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { verifyVnpayReturn } from '@/features/account/api/account.api'
import { ROUTE_PATHS } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'

export const PaymentSuccessPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hasRequestedVerification = useRef(false)

  const verifyMutation = useMutation({
    mutationFn: verifyVnpayReturn,
    onSuccess: (data) => {
      void message.success(data.isSuccess ? 'Thanh toán thành công' : 'Thanh toán chưa thành công')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const vnpPayload = useMemo(() => {
    const payload: Record<string, string> = {}

    searchParams.forEach((value, key) => {
      if (key.startsWith('vnp_')) {
        payload[key] = value
      }
    })

    return payload
    }, [searchParams])

    const hasVnpReturnData =
    Boolean(vnpPayload.vnp_TxnRef) &&
    Boolean(vnpPayload.vnp_SecureHash) &&
    Boolean(vnpPayload.vnp_ResponseCode)

  useEffect(() => {
    if (!hasVnpReturnData || hasRequestedVerification.current) {
      return
    }

    hasRequestedVerification.current = true
    verifyMutation.mutate(vnpPayload)
  }, [hasVnpReturnData, verifyMutation, vnpPayload])

  if (!hasVnpReturnData) {
    return (
        <Card className="mx-auto mt-8 max-w-2xl">
        <Result
          status="warning"
          title="Không có dữ liệu thanh toán"
          subTitle="Liên kết thanh toán không hợp lệ hoặc đã hết hạn."
          extra={
            <Button type="primary" onClick={() => navigate(ROUTE_PATHS.ACCOUNT_ORDERS)}>
              Đến đơn hàng của tôi
            </Button>
            }
        />
        </Card>
    )
    }

    if (verifyMutation.isPending || verifyMutation.isIdle) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Space direction="vertical" align="center">
          <Spin size="large" />
          <Typography.Text type="secondary">Đang xác thực giao dịch VNPay...</Typography.Text>
        </Space>
      </div>
    )
  }

  if (verifyMutation.isError) {
    return (
      <Card className="mx-auto mt-8 max-w-2xl">
        <Result
            status="error"
            title="Không xác thực được giao dịch VNPay"
          subTitle="Vui lòng kiểm tra lại đơn hàng của bạn và thử thanh toán lại nếu cần."
          extra={
            <Button type="primary" onClick={() => navigate(ROUTE_PATHS.ACCOUNT_ORDERS)}>
              Đơn hàng của tôi
            </Button>
            }
        />
        </Card>
    )
    }

    const verifyResult = verifyMutation.data
  const order = verifyResult.order
  const isPaymentSuccess = verifyResult.isSuccess

  return (
    <Card className="mx-auto mt-8 max-w-2xl">
      <Result
        status={isPaymentSuccess ? 'success' : 'error'}
        title={isPaymentSuccess ? 'Thanh toán VNPay thành công' : 'Thanh toán VNPay thất bại'}
        subTitle={`Đơn hàng ${order.orderCode} - ${formatVndCurrency(order.totalAmount)}`}
        extra={[
          <Button
            key="orders"
            type="primary"
            onClick={() => {
                navigate(ROUTE_PATHS.ACCOUNT_ORDERS)
            }}
            >
            Đến đơn hàng của tôi
          </Button>,
        <Button
            key="home"
            onClick={() => {
                navigate(ROUTE_PATHS.ROOT)
            }}
            >
            Về trang chủ
          </Button>,
        ]}
        />
    </Card>
    )
}