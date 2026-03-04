import { Card, Rate, Tag, Typography } from 'antd'
import Highlighter from 'react-highlight-words'
import { Link } from 'react-router-dom'

import type { ProductCardItem } from '@/features/product/model/product.types'
import { buildProductDetailPath } from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'

const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

interface ProductCardProps {
  product: ProductCardItem
  compact?: boolean
  highlightText?: string
}

// worklog: 2026-03-04 21:01:01 | quochuy | cleanup | formatPriceLabel
// worklog: 2026-03-04 14:54:46 | trantu | refactor | formatPriceLabel
const formatPriceLabel = (priceFrom: number | null, priceTo: number | null) => {
  if (priceFrom === null || priceTo === null) {
    return 'Liên hệ'
  }

  if (priceFrom === priceTo) {
    return formatVndCurrency(priceFrom)
  }

  return `${formatVndCurrency(priceFrom)} - ${formatVndCurrency(priceTo)}`
}

// worklog: 2026-03-04 17:55:11 | ducanh | cleanup | ProductCard
export const ProductCard = ({ product, compact = false, highlightText }: ProductCardProps) => {
  const imageUrl = product.thumbnailUrl ?? product.images[0] ?? PRODUCT_PLACEHOLDER
  const searchWords = highlightText?.trim() ? [highlightText.trim()] : []

  return (
    <Link to={buildProductDetailPath(product.id)} className="block h-full">
      <Card
        hoverable
        className={`h-full overflow-hidden border-slate-200 ${compact ? '' : 'rounded-xl'}`}
        cover={
          <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
            <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
            {product.hasDiscount ? (
              <Tag color="red" className="!absolute !left-3 !top-3 !m-0">
                Khuyến mãi
              </Tag>
            ) : null}
          </div>
        }
      >
        <div className="space-y-2">
          <Typography.Title level={5} className="!mb-0 line-clamp-2 !text-base">
            {searchWords.length > 0 ? (
              <Highlighter
                autoEscape
                searchWords={searchWords}
                textToHighlight={product.name}
                highlightStyle={{ backgroundColor: '#FFF3A3', padding: 0 }}
              />
            ) : (
              product.name
            )}
          </Typography.Title>

          <Typography.Text type="secondary" className="line-clamp-1 text-xs uppercase">
            {product.brand}
          </Typography.Text>

          <Typography.Text strong className="!text-blue-700">
            {formatPriceLabel(product.priceFrom, product.priceTo)}
          </Typography.Text>

          <div className="flex items-center justify-between gap-2">
            <Rate disabled allowHalf value={product.averageRating} className="!text-[14px]" />
            <Typography.Text type="secondary">Đã bán: {product.soldCount}</Typography.Text>
          </div>
        </div>
      </Card>
    </Link>
  )
}
