import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UploadProps } from 'antd'
import {
  Button,
  Card,
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
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  createAdminProductVariant,
  deleteAdminProductVariant,
  listAdminBrands,
  listAdminCategories,
  listAdminColors,
  listAdminProductVariants,
  listAdminSizes,
  updateAdminProduct,
  updateAdminProductVariant,
} from '@/features/admin/api/product-management.api'
import type {
  AdminProductVariantItem,
  UpdateAdminProductPayload,
  UpsertAdminProductVariantPayload,
} from '@/features/admin/model/product-management.types'
import { getProductDetail } from '@/features/product/api/product.api'
import { queryKeys } from '@/shared/api/queryKeys'
import { uploadImage } from '@/shared/api/upload.api'
import { buildDashboardProductsPath, ROUTE_PATHS } from '@/shared/constants/routes'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import { formatVndCurrency } from '@/shared/utils/currency'
import { normalizeRichTextValue } from '@/shared/utils/rich-text'

const VARIANT_PAGE_SIZE = 20
const PRODUCT_PLACEHOLDER = '/images/product-placeholder.svg'

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

const mergeUniqueStringArray = (current: string[], nextValue: string) => {
  if (current.includes(nextValue)) {
    return current
  }

  return [...current, nextValue]
}

interface ProductUpdateFormValues {
  name: string
  categoryId: string
  brandId?: string
  description?: string
  images?: string[]
  isAvailable: boolean
}

interface VariantFormValues {
  colorId?: string
  sizeId?: string
  price: number
  originalPrice?: number
  stockQuantity: number
  isAvailable: boolean
  images?: string[]
}

