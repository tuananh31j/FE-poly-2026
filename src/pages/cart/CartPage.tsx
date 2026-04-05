import { DeleteOutlined, MinusOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Checkbox, Empty, List, message,Result, Space, Spin, Tag, Typography } from 'antd'
import { sumBy } from 'lodash'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import { clearMyCart, getMyCart, removeCartItem, upsertCartItem } from '@/features/cart/api/cart.api'
import type { CartItem } from '@/features/cart/model/cart.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { buildCheckoutPath, buildProductDetailPath, ROUTE_PATHS } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'

const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

const resolveDisplayColor = (item: CartItem) => {
  const selectedColor = item.selectedAttributes?.color

  if (typeof selectedColor === 'string' && selectedColor.trim()) {
    return selectedColor.trim()
  }

  return item.variant?.color?.trim() || undefined
}

const resolveDisplaySize = (item: CartItem) => {
  const size = item.variant?.size?.trim()

  if (!size) {
    return undefined
  }

  if (size.toLowerCase() === 'standard' || size.toLowerCase() === 'n/a') {
    return undefined
  }

  return size
}

export const CartPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([])
  const [hasUserSelection, setHasUserSelection] = useState(false)

  const cartQuery = useQuery({
    queryKey: queryKeys.cart.me,
    queryFn: getMyCart,
    enabled: Boolean(accessToken),
  })

  const upsertMutation = useMutation({
    mutationFn: upsertCartItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.cart.me,
      })
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const removeMutation = useMutation({
    mutationFn: removeCartItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.cart.me,
      })
      void message.success('Đã xóa sản phẩm khỏi giỏ hàng')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const clearMutation = useMutation({
    mutationFn: clearMyCart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.cart.me,
      })
      setSelectedVariantIds([])
      setHasUserSelection(false)
      void message.success('Đã xóa toàn bộ giỏ hàng')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const cartItems = useMemo(() => cartQuery.data?.items ?? [], [cartQuery.data?.items])
  const availableVariantIds = useMemo(() => cartItems.map((item) => item.variantId), [cartItems])
  const effectiveSelectedVariantIds = useMemo(() => {
    if (!hasUserSelection) {
      return availableVariantIds
    }

    const availableVariantSet = new Set(availableVariantIds)
    return selectedVariantIds.filter((variantId) => availableVariantSet.has(variantId))
  }, [availableVariantIds, hasUserSelection, selectedVariantIds])
  const totalQuantity = sumBy(cartItems, (item) => item.quantity)
  const selectedCartItems = useMemo(() => {
    const selectedSet = new Set(effectiveSelectedVariantIds)
    return cartItems.filter((item) => selectedSet.has(item.variantId))
  }, [cartItems, effectiveSelectedVariantIds])
  const selectedItemCount = selectedCartItems.length
  const selectedSubtotal = sumBy(
    selectedCartItems,
    (item) => (item.variant?.price ?? 0) * item.quantity
  )
  const estimatedSavings = sumBy(selectedCartItems, (item) => {
    const originalPrice = item.variant?.originalPrice ?? item.variant?.price ?? 0
    const currentPrice = item.variant?.price ?? 0
    return Math.max(0, originalPrice - currentPrice) * item.quantity
  })

  const isMutating = upsertMutation.isPending || removeMutation.isPending || clearMutation.isPending
  const isAllSelected =
    cartItems.length > 0 && effectiveSelectedVariantIds.length === cartItems.length
  const isIndeterminate = effectiveSelectedVariantIds.length > 0 && !isAllSelected

  const handleChangeQuantity = (item: CartItem, nextQuantity: number) => {
    if (nextQuantity < 1) {
      return
    }

    const maxQuantity = item.variant?.stockQuantity ?? nextQuantity
    const normalizedQuantity = Math.min(nextQuantity, Math.max(1, maxQuantity))

    if (normalizedQuantity !== nextQuantity) {
      void message.warning('Số lượng vượt quá tồn kho')
    }

    upsertMutation.mutate({
      productId: item.productId,
      variantId: item.variantId,
      quantity: normalizedQuantity,
      selectedAttributes: item.selectedAttributes,
    })
  }

  const toggleItemSelection = (variantId: string, checked: boolean) => {
    setHasUserSelection(true)
    setSelectedVariantIds((previous) => {
      if (checked) {
        if (previous.includes(variantId)) {
          return previous
        }

        return [...previous, variantId]
      }

      return previous.filter((id) => id !== variantId)
    })
  }

  const handleToggleSelectAll = (checked: boolean) => {
    setHasUserSelection(true)

    if (checked) {
      setSelectedVariantIds(cartItems.map((item) => item.variantId))
      return
    }

    setSelectedVariantIds([])
  }

  const handleOpenCheckout = () => {
    if (selectedCartItems.length === 0) {
      void message.warning('Vui lòng chọn ít nhất 1 sản phẩm để thanh toán')
      return
    }

    const selectedIdsForCheckout =
      selectedItemCount >= cartItems.length ? [] : effectiveSelectedVariantIds

    navigate(buildCheckoutPath(selectedIdsForCheckout))
  }

  return (
    <div className="space-y-6 py-6 md:py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <Typography.Title level={2} className="!mb-0 !text-3xl md:!text-[40px]">
            Giỏ hàng của bạn
          </Typography.Title>
          <Typography.Paragraph className="!mb-0 text-sm text-slate-500 md:text-base">
            Quản lý sản phẩm đã chọn, cập nhật số lượng rồi chuyển sang thanh toán khi sẵn sàng.
          </Typography.Paragraph>
        </div>

        <Space size={[10, 10]} wrap>
          <Button onClick={() => navigate(ROUTE_PATHS.PRODUCTS)}>Tiếp tục mua sắm</Button>
          <Button onClick={() => navigate(ROUTE_PATHS.ACCOUNT_ORDERS)}>Đơn hàng của tôi</Button>
        </Space>
      </div>

      {!accessToken ? (
        <Card className="!rounded-[28px] !border-slate-200/80">
          <Result
            status="info"
            title="Vui lòng đăng nhập để xem giỏ hàng"
            subTitle="Sau khi đăng nhập, bạn có thể quản lý sản phẩm đã thêm và tiếp tục thanh toán."
            extra={
              <Button
                type="primary"
                onClick={() => {
                  navigate(`${ROUTE_PATHS.LOGIN}?redirect=${encodeURIComponent(ROUTE_PATHS.CART)}`)
                }}
              >
                Đăng nhập
              </Button>
            }
          />
        </Card>
      ) : null}

      {accessToken && cartQuery.isLoading ? (
        <div className="py-20 text-center">
          <Spin size="large" />
        </div>
      ) : null}

      {accessToken && !cartQuery.isLoading && cartItems.length === 0 ? (
        <Card className="!rounded-[28px] !border-slate-200/80">
          <Empty
            description="Giỏ hàng của bạn đang trống"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={() => navigate(ROUTE_PATHS.PRODUCTS)}>
              Mua sắm ngay
            </Button>
          </Empty>
        </Card>
      ) : null}

      {accessToken && cartItems.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="!rounded-[28px] !border-slate-200/80 !shadow-[0_24px_60px_-48px_rgba(15,23,42,0.3)]">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Checkbox
                  indeterminate={isIndeterminate}
                  checked={isAllSelected}
                  onChange={(event) => {
                    handleToggleSelectAll(event.target.checked)
                  }}
                >
                  Chọn tất cả
                </Checkbox>

                <Typography.Text type="secondary" className="text-sm">
                  Đã chọn {selectedItemCount}/{cartItems.length} sản phẩm
                </Typography.Text>
              </div>

              <List
                dataSource={cartItems}
                renderItem={(item) => {
                  const image =
                    item.variant?.images[0] ?? item.product?.images[0] ?? PRODUCT_PLACEHOLDER
                  const displayPrice = item.variant?.price ?? 0
                  const maxQuantity = item.variant?.stockQuantity ?? 999
                  const canIncrease = item.quantity < maxQuantity
                  const isChecked = effectiveSelectedVariantIds.includes(item.variantId)

                  return (
                    <List.Item className="!items-start !border-b !border-slate-100 !px-0 !py-5 last:!border-b-0">
                      <div className="flex w-full gap-4">
                        <Checkbox
                          checked={isChecked}
                          className="mt-1"
                          onChange={(event) => {
                            toggleItemSelection(item.variantId, event.target.checked)
                          }}
                        />

                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          <img
                            src={image}
                            alt={item.product?.name ?? 'Product'}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-2">
                              <Button
                                type="link"
                                className="!h-auto !p-0 !text-left !text-base !font-semibold"
                                onClick={() => {
                                  navigate(buildProductDetailPath(item.productId))
                                }}
                              >
                                {item.product?.name ?? `Sản phẩm #${item.productId}`}
                              </Button>

                              <Space size={6} wrap>
                                <Tag className="!m-0">SKU: {item.variant?.sku ?? 'N/A'}</Tag>
                                {resolveDisplayColor(item) ? (
                                  <Tag className="!m-0">Màu: {resolveDisplayColor(item)}</Tag>
                                ) : null}
                                {resolveDisplaySize(item) ? (
                                  <Tag className="!m-0">Size: {resolveDisplaySize(item)}</Tag>
                                ) : null}
                              </Space>
                            </div>

                            <div className="text-left lg:text-right">
                              <Typography.Text strong className="block !text-lg !text-blue-700">
                                {formatVndCurrency(displayPrice)}
                              </Typography.Text>
                              <Typography.Text type="secondary" className="text-xs">
                                Kho: {item.variant?.stockQuantity ?? 0}
                              </Typography.Text>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Space size={6}>
                              <Button
                                size="small"
                                icon={<MinusOutlined />}
                                disabled={item.quantity <= 1 || isMutating}
                                onClick={() => {
                                  handleChangeQuantity(item, item.quantity - 1)
                                }}
                              />
                              <Typography.Text className="inline-block min-w-8 text-center">
                                {item.quantity}
                              </Typography.Text>
                              <Button
                                size="small"
                                icon={<PlusOutlined />}
                                disabled={!canIncrease || isMutating}
                                onClick={() => {
                                  handleChangeQuantity(item, item.quantity + 1)
                                }}
                              />
                            </Space>

                            <Space size={12}>
                              <Typography.Text strong>
                                Thành tiền: {formatVndCurrency(displayPrice * item.quantity)}
                              </Typography.Text>
                              <Button
                                size="small"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                loading={removeMutation.isPending}
                                onClick={() => {
                                  removeMutation.mutate(item.variantId)
                                }}
                              >
                                Xóa
                              </Button>
                            </Space>
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </div>
          </Card>

          <Card className="!rounded-[28px] !border-slate-200/80 !shadow-[0_24px_60px_-48px_rgba(15,23,42,0.3)] xl:sticky xl:top-28 xl:self-start">
            <div className="space-y-5">
              <Space>
                <ShoppingCartOutlined className="text-blue-600" />
                <Typography.Title level={4} className="!mb-0">
                  Tóm tắt giỏ hàng
                </Typography.Title>
              </Space>

              <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <Typography.Text type="secondary">Tổng số lượng</Typography.Text>
                  <Typography.Text strong>{totalQuantity}</Typography.Text>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <Typography.Text type="secondary">Sản phẩm đã chọn</Typography.Text>
                  <Typography.Text strong>{selectedItemCount}</Typography.Text>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <Typography.Text type="secondary">Tiết kiệm tạm tính</Typography.Text>
                  <Typography.Text strong className="!text-emerald-600">
                    {formatVndCurrency(estimatedSavings)}
                  </Typography.Text>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <Typography.Text strong>Tạm tính</Typography.Text>
                  <Typography.Text strong className="!text-xl !text-blue-700">
                    {formatVndCurrency(selectedSubtotal)}
                  </Typography.Text>
                </div>
              </div>

              <Typography.Paragraph className="!mb-0 text-sm text-slate-500">
                Chỉ những sản phẩm đang được chọn mới được chuyển sang trang thanh toán.
              </Typography.Paragraph>

              <div className="space-y-3">
                <Button
                  type="primary"
                  block
                  size="large"
                  disabled={selectedItemCount === 0}
                  onClick={handleOpenCheckout}
                >
                  Thanh toán các sản phẩm đã chọn
                </Button>
                <Button
                  block
                  danger
                  loading={clearMutation.isPending}
                  onClick={() => {
                    clearMutation.mutate()
                  }}
                >
                  Xóa toàn bộ giỏ hàng
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
