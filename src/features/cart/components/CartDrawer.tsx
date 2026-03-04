import { DeleteOutlined, MinusOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Checkbox,
  Drawer,
  Empty,
  List,
  message,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { sumBy } from 'lodash'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import { clearMyCart, getMyCart, removeCartItem, upsertCartItem } from '@/features/cart/api/cart.api'
import type { CartItem } from '@/features/cart/model/cart.types'
import { queryKeys } from '@/shared/api/queryKeys'
import {
  buildCheckoutPath,
  buildProductDetailPath,
  ROUTE_PATHS,
} from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'

const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

interface CartDrawerProps {
  open: boolean
  onClose: () => void
}

const resolveDisplayColor = (item: CartItem) => {
  const selectedColor = item.selectedAttributes?.color

  if (typeof selectedColor === 'string' && selectedColor.trim()) {
    return selectedColor.trim()
  }

  return item.variant?.color ?? 'N/A'
}

export const CartDrawer = ({ open, onClose }: CartDrawerProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([])
  const [hasUserSelection, setHasUserSelection] = useState(false)

  const cartQuery = useQuery({
    queryKey: queryKeys.cart.me,
    queryFn: getMyCart,
    enabled: open && Boolean(accessToken),
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

    onClose()
    navigate(buildCheckoutPath(selectedIdsForCheckout))
  }

  return (
    <>
      <Drawer
        title={
          <Space>
            <ShoppingCartOutlined />
            <span>Giỏ hàng ({totalQuantity})</span>
          </Space>
        }
        open={open}
        onClose={onClose}
        width={440}
        destroyOnHidden
      >
        {!accessToken ? (
          <Empty description="Vui lòng đăng nhập để quản lý giỏ hàng">
            <Button
              type="primary"
              onClick={() => {
                onClose()
                navigate(
                  `${ROUTE_PATHS.LOGIN}?redirect=${encodeURIComponent(ROUTE_PATHS.PRODUCTS)}`
                )
              }}
            >
              Đăng nhập
            </Button>
          </Empty>
        ) : null}

        {accessToken && cartQuery.isLoading ? (
          <div className="py-10 text-center">
            <Spin />
          </div>
        ) : null}

        {accessToken && !cartQuery.isLoading && cartItems.length === 0 ? (
          <Empty description="Giỏ hàng của bạn đang trống" />
        ) : null}

        {accessToken && cartItems.length > 0 ? (
          <div className="flex h-full flex-col">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <Checkbox
                indeterminate={isIndeterminate}
                checked={isAllSelected}
                onChange={(event) => {
                  handleToggleSelectAll(event.target.checked)
                }}
              >
                Chọn tất cả
              </Checkbox>
              <Typography.Text type="secondary" className="text-xs">
                Đã chọn {selectedItemCount}/{cartItems.length} sản phẩm
              </Typography.Text>
            </div>

            <List
              className="max-h-[calc(100vh-390px)] overflow-y-auto pr-1"
              dataSource={cartItems}
              renderItem={(item) => {
                const image = item.variant?.images[0] ?? item.product?.images[0] ?? PRODUCT_PLACEHOLDER
                const displayPrice = item.variant?.price ?? 0
                const maxQuantity = item.variant?.stockQuantity ?? 999
                const canIncrease = item.quantity < maxQuantity
                const isChecked = effectiveSelectedVariantIds.includes(item.variantId)

                return (
                  <List.Item className="!items-start !px-0">
                    <div className="flex w-full gap-3">
                      <Checkbox
                        checked={isChecked}
                        className="mt-1"
                        onChange={(event) => {
                          toggleItemSelection(item.variantId, event.target.checked)
                        }}
                      />

                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <img
                          src={image}
                          alt={item.product?.name ?? 'Product'}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <Button
                          type="link"
                          className="!h-auto !p-0 !text-left !font-semibold"
                          onClick={() => {
                            onClose()
                            navigate(buildProductDetailPath(item.productId))
                          }}
                        >
                          {item.product?.name ?? `Sản phẩm #${item.productId}`}
                        </Button>

                        <Space size={6} wrap>
                          <Tag className="!m-0">SKU: {item.variant?.sku ?? 'N/A'}</Tag>
                          <Tag className="!m-0">Màu: {resolveDisplayColor(item)}</Tag>
                          <Tag className="!m-0">Size: {item.variant?.size ?? 'N/A'}</Tag>
                        </Space>

                        <Typography.Text strong className="block !text-blue-700">
                          {formatVndCurrency(displayPrice)}
                        </Typography.Text>

                        <div className="flex items-center justify-between">
                          <Space size={6}>
                            <Button
                              size="small"
                              icon={<MinusOutlined />}
                              disabled={item.quantity <= 1 || isMutating}
                              onClick={() => {
                                handleChangeQuantity(item, item.quantity - 1)
                              }}
                            />
                            <Typography.Text className="inline-block min-w-6 text-center">
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
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )
              }}
            />

            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <Typography.Text strong>Tạm tính (đã chọn)</Typography.Text>
                <Typography.Text strong className="!text-blue-700">
                  {formatVndCurrency(selectedSubtotal)}
                </Typography.Text>
              </div>

              <Space className="w-full !justify-between" wrap>
                <Button
                  danger
                  loading={clearMutation.isPending}
                  onClick={() => {
                    clearMutation.mutate()
                  }}
                >
                  Xóa tất cả
                </Button>

                <Space>
                  <Button
                    onClick={() => {
                      onClose()
                      navigate(ROUTE_PATHS.ACCOUNT_ORDERS)
                    }}
                  >
                    Đơn hàng của tôi
                  </Button>
                  <Button type="primary" disabled={selectedItemCount === 0} onClick={handleOpenCheckout}>
                    Thanh toán
                  </Button>
                </Space>
              </Space>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  )
}
