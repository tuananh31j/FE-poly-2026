import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Card, message, Result, Space, Spin, Typography } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  retryMyVnpayPayment,
  verifyVnpayReturn,
  verifyZalopayRedirect,
} from '@/features/account/api/account.api'
import { queryKeys } from '@/shared/api/queryKeys'
import { ROUTE_PATHS } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'

export const PaymentSuccessPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const notifiedSuccessKeyRef = useRef<string | null>(null)
  const notifiedErrorKeyRef = useRef<string | null>(null)

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

  const zalopayPayload = useMemo(() => {
    const payload: Record<string, string> = {}

    searchParams.forEach((value, key) => {
      if (
        key === 'appid' ||
        key === 'apptransid' ||
        key === 'pmcid' ||
        key === 'bankcode' ||
        key === 'amount' ||
        key === 'discountamount' ||
        key === 'status' ||
        key === 'checksum'
      ) {
        payload[key] = value
      }
    })

    if (!payload.appid || !payload.apptransid || !payload.checksum) {
      return null
    }

    return {
      appid: payload.appid,
      apptransid: payload.apptransid,
      pmcid: payload.pmcid,
      bankcode: payload.bankcode,
      amount: payload.amount,
      discountamount: payload.discountamount,
      status: payload.status,
      checksum: payload.checksum,
    }
  }, [searchParams])

  const hasZalopayReturnData = Boolean(zalopayPayload)

  const verifyVnpayQuery = useQuery({
    queryKey: queryKeys.account.paymentVerification('vnpay', vnpPayload),
    queryFn: () => verifyVnpayReturn(vnpPayload),
    enabled: hasVnpReturnData,
    retry: false,
  })

  const verifyZalopayQuery = useQuery({
    queryKey: queryKeys.account.paymentVerification(
      'zalopay',
      (zalopayPayload ?? {}) as Record<string, unknown>
    ),
    queryFn: () => verifyZalopayRedirect(zalopayPayload!),
    enabled: hasZalopayReturnData && Boolean(zalopayPayload),
    retry: false,
  })

  const retryPaymentMutation = useMutation({
    mutationFn: (orderId: string) => retryMyVnpayPayment(orderId),
    onSuccess: (nextOrder) => {
      if (nextOrder.paymentUrl) {
        window.location.assign(nextOrder.paymentUrl)
        return
      }

      void message.warning('Không tạo được liên kết thanh toán')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const activeGateway = hasVnpReturnData ? 'vnpay' : 'zalopay'
  const activeQuery = activeGateway === 'vnpay' ? verifyVnpayQuery : verifyZalopayQuery
  const verifyResult = activeQuery.data
  const order = verifyResult?.order
  const isPaymentSuccess = verifyResult?.isSuccess ?? false
  const isAwaitingPayment = order?.status === 'awaiting_payment'
  const isWaitingForPaymentConfirmation = isAwaitingPayment && order?.paymentStatus === 'pending'
  const canRetryPayment =
    isAwaitingPayment && (order?.paymentStatus === 'pending' || order?.paymentStatus === 'failed')

  useEffect(() => {
    if (!verifyResult) {
      return
    }

    const notificationKey = `${activeGateway}:${verifyResult.order.id}:${verifyResult.responseCode}`

    if (notifiedSuccessKeyRef.current === notificationKey) {
      return
    }

    notifiedSuccessKeyRef.current = notificationKey
    void message.info(
      verifyResult.isSuccess
        ? 'Thanh toán thành công'
        : verifyResult.order.status === 'awaiting_payment' &&
            verifyResult.order.paymentStatus === 'pending'
          ? 'Đơn hàng đang chờ thanh toán'
          : 'Thanh toán chưa thành công'
    )
  }, [activeGateway, verifyResult])

  useEffect(() => {
    if (!activeQuery.error) {
      return
    }

    const errorKey = `${activeGateway}:${activeQuery.error.message}`

    if (notifiedErrorKeyRef.current === errorKey) {
      return
    }

    notifiedErrorKeyRef.current = errorKey
    void message.error(activeQuery.error.message)
  }, [activeGateway, activeQuery.error])

  useEffect(() => {
    if (!isPaymentSuccess || !order?.id) {
      return
    }

    const timer = window.setTimeout(() => {
      navigate(`${ROUTE_PATHS.ACCOUNT_ORDERS}?orderId=${order.id}`)
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [isPaymentSuccess, navigate, order?.id])

  if (!hasVnpReturnData && !hasZalopayReturnData) {
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

  if (activeQuery.isPending || activeQuery.fetchStatus === 'fetching') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Space direction="vertical" align="center">
          <Spin size="large" />
          <Typography.Text type="secondary">
            {activeGateway === 'zalopay'
              ? 'Đang xác thực giao dịch ZaloPay...'
              : 'Đang xác thực giao dịch VNPay...'}
          </Typography.Text>
        </Space>
      </div>
    )
  }

  if (activeQuery.isError) {
    return (
      <Card className="mx-auto mt-8 max-w-2xl">
        <Result
          status="error"
          title={
            activeGateway === 'zalopay'
              ? 'Không xác thực được giao dịch ZaloPay'
              : 'Không xác thực được giao dịch VNPay'
          }
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

  if (!verifyResult || !order) {
    return (
      <Card className="mx-auto mt-8 max-w-2xl">
        <Result
          status="warning"
          title="Không nhận được kết quả xác thực thanh toán"
          subTitle="Giao dịch có thể đã được xử lý nhưng trang trả về không lấy được phản hồi cuối cùng."
          extra={
            <Button type="primary" onClick={() => navigate(ROUTE_PATHS.ACCOUNT_ORDERS)}>
              Đơn hàng của tôi
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <Card className="mx-auto mt-8 max-w-2xl">
      <Result
        status={
          isPaymentSuccess ? 'success' : isWaitingForPaymentConfirmation ? 'warning' : 'error'
        }
        title={
          isPaymentSuccess
            ? activeGateway === 'zalopay'
              ? 'Thanh toán ZaloPay thành công'
              : 'Thanh toán VNPay thành công'
            : isWaitingForPaymentConfirmation
              ? 'Đơn hàng đang chờ thanh toán'
              : activeGateway === 'zalopay'
                ? 'Thanh toán ZaloPay thất bại'
                : 'Thanh toán VNPay thất bại'
        }
        subTitle={`Đơn hàng ${order.orderCode} - ${formatVndCurrency(order.totalAmount)}`}
        extra={[
          canRetryPayment ? (
            <Button
              key="repay"
              type="primary"
              loading={retryPaymentMutation.isPending}
              onClick={() => {
                retryPaymentMutation.mutate(order.id)
              }}
            >
              Thanh toán lại
            </Button>
          ) : null,
          <Button
            key="orders"
            type={canRetryPayment ? 'default' : 'primary'}
            onClick={() => {
              navigate(ROUTE_PATHS.ACCOUNT_ORDERS)
            }}
          >
            Đơn hàng của tôi
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
