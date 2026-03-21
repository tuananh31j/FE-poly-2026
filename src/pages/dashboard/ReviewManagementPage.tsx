import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Image,
  Input,
  message,
  Modal,
  Popconfirm,
  Rate,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { meanBy } from 'lodash'
import { useState } from 'react'

import {
  deleteAdminReview,
  listAdminReviews,
  moderateAdminReview,
  replyAdminReview,
} from '@/features/admin/api/review-management.api'
import type { AdminReviewItem } from '@/features/admin/model/review-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatDateTime } from '@/shared/utils/date'

const PAGE_SIZE = 10
const IMAGE_PLACEHOLDER = '/images/product-placeholder.svg'

interface ReplyReviewFormValues {
  replyContent: string
}

type PublishFilterValue = 'all' | 'published' | 'hidden'
type RatingFilterValue = 'all' | 1 | 2 | 3 | 4 | 5

export const ReviewManagementPage = () => {
  const queryClient = useQueryClient()
  const [replyForm] = Form.useForm<ReplyReviewFormValues>()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [productIdInput, setProductIdInput] = useState('')
  const [productIdFilter, setProductIdFilter] = useState('')
  const [userIdInput, setUserIdInput] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [publishFilter, setPublishFilter] = useState<PublishFilterValue>('all')
  const [ratingFilter, setRatingFilter] = useState<RatingFilterValue>('all')

  const [detailReview, setDetailReview] = useState<AdminReviewItem | null>(null)
  const [replyingReview, setReplyingReview] = useState<AdminReviewItem | null>(null)
  const [replyModalOpen, setReplyModalOpen] = useState(false)

  const reviewsQuery = useQuery({
    queryKey: queryKeys.admin.reviews({
      page,
      limit: PAGE_SIZE,
      search: searchTerm || undefined,
      productId: productIdFilter || undefined,
      userId: userIdFilter || undefined,
      rating: ratingFilter === 'all' ? undefined : ratingFilter,
      isPublished:
        publishFilter === 'all' ? undefined : publishFilter === 'published' ? true : false,
    }),
    queryFn: () =>
      listAdminReviews({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        productId: productIdFilter || undefined,
        userId: userIdFilter || undefined,
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        isPublished:
          publishFilter === 'all' ? undefined : publishFilter === 'published' ? true : false,
      }),
  })

  const invalidateReviewData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ])
  }

  const moderateReviewMutation = useMutation({
    mutationFn: ({ reviewId, isPublished }: { reviewId: string; isPublished: boolean }) =>
      moderateAdminReview(reviewId, { isPublished }),
    onSuccess: async (updatedReview) => {
      await invalidateReviewData()
      void message.success(
        updatedReview.isPublished ? 'Đã hiển thị lại đánh giá' : 'Đã ẩn đánh giá'
      )

      if (detailReview?.id === updatedReview.id) {
        setDetailReview(updatedReview)
      }
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteReviewMutation = useMutation({
    mutationFn: deleteAdminReview,
    onSuccess: async () => {
      await invalidateReviewData()
      void message.success('Đã xóa đánh giá')
      setDetailReview(null)
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const replyReviewMutation = useMutation({
    mutationFn: ({ reviewId, replyContent }: { reviewId: string; replyContent: string }) =>
      replyAdminReview(reviewId, { replyContent }),
    onSuccess: async (updatedReview) => {
      await invalidateReviewData()
      void message.success('Đã phản hồi đánh giá')
      setReplyModalOpen(false)
      setReplyingReview(null)
      replyForm.resetFields()

      if (detailReview?.id === updatedReview.id) {
        setDetailReview(updatedReview)
      }
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const handleOpenReplyModal = (review: AdminReviewItem) => {
    setReplyingReview(review)
    replyForm.setFieldsValue({
      replyContent: review.replyContent ?? '',
    })
    setReplyModalOpen(true)
  }

  const handleReplySubmit = (values: ReplyReviewFormValues) => {
    if (!replyingReview) {
      return
    }

    replyReviewMutation.mutate({
      reviewId: replyingReview.id,
      replyContent: values.replyContent.trim(),
    })
  }

  const columns: ColumnsType<AdminReviewItem> = [
    {
      title: 'Sản phẩm',
      key: 'product',
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong className="line-clamp-1">
            {record.product?.name || 'Sản phẩm'}
          </Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            Product ID: {record.productId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'user',
      width: 240,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar src={record.user?.avatarUrl}>{record.user?.fullName?.charAt(0) ?? 'U'}</Avatar>
          <Space direction="vertical" size={0}>
            <Typography.Text strong className="line-clamp-1">
              {record.user?.fullName || record.user?.email || 'Khách hàng'}
            </Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              {record.user?.email || `UID: ${record.userId}`}
            </Typography.Text>
          </Space>
        </div>
      ),
    },
    {
      title: 'Nội dung đánh giá',
      key: 'review',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Rate disabled value={record.rating} className="!text-sm" />
          <Typography.Text className="line-clamp-2" type={record.content ? undefined : 'secondary'}>
            {record.content || 'Không có nội dung'}
          </Typography.Text>
          {record.images.length > 0 ? (
            <Typography.Text type="secondary" className="text-xs">
              {record.images.length} ảnh đính kèm
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Hiển thị',
      key: 'publish',
      width: 140,
      render: (_, record) => (
        <Tag color={record.isPublished ? 'green' : 'red'}>
          {record.isPublished ? 'Hiển thị' : 'Đã ẩn'}
        </Tag>
      ),
    },
    {
      title: 'Phản hồi',
      key: 'reply',
      width: 140,
      render: (_, record) => (
        <Tag color={record.replyContent ? 'blue' : 'default'}>
          {record.replyContent ? 'Đã phản hồi' : 'Chưa phản hồi'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      key: 'createdAt',
      dataIndex: 'createdAt',
      width: 180,
      render: (value: string) => (
        <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 270,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setDetailReview(record)
            }}
          ></Button>

          <Button
            type={record.isPublished ? 'default' : 'primary'}
            ghost={!record.isPublished}
            onClick={() => {
              moderateReviewMutation.mutate({
                reviewId: record.id,
                isPublished: !record.isPublished,
              })
            }}
            loading={moderateReviewMutation.isPending}
          >
            {record.isPublished ? 'Ẩn' : 'Hiện'}
          </Button>

          <Button
            icon={<EditOutlined />}
            onClick={() => {
              handleOpenReplyModal(record)
            }}
          ></Button>

          <Popconfirm
            title="Xóa đánh giá này?"
            description="Hành động này không thể hoàn tác."
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => {
              deleteReviewMutation.mutate(record.id)
            }}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleteReviewMutation.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const reviews = reviewsQuery.data?.items ?? []
  const hiddenCount = reviews.filter((item) => !item.isPublished).length
  const averageRating = reviews.length > 0 ? Number(meanBy(reviews, 'rating').toFixed(2)) : 0

  return (
    <div className="space-y-5">
      <div>
        <Typography.Title level={3} className="!mb-1">
          Quản lý đánh giá
        </Typography.Title>
        <Typography.Text type="secondary">
          Kiểm duyệt, phản hồi và xử lý đánh giá sản phẩm từ khách hàng.
        </Typography.Text>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <Statistic
            title="Tổng đánh giá (theo filter)"
            value={reviewsQuery.data?.totalItems ?? 0}
          />
        </Card>
        <Card>
          <Statistic title="Đánh giá đang ẩn (trang hiện tại)" value={hiddenCount} />
        </Card>
        <Card>
          <Statistic title="Điểm trung bình (trang hiện tại)" value={averageRating} precision={2} />
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            allowClear
            className="w-full md:max-w-sm"
            placeholder="Tìm theo nội dung đánh giá/phản hồi"
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

          <Input.Search
            allowClear
            className="w-full md:max-w-xs"
            placeholder="Lọc theo productId"
            value={productIdInput}
            onChange={(event) => {
              setProductIdInput(event.target.value)
              if (!event.target.value.trim()) {
                setPage(1)
                setProductIdFilter('')
              }
            }}
            onSearch={(value) => {
              setPage(1)
              setProductIdFilter(value.trim())
            }}
          />

          <Input.Search
            allowClear
            className="w-full md:max-w-xs"
            placeholder="Lọc theo userId"
            value={userIdInput}
            onChange={(event) => {
              setUserIdInput(event.target.value)
              if (!event.target.value.trim()) {
                setPage(1)
                setUserIdFilter('')
              }
            }}
            onSearch={(value) => {
              setPage(1)
              setUserIdFilter(value.trim())
            }}
          />

          <Select
            value={ratingFilter}
            className="w-full md:w-44"
            options={[
              { label: 'Tất cả số sao', value: 'all' },
              { label: '5 sao', value: 5 },
              { label: '4 sao', value: 4 },
              { label: '3 sao', value: 3 },
              { label: '2 sao', value: 2 },
              { label: '1 sao', value: 1 },
            ]}
            onChange={(value) => {
              setPage(1)
              setRatingFilter(value as RatingFilterValue)
            }}
          />

          <Select
            value={publishFilter}
            className="w-full md:w-44"
            options={[
              { label: 'Tất cả hiển thị', value: 'all' },
              { label: 'Đang hiển thị', value: 'published' },
              { label: 'Đã ẩn', value: 'hidden' },
            ]}
            onChange={(value) => {
              setPage(1)
              setPublishFilter(value as PublishFilterValue)
            }}
          />
        </div>

        {reviewsQuery.isLoading ? (
          <div className="py-10 text-center">
            <Spin />
          </div>
        ) : null}

        {!reviewsQuery.isLoading && reviews.length === 0 ? (
          <Empty description="Không có đánh giá phù hợp" />
        ) : null}

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={reviews}
          loading={reviewsQuery.isFetching}
          scroll={{ x: 1500 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: reviewsQuery.data?.totalItems ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => {
              setPage(nextPage)
            },
          }}
        />
      </Card>

      <Modal
        open={replyModalOpen}
        title={`Phản hồi đánh giá${replyingReview ? `: #${replyingReview.id}` : ''}`}
        okText="Gửi phản hồi"
        cancelText="Hủy"
        onCancel={() => {
          setReplyModalOpen(false)
          setReplyingReview(null)
          replyForm.resetFields()
        }}
        onOk={() => {
          void replyForm.submit()
        }}
        okButtonProps={{
          loading: replyReviewMutation.isPending,
        }}
      >
        <Form<ReplyReviewFormValues>
          form={replyForm}
          layout="vertical"
          onFinish={handleReplySubmit}
        >
          <Form.Item
            label="Nội dung phản hồi"
            name="replyContent"
            rules={[
              { required: true, message: 'Vui lòng nhập nội dung phản hồi' },
              { min: 2, message: 'Nội dung phản hồi quá ngắn' },
              { max: 2000, message: 'Nội dung phản hồi vượt quá 2000 ký tự' },
            ]}
          >
            <Input.TextArea
              rows={4}
              showCount
              maxLength={2000}
              placeholder="Nhập nội dung phản hồi cho đánh giá này"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(detailReview)}
        title={detailReview ? `Chi tiết đánh giá #${detailReview.id}` : 'Chi tiết đánh giá'}
        footer={null}
        width={920}
        onCancel={() => {
          setDetailReview(null)
        }}
      >
        {!detailReview ? null : (
          <div className="space-y-5">
            <Descriptions
              bordered
              size="small"
              column={2}
              items={[
                {
                  key: 'product',
                  label: 'Sản phẩm',
                  children: detailReview.product?.name || detailReview.productId,
                },
                {
                  key: 'orderId',
                  label: 'Order ID',
                  children: detailReview.orderId,
                },
                {
                  key: 'customer',
                  label: 'Khách hàng',
                  children:
                    detailReview.user?.fullName || detailReview.user?.email || detailReview.userId,
                },
                {
                  key: 'rating',
                  label: 'Số sao',
                  children: <Rate disabled value={detailReview.rating} className="!text-sm" />,
                },
                {
                  key: 'status',
                  label: 'Hiển thị',
                  children: (
                    <Tag color={detailReview.isPublished ? 'green' : 'red'}>
                      {detailReview.isPublished ? 'Hiển thị' : 'Đã ẩn'}
                    </Tag>
                  ),
                },
                {
                  key: 'createdAt',
                  label: 'Ngày tạo',
                  children: formatDateTime(detailReview.createdAt),
                },
                {
                  key: 'updatedAt',
                  label: 'Cập nhật',
                  children: formatDateTime(detailReview.updatedAt),
                },
                {
                  key: 'repliedAt',
                  label: 'Phản hồi lúc',
                  children: detailReview.repliedAt
                    ? formatDateTime(detailReview.repliedAt)
                    : 'Chưa phản hồi',
                },
              ]}
            />

            <div>
              <Typography.Title level={5} className="!mb-2">
                Nội dung đánh giá
              </Typography.Title>
              <Typography.Paragraph className="!mb-0">
                {detailReview.content || 'Không có nội dung'}
              </Typography.Paragraph>
            </div>

            <div>
              <Typography.Title level={5} className="!mb-2">
                Ảnh đánh giá
              </Typography.Title>
              {detailReview.images.length === 0 ? (
                <Empty description="Không có ảnh đính kèm" />
              ) : (
                <Image.PreviewGroup>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {detailReview.images.map((imageUrl, index) => (
                      <div
                        key={`${detailReview.id}-image-${index}`}
                        className="overflow-hidden rounded-md border border-slate-200 bg-slate-100"
                      >
                        <Image
                          src={imageUrl || IMAGE_PLACEHOLDER}
                          alt={`review-image-${index + 1}`}
                          className="h-24 w-full object-cover"
                          preview
                        />
                      </div>
                    ))}
                  </div>
                </Image.PreviewGroup>
              )}
            </div>

            <div>
              <Typography.Title level={5} className="!mb-2">
                Phản hồi cửa hàng
              </Typography.Title>
              <Typography.Paragraph className="!mb-3">
                {detailReview.replyContent || 'Chưa có phản hồi'}
              </Typography.Paragraph>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  handleOpenReplyModal(detailReview)
                }}
              >
                {detailReview.replyContent ? 'Cập nhật phản hồi' : 'Phản hồi ngay'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
