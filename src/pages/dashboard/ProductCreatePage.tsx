import {
  ArrowLeftOutlined,
  BoldOutlined,
  DeleteOutlined,
  ItalicOutlined,
  OrderedListOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  createAdminProduct,
  createAdminProductVariant,
  listAdminBrands,
  listAdminCategories,
  listAdminColors,
  listAdminSizes,
} from '@/features/admin/api/product-management.api'
import type {
  CreateAdminProductPayload,
  UpsertAdminProductVariantPayload,
} from '@/features/admin/model/product-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { ROUTE_PATHS } from '@/shared/constants/routes'

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

interface ProductVariantFormValues {
  sku: string
  colorId?: string
  sizeId?: string
  price: number
  originalPrice?: number
  stockQuantity: number
  isAvailable: boolean
  images?: string[]
}

interface ProductCreateFormValues {
  name: string
  categoryId: string
  brandId: string
  description?: string
  images?: string[]
  isAvailable: boolean
  metaTitle?: string
  metaDescription?: string
  attributesJson?: string
  variants: ProductVariantFormValues[]
}

const toVariantPayload = (variant: ProductVariantFormValues): UpsertAdminProductVariantPayload => {
  return {
    sku: variant.sku.trim(),
    colorId: variant.colorId?.trim() || undefined,
    sizeId: variant.sizeId?.trim() || undefined,
    price: Number(variant.price),
    originalPrice:
      variant.originalPrice === undefined || variant.originalPrice === null
        ? undefined
        : Number(variant.originalPrice),
    stockQuantity: Number(variant.stockQuantity ?? 0),
    isAvailable: variant.isAvailable,
    images: normalizeStringArray(variant.images),
  }
}

