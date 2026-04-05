import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Card, message, Result, Space, Spin, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  retryMyVnpayPayment,
  verifyVnpayReturn,
  verifyZalopayRedirect,
} from '@/features/account/api/account.api'
import { queryKeys } from '@/shared/api/queryKeys'
import { ROUTE_PATHS } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'

const ZALOPAY_POLLING_INTERVAL_MS = 5000
const ZALOPAY_POLLING_TIMEOUT_MS = 60000

export const PaymentSuccessPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const notifiedSuccessKeyRef = useRef<string | null>(null)
  const notifiedErrorKeyRef = useRef<string | null>(null)
  const [slowVerificationKey, setSlowVerificationKey] = useState<string | null>(null)

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
  const hasPaymentReturnData = hasVnpReturnData || hasZalopayReturnData
  const paymentReturnKey = searchParams.toString()

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
    refetchInterval: (query) => {
      const data = query.state.data

      if (!data) {
        return false
      }

      return data.order.status === 'awaiting_payment' && data.order.paymentStatus === 'pending'
        ? ZALOPAY_POLLING_INTERVAL_MS
        : false
    },
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
  const isVerifyingPayment =
    hasPaymentReturnData && !verifyResult && (activeQuery.isPending || activeQuery.fetchStatus === 'fetching')
  const activeVerificationKey = isVerifyingPayment
    ? `${activeGateway}:${searchParams.toString()}`
    : null
  const order = verifyResult?.order
  const isPaymentSuccess = verifyResult?.isSuccess ?? false
  const isAwaitingPayment = order?.status === 'awaiting_payment'
  const isWaitingForPaymentConfirmation = isAwaitingPayment && order?.paymentStatus === 'pending'
  const canRetryPayment =
    isAwaitingPayment && (order?.paymentStatus === 'pending' || order?.paymentStatus === 'failed')
  const isVerificationSlow =
    activeVerificationKey !== null && slowVerificationKey === activeVerificationKey
  const isZalopayProcessingTimeout =
    activeGateway === 'zalopay' &&
    hasZalopayReturnData &&
    verifyResult?.order.status === 'awaiting_payment' &&
    verifyResult.order.paymentStatus === 'pending' &&
    slowVerificationKey === `zalopay-processing:${paymentReturnKey}`

  useEffect(() => {
    if (!activeVerificationKey) {
      return
    }

    const timer = window.setTimeout(() => {
      setSlowVerificationKey(activeVerificationKey)
    }, 12000)

    return () => window.clearTimeout(timer)
  }, [activeVerificationKey])

  useEffect(() => {
    if (
      activeGateway !== 'zalopay' ||
      !hasZalopayReturnData ||
      verifyResult?.order.status !== 'awaiting_payment' ||
      verifyResult.order.paymentStatus !== 'pending'
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setSlowVerificationKey(`zalopay-processing:${paymentReturnKey}`)
    }, ZALOPAY_POLLING_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [activeGateway, hasZalopayReturnData, paymentReturnKey, verifyResult])

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

  if (!hasPaymentReturnData) {
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

  if (isVerificationSlow) {
    return (
      <Card className="mx-auto mt-8 max-w-2xl">
        <Result
          status="warning"
          title="Giao dịch đang được xử lý"
          subTitle="Cổng thanh toán đang phản hồi chậm. Bạn có thể tải lại trang hoặc vào đơn hàng của tôi để kiểm tra trạng thái mới nhất."
          extra={[
            <Button
              key="reload"
              type="primary"
              onClick={() => {
                window.location.reload()
              }}
            >
              Tải lại trang
            </Button>,
            <Button
              key="orders"
              onClick={() => {
                navigate(ROUTE_PATHS.ACCOUNT_ORDERS)
              }}
            >
              Đơn hàng của tôi
            </Button>,
          ]}
        />
      </Card>
    )
  }

  if (isZalopayProcessingTimeout) {
    return (
      <Card className="mx-auto mt-8 max-w-2xl">
        <Result
          status="warning"
          title="ZaloPay vẫn đang xác nhận giao dịch"
          subTitle="Đơn hàng đã quay về trạng thái chờ thanh toán quá lâu. Bạn có thể kiểm tra lại ngay hoặc vào đơn hàng của tôi để thanh toán lại nếu giao dịch đã hết hạn."
          extra={[
            <Button
              key="recheck"
              type="primary"
              loading={verifyZalopayQuery.isRefetching}
              onClick={() => {
                void verifyZalopayQuery.refetch()
              }}
            >
              Kiểm tra lại ngay
            </Button>,
            <Button
              key="orders"
              onClick={() => {
                navigate(ROUTE_PATHS.ACCOUNT_ORDERS)
              }}
            >
              Đơn hàng của tôi
            </Button>,
          ]}
        />
      </Card>
    )
  }

  if (isVerifyingPayment) {
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
              ? activeGateway === 'zalopay'
                ? 'ZaloPay đang xác nhận giao dịch'
                : 'Đơn hàng đang chờ thanh toán'
              : activeGateway === 'zalopay'
                ? 'Thanh toán ZaloPay thất bại'
                : 'Thanh toán VNPay thất bại'
        }
        subTitle={
          isWaitingForPaymentConfirmation && activeGateway === 'zalopay'
            ? `Đơn hàng ${order.orderCode} đang được đồng bộ trạng thái từ ZaloPay. Trang sẽ tự kiểm tra lại sau mỗi vài giây.`
            : `Đơn hàng ${order.orderCode} - ${formatVndCurrency(order.totalAmount)}`
        }
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
