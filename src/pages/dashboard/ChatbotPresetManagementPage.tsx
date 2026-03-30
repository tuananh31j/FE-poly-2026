import { DeleteOutlined, EditOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
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
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'

import {
  createAdminChatbotPreset,
  deleteAdminChatbotPreset,
  listAdminChatbotPresets,
  updateAdminChatbotPreset,
} from '@/features/admin/api/chatbot-preset-management.api'
import { listAdminProducts } from '@/features/admin/api/product-management.api'
import type {
  AdminChatbotPresetItem,
  UpsertAdminChatbotPresetPayload,
} from '@/features/admin/model/chatbot-preset-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatDateTime } from '@/shared/utils/date'

interface ChatbotPresetFormValues {
  question: string
  answer?: string
  productIds: string[]
  isActive: boolean
  sortOrder: number
}

interface SelectedProductPreview {
  id: string
  name: string
  brand: string
  imageUrl: string | null
}

const PRODUCT_REFERENCE_LIMIT = 100

export const ChatbotPresetManagementPage = () => {
  const queryClient = useQueryClient()
  const [form] = Form.useForm<ChatbotPresetFormValues>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<AdminChatbotPresetItem | null>(null)

  const presetsQuery = useQuery({
    queryKey: queryKeys.admin.chatbotPresets,
    queryFn: listAdminChatbotPresets,
  })

  const productsQuery = useQuery({
    queryKey: queryKeys.admin.products({ page: 1, limit: PRODUCT_REFERENCE_LIMIT }),
    queryFn: () =>
      listAdminProducts({
        page: 1,
        limit: PRODUCT_REFERENCE_LIMIT,
      }),
  })

  const invalidateChatbotQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.chatbotPresets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.chatbot.presets }),
    ])
  }

  const createPresetMutation = useMutation({
    mutationFn: createAdminChatbotPreset,
    onSuccess: async () => {
      await invalidateChatbotQueries()
      void message.success('Tạo preset chatbot thành công')
      setModalOpen(false)
      setEditingPreset(null)
      form.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const updatePresetMutation = useMutation({
    mutationFn: ({ presetId, payload }: { presetId: string; payload: Partial<UpsertAdminChatbotPresetPayload> }) =>
      updateAdminChatbotPreset(presetId, payload),
    onSuccess: async () => {
      await invalidateChatbotQueries()
      void message.success('Cập nhật preset chatbot thành công')
      setModalOpen(false)
      setEditingPreset(null)
      form.resetFields()
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deletePresetMutation = useMutation({
    mutationFn: deleteAdminChatbotPreset,
    onSuccess: async () => {
      await invalidateChatbotQueries()
      void message.success('Đã xóa preset chatbot')
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const productOptions = useMemo(() => {
    const products = productsQuery.data?.items ?? []

    return products.map((product) => ({
      label: `${product.name} · ${product.brand}`,
      value: product.id,
      thumbnailUrl: product.thumbnailUrl,
      description: typeof product.priceFrom === 'number' ? `Từ ${product.priceFrom.toLocaleString('vi-VN')} đ` : undefined,
    }))
  }, [productsQuery.data?.items])

  const selectedProductIds = Form.useWatch('productIds', form) ?? []

  const selectedProducts = useMemo(() => {
    const productMap = new Map((productsQuery.data?.items ?? []).map((product) => [product.id, product]))

    return selectedProductIds
      .map((productId) => {
        const product =
          productMap.get(productId) ?? editingPreset?.products.find((item) => item.id === productId)

        if (!product) {
          return undefined
        }

         return {
          id: product.id,
          name: product.name,
          brand: product.brand,
          imageUrl: 'thumbnailUrl' in product ? product.thumbnailUrl : product.imageUrl,
        } satisfies SelectedProductPreview
      })
      .filter((product): product is SelectedProductPreview => Boolean(product))
  }, [editingPreset?.products, productsQuery.data?.items, selectedProductIds])

  const columns: ColumnsType<AdminChatbotPresetItem> = useMemo(
    () => [
      {
        title: 'Câu hỏi',
        dataIndex: 'question',
        key: 'question',
        render: (value: string) => (
          <Space align="start" size={10}>
            <Avatar icon={<RobotOutlined />} className="!bg-blue-600" />
            <Typography.Text strong>{value}</Typography.Text>
          </Space>
        ),
      },
      {
        title: 'Câu trả lời mẫu',
        dataIndex: 'answer',
        key: 'answer',
        render: (value?: string) => (
          <Typography.Paragraph className="!mb-0" ellipsis={{ rows: 2 }} type="secondary">
            {value?.trim() || 'Tự dùng nội dung mặc định'}
          </Typography.Paragraph>
        ),
      },
      {
        title: 'Sản phẩm gắn kèm',
        key: 'products',
        render: (_, record) => (
          <Space wrap size={[6, 6]}>
            {record.products.slice(0, 3).map((product) => (
              <Tag key={product.id} color={product.isAvailable ? 'blue' : 'default'}>
                {product.name}
              </Tag>
            ))}
            {record.products.length > 3 && <Tag>+{record.products.length - 3}</Tag>}
          </Space>
        ),
      },
      {
        title: 'Trạng thái',
        dataIndex: 'isActive',
        key: 'isActive',
        width: 120,
        render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Đang dùng' : 'Tắt'}</Tag>,
      },
      {
        title: 'Thứ tự',
        dataIndex: 'sortOrder',
        key: 'sortOrder',
        width: 100,
      },
      {
        title: 'Cập nhật',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value: string) => formatDateTime(value),
      },
      {
        title: 'Hành động',
        key: 'actions',
        width: 180,
        render: (_, record) => (
          <Space size={8}>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingPreset(record)
                form.setFieldsValue({
                  question: record.question,
                  answer: record.answer,
                  productIds: record.products.map((product) => product.id),
                  isActive: record.isActive,
                  sortOrder: record.sortOrder,
                })
                setModalOpen(true)
              }}
            />
            <Popconfirm
              title="Xóa preset chatbot"
              description="Preset này sẽ biến mất khỏi chatbot của khách hàng."
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => deletePresetMutation.mutate(record.id)}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deletePresetMutation, form]
  )

  const handleOpenCreateModal = () => {
    setEditingPreset(null)
    form.setFieldsValue({
      question: '',
      answer: undefined,
      productIds: [],
      isActive: true,
      sortOrder: 0,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()

    const payload: UpsertAdminChatbotPresetPayload = {
      question: values.question.trim(),
      answer: values.answer?.trim() || undefined,
      productIds: values.productIds,
      isActive: values.isActive,
      sortOrder: values.sortOrder ?? 0,
    }

    if (editingPreset) {
      updatePresetMutation.mutate({
        presetId: editingPreset.id,
        payload,
      })
      return
    }

    createPresetMutation.mutate(payload)
  }

  return (
     <div className="space-y-6">
        <div>
        <Typography.Title level={2}>Admin - Kịch bản chatbot</Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0">
          Quản lý câu hỏi mẫu cho chatbot. Mỗi câu hỏi sẽ gắn với danh sách sản phẩm do admin chọn.
        </Typography.Paragraph>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Typography.Title level={4} className="!mb-1">
              Preset chatbot
            </Typography.Title>
            <Typography.Text type="secondary">
              Khách hàng chỉ có thể bấm các câu hỏi mẫu được cấu hình tại đây.
            </Typography.Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>
            Thêm preset
          </Button>
        </div>

        <Table
          rowKey="id"
          loading={presetsQuery.isLoading}
          columns={columns}
          dataSource={presetsQuery.data ?? []}
          pagination={false}
          locale={{
            emptyText: 'Chưa có preset chatbot',
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title={editingPreset ? 'Cập nhật preset chatbot' : 'Tạo preset chatbot'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingPreset(null)
          form.resetFields()
        }}
        onOk={() => {
          void handleSubmit()
        }}
        okText={editingPreset ? 'Lưu thay đổi' : 'Tạo mới'}
        cancelText="Hủy"
        okButtonProps={{
          loading: createPresetMutation.isPending || updatePresetMutation.isPending,
        }}
        width={820}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            isActive: true,
            sortOrder: 0,
            productIds: [],
          }}
        >
          <Form.Item
            label="Câu hỏi hiển thị"
            name="question"
            rules={[{ required: true, message: 'Cần nhập câu hỏi hiển thị' }]}
          >
            <Input placeholder="Ví dụ: Sản phẩm nào phù hợp người mới chơi?" maxLength={200} />
          </Form.Item>

          <Form.Item label="Câu trả lời mẫu" name="answer">
            <Input.TextArea
              rows={4}
              placeholder="Nếu để trống, hệ thống sẽ dùng câu trả lời mặc định và chỉ hiển thị sản phẩm đã chọn."
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="Danh sách sản phẩm gắn kèm"
            name="productIds"
            rules={[{ required: true, message: 'Cần chọn ít nhất một sản phẩm' }]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="Chọn các sản phẩm chatbot sẽ gợi ý"
              options={productOptions}
              loading={productsQuery.isLoading}
              notFoundContent={productsQuery.isLoading ? 'Đang tải sản phẩm...' : 'Không có sản phẩm'}
            />
          </Form.Item>

          {selectedProducts.length > 0 && (
            <div className="mb-6 grid gap-3 md:grid-cols-2">
              {selectedProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={56}
                      height={56}
                      className="rounded-lg object-cover"
                      preview={false}
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-slate-100" />
                  )}
                  <div className="min-w-0">
                    <Typography.Text strong className="block truncate">
                      {product.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" className="text-xs">
                      {product.brand}
                    </Typography.Text>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="Thứ tự hiển thị" name="sortOrder">
              <InputNumber min={0} className="!w-full" placeholder="0" />
            </Form.Item>

            <Form.Item label="Kích hoạt" name="isActive" valuePropName="checked">
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Tắt" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}