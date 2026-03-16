import { DeleteOutlined, GiftOutlined, PlusOutlined, StarFilled } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { sumBy } from 'lodash'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import {
  createMyAddress,
  createOrder,
  listAvailableCheckoutVouchers,
  listMyAddresses,
} from '@/features/account/api/account.api'
import type {
  CheckoutVoucherItem,
  UpsertAddressPayload,
} from '@/features/account/model/account.types'
import { getMyCart } from '@/features/cart/api/cart.api'
import { queryKeys } from '@/shared/api/queryKeys'
import { buildProductDetailPath, ROUTE_PATHS } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'

const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

type AddressFormValues = UpsertAddressPayload

const defaultAddressFormValues: AddressFormValues = {
  label: 'Nhà riêng',
  recipientName: '',
  phone: '',
  street: '',
  city: '',
  district: '',
  ward: '',
  isDefault: false,
}

const normalizeVoucherCode = (value: string) => {
  return value.toUpperCase().replace(/\s+/g, '')
}

const resolveVariantIdsFromQuery = (searchParams: URLSearchParams) => {
  const rawValue = searchParams.get('variantIds')

  if (!rawValue?.trim()) {
    return []
  }

  return Array.from(
    new Set(
      rawValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

const getEstimatedTotalAmount = (subtotal: number, discountAmount: number) => {
  return Math.max(0, subtotal - discountAmount)
}

export const CheckoutPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addressForm] = Form.useForm<AddressFormValues>()

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'vnpay'>('cod')
  const [voucherCode, setVoucherCode] = useState('')
  const [manualAddressId, setManualAddressId] = useState<string | null>(null)
  const [createAddressModalOpen, setCreateAddressModalOpen] = useState(false)
  const [voucherModalOpen, setVoucherModalOpen] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)

  const requestedVariantIds = useMemo(
    () => resolveVariantIdsFromQuery(searchParams),
    [searchParams]
  )

  const cartQuery = useQuery({
    queryKey: queryKeys.cart.me,
    queryFn: getMyCart,
  })

  const addressesQuery = useQuery({
    queryKey: queryKeys.account.addresses,
    queryFn: listMyAddresses,
  })

  const selectedCartItems = useMemo(() => {
    const cartItems = cartQuery.data?.items ?? []

    if (requestedVariantIds.length === 0) {
      return cartItems
    }

    const selectedVariantSet = new Set(requestedVariantIds)
    return cartItems.filter((item) => selectedVariantSet.has(item.variantId))
  }, [cartQuery.data?.items, requestedVariantIds])

  const selectedVariantIds = useMemo(
    () => selectedCartItems.map((item) => item.variantId),
    [selectedCartItems]
  )

  const selectedSubtotal = useMemo(() => {
    return sumBy(selectedCartItems, (item) => (item.variant?.price ?? 0) * item.quantity)
  }, [selectedCartItems])

  const selectedAddressId = useMemo(() => {
    const addresses = addressesQuery.data ?? []

    if (manualAddressId && addresses.some((address) => address.id === manualAddressId)) {
      return manualAddressId
    }

    const defaultAddress = addresses.find((item) => item.isDefault) ?? addresses[0]
    return defaultAddress?.id ?? ''
  }, [addressesQuery.data, manualAddressId])

  const cartItems = cartQuery.data?.items ?? []
  const addresses = addressesQuery.data ?? []

  const availableVouchersQuery = useQuery({
    queryKey: queryKeys.account.checkoutVouchers({
      subtotal: selectedSubtotal,
    }),
    queryFn: () => listAvailableCheckoutVouchers(selectedSubtotal),
    enabled: voucherModalOpen || Boolean(voucherCode),
  })

  const selectedVoucher = useMemo(() => {
    const normalizedCode = normalizeVoucherCode(voucherCode)
    return (availableVouchersQuery.data ?? []).find((item) => item.code === normalizedCode)
  }, [availableVouchersQuery.data, voucherCode])

  const sortedAvailableVouchers = useMemo(() => {
    return [...(availableVouchersQuery.data ?? [])].sort((firstVoucher, secondVoucher) => {
      if (secondVoucher.estimatedDiscount !== firstVoucher.estimatedDiscount) {
        return secondVoucher.estimatedDiscount - firstVoucher.estimatedDiscount
      }

      if (secondVoucher.discountValue !== firstVoucher.discountValue) {
        return secondVoucher.discountValue - firstVoucher.discountValue
      }

      return (
        dayjs(firstVoucher.expirationDate).valueOf() - dayjs(secondVoucher.expirationDate).valueOf()
      )
    })
  }, [availableVouchersQuery.data])

  const estimatedDiscount = selectedVoucher?.estimatedDiscount ?? 0
  const estimatedTotalAmount = getEstimatedTotalAmount(selectedSubtotal, estimatedDiscount)

  const createAddressMutation = useMutation({
    mutationFn: createMyAddress,
    onSuccess: async (createdAddress) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.account.addresses,
      })
      setManualAddressId(createdAddress.id)
      setCreateAddressModalOpen(false)
      addressForm.resetFields()
      void message.success('Đã thêm địa chỉ mới')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: async (order) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.cart.me,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.account.orders(),
        }),
      ])

      if (
        order.paymentMethod === 'vnpay' &&
        order.paymentUrl
      ) {
        window.location.assign(order.paymentUrl)
        return
      }

      void message.success('Đặt hàng thành công')
      navigate(ROUTE_PATHS.ACCOUNT_ORDERS)
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const openCreateAddressModal = () => {
    addressForm.setFieldsValue(defaultAddressFormValues)
    setCreateAddressModalOpen(true)
  }

  const handleCreateAddress = (values: AddressFormValues) => {
    createAddressMutation.mutate(values)
  }

  const handleChooseVoucher = (voucher: CheckoutVoucherItem) => {
    setVoucherCode(voucher.code)
    setVoucherModalOpen(false)
  }

  const handlePlaceOrder = () => {
    if (selectedVariantIds.length === 0) {
      void message.warning('Bạn chưa chọn sản phẩm để thanh toán')
      return
    }

    if (!selectedAddressId) {
      void message.warning('Vui lòng thêm địa chỉ nhận hàng trước khi đặt đơn')
      openCreateAddressModal()
      return
    }

    if (!hasAcceptedTerms) {
      void message.warning('Vui lòng đồng ý điều khoản của cửa hàng trước khi đặt hàng')
      setTermsModalOpen(true)
      return
    }

    createOrderMutation.mutate({
      addressId: selectedAddressId,
      paymentMethod,
      voucherCode: normalizeVoucherCode(voucherCode) || undefined,
      selectedVariantIds,
    })
  }

  const voucherCount = sortedAvailableVouchers.length

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            Checkout đơn hàng
          </Typography.Title>
          <Typography.Text type="secondary">
            Xác nhận địa chỉ, voucher và phương thức thanh toán trước khi đặt hàng.
          </Typography.Text>
        </div>

        <Button
          onClick={() => {
            navigate(ROUTE_PATHS.ROOT)
          }}
        >
          Tiếp tục mua sắm
        </Button>
      </div>

      {cartQuery.isLoading ? (
        <Card className="text-center">
          <Spin />
        </Card>
      ) : null}

      {!cartQuery.isLoading && cartItems.length === 0 ? (
        <Card>
          <Empty description="Giỏ hàng đang trống">
            <Button type="primary">
              <Link to={ROUTE_PATHS.PRODUCTS}>Mua sắm ngay</Link>
            </Button>
          </Empty>
        </Card>
      ) : null}

      {!cartQuery.isLoading && cartItems.length > 0 && selectedCartItems.length === 0 ? (
        <Card>
          <Empty description="Không tìm thấy sản phẩm đã chọn trong giỏ hàng">
            <Button type="primary">
              <Link to={ROUTE_PATHS.PRODUCTS}>Quay lại danh sách sản phẩm</Link>
            </Button>
          </Empty>
        </Card>
      ) : null}

      {selectedCartItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card
              title="Địa chỉ nhận hàng"
              extra={
                <Button icon={<PlusOutlined />} onClick={openCreateAddressModal}>
                  Thêm địa chỉ
                </Button>
              }
            >
              {addressesQuery.isLoading ? <Spin /> : null}

              {!addressesQuery.isLoading && addresses.length === 0 ? (
                <Empty description="Bạn chưa có địa chỉ nhận hàng"></Empty>
              ) : null}

              {addresses.length > 0 ? (
                <Radio.Group
                  value={selectedAddressId || undefined}
                  className="w-full"
                  onChange={(event) => {
                    setManualAddressId(String(event.target.value))
                  }}
                >
                  <Space direction="vertical" className="w-full" size={10}>
                    {addresses.map((address) => (
                      <Card
                        key={address.id}
                        hoverable
                        size="small"
                        className={`cursor-pointer border ${
                          selectedAddressId === address.id
                            ? 'border-blue-500 bg-blue-50/40'
                            : 'border-slate-200'
                        }`}
                        onClick={() => {
                          setManualAddressId(address.id)
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Space direction="vertical" size={2}>
                            <Space size={8} wrap>
                              <Typography.Text strong>{address.recipientName}</Typography.Text>
                              <Typography.Text type="secondary">{address.phone}</Typography.Text>
                              {address.isDefault ? (
                                <Tag color="gold" icon={<StarFilled />}>
                                  Mặc định
                                </Tag>
                              ) : null}
                            </Space>
                            <Typography.Text type="secondary">
                              {address.street}, {address.ward}, {address.district}, {address.city}
                            </Typography.Text>
                          </Space>
                          <Radio value={address.id} />
                        </div>
                      </Card>
                    ))}
                  </Space>
                </Radio.Group>
              ) : null}
            </Card>

            <Card title="Phương thức thanh toán">
              <Radio.Group
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value as 'cod' | 'vnpay')
                }}
              >
                <Space direction="vertical" size={10}>
                  <Radio value="cod">COD - Thanh toán khi nhận hàng</Radio>
                  <Radio value="vnpay">VNPay - Thanh toán online</Radio>
                </Space>
              </Radio.Group>
            </Card>

            <Card title={`Sản phẩm đã chọn (${selectedCartItems.length})`}>
              <List
                dataSource={selectedCartItems}
                split
                renderItem={(item) => {
                  const image =
                    item.variant?.images[0] ?? item.product?.images[0] ?? PRODUCT_PLACEHOLDER
                  const displayPrice = item.variant?.price ?? 0

                  return (
                    <List.Item>
                      <div className="flex w-full gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                          <img
                            src={image}
                            alt={item.product?.name ?? 'Product'}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <Button
                            type="link"
                            className="!h-auto !p-0 !font-semibold"
                            onClick={() => {
                              navigate(buildProductDetailPath(item.productId))
                            }}
                          >
                            {item.product?.name ?? `Sản phẩm #${item.productId}`}
                          </Button>
                          <Space size={6} wrap>
                            <Tag className="!m-0 text-xs">SKU: {item.variant?.sku ?? 'N/A'}</Tag>
                            {item.variant?.color?.trim() ? (
                              <Tag className="!m-0 text-xs">Màu: {item.variant.color.trim()}</Tag>
                            ) : null}
                            {item.variant?.size &&
                            item.variant.size.trim() &&
                            !['standard', 'n/a'].includes(item.variant.size.trim().toLowerCase()) ? (
                              <Tag className="!m-0 text-xs">Size: {item.variant.size.trim()}</Tag>
                            ) : null}
                          </Space>
                        </div>

                        <Space direction="vertical" align="end" size={0}>
                          <Typography.Text>
                            {formatVndCurrency(displayPrice)} x {item.quantity}
                          </Typography.Text>
                          <Typography.Text strong className="!text-blue-700">
                            {formatVndCurrency(displayPrice * item.quantity)}
                          </Typography.Text>
                        </Space>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Voucher">
              <Space direction="vertical" size={10} className="w-full">
                <Input
                  readOnly
                  value={normalizeVoucherCode(voucherCode)}
                  placeholder="Chưa chọn voucher"
                />
                <Space wrap>
                  <Button
                    icon={<GiftOutlined />}
                    onClick={() => {
                      setVoucherModalOpen(true)
                    }}
                  >
                    Chọn voucher
                  </Button>
                  {voucherCode ? (
                    <Button
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        setVoucherCode('')
                      }}
                    >
                      Bỏ chọn
                    </Button>
                  ) : null}
                </Space>

                {selectedVoucher ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Typography.Text strong>{selectedVoucher.code}</Typography.Text>
                        {selectedVoucher.description ? (
                          <Typography.Paragraph type="secondary" className="!mb-0 !mt-1 text-xs">
                            {selectedVoucher.description}
                          </Typography.Paragraph>
                        ) : null}
                      </div>
                      <Tag color={selectedVoucher.isEligible ? 'green' : 'default'}>
                        {selectedVoucher.isEligible ? 'Áp dụng được' : 'Chưa đủ điều kiện'}
                      </Tag>
                    </div>
                    <Typography.Text type="secondary" className="mt-2 block text-xs">
                      HSD: {dayjs(selectedVoucher.expirationDate).format('DD/MM/YYYY HH:mm')} · Tối
                      đa / tài khoản: {selectedVoucher.maxUsagePerUser} · Còn:{' '}
                      {selectedVoucher.remainingUsagePerUser}
                    </Typography.Text>
                  </div>
                ) : null}
              </Space>
            </Card>

            <Card title="Tóm tắt thanh toán" className="sticky top-24">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Typography.Text>Tạm tính</Typography.Text>
                  <Typography.Text>{formatVndCurrency(selectedSubtotal)}</Typography.Text>
                </div>
                <div className="flex items-center justify-between">
                  <Typography.Text>Giảm giá ước tính</Typography.Text>
                  <Typography.Text className="!text-emerald-600">
                    - {formatVndCurrency(estimatedDiscount)}
                  </Typography.Text>
                </div>
                <Divider className="!my-2" />
                <div className="flex items-center justify-between">
                  <Typography.Text strong>Tổng thanh toán</Typography.Text>
                  <Typography.Text strong className="!text-xl !text-blue-700">
                    {formatVndCurrency(estimatedTotalAmount)}
                  </Typography.Text>
                </div>
              </div>

              <Typography.Text type="secondary" className="mt-3 block text-xs">
                Tổng giảm giá là ước tính theo voucher đã chọn. Server sẽ kiểm tra lại khi đặt hàng.
              </Typography.Text>

              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <Checkbox
                  checked={hasAcceptedTerms}
                  onChange={(event) => {
                    setHasAcceptedTerms(event.target.checked)
                  }}
                >
                  <Typography.Text className="text-xs">
                    Tôi đã đọc và đồng ý với{' '}
                    <Typography.Link
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setTermsModalOpen(true)
                      }}
                    >
                      điều khoản của cửa hàng
                    </Typography.Link>
                    .
                  </Typography.Text>
                </Checkbox>
              </div>

              <Button
                type="primary"
                className="!mt-4 !w-full"
                size="large"
                loading={createOrderMutation.isPending}
                disabled={!hasAcceptedTerms}
                onClick={handlePlaceOrder}
              >
                Đặt hàng
              </Button>
            </Card>
          </div>
        </div>
      ) : null}

      <Modal
        title="Thêm địa chỉ nhận hàng"
        open={createAddressModalOpen}
        footer={null}
        destroyOnHidden
        onCancel={() => {
          if (createAddressMutation.isPending) {
            return
          }
          setCreateAddressModalOpen(false)
          addressForm.resetFields()
        }}
      >
        <Form
          form={addressForm}
          layout="vertical"
          initialValues={defaultAddressFormValues}
          onFinish={handleCreateAddress}
        >
          <Form.Item label="Nhãn địa chỉ" name="label">
            <Select
              placeholder="Chọn nhãn địa chỉ"
              options={[
                { value: 'home', label: 'Nhà riêng' },
                { value: 'work', label: 'Văn phòng' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Người nhận"
            name="recipientName"
            rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}
          >
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            label="Số điện thoại"
            name="phone"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
          >
            <Input placeholder="Ví dụ: 09xxxxxxxx" />
          </Form.Item>

          <Form.Item
            label="Địa chỉ cụ thể"
            name="street"
            rules={[{ required: true, message: 'Vui lòng nhập số nhà, tên đường' }]}
          >
            <Input placeholder="Ví dụ: 123 Nguyễn Trãi" />
          </Form.Item>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              label="Tỉnh/Thành phố"
              name="city"
              rules={[{ required: true, message: 'Vui lòng nhập tỉnh/thành phố' }]}
            >
              <Input placeholder="Ví dụ: TP. Hồ Chí Minh" />
            </Form.Item>
            <Form.Item
              label="Quận/Huyện"
              name="district"
              rules={[{ required: true, message: 'Vui lòng nhập quận/huyện' }]}
            >
              <Input placeholder="Ví dụ: Quận 3" />
            </Form.Item>
          </div>

          <Form.Item
            label="Phường/Xã"
            name="ward"
            rules={[{ required: true, message: 'Vui lòng nhập phường/xã' }]}
          >
            <Input placeholder="Ví dụ: Phường Võ Thị Sáu" />
          </Form.Item>

          <Form.Item label="Đặt làm mặc định" name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setCreateAddressModalOpen(false)
                addressForm.resetFields()
              }}
            >
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={createAddressMutation.isPending}>
              Lưu địa chỉ
            </Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Điều khoản của cửa hàng"
        open={termsModalOpen}
        destroyOnHidden
        width={680}
        onCancel={() => {
          setTermsModalOpen(false)
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setTermsModalOpen(false)
            }}
          >
            Đóng
          </Button>,
          <Button
            key="accept"
            type="primary"
            onClick={() => {
              setHasAcceptedTerms(true)
              setTermsModalOpen(false)
            }}
          >
            Đồng ý điều khoản
          </Button>,
        ]}
      >
        <Space direction="vertical" size={10} className="w-full">
          <Typography.Paragraph className="!mb-0 text-sm">
            Vui lòng đọc kỹ các điều khoản trước khi xác nhận đặt hàng:
          </Typography.Paragraph>

          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Đơn hàng chỉ được xác nhận khi thông tin nhận hàng và thanh toán hợp lệ.</li>
            <li>
              Voucher và ưu đãi được áp dụng theo điều kiện cụ thể, hệ thống sẽ kiểm tra lại tại
              thời điểm tạo đơn.
            </li>
            <li>Thời gian giao hàng dự kiến phụ thuộc khu vực nhận và tình trạng tồn kho.</li>
            <li>
              Sản phẩm lỗi do nhà sản xuất hoặc vận chuyển được hỗ trợ đổi trả theo chính sách hiện
              hành.
            </li>
            <li>
              Với thanh toán online, đơn hàng chỉ hoàn tất khi cổng thanh toán trả về kết quả thành
              công.
            </li>
            <li>
              Thông tin cá nhân của khách hàng được bảo mật theo chính sách riêng tư của cửa hàng.
            </li>
          </ul>
        </Space>
      </Modal>

      <Modal
        title={`Chọn voucher (${voucherCount})`}
        open={voucherModalOpen}
        footer={null}
        destroyOnHidden
        width={720}
        onCancel={() => {
          setVoucherModalOpen(false)
        }}
      >
        {availableVouchersQuery.isLoading ? (
          <div className="py-8 text-center">
            <Spin />
          </div>
        ) : null}

        {!availableVouchersQuery.isLoading && voucherCount === 0 ? (
          <Empty description="Hiện chưa có voucher khả dụng" />
        ) : null}

        {!availableVouchersQuery.isLoading && voucherCount > 0 ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {sortedAvailableVouchers.map((voucher) => (
              <Card key={voucher.id} size="small" className="border border-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <Space direction="vertical" size={2}>
                    <Space size={8} wrap>
                      <Tag color="blue">{voucher.code}</Tag>
                      <Typography.Text strong>
                        {voucher.discountType === 'percentage'
                          ? `Giảm ${voucher.discountValue}%`
                          : `Giảm ${formatVndCurrency(voucher.discountValue)}`}
                      </Typography.Text>
                    </Space>
                    {voucher.description ? (
                      <Typography.Paragraph className="!mb-0 text-sm" type="secondary">
                        {voucher.description}
                      </Typography.Paragraph>
                    ) : null}
                    <Typography.Text type="secondary" className="text-xs">
                      Đơn tối thiểu: {formatVndCurrency(voucher.minOrderValue)} · Còn lại:{' '}
                      {voucher.remainingUsage} lượt · Tối đa / tài khoản: {voucher.maxUsagePerUser}{' '}
                      · Bạn đã dùng: {voucher.usedCountByCurrentUser} · Còn:{' '}
                      {voucher.remainingUsagePerUser} · HSD:{' '}
                      {dayjs(voucher.expirationDate).format('DD/MM/YYYY HH:mm')}
                    </Typography.Text>
                  </Space>

                  <Space direction="vertical" align="end" size={8}>
                    <Tag color={voucher.isEligible ? 'green' : 'default'}>
                      {voucher.isEligible ? 'Áp dụng được' : 'Chưa đủ điều kiện'}
                    </Tag>
                    <Typography.Text strong className="!text-emerald-600">
                      - {formatVndCurrency(voucher.estimatedDiscount)}
                    </Typography.Text>
                    <Button
                      type="primary"
                      disabled={!voucher.isEligible}
                      onClick={() => {
                        handleChooseVoucher(voucher)
                      }}
                    >
                      Chọn voucher
                    </Button>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
