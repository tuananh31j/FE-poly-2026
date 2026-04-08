import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Image,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { listAdminCategories } from '@/features/admin/api/product-management.api'
import { getProductDetail } from '@/features/product/api/product.api'
import type { ProductVariantItem } from '@/features/product/model/product.types'
import { queryKeys } from '@/shared/api/queryKeys'
import {
  buildDashboardProductEditPath,
  buildDashboardProductsPath,
} from '@/shared/constants/routes'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

const normalizeAttributeValue = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value, null, 2)
}

export const ProductAdminDetailPage = () => {
  const navigate = useNavigate()
  const { productId = '' } = useParams()

  const productQuery = useQuery({
    queryKey: queryKeys.products.detail(productId),
    enabled: Boolean(productId),
    queryFn: () => getProductDetail(productId),
  })

  const categoriesQuery = useQuery({
    queryKey: queryKeys.admin.productMeta.categories,
    queryFn: listAdminCategories,
  })

  const categoryName = useMemo(() => {
    const categories = categoriesQuery.data ?? []
    return categories.find((item) => item.id === productQuery.data?.categoryId)?.name
  }, [categoriesQuery.data, productQuery.data?.categoryId])

  const variantColumns: ColumnsType<ProductVariantItem> = useMemo(
    () => [
      {
        title: 'Biến thể',
        key: 'variant',
        render: (_, record) => (
          <div className="flex min-w-[260px] items-start gap-3">
            <Image
              src={record.images[0] ?? PRODUCT_PLACEHOLDER}
              alt={record.sku}
              width={56}
              height={56}
              className="rounded-lg object-cover"
              fallback={PRODUCT_PLACEHOLDER}
              preview={false}
            />
            <div className="min-w-0 flex-1">
              <Typography.Text strong className="block">
                {record.color || 'Không màu'} / {record.size}
              </Typography.Text>
              <Typography.Text type="secondary" className="block text-xs">
                SKU: {record.sku}
              </Typography.Text>
            </div>
          </div>
        ),
      },
      {
        title: 'Giá bán',
        dataIndex: 'price',
        key: 'price',
        width: 150,
        render: (value: number) => <Typography.Text strong>{formatVndCurrency(value)}</Typography.Text>,
      },
      {
        title: 'Giá gốc',
        key: 'originalPrice',
        width: 150,
        render: (_, record) =>
          record.originalPrice ? (
            <Typography.Text type="secondary">{formatVndCurrency(record.originalPrice)}</Typography.Text>
          ) : (
            'N/A'
          ),
      },
      {
        title: 'Tồn kho',
        dataIndex: 'stockQuantity',
        key: 'stockQuantity',
        width: 110,
      },
      {
        title: 'Trạng thái',
        key: 'isAvailable',
        width: 130,
        render: (_, record) => (
          <Tag color={record.isAvailable ? 'green' : 'default'}>
            {record.isAvailable ? 'Đang bán' : 'Ngừng bán'}
          </Tag>
        ),
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
    ],
    []
  )

  const attributeItems = useMemo(() => {
    return Object.entries(productQuery.data?.attributes ?? {}).map(([key, value]) => ({
      key,
      label: key,
      children: (
        <Typography.Text className="whitespace-pre-wrap">
          {normalizeAttributeValue(value)}
        </Typography.Text>
      ),
    }))
  }, [productQuery.data?.attributes])

  if (productQuery.isLoading) {
    return (
      <Card loading>
        <div className="h-64" />
      </Card>
    )
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không tải được chi tiết sản phẩm"
        description={productQuery.error instanceof Error ? productQuery.error.message : undefined}
      />
    )
  }

  const product = productQuery.data
  const availableVariantCount = product.variants.filter((variant) => variant.isAvailable).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1">
            Chi tiết sản phẩm admin
          </Typography.Title>
          <Typography.Text type="secondary">
            Xem đầy đủ thông tin sản phẩm, biến thể và chuyển nhanh sang form sửa.
          </Typography.Text>
        </div>

        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              navigate(buildDashboardProductsPath('list'))
            }}
          >
            Quay lại danh sách
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              navigate(buildDashboardProductEditPath(product.id))
            }}
          >
            Chỉnh sửa
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8} xl={6}>
          <Card>
            <Statistic title="Số biến thể" value={product.variants.length} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={6}>
          <Card>
            <Statistic title="Biến thể đang bán" value={availableVariantCount} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={6}>
          <Card>
            <Statistic title="Đã bán" value={product.soldCount} />
          </Card>
        </Col>
        <Col xs={24} md={8} xl={6}>
          <Card>
            <Statistic title="Đánh giá" value={product.reviewCount} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="Thông tin sản phẩm">
            <Descriptions
              bordered
              column={1}
              items={[
                {
                  key: 'name',
                  label: 'Tên sản phẩm',
                  children: product.name,
                },
                {
                  key: 'brand',
                  label: 'Thương hiệu',
                  children: product.brand,
                },
                {
                  key: 'category',
                  label: 'Danh mục',
                  children: categoryName ?? product.categoryId,
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  children: (
                    <Tag color={product.isAvailable ? 'green' : 'default'}>
                      {product.isAvailable ? 'Đang bán' : 'Ngừng bán'}
                    </Tag>
                  ),
                },
                {
                  key: 'rating',
                  label: 'Đánh giá trung bình',
                  children: product.averageRating.toFixed(1),
                },
                {
                  key: 'createdAt',
                  label: 'Tạo lúc',
                  children: formatDateTime(product.createdAt),
                },
                {
                  key: 'updatedAt',
                  label: 'Cập nhật lúc',
                  children: formatDateTime(product.updatedAt),
                },
                {
                  key: 'description',
                  label: 'Mô tả',
                  children: product.description ? (
                    <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                      {product.description}
                    </Typography.Paragraph>
                  ) : (
                    'Chưa có mô tả'
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card title="Ảnh sản phẩm">
            {product.images.length > 0 ? (
              <Image.PreviewGroup>
                <div className="grid grid-cols-2 gap-3">
                  {product.images.map((image, index) => (
                    <Image
                      key={`${image}-${index}`}
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="h-40 w-full rounded-lg object-cover"
                      fallback={PRODUCT_PLACEHOLDER}
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <Empty description="Sản phẩm chưa có ảnh" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Thuộc tính mở rộng">
        {attributeItems.length > 0 ? (
          <Descriptions bordered column={1} items={attributeItems} />
        ) : (
          <Empty description="Chưa có thuộc tính mở rộng" />
        )}
      </Card>

      <Card title={`Danh sách biến thể (${product.variants.length})`}>
        <Table
          rowKey="id"
          columns={variantColumns}
          dataSource={product.variants}
          pagination={false}
          locale={{
            emptyText: <Empty description="Sản phẩm chưa có biến thể" />,
          }}
          scroll={{ x: 960 }}
        />
      </Card>
    </div>
  )
}
