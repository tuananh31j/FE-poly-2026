import { Empty, Grid, Skeleton, Typography } from 'antd'

import type { ProductCardItem } from '@/features/product/model/product.types'

import { ProductCard } from './ProductCard'

interface ProductCarouselSectionProps {
  title: string
  products: ProductCardItem[]
  loading?: boolean
}

export const ProductCarouselSection = ({
  title,
  products,
  loading = false,
}: ProductCarouselSectionProps) => {
  const screens = Grid.useBreakpoint()

  const cardsPerSlide = screens.lg ? 4 : screens.md ? 3 : screens.sm ? 2 : 1

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Typography.Title level={3} className="!mb-0 !text-slate-900">
          {title}
        </Typography.Title>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: cardsPerSlide }).map((_, index) => (
            <Skeleton.Node key={index} active className="!h-[300px] !w-full !max-w-none" />
          ))}
        </div>
      ) : null}

      {!loading && products.length === 0 ? <Empty description="Chưa có sản phẩm" /> : null}

      {!loading && products.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      ) : null}
    </section>
  )
}
