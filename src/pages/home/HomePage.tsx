import { Card, Carousel, Col, Empty, Row, Spin, Typography } from 'antd'
import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ProductCard } from '@/features/product/components/ProductCard'
import { ProductCarouselSection } from '@/features/product/components/ProductCarouselSection'
import { useHomeProducts } from '@/features/product/hooks/useHomeProducts'
import { BRAND } from '@/shared/constants/brand'

export const HomePage = () => {
  const [searchParams] = useSearchParams()
  const search = searchParams.get('search')?.trim() ?? ''
  const categoryId = searchParams.get('categoryId')?.trim() ?? ''
  const brand = searchParams.get('brand')?.trim() ?? ''

  const { topSellingQuery, newestQuery, allProductsQuery } = useHomeProducts({
    search,
    categoryId,
    brand,
  })
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = allProductsQuery

  const allProducts = useMemo(() => {
    return allProductsQuery.data?.pages.flatMap((page) => page.items) ?? []
  }, [allProductsQuery.data])

  useEffect(() => {
    const node = sentinelRef.current

    if (!node) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]

        if (firstEntry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      {
        rootMargin: '300px',
      }
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  return (
    <div className="space-y-12 py-6">
      <section>
        <Carousel autoplay draggable>
          {BRAND.heroBanners.map((slide) => (
            <div key={slide.title}>
              <div className="overflow-hidden rounded-2xl">
                <img src={slide.imageUrl} alt={slide.title} className="h-[280px] w-full object-cover md:h-[360px]" />
              </div>
            </div>
          ))}
        </Carousel>
      </section>

      <ProductCarouselSection
        title="Top 10 sản phẩm bán chạy"
        products={topSellingQuery.data ?? []}
        loading={topSellingQuery.isLoading}
      />

      <ProductCarouselSection
        title="10 sản phẩm mới nhất"
        products={newestQuery.data ?? []}
        loading={newestQuery.isLoading}
      />

      <section className="space-y-4">
        <Typography.Title level={3} className="!mb-0 !text-slate-900">
          Tất cả sản phẩm
        </Typography.Title>

        {allProductsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : null}

        {!allProductsQuery.isLoading && allProducts.length === 0 ? (
          <Card>
            <Empty description="Không tìm thấy sản phẩm phù hợp" />
          </Card>
        ) : null}

        <Row gutter={[16, 16]}>
          {allProducts.map((product) => (
            <Col key={product.id} xs={24} sm={12} lg={8} xl={6}>
              <ProductCard product={product} />
            </Col>
          ))}
        </Row>

        <div ref={sentinelRef} className="h-10" />

        {allProductsQuery.isFetchingNextPage ? (
          <div className="flex justify-center pb-4">
            <Spin />
          </div>
        ) : null}

        {!allProductsQuery.hasNextPage && allProducts.length > 0 ? (
          <Typography.Paragraph className="!mb-0 text-center" type="secondary">
            Đã hiển thị hết sản phẩm.
          </Typography.Paragraph>
        ) : null}
      </section>
    </div>
  )
}