import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  createAdminProduct,
  createAdminProductVariant,
  deleteAdminProduct,
  deleteAdminProductVariant,
  listAdminBrands,
  listAdminCategories,
  listAdminColors,
  listAdminProducts,
  listAdminProductVariants,
  listAdminSizes,
  updateAdminProduct,
  updateAdminProductVariant,
} from '@/features/admin/api/product-management.api'
import type {
  AdminProductItem,
  AdminProductVariantItem,
  CreateAdminProductPayload,
  UpdateAdminProductPayload,
  UpsertAdminProductVariantPayload,
} from '@/features/admin/model/product-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatVndCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'

const PAGE_SIZE = 10
const VARIANT_PAGE_SIZE = 20
const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

const createSlugFromName = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const parseAttributesInput = (value?: string) => {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    return undefined
  }

  return JSON.parse(normalizedValue) as Record<string, unknown>
}

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

const formatPriceRange = (product: AdminProductItem) => {
  if (product.priceFrom === null || product.priceTo === null) {
    return 'Liên hệ'
  }

  if (product.priceFrom === product.priceTo) {
    return formatVndCurrency(product.priceFrom)
  }

  return `${formatVndCurrency(product.priceFrom)} - ${formatVndCurrency(product.priceTo)}`
}

type ProductAvailabilityFilter = 'all' | 'available' | 'unavailable'

interface ProductFormValues {
  name: string
  slug: string
  categoryId: string
  brandId?: string
  customBrand?: string
  description?: string
  images?: string[]
  isAvailable: boolean
  metaTitle?: string
  metaDescription?: string
  attributesJson?: string
}

interface VariantFormValues {
  sku: string
  colorId?: string
  sizeId?: string
  price: number
  originalPrice?: number
  stockQuantity: number
  isAvailable: boolean
  images?: string[]
}

