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

interface VariantFilterOption {
  value: string
  label: string
  colorHex?: string
}

interface ProductDetailUiState {
  productId: string
  selectedVariantId: string | null
  purchaseQuantity: number
  activeImageIndex: number
  activeColorFilter: string
  activeSizeFilter: string
  activeVariantSlide: number
}

const normalizeVariantFilterValue = (value?: string) => value?.trim().toLowerCase() ?? ''

const createDefaultProductDetailUiState = (productId: string): ProductDetailUiState => ({
  productId,
  selectedVariantId: null,
  purchaseQuantity: 1,
  activeImageIndex: 0,
  activeColorFilter: 'all',
  activeSizeFilter: 'all',
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
  const [uiState, setUiState] = useState<ProductDetailUiState>(() =>
    createDefaultProductDetailUiState(productId)
  )
  const carouselRef = useRef<CarouselRef>(null)
  const variantCarouselRef = useRef<CarouselRef>(null)

  const currentUiState =
    uiState.productId === productId ? uiState : createDefaultProductDetailUiState(productId)
  const {
    selectedVariantId,
    purchaseQuantity,
    activeImageIndex,
    activeColorFilter,
    activeSizeFilter,
    activeVariantSlide,
  } = currentUiState

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

  const availableColorFilters = useMemo<VariantFilterOption[]>(() => {
    if (!product) {
      return []
    }

    const colorMap = new Map<string, VariantFilterOption>()

    product.variants.forEach((variant) => {
      const normalizedColor = normalizeVariantFilterValue(variant.color)

      if (!normalizedColor || colorMap.has(normalizedColor)) {
        return
      }

      colorMap.set(normalizedColor, {
        value: normalizedColor,
        label: variant.color?.trim() || 'Mặc định',
        colorHex: variant.colorHex,
      })
    })

    return Array.from(colorMap.values())
  }, [product])

  const availableSizeFilters = useMemo<VariantFilterOption[]>(() => {
    if (!product) {
      return []
    }

    const sizeMap = new Map<string, VariantFilterOption>()

    product.variants.forEach((variant) => {
      const normalizedSize = normalizeVariantFilterValue(variant.size)

      if (!normalizedSize || sizeMap.has(normalizedSize)) {
        return
      }

      sizeMap.set(normalizedSize, {
        value: normalizedSize,
        label: variant.size?.trim() || 'Tiêu chuẩn',
      })
    })

    return Array.from(sizeMap.values())
  }, [product])

  const filteredVariants = useMemo(() => {
    if (!product) {
      return []
    }

    return product.variants.filter((variant) => {
      const matchesColor =
        activeColorFilter === 'all' ||
        normalizeVariantFilterValue(variant.color) === activeColorFilter
      const matchesSize =
        activeSizeFilter === 'all' ||
        normalizeVariantFilterValue(variant.size) === activeSizeFilter

      return matchesColor && matchesSize
    })
  }, [activeColorFilter, activeSizeFilter, product])

  const resolvedSelectedVariantId = useMemo(() => {
    if (!product) {
      return null
    }

    if (filteredVariants.length === 0) {
      return null
    }

    if (
      selectedVariantId &&
      filteredVariants.some((variant) => variant.id === selectedVariantId)
    ) {
      return selectedVariantId
    }

    return filteredVariants[0]?.id ?? product.variants[0]?.id ?? null
  }, [filteredVariants, product, selectedVariantId])

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

  const variantCardsPerSlide = screens.xl ? 3 : screens.md ? 2 : 1
  const variantGapPx = 16
  const variantItemWidth = useMemo(() => {
    if (variantCardsPerSlide <= 1) {
      return '100%'
    }

    return `calc((100% - ${(variantCardsPerSlide - 1) * variantGapPx}px) / ${variantCardsPerSlide})`
  }, [variantCardsPerSlide])

  const variantSlides = useMemo(() => {
    if (filteredVariants.length === 0) {
      return []
    }

    return chunk(filteredVariants, variantCardsPerSlide)
  }, [filteredVariants, variantCardsPerSlide])
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
  const resolvedActiveImageIndex = Math.min(activeImageIndex, Math.max(gallery.length - 1, 0))

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
    const nextImageIndex = variantImageIndexMap.get(variant.id) ?? 0
    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      selectedVariantId: variant.id,
      purchaseQuantity: 1,
      activeImageIndex: nextImageIndex,
      activeVariantSlide: variantSlideIndexMap.get(variant.id) ?? 0,
    }))
    carouselRef.current?.goTo(nextImageIndex)
    variantCarouselRef.current?.goTo(variantSlideIndexMap.get(variant.id) ?? 0)
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

  const handleVariantSlidePrev = () => {
    variantCarouselRef.current?.prev()
  }

  const handleVariantSlideNext = () => {
    variantCarouselRef.current?.next()
  }

  const handleVariantCarouselAfterChange = (slideIndex: number) => {
    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      activeVariantSlide: slideIndex,
    }))
  }

  const handleVariantFilterChange = (
    type: 'color' | 'size',
    nextValue: string
  ) => {
    const nextColorFilter = type === 'color' ? nextValue : activeColorFilter
    const nextSizeFilter = type === 'size' ? nextValue : activeSizeFilter
    const nextFilteredVariants =
      product?.variants.filter((variant) => {
        const matchesColor =
          nextColorFilter === 'all' ||
          normalizeVariantFilterValue(variant.color) === nextColorFilter
        const matchesSize =
          nextSizeFilter === 'all' || normalizeVariantFilterValue(variant.size) === nextSizeFilter

        return matchesColor && matchesSize
      }) ?? []
    const nextVariantId = nextFilteredVariants[0]?.id ?? null
    const nextImageIndex =
      nextVariantId && variantImageIndexMap.has(nextVariantId)
        ? (variantImageIndexMap.get(nextVariantId) ?? 0)
        : 0

    setUiState((prev) => ({
      ...(prev.productId === productId ? prev : createDefaultProductDetailUiState(productId)),
      productId,
      activeColorFilter: nextColorFilter,
      activeSizeFilter: nextSizeFilter,
      selectedVariantId: nextVariantId,
      purchaseQuantity: 1,
      activeVariantSlide: 0,
      activeImageIndex: nextImageIndex,
    }))

    carouselRef.current?.goTo(nextImageIndex)
    variantCarouselRef.current?.goTo(0)
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

  const selectedColorFilterLabel =
    activeColorFilter === 'all'
      ? 'Tất cả màu'
      : availableColorFilters.find((option) => option.value === activeColorFilter)?.label ??
        'Tất cả màu'

  const selectedSizeFilterLabel =
    activeSizeFilter === 'all'
      ? 'Tất cả kích thước'
      : availableSizeFilters.find((option) => option.value === activeSizeFilter)?.label ??
        'Tất cả kích thước'

  const hasActiveVariantFilters = activeColorFilter !== 'all' || activeSizeFilter !== 'all'
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
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <Typography.Text className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Bộ sưu tập ảnh
                </Typography.Text>
                <Typography.Title level={4} className="!mb-0 !text-xl md:!text-[28px]">
                  Xem chi tiết từng góc sản phẩm
                </Typography.Title>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
                {displayedVariant ? (
                  <Tag
                    className={`!m-0 !rounded-full !border-0 !px-3 !py-1 !text-xs !font-medium ${
                      displayedVariant.isAvailable
                        ? '!bg-emerald-50 !text-emerald-700'
                        : '!bg-slate-100 !text-slate-500'
                    }`}
                  >
                    {getVariantAvailabilityLabel(displayedVariant)}
                  </Tag>
                ) : null}
                <Typography.Text type="secondary" className="text-xs">
                  {resolvedActiveImageIndex + 1}/{gallery.length} ảnh
                </Typography.Text>
              </div>
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

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <Typography.Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Biến thể đang xem
                  </Typography.Text>
                  <Typography.Title level={5} className="!mb-0 !text-lg">
                    {displayedVariant
                      ? getVariantLabel(displayedVariant)
                      : 'Sản phẩm chưa có biến thể'}
                  </Typography.Title>
                </div>
                {displayedVariant ? (
                  <Typography.Text type="secondary" className="text-sm">
                    SKU: {displayedVariant.sku}
                  </Typography.Text>
                ) : null}
              </div>

              {displayedVariant ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <Typography.Text type="secondary" className="text-xs">
                      Màu sắc
                    </Typography.Text>
                    <div className="mt-2 flex items-center gap-2">
                      {displayedVariant.colorHex ? (
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-slate-200"
                          style={{ backgroundColor: displayedVariant.colorHex }}
                        />
                      ) : null}
                      <Typography.Text strong>{displayedVariant.color}</Typography.Text>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <Typography.Text type="secondary" className="text-xs">
                      Kích thước
                    </Typography.Text>
                    <Typography.Text strong className="mt-2 block">
                      {displayedVariant.size}
                    </Typography.Text>
                  </div>

                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <Typography.Text type="secondary" className="text-xs">
                      Tồn kho khả dụng
                    </Typography.Text>
                    <Typography.Text strong className="mt-2 block">
                      {displayedVariant.stockQuantity} sản phẩm
                    </Typography.Text>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className="!rounded-[28px] !border-slate-200/80 !shadow-[0_24px_60px_-48px_rgba(15,23,42,0.55)]">
          <div className="space-y-6">
            <div className="space-y-3">
              <Space size={[8, 8]} wrap>
                <Tag color="blue">{product.brand}</Tag>
                {displayedVariant ? (
                  <Tag color={displayedVariant.isAvailable ? 'green' : 'default'}>
                    {getVariantAvailabilityLabel(displayedVariant)}
                  </Tag>
                ) : null}
                <Tag color="default">Cập nhật {formatDateTime(product.updatedAt)}</Tag>
              </Space>

              <Typography.Title
                level={2}
                className="!mb-0 !text-3xl !leading-tight md:!text-[42px]"
              >
                {product.name}
              </Typography.Title>

              <Typography.Paragraph className="!mb-0 max-w-3xl text-sm text-slate-500">
                {selectedVariant
                  ? `Biến thể đang chọn: ${getVariantLabel(selectedVariant)} • SKU ${selectedVariant.sku}`
                  : 'Chọn biến thể phù hợp bên dưới để đồng bộ ảnh, giá bán và số lượng tồn kho trước khi thêm vào giỏ.'}
              </Typography.Paragraph>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Typography.Text type="secondary" className="text-xs uppercase tracking-[0.16em]">
                  Đánh giá
                </Typography.Text>
                <Typography.Title level={4} className="!mb-0 !mt-2 !text-xl">
                  {product.averageRating.toFixed(1)}
                </Typography.Title>
                <Typography.Text type="secondary" className="text-xs">
                  {product.reviewCount} lượt đánh giá
                </Typography.Text>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Typography.Text type="secondary" className="text-xs uppercase tracking-[0.16em]">
                  Đã bán
                </Typography.Text>
                <Typography.Title level={4} className="!mb-0 !mt-2 !text-xl">
                  {product.soldCount}
                </Typography.Title>
                <Typography.Text type="secondary" className="text-xs">
                  Sản phẩm thành công
                </Typography.Text>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Typography.Text type="secondary" className="text-xs uppercase tracking-[0.16em]">
                  Tồn kho
                </Typography.Text>
                <Typography.Title level={4} className="!mb-0 !mt-2 !text-xl">
                  {displayedVariant?.stockQuantity ?? 0}
                </Typography.Title>
                <Typography.Text type="secondary" className="text-xs">
                  Theo biến thể đang xem
                </Typography.Text>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Typography.Text type="secondary" className="text-xs uppercase tracking-[0.16em]">
                  Thanh toán
                </Typography.Text>
                <Typography.Title level={4} className="!mb-0 !mt-2 !text-xl">
                  3+
                </Typography.Title>
                <Typography.Text type="secondary" className="text-xs">
                  COD, VNPay, ZaloPay
                </Typography.Text>
              </div>
            </div>

            <div className="rounded-[28px] border border-blue-100 bg-[radial-gradient(circle_at_top_left,_rgba(219,234,254,0.9),_rgba(255,255,255,0.95)_55%)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Typography.Text className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                    Giá đang áp dụng
                  </Typography.Text>
                  <Typography.Title level={2} className="!mb-0 !mt-2 !text-blue-700">
                    {displayedVariant
                      ? formatVndCurrency(displayedVariant.price)
                      : formatPriceRange(product.variants)}
                  </Typography.Title>
                  {displayedVariant?.originalPrice &&
                  displayedVariant.originalPrice > displayedVariant.price ? (
                    <Space size={10} wrap className="!mt-2">
                      <Typography.Text type="secondary" delete>
                        {formatVndCurrency(displayedVariant.originalPrice)}
                      </Typography.Text>
                      <Tag color="red" className="!m-0">
                        Tiết kiệm {formatVndCurrency(displayedVariantSavings)}
                      </Tag>
                    </Space>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                  <Rate disabled allowHalf value={product.averageRating} className="!text-sm" />
                  <Typography.Text type="secondary" className="mt-1 block text-xs">
                    {product.reviewCount} đánh giá • {product.soldCount} lượt bán
                  </Typography.Text>
                </div>
              </div>
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

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-5">
              <Typography.Text strong>Phương thức thanh toán hỗ trợ</Typography.Text>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <Badge status="processing" text="COD" />
                  <Typography.Paragraph className="!mb-0 !mt-2 text-xs text-slate-500">
                    Thanh toán khi nhận hàng.
                  </Typography.Paragraph>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <Badge status="success" text="VNPay" />
                  <Typography.Paragraph className="!mb-0 !mt-2 text-xs text-slate-500">
                    Cổng thanh toán online.
                  </Typography.Paragraph>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <Badge status="success" text="ZaloPay" />
                  <Typography.Paragraph className="!mb-0 !mt-2 text-xs text-slate-500">
                    Ví điện tử và ngân hàng.
                  </Typography.Paragraph>
                </div>
              </div>
              <Typography.Paragraph className="!mb-0 !mt-3 text-xs text-slate-500">
                Phương thức thanh toán được xác nhận ở bước đặt hàng.
              </Typography.Paragraph>
            </div>
          </div>
        </Card>
      </div>

      <Card className="!rounded-[28px] !border-slate-200/80 !shadow-[0_24px_60px_-48px_rgba(15,23,42,0.55)]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <Typography.Title level={3} className="!mb-0 !text-[30px]">
                Phiên bản sản phẩm
              </Typography.Title>
              <Typography.Text type="secondary">
                {filteredVariants.length}/{product.variants.length} phiên bản đang hiển thị
              </Typography.Text>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                {selectedColorFilterLabel} • {selectedSizeFilterLabel}
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
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div>
                <Typography.Text type="secondary" className="text-xs uppercase tracking-[0.16em]">
                  Lọc theo màu
                </Typography.Text>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="small"
                    type={activeColorFilter === 'all' ? 'primary' : 'default'}
                    className="!rounded-full"
                    onClick={() => handleVariantFilterChange('color', 'all')}
                  >
                    Tất cả màu
                  </Button>
                  {availableColorFilters.map((colorOption) => (
                    <Button
                      key={colorOption.value}
                      size="small"
                      type={activeColorFilter === colorOption.value ? 'primary' : 'default'}
                      className="!rounded-full"
                      onClick={() => handleVariantFilterChange('color', colorOption.value)}
                    >
                      <span className="inline-flex items-center gap-2">
                        {colorOption.colorHex ? (
                          <span
                            className="inline-block h-3 w-3 rounded-full border border-slate-200"
                            style={{ backgroundColor: colorOption.colorHex }}
                          />
                        ) : null}
                        {colorOption.label}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Typography.Text type="secondary" className="text-xs uppercase tracking-[0.16em]">
                  Lọc theo kích thước
                </Typography.Text>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="small"
                    type={activeSizeFilter === 'all' ? 'primary' : 'default'}
                    className="!rounded-full"
                    onClick={() => handleVariantFilterChange('size', 'all')}
                  >
                    Tất cả kích thước
                  </Button>
                  {availableSizeFilters.map((sizeOption) => (
                    <Button
                      key={sizeOption.value}
                      size="small"
                      type={activeSizeFilter === sizeOption.value ? 'primary' : 'default'}
                      className="!rounded-full"
                      onClick={() => handleVariantFilterChange('size', sizeOption.value)}
                    >
                      {sizeOption.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-end justify-start lg:justify-end">
                {hasActiveVariantFilters ? (
                  <Button
                    onClick={() => {
                      handleVariantFilterChange('color', 'all')
                      handleVariantFilterChange('size', 'all')
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {product.variants.length === 0 ? (
            <Empty description="Hiện chưa có phiên bản sản phẩm" />
          ) : filteredVariants.length === 0 ? (
            <div className="py-6">
              <Empty
                description="Không có phiên bản phù hợp với bộ lọc hiện tại"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  onClick={() => {
                    handleVariantFilterChange('color', 'all')
                    handleVariantFilterChange('size', 'all')
                  }}
                >
                  Xem lại toàn bộ biến thể
                </Button>
              </Empty>
            </div>
          ) : (
            <div>
              <Radio.Group
                value={resolvedSelectedVariantId ?? undefined}
                className="w-full"
                onChange={(event) => {
                  const selected = filteredVariants.find(
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
                    <div key={`variant-slide-${slideIndex}`} className="w-full">
                      <div className="flex items-stretch gap-4 overflow-hidden pb-2">
                        {slideVariants.map((variant) => {
                          const image =
                            variant.images[0] ?? product.images[0] ?? PRODUCT_PLACEHOLDER
                          const isSelected = variant.id === resolvedSelectedVariantId
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
                                className={`product-variant-option !m-0 !flex !h-full flex-1 !w-full items-stretch rounded-[24px] border bg-white p-4 transition-all duration-200 [&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:flex-1 ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50/70 shadow-[0_22px_44px_-34px_rgba(37,99,235,0.75)]'
                                    : 'border-slate-200 hover:border-blue-300 hover:shadow-[0_18px_36px_-30px_rgba(15,23,42,0.45)]'
                                }`}
                              >
                                <div className="h-full w-full">
                                  <div className="flex h-full flex-col gap-4">
                                    <div className="flex items-start gap-4">
                                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                                        <img
                                          src={image}
                                          alt={`${product.name}-${variantLabel}`}
                                          className="h-full w-full object-cover"
                                        />
                                      </div>

                                      <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <Typography.Text
                                            strong
                                            className="block line-clamp-2 !text-base !leading-6"
                                          >
                                            {variantLabel}
                                          </Typography.Text>

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

                                        <Typography.Text type="secondary" className="block !text-sm">
                                          SKU: {variant.sku}
                                        </Typography.Text>

                                        <div className="grid gap-2 sm:grid-cols-2">
                                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                            <Typography.Text
                                              type="secondary"
                                              className="block text-[11px] uppercase tracking-[0.12em]"
                                            >
                                              Màu
                                            </Typography.Text>
                                            <div className="mt-1 flex items-center gap-2">
                                              {variant.colorHex ? (
                                                <span
                                                  className="inline-block h-3.5 w-3.5 rounded-full border border-slate-200"
                                                  style={{ backgroundColor: variant.colorHex }}
                                                />
                                              ) : null}
                                              <Typography.Text>{variant.color}</Typography.Text>
                                            </div>
                                          </div>

                                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                            <Typography.Text
                                              type="secondary"
                                              className="block text-[11px] uppercase tracking-[0.12em]"
                                            >
                                              Kích thước
                                            </Typography.Text>
                                            <Typography.Text className="mt-1 block">
                                              {variant.size}
                                            </Typography.Text>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
                                      <div>{renderVariantPrice(variant)}</div>

                                      <div className="space-y-1 text-right">
                                        <Typography.Text type="secondary" className="block text-xs">
                                          Tồn kho
                                        </Typography.Text>
                                        <Typography.Text strong className="block text-sm">
                                          {variant.stockQuantity} sản phẩm
                                        </Typography.Text>
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
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
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

              <Typography.Paragraph className="!mb-0 !mt-3 text-xs" type="secondary">
                {selectedVariant
                  ? `Đang chọn: ${getVariantLabel(selectedVariant)}`
                  : 'Chọn một phiên bản để đồng bộ ảnh, giá và tồn kho trước khi thêm vào giỏ hàng.'}
              </Typography.Paragraph>
            </div>
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
