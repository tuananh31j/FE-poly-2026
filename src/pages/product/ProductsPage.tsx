import { ShoppingCartOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Pagination,
  Radio,
  Row,
  Space,
  Spin,
  Typography,
} from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { getProductFilters, getProducts } from '@/features/product/api/product.api'
import { ProductCard } from '@/features/product/components/ProductCard'
import { queryKeys } from '@/shared/api/queryKeys'
import { ROUTE_PATHS } from '@/shared/constants/routes'

const PAGE_SIZE = 8
const PRICE_RANGES = [
  { value: '0-2000000', label: 'Dưới 2.000.000đ' },
  { value: '2000000-5000000', label: '2.000.000đ - 5.000.000đ' },
  { value: '5000000-10000000', label: '5.000.000đ - 10.000.000đ' },
  { value: '10000000-20000000', label: '10.000.000đ - 20.000.000đ' },
  { value: '20000000-', label: 'Trên 20.000.000đ' },
]

export const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const categoryId = searchParams.get('categoryId')?.trim() ?? ''
  const brand = searchParams.get('brand')?.trim() ?? ''
  const selectedBrands = brand
    ? brand
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
  const selectedColorIds = (searchParams.get('colorIds') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const selectedSizeIds = (searchParams.get('sizeIds') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const selectedPriceRanges = (searchParams.get('priceRanges') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const search = searchParams.get('search')?.trim() ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1

  const filtersQuery = useQuery({
    queryKey: queryKeys.products.filters,
    queryFn: getProductFilters,
  })

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list({
      page: currentPage,
      limit: PAGE_SIZE,
      categoryId,
      brand,
      colorIds: selectedColorIds,
      sizeIds: selectedSizeIds,
      priceRanges: selectedPriceRanges,
      search,
      isAvailable: true,
    }),
    queryFn: () =>
      getProducts({
        page: currentPage,
        limit: PAGE_SIZE,
        categoryId: categoryId || undefined,
        brand: selectedBrands.length > 0 ? selectedBrands.join(',') : undefined,
        colorIds: selectedColorIds,
        sizeIds: selectedSizeIds,
        priceRanges: selectedPriceRanges,
        search: search || undefined,
        isAvailable: true,
      }),
  })

  const selectedCategoryValue = categoryId || 'all'
  const categories = filtersQuery.data?.categories ?? []
  const brands = filtersQuery.data?.brands ?? []
  const colors = filtersQuery.data?.colors ?? []
  const sizes = filtersQuery.data?.sizes ?? []

  const handleFilterChange = (next: {
    categoryId?: string
    brands?: string[]
    colorIds?: string[]
    sizeIds?: string[]
    priceRanges?: string[]
    page?: string
  }) => {
    const params = new URLSearchParams(searchParams)

    const nextCategoryId = next.categoryId ?? categoryId
    const nextBrands = next.brands ?? selectedBrands
    const nextColorIds = next.colorIds ?? selectedColorIds
    const nextSizeIds = next.sizeIds ?? selectedSizeIds
    const nextPriceRanges = next.priceRanges ?? selectedPriceRanges
    const nextPage = next.page ?? '1'

    if (nextCategoryId) {
      params.set('categoryId', nextCategoryId)
    } else {
      params.delete('categoryId')
    }

    if (nextBrands.length > 0) {
      params.set('brand', nextBrands.join(','))
    } else {
      params.delete('brand')
    }

    if (nextColorIds.length > 0) {
      params.set('colorIds', nextColorIds.join(','))
    } else {
      params.delete('colorIds')
    }

    if (nextSizeIds.length > 0) {
      params.set('sizeIds', nextSizeIds.join(','))
    } else {
      params.delete('sizeIds')
    }

    if (nextPriceRanges.length > 0) {
      params.set('priceRanges', nextPriceRanges.join(','))
    } else {
      params.delete('priceRanges')
    }

    if (search) {
      params.set('search', search)
    } else {
      params.delete('search')
    }

    params.set('page', nextPage)
    setSearchParams(params)
  }

  const selectedCategoryName =
    categories.find((item) => item.id === categoryId)?.name ?? 'Tất cả danh mục'
  const selectedBrandName =
    selectedBrands.length > 0 ? `${selectedBrands.length} thương hiệu` : 'Tất cả thương hiệu'
  const selectedColorName =
    selectedColorIds.length > 0 ? `${selectedColorIds.length} màu` : 'Tất cả màu'
  const selectedSizeName =
    selectedSizeIds.length > 0 ? `${selectedSizeIds.length} kích thước` : 'Tất cả kích thước'
  const selectedPriceName =
    selectedPriceRanges.length > 0 ? `${selectedPriceRanges.length} mức giá` : 'Tất cả giá'
  const summaryText = `${selectedCategoryName} • ${selectedBrandName} • ${selectedColorName} • ${selectedSizeName} • ${selectedPriceName}`

  return (
    <div className="space-y-6 py-6">
      <Typography.Title level={2} className="!mb-0">
        Sản phẩm
      </Typography.Title>

      <Row gutter={[20, 20]} align="top">
        <Col xs={24} lg={7} xl={6}>
          <Card title="Bộ lọc sản phẩm" className="sticky top-24">
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Typography.Text strong>Danh mục</Typography.Text>
                <Radio.Group
                  className="mt-3 flex w-full flex-col gap-2"
                  value={selectedCategoryValue}
                  onChange={(event) => {
                    handleFilterChange({
                      categoryId: event.target.value === 'all' ? '' : String(event.target.value),
                    })
                  }}
                >
                  <Radio value="all">Tất cả danh mục</Radio>
                  {categories.map((item) => (
                    <Radio key={item.id} value={item.id}>
                      {item.name}
                    </Radio>
                  ))}
                </Radio.Group>
              </div>

              <div>
                <Typography.Text strong>Thương hiệu</Typography.Text>
                <Checkbox.Group
                  className="mt-3 flex w-full flex-col gap-2"
                  value={selectedBrands}
                  onChange={(values) => {
                    handleFilterChange({
                      brands: values.map((value) => String(value)),
                    })
                  }}
                >
                  {brands.map((item) => (
                    <Checkbox key={item} value={item}>
                      {item}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </div>

              <div>
                <Typography.Text strong>Màu sắc</Typography.Text>
                <Checkbox.Group
                  className="mt-3 flex w-full flex-col gap-2"
                  value={selectedColorIds}
                  onChange={(values) => {
                    handleFilterChange({
                      colorIds: values.map((value) => String(value)),
                    })
                  }}
                >
                  {colors.map((item) => (
                    <Checkbox key={item.id} value={item.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border border-slate-200"
                          style={{ backgroundColor: item.hexCode || '#e2e8f0' }}
                        />
                        {item.name}
                      </span>
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </div>

              <div>
                <Typography.Text strong>Kích thước</Typography.Text>
                <Checkbox.Group
                  className="mt-3 flex w-full flex-col gap-2"
                  value={selectedSizeIds}
                  onChange={(values) => {
                    handleFilterChange({
                      sizeIds: values.map((value) => String(value)),
                    })
                  }}
                >
                  {sizes.map((item) => (
                    <Checkbox key={item.id} value={item.id}>
                      {item.name}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </div>

              <div>
                <Typography.Text strong>Khoảng giá</Typography.Text>
                <Checkbox.Group
                  className="mt-3 flex w-full flex-col gap-2"
                  value={selectedPriceRanges}
                  onChange={(values) => {
                    handleFilterChange({
                      priceRanges: values.map((value) => String(value)),
                    })
                  }}
                >
                  {PRICE_RANGES.map((range) => (
                    <Checkbox key={range.value} value={range.value}>
                      {range.label}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </div>

              <Button
                onClick={() => {
                  const params = new URLSearchParams(searchParams)
                  params.delete('categoryId')
                  params.delete('brand')
                  params.delete('colorIds')
                  params.delete('sizeIds')
                  params.delete('priceRanges')
                  params.delete('page')
                  setSearchParams(params)
                }}
              >
                Xóa bộ lọc
              </Button>

              <Button
                type="primary"
                icon={<ShoppingCartOutlined />}
                onClick={() => navigate(ROUTE_PATHS.CHECKOUT)}
              >
                Xem giỏ hàng
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={17} xl={18}>
          <Space direction="vertical" size="middle" className="w-full">
            <Typography.Text type="secondary">Bộ lọc hiện tại: {summaryText}</Typography.Text>

            {productsQuery.isLoading ? (
              <div className="py-16 text-center">
                <Spin size="large" />
              </div>
            ) : null}

            {!productsQuery.isLoading && (productsQuery.data?.items.length ?? 0) === 0 ? (
              <Card>
                <Empty description="Không tìm thấy sản phẩm phù hợp" />
              </Card>
            ) : null}

            <Row gutter={[16, 16]}>
              {(productsQuery.data?.items ?? []).map((product) => (
                <Col key={product.id} xs={24} sm={12} lg={8} xl={6}>
                  <ProductCard product={product} />
                </Col>
              ))}
            </Row>

            {(productsQuery.data?.totalItems ?? 0) > 0 ? (
              <div className="flex justify-end pt-2">
                <Pagination
                  current={currentPage}
                  pageSize={PAGE_SIZE}
                  total={productsQuery.data?.totalItems ?? 0}
                  showSizeChanger={false}
                  onChange={(nextPage) => {
                    handleFilterChange({ page: String(nextPage) })
                  }}
                />
              </div>
            ) : null}
          </Space>
        </Col>
      </Row>
    </div>
  )
}