export const ProductCreatePage = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [form] = Form.useForm<ProductCreateFormValues>()
  const descriptionEditorRef = useRef<TextAreaRef>(null)
  const descriptionValue = Form.useWatch('description', form) ?? ''

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

  const insertDescriptionText = (prefix: string, suffix = '', fallbackText = 'nội dung') => {
    const textarea = descriptionEditorRef.current?.resizableTextArea?.textArea
    const current = form.getFieldValue('description') ?? ''

    if (!textarea) {
      form.setFieldValue('description', `${current}${prefix}${fallbackText}${suffix}`)
      return
    }

    const start = textarea.selectionStart ?? current.length
    const end = textarea.selectionEnd ?? current.length
    const selectedText = current.slice(start, end) || fallbackText
    const nextValue = `${current.slice(0, start)}${prefix}${selectedText}${suffix}${current.slice(end)}`

    form.setFieldValue('description', nextValue)

    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + prefix.length + selectedText.length + suffix.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const createProductMutation = useMutation({
    mutationFn: async (values: ProductCreateFormValues) => {
      const parsedAttributes = parseAttributesInput(values.attributesJson)
      const slug = createSlugFromName(values.name)

      if (!slug) {
        throw new Error('Tên sản phẩm không hợp lệ để tạo slug')
      }

      const payload: CreateAdminProductPayload = {
        name: values.name.trim(),
        slug,
        categoryId: values.categoryId,
        brandId: values.brandId.trim(),
        description: values.description?.trim() || undefined,
        attributes: parsedAttributes,
        images: normalizeStringArray(values.images),
        isAvailable: values.isAvailable,
        metaTitle: values.metaTitle?.trim() || undefined,
        metaDescription: values.metaDescription?.trim() || undefined,
      }

      let createdProduct = await createAdminProduct(payload)

      for (let index = 0; index < values.variants.length; index += 1) {
        const variantPayload = toVariantPayload(values.variants[index])

        try {
          await createAdminProductVariant(createdProduct.id, variantPayload)
        } catch (error) {
          const messageSuffix = error instanceof Error ? ` ${error.message}` : ''
          throw new Error(
            `Đã tạo sản phẩm nhưng lỗi khi tạo biến thể #${index + 1}.${messageSuffix}`.trim()
          )
        }
      }

      return createdProduct
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ])

      void message.success('Tạo sản phẩm thành công')
      navigate(ROUTE_PATHS.DASHBOARD_PRODUCTS)
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const handleSubmit = (values: ProductCreateFormValues) => {
    createProductMutation.mutate(values)
  }

  return (
    <div className="space-y-5">
      <Space align="center" size={12}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            navigate(ROUTE_PATHS.DASHBOARD_PRODUCTS)
          }}
        >
          Quay lại danh sách
        </Button>
        <Typography.Title level={3} className="!mb-0">
          Tạo sản phẩm
        </Typography.Title>
      </Space>

      <Typography.Paragraph className="!mb-0" type="secondary">
        Form tạo sản phẩm theo page riêng. Mô tả dùng editor và biến thể dùng form động.
      </Typography.Paragraph>

      <Card>
        <Form<ProductCreateFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            isAvailable: true,
            variants: [
              {
                stockQuantity: 0,
                isAvailable: true,
              },
            ],
          }}
          onFinish={handleSubmit}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              name="name"
              label="Tên sản phẩm"
              rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
            >
              <Input placeholder="Ví dụ: Cơ Predator P3" />
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

          <Form.Item
            name="brandId"
            label="Brand"
            rules={[{ required: true, message: 'Vui lòng chọn thương hiệu' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn brand đã có"
              options={(brandsQuery.data ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </Form.Item>

          <Form.Item label="Mô tả (Editor)">
            <Card size="small" className="!border-slate-200 !bg-slate-50">
              <Space wrap className="mb-3">
                <Button
                  icon={<BoldOutlined />}
                  onClick={() => {
                    insertDescriptionText('**', '**', 'in đậm')
                  }}
                >
                  Đậm
                </Button>
                <Button
                  icon={<ItalicOutlined />}
                  onClick={() => {
                    insertDescriptionText('_', '_', 'in nghiêng')
                  }}
                >
                  Nghiêng
                </Button>
                <Button
                  icon={<UnorderedListOutlined />}
                  onClick={() => {
                    insertDescriptionText('\n- ', '', 'mục')
                  }}
                >
                  Danh sách
                </Button>
                <Button
                  icon={<OrderedListOutlined />}
                  onClick={() => {
                    insertDescriptionText('\n1. ', '', 'mục')
                  }}
                >
                  Đánh số
                </Button>
              </Space>

              <Form.Item name="description" noStyle>
                <Input.TextArea
                  ref={descriptionEditorRef}
                  rows={8}
                  placeholder="Nhập mô tả sản phẩm..."
                />
              </Form.Item>

              <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                <Typography.Text type="secondary" className="text-xs">
                  Xem trước
                </Typography.Text>
                <Typography.Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap">
                  {descriptionValue.trim() || 'Nội dung mô tả sẽ hiển thị tại đây.'}
                </Typography.Paragraph>
              </div>
            </Card>
          </Form.Item>

          <Form.Item name="images" label="Danh sách ảnh (nhập URL, Enter để thêm)">
            <Select mode="tags" tokenSeparators={[',']} placeholder="https://..." />
          </Form.Item>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="metaTitle" label="Meta title">
              <Input placeholder="Nhập tiêu đề SEO" />
            </Form.Item>

            <Form.Item name="metaDescription" label="Meta description">
              <Input placeholder="Nhập mô tả SEO ngắn" />
            </Form.Item>
          </div>

          <Form.Item name="attributesJson" label="Attributes JSON (tùy chọn)">
            <Input.TextArea rows={4} placeholder='{"weight":"19oz","material":"Maple"}' />
          </Form.Item>

          <Form.Item name="isAvailable" label="Trạng thái bán" valuePropName="checked">
            <Switch checkedChildren="Đang bán" unCheckedChildren="Ngừng bán" />
          </Form.Item>

          <Divider />

          <Typography.Title level={5}>Biến thể (Form động)</Typography.Title>
          <Form.List
            name="variants"
            rules={[
              {
                validator: async (_, value) => {
                  if (Array.isArray(value) && value.length > 0) {
                    return
                  }

                  throw new Error('Vui lòng thêm ít nhất 1 biến thể')
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`Biến thể #${index + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            remove(field.name)
                          }}
                        >
                          Xóa
                        </Button>
                      ) : null
                    }
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Form.Item
                        name={[field.name, 'sku']}
                        label="SKU"
                        rules={[{ required: true, message: 'Vui lòng nhập SKU' }]}
                      >
                        <Input placeholder="Ví dụ: SKU-P3-BLACK-13" />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, 'price']}
                        label="Giá bán"
                        rules={[{ required: true, message: 'Vui lòng nhập giá bán' }]}
                      >
                        <InputNumber min={0} className="w-full" placeholder="Nhập giá bán" />
                      </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Form.Item name={[field.name, 'colorId']} label="Màu sắc (tùy chọn)">
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

                      <Form.Item name={[field.name, 'sizeId']} label="Size (tùy chọn)">
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
                      <Form.Item name={[field.name, 'originalPrice']} label="Giá gốc">
                        <InputNumber
                          min={0}
                          className="w-full"
                          placeholder="Nhập giá gốc (nếu có)"
                        />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, 'stockQuantity']}
                        label="Tồn kho"
                        rules={[{ required: true, message: 'Vui lòng nhập tồn kho' }]}
                      >
                        <InputNumber min={0} className="w-full" placeholder="Nhập số lượng tồn" />
                      </Form.Item>
                    </div>

                    <Form.Item name={[field.name, 'images']} label="Ảnh variant (URL)">
                      <Select mode="tags" tokenSeparators={[',']} placeholder="https://..." />
                    </Form.Item>

                    <Form.Item
                      name={[field.name, 'isAvailable']}
                      label="Trạng thái"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="Còn hàng" unCheckedChildren="Hết hàng" />
                    </Form.Item>
                  </Card>
                ))}

                <Form.ErrorList errors={errors} />

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    add({
                      stockQuantity: 0,
                      isAvailable: true,
                    })
                  }}
                >
                  Thêm biến thể
                </Button>
              </div>
            )}
          </Form.List>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              onClick={() => {
                navigate(ROUTE_PATHS.DASHBOARD_PRODUCTS)
              }}
            >
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={createProductMutation.isPending}>
              Tạo sản phẩm
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
