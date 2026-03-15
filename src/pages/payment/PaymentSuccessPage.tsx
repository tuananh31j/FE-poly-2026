import { useMutation } from '@tanstack/react-query'
import { Button, Card, message, Result, Space, Spin, Typography } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { verifyVnpayReturn, verifyZalopayRedirect } from '@/features/account/api/account.api'
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

  const verifyZalopayMutation = useMutation({
    mutationFn: verifyZalopayRedirect,
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

  useEffect(() => {
    if ((hasVnpReturnData || hasZalopayReturnData) && hasRequestedVerification.current) {
      return
    }

    if (!hasVnpReturnData && !hasZalopayReturnData) {
      return
    }

    hasRequestedVerification.current = true
    if (hasVnpReturnData) {
      verifyMutation.mutate(vnpPayload)
      return
    }

    if (hasZalopayReturnData && zalopayPayload) {
      verifyZalopayMutation.mutate(zalopayPayload)
    }
  }, [
    hasVnpReturnData,
    hasZalopayReturnData,
    verifyMutation,
    verifyZalopayMutation,
    vnpPayload,
    zalopayPayload,
  ])

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

  const activeGateway = hasVnpReturnData ? 'vnpay' : hasZalopayReturnData ? 'zalopay' : null
  const isVerifying =
    activeGateway === 'vnpay'
      ? verifyMutation.isPending || verifyMutation.isIdle
      : verifyZalopayMutation.isPending || verifyZalopayMutation.isIdle

  if (isVerifying) {
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

  const isVerifyError =
    activeGateway === 'vnpay' ? verifyMutation.isError : verifyZalopayMutation.isError

  if (isVerifyError) {
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

  const verifyResult =
    activeGateway === 'zalopay' ? verifyZalopayMutation.data : verifyMutation.data

  if (!verifyResult) {
    return null
  }
  const order = verifyResult.order
  const isPaymentSuccess = verifyResult.isSuccess

  return (
    <Card className="mx-auto mt-8 max-w-2xl">
      <Result
        status={isPaymentSuccess ? 'success' : 'error'}
        title={
          isPaymentSuccess
            ? activeGateway === 'zalopay'
              ? 'Thanh toán ZaloPay thành công'
              : 'Thanh toán VNPay thành công'
            : activeGateway === 'zalopay'
              ? 'Thanh toán ZaloPay thất bại'
              : 'Thanh toán VNPay thất bại'
        }
        subTitle={`Đơn hàng ${order.orderCode} - ${formatVndCurrency(order.totalAmount)}`}
        extra={[
          <Button
            key="orders"
            type="primary"
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
