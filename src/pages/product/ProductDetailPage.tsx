import {
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  RightOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Carousel,
  Col,
  Empty,
  Grid,
  List,
  message,
  Radio,
  Rate,
  Result,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import type { CarouselRef } from 'antd/es/carousel'
import DOMPurify from 'dompurify'
import { chunk } from 'lodash'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAppSelector } from '@/app/store/hooks'
import { getMyCart, upsertCartItem } from '@/features/cart/api/cart.api'
import type { CartResponse } from '@/features/cart/model/cart.types'
import {
  createProductComment,
  getProductComments,
  getProductDetail,
  getProductReviews,
  getProducts,
} from '@/features/product/api/product.api'
import { CommentComposer } from '@/features/product/components/CommentComposer'
import { ProductCard } from '@/features/product/components/ProductCard'
import type {
  CommentListItem,
  ProductVariantItem,
  ReviewListItem,
} from '@/features/product/model/product.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { ROUTE_PATHS } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'
import { hasRichTextMarkup } from '@/shared/utils/rich-text'

const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

const getVariantLabel = (variant: ProductVariantItem) =>
  `${variant.color?.trim() || 'Mặc định'} / ${variant.size?.trim() || 'Tiêu chuẩn'}`

const getVariantAvailabilityLabel = (variant: ProductVariantItem) =>
  variant.isAvailable && variant.stockQuantity > 0 ? 'Còn hàng' : 'Hết hàng'