export const ProductManagementPage = () => {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const isCreateMode = searchParams.get('mode') === 'create'
  const [productForm] = Form.useForm<ProductFormValues>()
  const [variantForm] = Form.useForm<VariantFormValues>()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState<ProductAvailabilityFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')

  const [productModalOpen, setProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<AdminProductItem | null>(null)
  const [variantDrawerOpen, setVariantDrawerOpen] = useState(false)
  const [activeProductForVariants, setActiveProductForVariants] = useState<AdminProductItem | null>(null)
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<AdminProductVariantItem | null>(null)
  const [variantPage, setVariantPage] = useState(1)
  const activeEditingProduct = isCreateMode ? null : editingProduct

  const clearCreateModeQuery = () => {
    if (searchParams.get('mode') !== 'create') {
      return
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('mode')
    setSearchParams(nextSearchParams, { replace: true })
  }

  const categoriesQuery = useQuery({
    queryKey: queryKeys.admin.productMeta.categories,
    queryFn: listAdminCategories,
  })

  const brandsQuery = useQuery({
    queryKey: queryKeys.admin.productMeta.brands,
    queryFn: listAdminBrands,
  })

  const colorsQuery = useQuery({
    queryKey: queryKeys.admin.productMeta.colors,
    queryFn: listAdminColors,
  })

  const sizesQuery = useQuery({
    queryKey: queryKeys.admin.productMeta.sizes,
    queryFn: listAdminSizes,
  })

  const productsQuery = useQuery({
    queryKey: queryKeys.admin.products({
      page,
      limit: PAGE_SIZE,
      search: searchTerm,
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      brandId: brandFilter === 'all' ? undefined : brandFilter,
      isAvailable:
        availabilityFilter === 'all' ? undefined : availabilityFilter === 'available' ? true : false,
    }),
    queryFn: () =>
      listAdminProducts({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
        brandId: brandFilter === 'all' ? undefined : brandFilter,
        isAvailable:
          availabilityFilter === 'all' ? undefined : availabilityFilter === 'available' ? true : false,
      }),
  })

  const variantsQuery = useQuery({
    queryKey: queryKeys.admin.productVariants(activeProductForVariants?.id ?? '', {
      page: variantPage,
      limit: VARIANT_PAGE_SIZE,
    }),
    enabled: Boolean(activeProductForVariants?.id) && variantDrawerOpen,
    queryFn: () =>
      listAdminProductVariants(activeProductForVariants!.id, {
        page: variantPage,
        limit: VARIANT_PAGE_SIZE,
      }),
  })

  const invalidateProductData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ])
  }

  const createProductMutation = useMutation({
    mutationFn: createAdminProduct,
    onSuccess: async () => {
      await invalidateProductData()
      void message.success('Tạo sản phẩm thành công')
      setProductModalOpen(false)
      setEditingProduct(null)
      productForm.resetFields()
      clearCreateModeQuery()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: UpdateAdminProductPayload }) =>
      updateAdminProduct(productId, payload),
    onSuccess: async () => {
      await invalidateProductData()
      void message.success('Cập nhật sản phẩm thành công')
      setProductModalOpen(false)
      setEditingProduct(null)
      productForm.resetFields()
      clearCreateModeQuery()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: deleteAdminProduct,
    onSuccess: async () => {
      await invalidateProductData()
      void message.success('Đã xóa sản phẩm')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const createVariantMutation = useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: string
      payload: UpsertAdminProductVariantPayload
    }) => createAdminProductVariant(productId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'product-variants', activeProductForVariants?.id],
        }),
        invalidateProductData(),
      ])
      void message.success('Tạo variant thành công')
      setVariantModalOpen(false)
      setEditingVariant(null)
      variantForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateVariantMutation = useMutation({
    mutationFn: ({
      productId,
      variantId,
      payload,
    }: {
      productId: string
      variantId: string
      payload: Partial<UpsertAdminProductVariantPayload> & { colorId?: string | null }
    }) => updateAdminProductVariant(productId, variantId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'product-variants', activeProductForVariants?.id],
        }),
        invalidateProductData(),
      ])
      void message.success('Cập nhật variant thành công')
      setVariantModalOpen(false)
      setEditingVariant(null)
      variantForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: ({ productId, variantId }: { productId: string; variantId: string }) =>
      deleteAdminProductVariant(productId, variantId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'product-variants', activeProductForVariants?.id],
        }),
        invalidateProductData(),
      ])
      void message.success('Đã xóa variant')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const categoriesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name)
    }
    return map
  }, [categoriesQuery.data])

  const productColumns: ColumnsType<AdminProductItem> = useMemo(
    () => [
      {
        title: 'Sản phẩm',
        key: 'product',
        render: (_, record) => (
          <div className="flex min-w-0 items-start gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              <Image
                src={record.thumbnailUrl ?? record.images[0] ?? PRODUCT_PLACEHOLDER}
                alt={record.name}
                className="h-full w-full object-cover"
                preview={false}
                fallback={PRODUCT_PLACEHOLDER}
              />
            </div>
            <Space direction="vertical" size={0} className="min-w-0">
              <Typography.Text strong className="line-clamp-1">
                {record.name}
              </Typography.Text>
              <Typography.Text type="secondary" className="text-xs">
                slug: {record.slug}
              </Typography.Text>
            </Space>
          </div>
        ),
      },
      {
        title: 'Danh mục',
        dataIndex: 'categoryId',
        key: 'categoryId',
        width: 170,
        render: (value: string) => categoriesById.get(value) ?? value,
      },
      {
        title: 'Brand',
        key: 'brand',
        width: 160,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Typography.Text>{record.brand}</Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              {record.brandId ? `id: ${record.brandId}` : 'brand text'}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Giá',
        key: 'price',
        width: 180,
        render: (_, record) => <Typography.Text strong>{formatPriceRange(record)}</Typography.Text>,
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isAvailable',
        key: 'isAvailable',
        width: 120,
        render: (value: boolean) => (
          <Tag color={value ? 'green' : 'default'}>{value ? 'Đang bán' : 'Ngừng bán'}</Tag>
        ),
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value: string) => (
          <Typography.Text type="secondary" className="text-xs">
            {formatDateTime(value)}
          </Typography.Text>
        ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 320,
        render: (_, record) => (
          <Space wrap>
            <Button
              icon={<TagsOutlined />}
              onClick={() => {
                setActiveProductForVariants(record)
                setVariantPage(1)
                setVariantDrawerOpen(true)
              }}
            >
              Variants
            </Button>

            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingProduct(record)
                productForm.setFieldsValue({
                  name: record.name,
                  slug: record.slug,
                  categoryId: record.categoryId,
                  brandId: record.brandId,
                  customBrand: record.brandId ? undefined : record.brand,
                  description: record.description,
                  images: record.images,
                  isAvailable: record.isAvailable,
                  metaTitle: record.metaTitle,
                  metaDescription: record.metaDescription,
                  attributesJson: record.attributes ? JSON.stringify(record.attributes, null, 2) : undefined,
                })
                setProductModalOpen(true)
              }}
            >
              Sửa
            </Button>

            <Popconfirm
              title={`Xóa sản phẩm "${record.name}"?`}
              description="Sản phẩm và toàn bộ variants sẽ bị xóa."
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                deleteProductMutation.mutate(record.id)
              }}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteProductMutation.isPending}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [categoriesById, deleteProductMutation, productForm]
  )

  const variantColumns: ColumnsType<AdminProductVariantItem> = useMemo(
    () => [
      {
        title: 'SKU',
        dataIndex: 'sku',
        key: 'sku',
        width: 180,
        render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
      },
      {
        title: 'Màu',
        key: 'color',
        width: 180,
        render: (_, record) => (
          <Space size={8}>
            {record.colorHex ? (
              <span
                className="inline-block h-3 w-3 rounded-full border border-slate-300"
                style={{ backgroundColor: record.colorHex }}
              />
            ) : null}
            <Typography.Text>{record.color || 'Không chọn'}</Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Size',
        dataIndex: 'size',
        key: 'size',
        width: 120,
      },
      {
        title: 'Giá',
        dataIndex: 'price',
        key: 'price',
        width: 160,
        render: (value: number) => <Typography.Text strong>{formatVndCurrency(value)}</Typography.Text>,
      },
      {
        title: 'Tồn kho',
        dataIndex: 'stockQuantity',
        key: 'stockQuantity',
        width: 110,
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isAvailable',
        key: 'isAvailable',
        width: 120,
        render: (value: boolean) => (
          <Tag color={value ? 'green' : 'default'}>{value ? 'Còn hàng' : 'Hết hàng'}</Tag>
        ),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 220,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingVariant(record)
                variantForm.setFieldsValue({
                  sku: record.sku,
                  colorId: record.colorId,
                  sizeId: record.sizeId,
                  price: record.price,
                  originalPrice: record.originalPrice,
                  stockQuantity: record.stockQuantity,
                  isAvailable: record.isAvailable,
                  images: record.images,
                })
                setVariantModalOpen(true)
              }}
            >
              Sửa
            </Button>

            <Popconfirm
              title={`Xóa variant "${record.sku}"?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => {
                if (!activeProductForVariants) {
                  return
                }

                deleteVariantMutation.mutate({
                  productId: activeProductForVariants.id,
                  variantId: record.id,
                })
              }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deleteVariantMutation.isPending}
              >
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [activeProductForVariants, deleteVariantMutation, variantForm]
  )

  const submitProductForm = (values: ProductFormValues) => {
    try {
      const parsedAttributes = parseAttributesInput(values.attributesJson)
      const normalizedBrandId = values.brandId?.trim()
      const normalizedCustomBrand = values.customBrand?.trim()

      if (!normalizedBrandId && !normalizedCustomBrand) {
        void message.error('Vui lòng chọn brand hoặc nhập brand tùy chỉnh')
        return
      }

      const payload: CreateAdminProductPayload = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        categoryId: values.categoryId,
        brandId: normalizedBrandId || undefined,
        brand: normalizedCustomBrand || undefined,
        description: values.description?.trim() || undefined,
        attributes: parsedAttributes,
        images: normalizeStringArray(values.images),
        isAvailable: values.isAvailable,
        metaTitle: values.metaTitle?.trim() || undefined,
        metaDescription: values.metaDescription?.trim() || undefined,
      }

      if (activeEditingProduct) {
        updateProductMutation.mutate({
          productId: activeEditingProduct.id,
          payload: payload as UpdateAdminProductPayload,
        })
        return
      }

      createProductMutation.mutate(payload)
    } catch {
      void message.error('Trường attributes phải là JSON hợp lệ')
    }
  }

  const submitVariantForm = (values: VariantFormValues) => {
    if (!activeProductForVariants) {
      return
    }

    const normalizedColorId = values.colorId?.trim()
    const normalizedSizeId = values.sizeId?.trim()

    const payload: UpsertAdminProductVariantPayload = {
      sku: values.sku.trim(),
      colorId: normalizedColorId || undefined,
      sizeId: normalizedSizeId || undefined,
      price: Number(values.price),
      originalPrice:
        values.originalPrice === undefined || values.originalPrice === null
          ? undefined
          : Number(values.originalPrice),
      stockQuantity: Number(values.stockQuantity ?? 0),
      isAvailable: values.isAvailable,
      images: normalizeStringArray(values.images),
    }

    if (editingVariant) {
      const updatePayload: Partial<UpsertAdminProductVariantPayload> & {
        colorId?: string | null
        sizeId?: string | null
      } = {
        ...payload,
        colorId: normalizedColorId ?? null,
        sizeId: normalizedSizeId ?? null,
      }

      updateVariantMutation.mutate({
        productId: activeProductForVariants.id,
        variantId: editingVariant.id,
        payload: updatePayload,
      })
      return
    }

    createVariantMutation.mutate({
      productId: activeProductForVariants.id,
      payload,
    })
  }

  return (
    <div className="space-y-5">
      <Typography.Title level={3} className="!mb-0">
        Admin - Quản lý sản phẩm
      </Typography.Title>
      <Typography.Paragraph className="!mb-0" type="secondary">
        CRUD sản phẩm và variants. Ở form variant, `color` và `size` là tùy chọn.
      </Typography.Paragraph>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            allowClear
            className="w-full md:max-w-sm"
            placeholder="Tìm theo tên hoặc slug"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              if (!event.target.value.trim()) {
                setPage(1)
                setSearchTerm('')
              }
            }}
            onSearch={(value) => {
              setPage(1)
              setSearchTerm(value.trim())
            }}
          />

          <Select
            className="w-full md:w-48"
            value={categoryFilter}
            options={[
              { label: 'Tất cả danh mục', value: 'all' },
              ...(categoriesQuery.data ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              })),
            ]}
            onChange={(value) => {
              setPage(1)
              setCategoryFilter(value)
            }}
          />

          <Select
            className="w-full md:w-44"
            value={availabilityFilter}
            options={[
              { label: 'Tất cả trạng thái', value: 'all' },
              { label: 'Đang bán', value: 'available' },
              { label: 'Ngừng bán', value: 'unavailable' },
            ]}
            onChange={(value) => {
              setPage(1)
              setAvailabilityFilter(value as ProductAvailabilityFilter)
            }}
          />

          <Select
            className="w-full md:w-48"
            value={brandFilter}
            options={[
              { label: 'Tất cả brand', value: 'all' },
              ...(brandsQuery.data ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              })),
            ]}
            onChange={(value) => {
              setPage(1)
              setBrandFilter(value)
            }}
          />

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingProduct(null)
              productForm.resetFields()
              productForm.setFieldsValue({
                isAvailable: true,
              })
              setProductModalOpen(true)
            }}
          >
            Tạo sản phẩm
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={productColumns}
          dataSource={productsQuery.data?.items ?? []}
          loading={productsQuery.isLoading || productsQuery.isFetching}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: productsQuery.data?.totalItems ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => {
              setPage(nextPage)
            },
          }}
        />
      </Card>

      <Modal
        title={activeEditingProduct ? 'Cập nhật sản phẩm' : 'Tạo sản phẩm'}
        open={isCreateMode || productModalOpen}
        onCancel={() => {
          setProductModalOpen(false)
          setEditingProduct(null)
          productForm.resetFields()
          productForm.setFieldsValue({
            isAvailable: true,
          })
          clearCreateModeQuery()
        }}
        width={840}
        footer={null}
        destroyOnHidden
      >
        <Form<ProductFormValues>
          form={productForm}
          layout="vertical"
          initialValues={{
            isAvailable: true,
          }}
          onFinish={submitProductForm}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              name="name"
              label="Tên sản phẩm"
              rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
            >
              <Input
                onBlur={(event) => {
                  const nextName = event.target.value
                  const currentSlug = productForm.getFieldValue('slug')

                  if (!currentSlug?.trim()) {
                    productForm.setFieldValue('slug', createSlugFromName(nextName))
                  }
                }}
              />
            </Form.Item>

            <Form.Item
              name="slug"
              label="Slug"
              rules={[{ required: true, message: 'Vui lòng nhập slug' }]}
            >
              <Input
                addonAfter={
                  <Button
                    type="link"
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => {
                      const currentName = productForm.getFieldValue('name') ?? ''
                      productForm.setFieldValue('slug', createSlugFromName(currentName))
                    }}
                  >
                    Tạo
                  </Button>
                }
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              name="categoryId"
              label="Danh mục"
              rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={(categoriesQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
              />
            </Form.Item>

            <Form.Item name="brandId" label="Brand (ưu tiên dùng brandId)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn brand đã có"
                options={(brandsQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
              />
            </Form.Item>
          </div>

          <Form.Item name="customBrand" label="Brand tùy chỉnh (nếu không chọn brandId)">
            <Input placeholder="Ví dụ: Predator" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item name="images" label="Danh sách ảnh (nhập URL, Enter để thêm)">
            <Select mode="tags" tokenSeparators={[',']} placeholder="https://..." />
          </Form.Item>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="metaTitle" label="Meta title">
              <Input />
            </Form.Item>
            <Form.Item name="metaDescription" label="Meta description">
              <Input />
            </Form.Item>
          </div>

          <Form.Item name="attributesJson" label="Attributes JSON (tùy chọn)">
            <Input.TextArea rows={4} placeholder='{"weight":"19oz","material":"Maple"}' />
          </Form.Item>

          <Form.Item name="isAvailable" label="Trạng thái bán" valuePropName="checked">
            <Switch checkedChildren="Đang bán" unCheckedChildren="Ngừng bán" />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setProductModalOpen(false)
                setEditingProduct(null)
                productForm.resetFields()
                productForm.setFieldsValue({
                  isAvailable: true,
                })
                clearCreateModeQuery()
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createProductMutation.isPending || updateProductMutation.isPending}
            >
              {activeEditingProduct ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>

      <Drawer
        title={`Variants - ${activeProductForVariants?.name ?? ''}`}
        open={variantDrawerOpen}
        width={980}
        onClose={() => {
          setVariantDrawerOpen(false)
          setActiveProductForVariants(null)
          setVariantPage(1)
          setEditingVariant(null)
          setVariantModalOpen(false)
          variantForm.resetFields()
        }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingVariant(null)
              variantForm.resetFields()
              variantForm.setFieldsValue({
                stockQuantity: 0,
                isAvailable: true,
              })
              setVariantModalOpen(true)
            }}
          >
            Tạo variant
          </Button>
        }
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" className="!mb-3">
          Lưu ý: `color` và `size` là trường tùy chọn.
        </Typography.Paragraph>

        <Table
          rowKey="id"
          columns={variantColumns}
          dataSource={variantsQuery.data?.items ?? []}
          loading={variantsQuery.isLoading || variantsQuery.isFetching}
          pagination={{
            current: variantPage,
            pageSize: VARIANT_PAGE_SIZE,
            total: variantsQuery.data?.totalItems ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => {
              setVariantPage(nextPage)
            },
          }}
        />
      </Drawer>

      <Modal
        title={editingVariant ? 'Cập nhật variant' : 'Tạo variant'}
        open={variantModalOpen}
        onCancel={() => {
          setVariantModalOpen(false)
          setEditingVariant(null)
          variantForm.resetFields()
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<VariantFormValues>
          form={variantForm}
          layout="vertical"
          initialValues={{
            stockQuantity: 0,
            isAvailable: true,
          }}
          onFinish={submitVariantForm}
        >
          <Form.Item
            name="sku"
            label="SKU"
            rules={[{ required: true, message: 'Vui lòng nhập SKU' }]}
          >
            <Input />
          </Form.Item>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="colorId" label="Màu sắc (tùy chọn)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Không chọn màu cũng được"
                options={(colorsQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
              />
            </Form.Item>

            <Form.Item name="sizeId" label="Size (tùy chọn)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Không chọn size cũng được"
                options={(sizesQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              name="price"
              label="Giá bán"
              rules={[{ required: true, message: 'Vui lòng nhập giá bán' }]}
            >
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            <Form.Item name="originalPrice" label="Giá gốc">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
          </div>

          <Form.Item
            name="stockQuantity"
            label="Tồn kho"
            rules={[{ required: true, message: 'Vui lòng nhập tồn kho' }]}
          >
            <InputNumber min={0} className="w-full" />
          </Form.Item>

          <Form.Item name="images" label="Danh sách ảnh variant (URL)">
            <Select mode="tags" tokenSeparators={[',']} placeholder="https://..." />
          </Form.Item>

          <Form.Item name="isAvailable" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Còn hàng" unCheckedChildren="Hết hàng" />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setVariantModalOpen(false)
                setEditingVariant(null)
                variantForm.resetFields()
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createVariantMutation.isPending || updateVariantMutation.isPending}
            >
              {editingVariant ? 'Lưu thay đổi' : 'Tạo variant'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}