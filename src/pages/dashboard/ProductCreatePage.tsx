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
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Switch,
  Typography,
  Upload,
} from 'antd'
import { useState } from 'react'
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
import { uploadImage } from '@/shared/api/upload.api'
import { ROUTE_PATHS } from '@/shared/constants/routes'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import { normalizeRichTextValue } from '@/shared/utils/rich-text'

const createSlugFromName = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

const mergeUniqueStringArray = (current: string[], nextValue: string) => {
  if (current.includes(nextValue)) {
    return current
  }

  return [...current, nextValue]
}

interface ProductVariantFormValues {
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
  variants: ProductVariantFormValues[]
}

const toVariantPayload = (variant: ProductVariantFormValues): UpsertAdminProductVariantPayload => {
  return {
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
  const [uploadingCount, setUploadingCount] = useState(0)
  const productImages = normalizeStringArray(Form.useWatch('images', form))
  const variantValues = Form.useWatch('variants', form) ?? []

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

  const appendVariantImage = (variantIndex: number, url: string) => {
    const currentImages = normalizeStringArray(
      form.getFieldValue(['variants', variantIndex, 'images'])
    )
    form.setFieldValue(
      ['variants', variantIndex, 'images'],
      mergeUniqueStringArray(currentImages, url)
    )
  }

  const removeVariantImage = (variantIndex: number, url: string) => {
    const currentImages = normalizeStringArray(
      form.getFieldValue(['variants', variantIndex, 'images'])
    )
    form.setFieldValue(
      ['variants', variantIndex, 'images'],
      currentImages.filter((value) => value !== url)
    )
  }

  const createVariantImageBeforeUpload =
    (variantIndex: number): UploadProps['beforeUpload'] =>
    (file) => {
      void uploadProductImageFile(file as File, (url) => {
        appendVariantImage(variantIndex, url)
      })
      return Upload.LIST_IGNORE
    }

  const createProductMutation = useMutation({
    mutationFn: async (values: ProductCreateFormValues) => {
      const slug = createSlugFromName(values.name)

      if (!slug) {
        throw new Error('Tên sản phẩm không hợp lệ để tạo slug')
      }

      const payload: CreateAdminProductPayload = {
        name: values.name.trim(),
        slug,
        categoryId: values.categoryId,
        brandId: values.brandId.trim(),
        description: normalizeRichTextValue(values.description),
        images: normalizeStringArray(values.images),
        isAvailable: values.isAvailable,
        metaTitle: values.metaTitle?.trim() || undefined,
        metaDescription: values.metaDescription?.trim() || undefined,
      }

      const createdProduct = await createAdminProduct(payload)

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

              <Typography.Text type="secondary" className="text-xs">
                Hỗ trợ JPG/PNG/WebP, tối đa 5MB mỗi ảnh.
              </Typography.Text>

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
                        fallback="/images/product-placeholder.svg"
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item name="metaTitle" label="Meta title">
              <Input placeholder="Nhập tiêu đề SEO" />
            </Form.Item>

            <Form.Item name="metaDescription" label="Meta description">
              <Input placeholder="Nhập mô tả SEO ngắn" />
            </Form.Item>
          </div>

          <Form.Item name="isAvailable" label="Trạng thái bán" valuePropName="checked">
            <Switch checkedChildren="Đang bán" unCheckedChildren="Ngừng bán" />
          </Form.Item>

          <Divider />

          <Typography.Title level={5}>Thông tin bán hàng</Typography.Title>
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
                {fields.map((field, index) => {
                  const variantIndex = Number(field.name)
                  const variantImages = normalizeStringArray(variantValues[variantIndex]?.images)

                  return (
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
                      <Form.Item label="SKU">
                        <Input disabled placeholder="SKU sẽ được hệ thống tự động tạo" />
                      </Form.Item>

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
                        <Form.Item
                          name={[field.name, 'price']}
                          label="Giá bán"
                          rules={[{ required: true, message: 'Vui lòng nhập giá bán' }]}
                        >
                          <InputNumber min={0} className="w-full" placeholder="Nhập giá bán" />
                        </Form.Item>

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

                      <Form.Item label="Ảnh variant (upload file)">
                        <Space direction="vertical" size={10} className="w-full">
                          <Upload
                            multiple
                            accept="image/*"
                            showUploadList={false}
                            beforeUpload={createVariantImageBeforeUpload(Number(field.name))}
                          >
                            <Button icon={<UploadOutlined />} loading={uploadingCount > 0}>
                              Tải ảnh variant
                            </Button>
                          </Upload>

                          {variantImages.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                              {variantImages.map((imageUrl) => (
                                <div
                                  key={`${field.key}-${imageUrl}`}
                                  className="w-[110px] rounded-md border border-slate-200 p-2"
                                >
                                  <Image
                                    src={imageUrl}
                                    alt="Ảnh variant"
                                    className="h-[70px] w-full rounded object-cover"
                                    fallback="/images/product-placeholder.svg"
                                  />
                                  <Button
                                    danger
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={() => {
                                      removeVariantImage(variantIndex, imageUrl)
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
                      <Form.Item name={[field.name, 'images']} hidden>
                        <Input placeholder="Danh sách URL ảnh variant" />
                      </Form.Item>

                      <Form.Item
                        name={[field.name, 'isAvailable']}
                        label="Trạng thái"
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="Còn hàng" unCheckedChildren="Hết hàng" />
                      </Form.Item>
                    </Card>
                  )
                })}

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
