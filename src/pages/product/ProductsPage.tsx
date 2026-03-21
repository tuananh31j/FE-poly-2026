import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Col,
  Empty,
  Pagination,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd'
import { useSearchParams } from 'react-router-dom'

import { getProductFilters, getProducts } from '@/features/product/api/product.api'
import { ProductCard } from '@/features/product/components/ProductCard'
import { queryKeys } from '@/shared/api/queryKeys'

const PAGE_SIZE = 12

export const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const categoryId = searchParams.get('categoryId')?.trim() ?? ''
  const brand = searchParams.get('brand')?.trim() ?? ''
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
      search,
      isAvailable: true,
    }),
    queryFn: () =>
      getProducts({
        page: currentPage,
        limit: PAGE_SIZE,
        categoryId: categoryId || undefined,
        brand: brand || undefined,
        search: search || undefined,
        isAvailable: true,
      }),
  })

  const selectedCategoryValue = categoryId || 'all'
  const selectedBrandValue = brand || 'all'
  const categories = filtersQuery.data?.categories ?? []
  const brands = filtersQuery.data?.brands ?? []

  const handleFilterChange = (next: { categoryId?: string; brand?: string; page?: string }) => {
    const params = new URLSearchParams(searchParams)

    const nextCategoryId = next.categoryId ?? categoryId
    const nextBrand = next.brand ?? brand
    const nextPage = next.page ?? '1'

    if (nextCategoryId) {
      params.set('categoryId', nextCategoryId)
    } else {
      params.delete('categoryId')
    }

    if (nextBrand) {
      params.set('brand', nextBrand)
    } else {
      params.delete('brand')
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
  const selectedBrandName = brand || 'Tất cả thương hiệu'
  const summaryText = `${selectedCategoryName} • ${selectedBrandName}`

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
                <Select
                  className="mt-3 w-full"
                  value={selectedBrandValue}
                  onChange={(value) => {
                    handleFilterChange({
                      brand: value === 'all' ? '' : String(value),
                    })
                  }}
                  options={[
                    { label: 'Tất cả thương hiệu', value: 'all' },
                    ...brands.map((item) => ({ label: item, value: item })),
                  ]}
                />
              </div>

              <Button
                onClick={() => {
                  const params = new URLSearchParams(searchParams)
                  params.delete('categoryId')
                  params.delete('brand')
                  params.delete('page')
                  setSearchParams(params)
                }}
              >
                Xóa bộ lọc
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={17} xl={18}>
          <Space direction="vertical" size="middle" className="w-full">
            <Typography.Text type="secondary">
              Bộ lọc hiện tại: {summaryText}
            </Typography.Text>

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
                <Col key={product.id} xs={24} sm={12} xl={8}>
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
