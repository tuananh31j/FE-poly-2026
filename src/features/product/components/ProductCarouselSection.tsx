import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Button, Carousel, Empty, Grid, Skeleton, Space, Typography } from 'antd'
import type { CarouselRef } from 'antd/es/carousel'
import { useRef } from 'react'

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
}: ProductCarouselSectionProps) =>{
    const screens = Grid.useBreakpoint()
    const carouselRef = useRef<CarouselRef>(null)

    const cardsPerSlide = screens.xxl ? 6 : screens.xl ? 5 : screens.lg ? 4 : screens.md ? 3 : screens.sm ? 2 : 1
    const hasMultipleSlides = products.length > cardsPerSlide

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <Typography.Title level={3} className="!mb-0 !text-slate-900">
                    {title}
                </Typography.Title>
                {hasMultipleSlides ? (
                <Space size={8}>
                    <Button
                    aria-label={`Trượt về trước danh sách ${title}`}
                    icon={<LeftOutlined />}
                    onClick={() => carouselRef.current?.prev()}
                    />
                    <Button
                    aria-label={`Trượt tới danh sách ${title}`}
                    icon={<RightOutlined />}
                    onClick={() => carouselRef.current?.next()}
                    />
                </Space>
                ) : null}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                {Array.from({ length: cardsPerSlide }).map((_, index) => (
                    <Skeleton.Node key={index} active className="!h-[300px] !w-full !max-w-none" />
                ))}
                </div>
            ) : null}

            {!loading && products.length === 0 ? <Empty description="Chưa có sản phẩm" /> : null}

            {!loading && products.length > 0 ? (
                <Carousel
                    ref={carouselRef}
                    className="home-product-carousel"
                    draggable
                    dots={hasMultipleSlides}
                    infinite={hasMultipleSlides}
                    slidesToShow={Math.min(cardsPerSlide, products.length)}
                    slidesToScroll={1}
                    speed={420}
                >
                    {products.map((product) => (
                        <div key={product.id}>
                        <div className="pb-2">
                            <ProductCard product={product} compact />
                        </div>
                        </div>
                    ))}
                </Carousel>
            ) : null}
        </section>
    )
}