const formatPriceRange = (variants: ProductVariantItem[]) => {
  if (variants.length === 0) {
    return 'Liên hệ'
  }

  const prices = variants.map((variant) => variant.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  if (minPrice === maxPrice) {
    return formatVndCurrency(minPrice)
  }

  return `${formatVndCurrency(minPrice)} - ${formatVndCurrency(maxPrice)}`
}

const renderVariantPrice = (variant: ProductVariantItem) => {
  if (variant.originalPrice && variant.originalPrice > variant.price) {
    return (
      <Space direction="vertical" size={0}>
        <Typography.Text strong className="!text-base !leading-6 !text-blue-700 sm:!text-lg">
          {formatVndCurrency(variant.price)}
        </Typography.Text>
        <Typography.Text type="secondary" delete className="text-xs leading-4">
          {formatVndCurrency(variant.originalPrice)}
        </Typography.Text>
      </Space>
    )
  }

  return (
    <Typography.Text strong className="!text-base !leading-6 !text-blue-700 sm:!text-lg">
      {formatVndCurrency(variant.price)}
    </Typography.Text>
  )
}

export const ProductDetailPage = () => {
  const { productId = '' } = useParams()
  const screens = Grid.useBreakpoint()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [purchaseQuantity, setPurchaseQuantity] = useState(1)
  const carouselRef = useRef<CarouselRef>(null)
  const variantCarouselRef = useRef<CarouselRef>(null)
  const [activeVariantSlide, setActiveVariantSlide] = useState(0)

  const productDetailQuery = useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => getProductDetail(productId),
    enabled: Boolean(productId),
  })

  const productReviewsQuery = useQuery({
    queryKey: queryKeys.products.reviews(productId),
    queryFn: () => getProductReviews(productId, 1, 5),
    enabled: Boolean(productId),
  })

  const productCommentsQuery = useQuery({
    queryKey: queryKeys.products.comments(productId),
    queryFn: () => getProductComments(productId, 1, 10),
    enabled: Boolean(productId),
  })

  const relatedProductsQuery = useQuery({
    queryKey: queryKeys.products.related(productId, productDetailQuery.data?.categoryId),
    queryFn: () =>
      getProducts({
        page: 1,
        limit: 12,
        isAvailable: true,
        categoryId: productDetailQuery.data?.categoryId,
      }),
    enabled: Boolean(productId) && Boolean(productDetailQuery.data?.categoryId),
  })

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      createProductComment({
        targetId: productId,
        content,
      }),
    onSuccess: async () => {
      void message.success('Đã gửi bình luận')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.products.comments(productId),
      })
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const addToCartMutation = useMutation({
    mutationFn: upsertCartItem,
    onSuccess: async () => {
      void message.success('Đã thêm sản phẩm vào giỏ hàng')
      await queryClient.invalidateQueries({
        queryKey: queryKeys.cart.me,
      })
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const product = productDetailQuery.data
  const normalizedDescription = product?.description?.trim() ?? ''
  const hasMarkupDescription = hasRichTextMarkup(normalizedDescription)
  const sanitizedDescriptionHtml = useMemo(() => {
    if (!normalizedDescription) {
      return ''
    }

    return DOMPurify.sanitize(normalizedDescription)
  }, [normalizedDescription])

  const gallery = useMemo(() => {
    if (!product) {
      return [PRODUCT_PLACEHOLDER]
    }

    const imageSet = new Set<string>()

    for (const image of product.images) {
      if (image.trim()) {
        imageSet.add(image)
      }
    }

    for (const variant of product.variants) {
      for (const image of variant.images) {
        if (image.trim()) {
          imageSet.add(image)
        }
      }
    }

    return imageSet.size > 0 ? Array.from(imageSet) : [PRODUCT_PLACEHOLDER]
  }, [product])

  const variantImageIndexMap = useMemo(() => {
    const imageIndexMap = new Map<string, number>()

    if (!product) {
      return imageIndexMap
    }

    for (const variant of product.variants) {
      const primaryVariantImage = variant.images[0] ?? product.images[0] ?? PRODUCT_PLACEHOLDER
      const imageIndex = gallery.indexOf(primaryVariantImage)
      imageIndexMap.set(variant.id, imageIndex >= 0 ? imageIndex : 0)
    }

    return imageIndexMap
  }, [gallery, product])

  const selectedVariant = useMemo(() => {
    if (!product) {
      return undefined
    }

    return product.variants.find((variant) => variant.id === selectedVariantId)
  }, [product, selectedVariantId])

  const displayedVariant = useMemo(() => {
    if (!product) {
      return undefined
    }

    return selectedVariant ?? product.variants[0]
  }, [product, selectedVariant])
  const variantCardsPerSlide = screens.md ? 2 : 1
  const variantGapPx = 16
  const variantItemWidth = useMemo(() => {
    if (variantCardsPerSlide <= 1) {
      return '100%'
    }

    return `calc((100% - ${(variantCardsPerSlide - 1) * variantGapPx}px) / ${variantCardsPerSlide})`
  }, [variantCardsPerSlide])

  const variantSlides = useMemo(() => {
    if (!product || product.variants.length === 0) {
      return []
    }

    return chunk(product.variants, variantCardsPerSlide)
  }, [product, variantCardsPerSlide])
  const variantSlideIndexMap = useMemo(() => {
    const slideIndexMap = new Map<string, number>()

    variantSlides.forEach((slideVariants, slideIndex) => {
      slideVariants.forEach((variant) => {
        slideIndexMap.set(variant.id, slideIndex)
      })
    })

    return slideIndexMap
  }, [variantSlides])
  const hasMultipleVariantSlides = variantSlides.length > 1
  const maxVariantSlideIndex = Math.max(variantSlides.length - 1, 0)
  const resolvedActiveVariantSlide = Math.min(activeVariantSlide, maxVariantSlideIndex)

  const relatedProducts = (relatedProductsQuery.data?.items ?? [])
    .filter((item) => item.id !== productId)
    .slice(0, 8)

  useEffect(() => {
    if (activeVariantSlide > maxVariantSlideIndex) {
      variantCarouselRef.current?.goTo(maxVariantSlideIndex)
    }
  }, [activeVariantSlide, maxVariantSlideIndex])

  // worklog: 2026-03-04 21:11:32 | quochuy | refactor | handleSelectVariant
  // worklog: 2026-03-04 18:01:37 | trantu | cleanup | handleSelectVariant
  const handleSelectVariant = (variant: ProductVariantItem) => {
    setSelectedVariantId(variant.id)
    setPurchaseQuantity(1)
    carouselRef.current?.goTo(variantImageIndexMap.get(variant.id) ?? 0)
    const variantSlideIndex = variantSlideIndexMap.get(variant.id) ?? 0
    setActiveVariantSlide(variantSlideIndex)
    variantCarouselRef.current?.goTo(variantSlideIndex)
  }

  const handleVariantSlidePrev = () => {
    variantCarouselRef.current?.prev()
  }

  const handleVariantSlideNext = () => {
    variantCarouselRef.current?.next()
  }

  // worklog: 2026-03-04 14:54:46 | trantu | refactor | handleDecreaseQuantity
  const handleDecreaseQuantity = () => {
    setPurchaseQuantity((prev) => Math.max(1, prev - 1))
  }

  const handleIncreaseQuantity = () => {
    if (!selectedVariant) {
      void message.warning('Vui lòng chọn phiên bản sản phẩm trước')
      return
    }

    if (selectedVariant.stockQuantity <= 0) {
      void message.error('Phiên bản đã hết hàng')
      return
    }

    setPurchaseQuantity((prev) => {
      const nextValue = prev + 1
      return Math.min(nextValue, selectedVariant.stockQuantity)
    })
  }

  const handleAddToCart = async () => {
    if (!accessToken) {
      void message.warning('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng')
      navigate(ROUTE_PATHS.LOGIN)
      return
    }

    if (!selectedVariant) {
      void message.warning('Bạn cần chọn phiên bản sản phẩm trước khi thêm vào giỏ hàng')
      return
    }

    if (!selectedVariant.isAvailable || selectedVariant.stockQuantity <= 0) {
      void message.error('Phiên bản đã hết hàng')
      return
    }

    const normalizedQuantity = Math.min(
      Math.max(purchaseQuantity, 1),
      selectedVariant.stockQuantity
    )

    if (normalizedQuantity !== purchaseQuantity) {
      setPurchaseQuantity(normalizedQuantity)
    }

    const cachedCart = queryClient.getQueryData<CartResponse>(queryKeys.cart.me)
    const resolvedCart: CartResponse =
      cachedCart ??
      (await queryClient.fetchQuery({
        queryKey: queryKeys.cart.me,
        queryFn: getMyCart,
      }))

    const existingQuantity =
      resolvedCart.items.find((item) => item.variantId === selectedVariant.id)?.quantity ?? 0
    const nextQuantity = Math.min(
      existingQuantity + normalizedQuantity,
      selectedVariant.stockQuantity
    )

    if (nextQuantity <= existingQuantity) {
      void message.warning('Số lượng trong giỏ đã đạt tối đa theo tồn kho')
      return
    }

    addToCartMutation.mutate({
      productId,
      variantId: selectedVariant.id,
      quantity: nextQuantity,
      selectedAttributes: {
        color: selectedVariant.color,
        size: selectedVariant.size,
      },
    })
  }

  if (productDetailQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (productDetailQuery.isError || !product) {
    return (
      <Result
        status="404"
        title="Không tìm thấy sản phẩm"
        extra={
          <Button type="primary">
            <Link to={ROUTE_PATHS.ROOT}>Quay về trang chủ</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-8 py-6">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={11}>
          <Card className="h-full">
            <div className="mx-auto w-full max-w-[540px]">
              <Carousel ref={carouselRef} draggable>
                {gallery.map((image, index) => (
                  <div key={`${image}-${index}`}>
                    <div className="aspect-[5/4] overflow-hidden rounded-2xl bg-slate-100 md:aspect-[4/3]">
                      <img
                        src={image}
                        alt={`${product.name}-${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </Carousel>
            </div>
            <div className="w-full border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <Typography.Title level={4} className="!mb-0 !text-xl md:!text-[26px]">
                    Phiên bản sản phẩm
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {product.variants.length} phiên bản để lựa chọn
                  </Typography.Text>
                </div>

                {hasMultipleVariantSlides ? (
                  <Space size={8}>
                    <Button
                      shape="circle"
                      icon={<LeftOutlined />}
                      aria-label="Xem phiên bản trước"
                      disabled={resolvedActiveVariantSlide <= 0}
                      onClick={handleVariantSlidePrev}
                    />
                    <Button
                      shape="circle"
                      type="primary"
                      ghost
                      icon={<RightOutlined />}
                      aria-label="Xem phiên bản tiếp theo"
                      disabled={resolvedActiveVariantSlide >= variantSlides.length - 1}
                      onClick={handleVariantSlideNext}
                    />
                  </Space>
                ) : null}
              </div>

              {product.variants.length === 0 ? (
                <div className="pt-3">
                  <Empty description="Hiện chưa có phiên bản sản phẩm" />
                </div>
              ) : (
                <div className="pt-3">
                  <Radio.Group
                    value={selectedVariantId ?? undefined}
                    className="w-full"
                    onChange={(event) => {
                      const selected = product.variants.find(
                        (variant) => variant.id === String(event.target.value)
                      )

                      if (selected) {
                        handleSelectVariant(selected)
                      }
                    }}
                  >
                    <Carousel
                      ref={variantCarouselRef}
                      draggable
                      dots={hasMultipleVariantSlides}
                      infinite={false}
                      afterChange={setActiveVariantSlide}
                      className="product-variant-carousel"
                    >
                      {variantSlides.map((slideVariants, slideIndex) => (
                        <div key={`variant-slide-${slideIndex}`} className="w-full">
                          <div className="flex items-stretch gap-4 overflow-hidden pb-2">
                            {slideVariants.map((variant) => {
                              const image =
                                variant.images[0] ?? product.images[0] ?? PRODUCT_PLACEHOLDER
                              const isSelected = variant.id === selectedVariantId
                              const variantLabel = getVariantLabel(variant)
                              const availabilityLabel = getVariantAvailabilityLabel(variant)

                              return (
                                <div
                                  key={variant.id}
                                  className="flex"
                                  style={{
                                    flex: `0 0 ${variantItemWidth}`,
                                    maxWidth: variantItemWidth,
                                  }}
                                >
                                  <Radio
                                    value={variant.id}
                                    className={`product-variant-option !m-0 !flex !h-full flex-1 !w-full items-stretch rounded-[20px] border bg-white p-3 transition-all duration-200 [&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:flex-1 ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-50/60 shadow-[0_18px_36px_-30px_rgba(37,99,235,0.65)]'
                                        : 'border-slate-200 hover:border-blue-300 hover:shadow-[0_14px_28px_-28px_rgba(15,23,42,0.55)]'
                                    }`}
                                  >
                                    <div className="h-full w-full">
                                      <div className="flex h-full gap-3">
                                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-24 sm:w-24">
                                          <img
                                            src={image}
                                            alt={`${product.name}-${variantLabel}`}
                                            className="h-full w-full object-cover"
                                          />
                                        </div>

                                        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                                          <div className="min-w-0 space-y-2">
                                            <Typography.Text
                                              strong
                                              className="block line-clamp-2 !text-sm !leading-5 sm:!text-base"
                                            >
                                              {variantLabel}
                                            </Typography.Text>

                                            <Typography.Text
                                              type="secondary"
                                              className="block line-clamp-1 !text-xs sm:!text-sm"
                                            >
                                              SKU: {variant.sku}
                                            </Typography.Text>

                                            <div className="flex flex-wrap items-center gap-2">
                                              {variant.color ? (
                                                <Tag className="!m-0 !rounded-full !border-0 !bg-slate-100 !px-3 !py-1 !text-xs !text-slate-600">
                                                  Màu: {variant.color}
                                                </Tag>
                                              ) : null}
                                              {variant.size ? (
                                                <Tag className="!m-0 !rounded-full !border-0 !bg-slate-100 !px-3 !py-1 !text-xs !text-slate-600">
                                                  Size: {variant.size}
                                                </Tag>
                                              ) : null}
                                            </div>
                                          </div>

                                          <div className="space-y-2">
                                            <div>{renderVariantPrice(variant)}</div>

                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <Space size={8} align="center">
                                                {variant.colorHex ? (
                                                  <span
                                                    className="inline-block h-5 w-5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(148,163,184,0.55)]"
                                                    style={{ backgroundColor: variant.colorHex }}
                                                  />
                                                ) : (
                                                  <span className="inline-block h-5 w-5 rounded-full bg-slate-100" />
                                                )}
                                                <Typography.Text
                                                  type="secondary"
                                                  className="text-xs"
                                                >
                                                  Kho: {variant.stockQuantity}
                                                </Typography.Text>
                                              </Space>

                                              <Tag
                                                className={`!m-0 !rounded-full !border-0 !px-3 !py-1 !text-xs !font-medium ${
                                                  availabilityLabel === 'Còn hàng'
                                                    ? '!bg-lime-50 !text-lime-700'
                                                    : '!bg-slate-100 !text-slate-500'
                                                }`}
                                              >
                                                {availabilityLabel}
                                              </Tag>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </Radio>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </Carousel>

                    {hasMultipleVariantSlides ? (
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                        <Button
                          icon={<LeftOutlined />}
                          disabled={resolvedActiveVariantSlide <= 0}
                          onClick={handleVariantSlidePrev}
                        >
                          Trước
                        </Button>
                        <Typography.Text type="secondary" className="text-xs sm:text-sm">
                          {`Trang ${resolvedActiveVariantSlide + 1}/${variantSlides.length}`}
                        </Typography.Text>
                        <Button
                          type="primary"
                          ghost
                          icon={<RightOutlined />}
                          iconPosition="end"
                          disabled={resolvedActiveVariantSlide >= variantSlides.length - 1}
                          onClick={handleVariantSlideNext}
                        >
                          Tiếp
                        </Button>
                      </div>
                    ) : null}
                  </Radio.Group>

                  <Typography.Paragraph className="!mb-0 !mt-2 text-xs" type="secondary">
                    {selectedVariant
                      ? `Đang chọn: ${getVariantLabel(selectedVariant)}`
                      : 'Chọn một phiên bản để xem ảnh đúng biến thể và thêm vào giỏ hàng.'}
                  </Typography.Paragraph>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={13}>
          <Card className="h-full">
            <Space direction="vertical" size="middle" className="w-full">
              <Typography.Title
                level={2}
                className="!mb-0 !text-3xl md:!text-[42px] !leading-tight"
              >
                {product.name}
              </Typography.Title>

              <Space size={[8, 8]} wrap>
                <Tag color="blue">{product.brand}</Tag>
                {displayedVariant ? (
                  <Tag color={displayedVariant.isAvailable ? 'green' : 'default'}>
                    {displayedVariant.color} / {displayedVariant.size}
                  </Tag>
                ) : null}
              </Space>

              <Space size="middle" wrap>
                <Rate disabled allowHalf value={product.averageRating} />
                <Typography.Text type="secondary">{product.reviewCount} đánh giá</Typography.Text>
                <Typography.Text type="secondary">Đã bán: {product.soldCount}</Typography.Text>
              </Space>

              <Typography.Title level={3} className="!mb-0 !text-blue-700">
                {displayedVariant
                  ? formatVndCurrency(displayedVariant.price)
                  : formatPriceRange(product.variants)}
              </Typography.Title>

              {displayedVariant?.originalPrice &&
              displayedVariant.originalPrice > displayedVariant.price ? (
                <Typography.Text type="secondary" delete>
                  {formatVndCurrency(displayedVariant.originalPrice)}
                </Typography.Text>
              ) : null}

              <Typography.Paragraph className="!mb-0" type="secondary">
                Cập nhật: {formatDateTime(product.updatedAt)}
              </Typography.Paragraph>

              <Typography.Paragraph className="!mb-0" type="secondary">
                {displayedVariant
                  ? `SKU: ${displayedVariant.sku} • Tồn kho: ${displayedVariant.stockQuantity}`
                  : 'Sản phẩm chưa có phiên bản cụ thể'}
              </Typography.Paragraph>

              <div className="w-full border-t border-slate-200 pt-4">
                <Typography.Text strong>Phương thức thanh toán</Typography.Text>
                <Space direction="vertical" size={10} className="mt-3 w-full">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Badge status="processing" text="COD - Thanh toán khi nhận hàng" />
                    <Tag color="blue" className="!m-0">
                      Hỗ trợ
                    </Tag>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Badge status="success" text="VNPay - Thanh toán online" />
                    <Tag color="green" className="!m-0">
                      Hỗ trợ
                    </Tag>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Badge status="success" text="ZaloPay - Thanh toán online" />
                    <Tag color="green" className="!m-0">
                      Hỗ trợ
                    </Tag>
                  </div>
                </Space>
                <Typography.Paragraph className="!mb-0 !mt-2 text-xs" type="secondary">
                  Phương thức thanh toán được xác nhận ở bước đặt hàng.
                </Typography.Paragraph>
              </div>

              <div className="w-full border-t border-slate-200 pt-4">
                <Typography.Text strong>Số lượng mua</Typography.Text>
                <Space className="mt-3 ml-3" size="middle" align="center" wrap>
                  <Space size={6} align="center">
                    <Button
                      icon={<MinusOutlined />}
                      onClick={handleDecreaseQuantity}
                      disabled={
                        !selectedVariant || purchaseQuantity <= 1 || addToCartMutation.isPending
                      }
                    />
                    <Typography.Text className="inline-block min-w-8 text-center">
                      {purchaseQuantity}
                    </Typography.Text>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={handleIncreaseQuantity}
                      disabled={
                        !selectedVariant ||
                        addToCartMutation.isPending ||
                        purchaseQuantity >= selectedVariant.stockQuantity
                      }
                    />
                  </Space>
                  <Typography.Text type="secondary" className="text-xs">
                    {selectedVariant
                      ? `Tồn kho tối đa: ${selectedVariant.stockQuantity}`
                      : 'Vui lòng chọn phiên bản sản phẩm để thêm vào giỏ hàng'}
                  </Typography.Text>
                </Space>

                <Button
                  type="primary"
                  block
                  icon={<ShoppingCartOutlined />}
                  className="!mt-4"
                  loading={addToCartMutation.isPending}
                  onClick={handleAddToCart}
                >
                  Thêm vào giỏ hàng
                </Button>

                {!accessToken ? (
                  <Typography.Paragraph className="!mb-0 !mt-2 text-xs" type="secondary">
                    Bạn cần đăng nhập trước khi thêm sản phẩm vào giỏ hàng.
                  </Typography.Paragraph>
                ) : null}
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Mô tả sản phẩm">
        {normalizedDescription ? (
          hasMarkupDescription ? (
            <div
              className="rich-text-render text-slate-700"
              dangerouslySetInnerHTML={{
                __html: sanitizedDescriptionHtml,
              }}
            />
          ) : (
            <Typography.Paragraph className="!mb-0 whitespace-pre-line">
              {normalizedDescription}
            </Typography.Paragraph>
          )
        ) : (
          <Typography.Paragraph className="!mb-0" type="secondary">
            Sản phẩm chưa có mô tả chi tiết.
          </Typography.Paragraph>
        )}
      </Card>

      <Card title="Đánh giá khách hàng">
        {productReviewsQuery.isLoading ? <Spin /> : null}

        <List
          dataSource={productReviewsQuery.data?.items ?? []}
          renderItem={(review: ReviewListItem) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar src={review.user?.avatarUrl}>
                    {review.user?.fullName?.charAt(0) ?? 'U'}
                  </Avatar>
                }
                title={
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>
                      {review.user?.fullName ?? review.user?.email ?? 'Khách hàng'}
                    </Typography.Text>
                    <Rate disabled value={review.rating} className="!text-sm" />
                  </Space>
                }
                description={
                  <Space direction="vertical" size={4}>
                    <Typography.Paragraph className="!mb-0">
                      {review.content || 'Không có nội dung'}
                    </Typography.Paragraph>

                    <Typography.Text type="secondary" className="text-xs">
                      {formatDateTime(review.createdAt)}
                    </Typography.Text>
                    {review.replyContent ? (
                      <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                        <Typography.Text strong className="block text-xs text-blue-700">
                          Phản hồi từ cửa hàng
                        </Typography.Text>
                        <Typography.Paragraph className="!mb-0 !mt-1 text-sm">
                          {review.replyContent}
                        </Typography.Paragraph>
                        {review.repliedAt ? (
                          <Typography.Text type="secondary" className="text-xs">
                            {formatDateTime(review.repliedAt)}
                          </Typography.Text>
                        ) : null}
                      </div>
                    ) : null}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Card title="Bình luận">
        <Space direction="vertical" size="large" className="w-full">
          <CommentComposer
            isAuthenticated={Boolean(accessToken)}
            isSubmitting={commentMutation.isPending}
            onSubmit={async (content) => {
              await commentMutation.mutateAsync(content)
            }}
          />

          <Typography.Text type="secondary">
            {productCommentsQuery.data?.items.length ?? 0} bình luận
          </Typography.Text>

          {productCommentsQuery.isLoading ? (
            <div className="py-4 text-center">
              <Spin />
            </div>
          ) : null}

          <List
            dataSource={productCommentsQuery.data?.items ?? []}
            split={false}
            renderItem={(comment: CommentListItem) => (
              <List.Item className="!px-0">
                <div className="w-full rounded-xl border border-slate-200 bg-white p-4">
                  <List.Item.Meta
                    avatar={
                      <Avatar src={comment.user?.avatarUrl}>
                        {comment.user?.fullName?.charAt(0) ?? 'U'}
                      </Avatar>
                    }
                    title={comment.user?.fullName ?? comment.user?.email ?? 'Người dùng'}
                    description={
                      <Space direction="vertical" size={4}>
                        <Typography.Paragraph className="!mb-0 text-slate-700">
                          {comment.content}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary" className="text-xs">
                          {formatDateTime(comment.createdAt)}
                        </Typography.Text>
                      </Space>
                    }
                  />
                </div>
              </List.Item>
            )}
          />
        </Space>
      </Card>

      <Card title="Sản phẩm liên quan">
        {relatedProductsQuery.isLoading ? <Spin /> : null}

        {!relatedProductsQuery.isLoading && relatedProducts.length === 0 ? (
          <Empty description="Không có sản phẩm liên quan" />
        ) : null}

        <Row gutter={[16, 16]}>
          {relatedProducts.map((item) => (
            <Col key={item.id} xs={24} sm={12} lg={8} xl={6}>
              <ProductCard product={item} compact />
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  )
}
