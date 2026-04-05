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
  InputNumber,
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

interface ProductDetailUiState {
  productId: string
  selectedVariantId: string | null
  purchaseQuantity: number
  activeImageIndex: number
  activeVariantSlide: number
}

const createDefaultProductDetailUiState = (productId: string): ProductDetailUiState => ({
  productId,
  selectedVariantId: null,
  purchaseQuantity: 1,
  activeImageIndex: 0,
  activeVariantSlide: 0,
})

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
        <Typography.Text
          strong
          className="!text-lg !leading-7 !text-blue-700 !whitespace-nowrap xl:!text-[30px]"
        >
          {formatVndCurrency(variant.price)}
        </Typography.Text>
        <Typography.Text type="secondary" delete className="text-xs leading-4 !whitespace-nowrap">
          {formatVndCurrency(variant.originalPrice)}
        </Typography.Text>
      </Space>
    )
  }

  return (
    <Typography.Text
      strong
      className="!text-lg !leading-7 !text-blue-700 !whitespace-nowrap xl:!text-[30px]"
    >
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
  const [uiState, setUiState] = useState<ProductDetailUiState>(() =>
    createDefaultProductDetailUiState(productId)
  )
  const carouselRef = useRef<CarouselRef>(null)
  const variantCarouselRef = useRef<CarouselRef>(null)

  const currentUiState =
    uiState.productId === productId ? uiState : createDefaultProductDetailUiState(productId)
  const { selectedVariantId, purchaseQuantity, activeImageIndex, activeVariantSlide } =
    currentUiState

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

  const resolvedSelectedVariantId = useMemo(() => {
    if (!product) {
      return null
    }

    if (selectedVariantId && product.variants.some((variant) => variant.id === selectedVariantId)) {
      return selectedVariantId
    }

    return product.variants[0]?.id ?? null
  }, [product, selectedVariantId])

  const selectedVariant = useMemo(() => {
    if (!product || !resolvedSelectedVariantId) {
      return undefined
    }

    return product.variants.find((variant) => variant.id === resolvedSelectedVariantId)
  }, [product, resolvedSelectedVariantId])

  const displayedVariant = useMemo(() => {
    if (!product) {
      return undefined
    }

    return selectedVariant ?? product.variants[0]
  }, [product, selectedVariant])

  const variantCardsPerSlide = screens.lg ? 3 : screens.sm ? 2 : 1
  const variantSlides = useMemo(() => {
    if (!product || product.variants.length === 0) {
      return []
    }

    return Array.from(
      { length: Math.ceil(product.variants.length / variantCardsPerSlide) },
      (_, index) =>
        product.variants.slice(
          index * variantCardsPerSlide,
          index * variantCardsPerSlide + variantCardsPerSlide
        )
    )
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
  const maxVariantSlideIndex = Math.max(variantSlides.length - 1, 0)
  const resolvedActiveVariantSlide = Math.min(activeVariantSlide, maxVariantSlideIndex)
  const hasMultipleVariantSlides = variantSlides.length > 1
  const variantGridClassName = screens.lg
    ? 'grid-cols-3'
    : screens.sm
      ? 'grid-cols-2'
      : 'grid-cols-1'
  const resolvedActiveImageIndex = Math.min(activeImageIndex, Math.max(gallery.length - 1, 0))

  const relatedProducts = (relatedProductsQuery.data?.items ?? [])
    .filter((item) => item.id !== productId)
    .slice(0, 8)

  useEffect(() => {
    if (!resolvedSelectedVariantId) {
      return
    }

    const nextSlideIndex = variantSlideIndexMap.get(resolvedSelectedVariantId) ?? 0
    const clampedSlideIndex = Math.min(nextSlideIndex, maxVariantSlideIndex)

    variantCarouselRef.current?.goTo(clampedSlideIndex)
  }, [maxVariantSlideIndex, resolvedSelectedVariantId, variantCardsPerSlide, variantSlideIndexMap])

  // worklog: 2026-03-04 21:11:32 | quochuy | refactor | handleSelectVariant
  // worklog: 2026-03-04 18:01:37 | trantu | cleanup | handleSelectVariant
  const handleSelectVariant = (variant: ProductVariantItem) => {
    const nextImageIndex = variantImageIndexMap.get(variant.id) ?? 0
    const nextSlideIndex = variantSlideIndexMap.get(variant.id) ?? 0
    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      selectedVariantId: variant.id,
      purchaseQuantity: 1,
      activeImageIndex: nextImageIndex,
      activeVariantSlide: nextSlideIndex,
    }))
    carouselRef.current?.goTo(nextImageIndex)
    variantCarouselRef.current?.goTo(nextSlideIndex)
  }

  const handleSelectGalleryImage = (index: number) => {
    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      activeImageIndex: index,
    }))
    carouselRef.current?.goTo(index)
  }

  const handleGalleryAfterChange = (index: number) => {
    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      activeImageIndex: index,
    }))
  }

  const handleVariantCarouselAfterChange = (slideIndex: number) => {
    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      activeVariantSlide: slideIndex,
    }))
  }

  const handleVariantSlidePrev = () => {
    variantCarouselRef.current?.prev()
  }

  const handleVariantSlideNext = () => {
    variantCarouselRef.current?.next()
  }

  // worklog: 2026-03-04 14:54:46 | trantu | refactor | handleDecreaseQuantity
  const handleDecreaseQuantity = () => {
    setUiState((prev) => {
      const base =
        prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)
      return {
        ...base,
        productId,
        purchaseQuantity: Math.max(1, base.purchaseQuantity - 1),
      }
    })
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

    setUiState((prev) => {
      const base =
        prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)
      const nextValue = base.purchaseQuantity + 1
      return {
        ...base,
        productId,
        purchaseQuantity: Math.min(nextValue, selectedVariant.stockQuantity),
      }
    })
  }

  const handlePurchaseQuantityChange = (value: number | null) => {
    if (value === null) {
      return
    }

    const normalizedValue = Math.max(1, Math.trunc(value))

    if (!selectedVariant) {
      setUiState((prev) => ({
        ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
        productId,
        purchaseQuantity: normalizedValue,
      }))
      return
    }

    if (selectedVariant.stockQuantity <= 0) {
      setUiState((prev) => ({
        ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
        productId,
        purchaseQuantity: 1,
      }))
      return
    }

    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      purchaseQuantity: Math.min(normalizedValue, selectedVariant.stockQuantity),
    }))
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
      setUiState((prev) => ({
        ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
        productId,
        purchaseQuantity: normalizedQuantity,
      }))
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

  const displayedVariantSavings =
    displayedVariant?.originalPrice && displayedVariant.originalPrice > displayedVariant.price
      ? displayedVariant.originalPrice - displayedVariant.price
      : 0

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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="!overflow-hidden !rounded-[28px] !border-slate-200/80 !shadow-[0_24px_60px_-48px_rgba(15,23,42,0.55)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Typography.Title level={4} className="!mb-0 !text-xl md:!text-[28px]">
                Ảnh sản phẩm
              </Typography.Title>
              <Typography.Text type="secondary" className="text-xs">
                {resolvedActiveImageIndex + 1}/{gallery.length}
              </Typography.Text>
            </div>

            <Carousel
              ref={carouselRef}
              draggable
              dots={false}
              afterChange={handleGalleryAfterChange}
              className="product-detail-gallery-carousel"
            >
              {gallery.map((image, index) => (
                <div key={`${image}-${index}`}>
                  <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-slate-100">
                    <img
                      src={image}
                      alt={`${product.name}-${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              ))}
            </Carousel>

            <div className="product-detail-gallery-thumbnails flex gap-3 overflow-x-auto pb-1">
              {gallery.map((image, index) => {
                const isActive = index === resolvedActiveImageIndex

                return (
                  <button
                    key={`${image}-thumb-${index}`}
                    type="button"
                    onClick={() => handleSelectGalleryImage(index)}
                    className={`group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border transition-all duration-200 ${
                      isActive
                        ? 'border-blue-500 shadow-[0_18px_36px_-28px_rgba(37,99,235,0.7)]'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                    aria-label={`Xem ảnh ${index + 1}`}
                  >
                    <img
                      src={image}
                      alt={`${product.name}-thumbnail-${index + 1}`}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <span
                      className={`absolute inset-0 bg-slate-950/10 transition-opacity ${
                        isActive ? 'opacity-0' : 'opacity-100'
                      }`}
                    />
                  </button>
                )
              })}
            </div>

            <Typography.Paragraph className="!mb-0 text-sm text-slate-500">
              {selectedVariant
                ? `Đang xem: ${getVariantLabel(selectedVariant)}`
                : 'Chọn biến thể để đồng bộ ảnh theo đúng phiên bản.'}
            </Typography.Paragraph>
          </div>
        </Card>

        <Card className="!rounded-[28px] !border-slate-200/80 !shadow-[0_24px_60px_-48px_rgba(15,23,42,0.55)]">
          <div className="space-y-5">
            <div className="space-y-3">
              <Space size={[8, 8]} wrap>
                <Tag color="blue">{product.brand}</Tag>
                {displayedVariant ? (
                  <Tag color={displayedVariant.isAvailable ? 'green' : 'default'}>
                    {getVariantAvailabilityLabel(displayedVariant)}
                  </Tag>
                ) : null}
              </Space>

              <Typography.Title
                level={2}
                className="!mb-0 !text-3xl !leading-tight md:!text-[42px]"
              >
                {product.name}
              </Typography.Title>

              <Typography.Paragraph className="!mb-0 text-sm text-slate-500">
                {selectedVariant
                  ? `Biến thể đang chọn: ${getVariantLabel(selectedVariant)} • SKU ${selectedVariant.sku}`
                  : 'Chọn biến thể phù hợp bên dưới trước khi thêm vào giỏ hàng.'}
              </Typography.Paragraph>
            </div>

            <div className="space-y-2 rounded-[24px] border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(219,234,254,0.75),_rgba(255,255,255,0.96)_60%)] p-5">
              <Typography.Title level={2} className="!mb-0 !text-blue-700">
                {displayedVariant
                  ? formatVndCurrency(displayedVariant.price)
                  : formatPriceRange(product.variants)}
              </Typography.Title>
              {displayedVariant?.originalPrice &&
              displayedVariant.originalPrice > displayedVariant.price ? (
                <Space size={10} wrap>
                  <Typography.Text type="secondary" delete>
                    {formatVndCurrency(displayedVariant.originalPrice)}
                  </Typography.Text>
                  <Tag color="red" className="!m-0">
                    Tiết kiệm {formatVndCurrency(displayedVariantSavings)}
                  </Tag>
                </Space>
              ) : null}
              <Space size={[12, 8]} wrap>
                <Rate disabled allowHalf value={product.averageRating} className="!text-sm" />
                <Typography.Text type="secondary" className="text-sm">
                  {product.reviewCount} đánh giá
                </Typography.Text>
                <Typography.Text type="secondary" className="text-sm">
                  Đã bán {product.soldCount}
                </Typography.Text>
              </Space>
              <Typography.Paragraph className="!mb-0 text-sm text-slate-500">
                {displayedVariant
                  ? `SKU: ${displayedVariant.sku} • Tồn kho: ${displayedVariant.stockQuantity}`
                  : `Cập nhật: ${formatDateTime(product.updatedAt)}`}
              </Typography.Paragraph>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Typography.Text strong>Số lượng mua</Typography.Text>
                    <Typography.Paragraph className="!mb-0 text-xs text-slate-500">
                      {selectedVariant
                        ? `Bạn có thể mua tối đa ${selectedVariant.stockQuantity} sản phẩm ở biến thể này.`
                        : 'Vui lòng chọn biến thể trước khi điều chỉnh số lượng và thêm vào giỏ.'}
                    </Typography.Paragraph>
                  </div>

                  <Space size={6} align="center">
                    <Button
                      icon={<MinusOutlined />}
                      onClick={handleDecreaseQuantity}
                      disabled={
                        !selectedVariant || purchaseQuantity <= 1 || addToCartMutation.isPending
                      }
                    />
                    <InputNumber
                      min={1}
                      max={selectedVariant?.stockQuantity ?? 1}
                      controls={false}
                      precision={0}
                      value={purchaseQuantity}
                      disabled={
                        !selectedVariant ||
                        selectedVariant.stockQuantity <= 0 ||
                        addToCartMutation.isPending
                      }
                      onChange={handlePurchaseQuantityChange}
                      className="w-24"
                    />
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
                </div>

                <Button
                  type="primary"
                  block
                  icon={<ShoppingCartOutlined />}
                  className="!h-12 !rounded-2xl"
                  loading={addToCartMutation.isPending}
                  onClick={handleAddToCart}
                >
                  Thêm vào giỏ hàng
                </Button>

                {!accessToken ? (
                  <Typography.Paragraph className="!mb-0 text-xs" type="secondary">
                    Bạn cần đăng nhập trước khi thêm sản phẩm vào giỏ hàng.
                  </Typography.Paragraph>
                ) : null}
              </div>
            </div>

            <Space size={[8, 8]} wrap>
              <Badge status="processing" text="COD" />
              <Badge status="success" text="VNPay" />
              <Badge status="success" text="ZaloPay" />
            </Space>
          </div>
        </Card>
      </div>

      <Card className="!rounded-[28px] !border-slate-200/80 !shadow-[0_24px_60px_-48px_rgba(15,23,42,0.55)]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <Typography.Title level={3} className="!mb-0 !text-[30px]">
                Chọn phiên bản
              </Typography.Title>
              <Typography.Text type="secondary">
                {product.variants.length > 0
                  ? `${product.variants.length} biến thể có sẵn, chọn trực tiếp trước khi thêm vào giỏ.`
                  : 'Hiện chưa có biến thể để lựa chọn.'}
              </Typography.Text>
            </div>

            {hasMultipleVariantSlides ? (
              <Space size={8}>
                <Button
                  shape="circle"
                  icon={<LeftOutlined />}
                  aria-label="Xem biến thể trước"
                  disabled={resolvedActiveVariantSlide <= 0}
                  onClick={handleVariantSlidePrev}
                />
                <Button
                  shape="circle"
                  type="primary"
                  ghost
                  icon={<RightOutlined />}
                  aria-label="Xem biến thể tiếp theo"
                  disabled={resolvedActiveVariantSlide >= maxVariantSlideIndex}
                  onClick={handleVariantSlideNext}
                />
              </Space>
            ) : null}
          </div>

          {product.variants.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Hiện chưa có phiên bản sản phẩm"
            />
          ) : (
            <Radio.Group
              value={resolvedSelectedVariantId ?? undefined}
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
                afterChange={handleVariantCarouselAfterChange}
                className="product-variant-carousel"
              >
                {variantSlides.map((slideVariants, slideIndex) => (
                  <div key={`variant-slide-${slideIndex}`}>
                    <div className={`grid gap-4 pb-2 ${variantGridClassName}`}>
                      {slideVariants.map((variant) => {
                        const image = variant.images[0] ?? product.images[0] ?? PRODUCT_PLACEHOLDER
                        const isSelected = variant.id === resolvedSelectedVariantId
                        const availabilityLabel = getVariantAvailabilityLabel(variant)

                        return (
                          <Radio
                            key={variant.id}
                            value={variant.id}
                            className={`product-variant-picker product-variant-option !m-0 !flex !h-full !w-full rounded-[24px] border bg-white p-4 transition-all duration-200 [&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:flex-1 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50/70 shadow-[0_22px_44px_-34px_rgba(37,99,235,0.75)]'
                                : 'border-slate-200 hover:border-blue-300 hover:shadow-[0_18px_36px_-30px_rgba(15,23,42,0.45)]'
                            }`}
                          >
                            <div className="flex h-full w-full flex-col gap-4">
                              <div className="flex items-start gap-4">
                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                                  <img
                                    src={image}
                                    alt={`${product.name}-${getVariantLabel(variant)}`}
                                    className="h-full w-full object-cover"
                                  />
                                </div>

                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="space-y-1">
                                    <Typography.Text
                                      strong
                                      className="block !text-lg !leading-7"
                                    >
                                      {getVariantLabel(variant)}
                                    </Typography.Text>
                                    <Typography.Text
                                      type="secondary"
                                      className="block truncate text-sm"
                                    >
                                      SKU: {variant.sku}
                                    </Typography.Text>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <Tag className="!m-0 !rounded-full !border-0 !bg-slate-100 !px-3 !py-1 !text-xs !text-slate-600">
                                      {variant.color?.trim() || 'Mặc định'}
                                    </Tag>
                                    <Tag className="!m-0 !rounded-full !border-0 !bg-slate-100 !px-3 !py-1 !text-xs !text-slate-600">
                                      {variant.size?.trim() || 'Tiêu chuẩn'}
                                    </Tag>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-auto flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
                                <div className="min-w-0 flex-1">
                                  {renderVariantPrice(variant)}
                                </div>

                                <div className="shrink-0 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
                                  Kho: {variant.stockQuantity}
                                </div>
                              </div>

                              <Typography.Text
                                className={`block text-sm font-medium ${
                                  availabilityLabel === 'Còn hàng'
                                    ? 'text-lime-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {availabilityLabel}
                              </Typography.Text>
                            </div>
                          </Radio>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </Carousel>
            </Radio.Group>
          )}
        </div>
      </Card>

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