export const ProductUpdatePage = () => {
  const { productId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<ProductUpdateFormValues>()
  const [variantForm] = Form.useForm<VariantFormValues>()
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<AdminProductVariantItem | null>(null)
  const [variantPage, setVariantPage] = useState(1)
  const [uploadingCount, setUploadingCount] = useState(0)

  const productImages = normalizeStringArray(Form.useWatch('images', form))
  const variantFormImages = normalizeStringArray(Form.useWatch('images', variantForm))

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

  const productQuery = useQuery({
    queryKey: queryKeys.products.detail(productId ?? ''),
    queryFn: () => getProductDetail(String(productId)),
    enabled: Boolean(productId),
  })

  const variantsQuery = useQuery({
    queryKey: queryKeys.admin.productVariants(String(productId ?? ''), {
      page: variantPage,
      limit: VARIANT_PAGE_SIZE,
    }),
    enabled: Boolean(productId),
    queryFn: () =>
      listAdminProductVariants(String(productId), {
        page: variantPage,
        limit: VARIANT_PAGE_SIZE,
      }),
  })

  useEffect(() => {
    if (!productQuery.data) {
      return
    }

    form.setFieldsValue({
      name: productQuery.data.name,
      categoryId: productQuery.data.categoryId,
      brandId: productQuery.data.brandId || undefined,
      description: productQuery.data.description,
      images: productQuery.data.images,
      isAvailable: productQuery.data.isAvailable,
    })
  }, [form, productQuery.data])

  const validateImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      void message.error('Chỉ chấp nhận file ảnh')
      return false
    }

    if (file.size / 1024 / 1024 > 5) {
      void message.error('Kích thước ảnh tối đa là 5MB')
      return false
    }

    return true
  }

  const uploadProductImageFile = async (file: File, onSuccess: (url: string) => void) => {
    if (!validateImageFile(file)) {
      return
    }

    setUploadingCount((value) => value + 1)

    try {
      const uploaded = await uploadImage(file, 'products')
      onSuccess(uploaded.url)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload ảnh thất bại'
      void message.error(errorMessage)
    } finally {
      setUploadingCount((value) => Math.max(0, value - 1))
    }
  }

  const appendProductImage = (url: string) => {
    form.setFieldValue('images', mergeUniqueStringArray(productImages, url))
  }

  const removeProductImage = (url: string) => {
    form.setFieldValue(
      'images',
      productImages.filter((value) => value !== url)
    )
  }

  const createProductImageBeforeUpload: UploadProps['beforeUpload'] = (file) => {
    void uploadProductImageFile(file as File, appendProductImage)
    return Upload.LIST_IGNORE
  }

  const appendVariantFormImage = (url: string) => {
    variantForm.setFieldValue('images', mergeUniqueStringArray(variantFormImages, url))
  }

  const removeVariantFormImage = (url: string) => {
    variantForm.setFieldValue(
      'images',
      variantFormImages.filter((value) => value !== url)
    )
  }

  const variantFormImageBeforeUpload: UploadProps['beforeUpload'] = (file) => {
    void uploadProductImageFile(file as File, appendVariantFormImage)
    return Upload.LIST_IGNORE
  }

  const updateProductMutation = useMutation({
    mutationFn: (payload: UpdateAdminProductPayload) =>
      updateAdminProduct(String(productId), payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(String(productId)) }),
      ])
      void message.success('Cập nhật sản phẩm thành công')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const createVariantMutation = useMutation({
    mutationFn: (payload: UpsertAdminProductVariantPayload) =>
      createAdminProductVariant(String(productId), payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'product-variants', String(productId)],
        }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
      ])
      void message.success('Tạo biến thể thành công')
      setVariantModalOpen(false)
      setEditingVariant(null)
      variantForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updateVariantMutation = useMutation({
    mutationFn: (payload: Partial<UpsertAdminProductVariantPayload> & { colorId?: string | null; sizeId?: string | null }) =>
      updateAdminProductVariant(String(productId), String(editingVariant?.id), payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'product-variants', String(productId)],
        }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
      ])
      void message.success('Cập nhật biến thể thành công')
      setVariantModalOpen(false)
      setEditingVariant(null)
      variantForm.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) =>
      deleteAdminProductVariant(String(productId), variantId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'product-variants', String(productId)],
        }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
      ])
      void message.success('Đã xóa biến thể')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

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
        title: 'Ảnh',
        key: 'image',
        width: 96,
        align: 'center',
        render: (_, record) => (
          <Image
            src={record.images[0] ?? PRODUCT_PLACEHOLDER}
            alt={`Ảnh biến thể ${record.sku}`}
            width={48}
            height={48}
            className="rounded-md object-cover"
            fallback={PRODUCT_PLACEHOLDER}
            preview={false}
          />
        ),
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
        render: (value: number) => (
          <Typography.Text strong>{formatVndCurrency(value)}</Typography.Text>
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
        width: 200,
        render: (_, record) => (
          <Space>
            <Button
              onClick={() => {
                setEditingVariant(record)
                variantForm.setFieldsValue({
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
              title={`Xóa biến thể "${record.sku}"?`}
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => deleteVariantMutation.mutate(record.id)}
            >
              <Button danger loading={deleteVariantMutation.isPending}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteVariantMutation, variantForm]
  )

  const submitProductForm = (values: ProductUpdateFormValues) => {
    const normalizedBrandId = values.brandId?.trim()

    const payload: UpdateAdminProductPayload = {
      name: values.name.trim(),
      categoryId: values.categoryId,
      brandId: normalizedBrandId || undefined,
      description: normalizeRichTextValue(values.description),
      images: normalizeStringArray(values.images),
      isAvailable: values.isAvailable,
    }

    updateProductMutation.mutate(payload)
  }

  const submitVariantForm = (values: VariantFormValues) => {
    const normalizedColorId = values.colorId?.trim()
    const normalizedSizeId = values.sizeId?.trim()

    const payload: UpsertAdminProductVariantPayload = {
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
      updateVariantMutation.mutate({
        ...payload,
        colorId: normalizedColorId ?? null,
        sizeId: normalizedSizeId ?? null,
      })
      return
    }

    createVariantMutation.mutate(payload)
  }

  return (
    <div className="space-y-5">
      <Space align="center" size={12}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            navigate(buildDashboardProductsPath('list'))
          }}
        >
          Quay lại danh sách
        </Button>
        <Typography.Title level={3} className="!mb-0">
          Cập nhật sản phẩm
        </Typography.Title>
      </Space>

      <Card loading={productQuery.isLoading}>
        <Form<ProductUpdateFormValues>
          form={form}
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
              <Input placeholder="Nhập tên sản phẩm" />
            </Form.Item>

            <Form.Item
              name="categoryId"
              label="Danh mục"
              rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
            >
              <Select
                showSearch
                placeholder="Chọn danh mục"
                optionFilterProp="label"
                options={(categoriesQuery.data ?? []).map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
              />
            </Form.Item>
          </div>

          <Form.Item name="brandId" label="Brand">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn thương hiệu (nếu có)"
              options={(brandsQuery.data ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="Mô tả">
            <Form.Item name="description" noStyle>
              <RichTextEditor placeholder="Nhập mô tả sản phẩm..." minHeight={260} />
            </Form.Item>
          </Form.Item>

          <Form.Item label="Danh sách ảnh">
            <Space direction="vertical" size={10} className="w-full">
              <Upload
                multiple
                accept="image/*"
                showUploadList={false}
                beforeUpload={createProductImageBeforeUpload}
              >
                <Button icon={<UploadOutlined />} loading={uploadingCount > 0}>
                  Tải ảnh sản phẩm
                </Button>
              </Upload>

              {productImages.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {productImages.map((imageUrl) => (
                    <div
                      key={imageUrl}
                      className="w-[110px] rounded-md border border-slate-200 p-2"
                    >
                      <Image
                        src={imageUrl}
                        alt="Ảnh sản phẩm"
                        className="h-[70px] w-full rounded object-cover"
                        fallback={PRODUCT_PLACEHOLDER}
                      />
                      <Button
                        danger
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          removeProductImage(imageUrl)
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography.Text type="secondary">Chưa có ảnh sản phẩm.</Typography.Text>
              )}
            </Space>
          </Form.Item>
          <Form.Item name="images" hidden>
            <Input placeholder="Danh sách URL ảnh sản phẩm" />
          </Form.Item>

          <Form.Item name="isAvailable" label="Trạng thái bán" valuePropName="checked">
            <Switch checkedChildren="Đang bán" unCheckedChildren="Ngừng bán" />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                navigate(ROUTE_PATHS.DASHBOARD_PRODUCTS)
              }}
            >
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={updateProductMutation.isPending}>
              Lưu thay đổi
            </Button>
          </div>
        </Form>
      </Card>

      <Card
        title="Danh sách biến thể"
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
            Tạo biến thể
          </Button>
        }
      >
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
      </Card>

      <Modal
        title={editingVariant ? 'Cập nhật biến thể' : 'Tạo biến thể'}
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
          <Form.Item label="SKU">
            <Input disabled value={editingVariant?.sku} placeholder="SKU sẽ được hệ thống tự động tạo" />
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
              <InputNumber min={0} className="w-full" placeholder="Nhập giá bán" />
            </Form.Item>

            <Form.Item name="originalPrice" label="Giá gốc">
              <InputNumber min={0} className="w-full" placeholder="Nhập giá gốc (nếu có)" />
            </Form.Item>
          </div>

          <Form.Item
            name="stockQuantity"
            label="Tồn kho"
            rules={[{ required: true, message: 'Vui lòng nhập tồn kho' }]}
          >
            <InputNumber min={0} className="w-full" placeholder="Nhập số lượng tồn" />
          </Form.Item>

          <Form.Item label="Ảnh variant (upload file)">
            <Space direction="vertical" size={10} className="w-full">
              <Upload multiple accept="image/*" showUploadList={false} beforeUpload={variantFormImageBeforeUpload}>
                <Button icon={<UploadOutlined />} loading={uploadingCount > 0}>
                  Tải ảnh variant
                </Button>
              </Upload>

              {variantFormImages.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {variantFormImages.map((imageUrl) => (
                    <div
                      key={imageUrl}
                      className="w-[110px] rounded-md border border-slate-200 p-2"
                    >
                      <Image
                        src={imageUrl}
                        alt="Ảnh variant"
                        className="h-[70px] w-full rounded object-cover"
                        fallback={PRODUCT_PLACEHOLDER}
                      />
                      <Button
                        danger
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          removeVariantFormImage(imageUrl)
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Typography.Text type="secondary">Chưa có ảnh variant.</Typography.Text>
              )}
            </Space>
          </Form.Item>
          <Form.Item name="images" hidden>
            <Input placeholder="Danh sách URL ảnh variant" />
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
            <Button type="primary" htmlType="submit" loading={createVariantMutation.isPending || updateVariantMutation.isPending}>
              {editingVariant ? 'Lưu thay đổi' : 'Tạo biến thể'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}