import { DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'

import {
  deleteAdminComment,
  listAdminComments,
  updateAdminCommentVisibility,
} from '@/features/admin/api/comment-management.api'
import type { AdminCommentItem, CommentTargetModel } from '@/features/admin/model/comment-management.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { formatDateTime } from '@/shared/utils/date'

const PAGE_SIZE = 10

type TargetModelFilter = 'all' | CommentTargetModel
type VisibilityFilter = 'all' | 'visible' | 'hidden'

export const CommentManagementPage = () => {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [targetIdInput, setTargetIdInput] = useState('')
  const [targetIdFilter, setTargetIdFilter] = useState('')
  const [userIdInput, setUserIdInput] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [targetModelFilter, setTargetModelFilter] = useState<TargetModelFilter>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')

  const [detailComment, setDetailComment] = useState<AdminCommentItem | null>(null)

  const commentsQuery = useQuery({
    queryKey: queryKeys.admin.comments({
      page,
      limit: PAGE_SIZE,
      search: searchTerm || undefined,
      targetId: targetIdFilter || undefined,
      userId: userIdFilter || undefined,
      targetModel: targetModelFilter === 'all' ? undefined : targetModelFilter,
      isHidden:
        visibilityFilter === 'all' ? undefined : visibilityFilter === 'hidden' ? true : false,
    }),
    queryFn: () =>
      listAdminComments({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
        targetId: targetIdFilter || undefined,
        userId: userIdFilter || undefined,
        targetModel: targetModelFilter === 'all' ? undefined : targetModelFilter,
        isHidden:
          visibilityFilter === 'all' ? undefined : visibilityFilter === 'hidden' ? true : false,
      }),
  })

  const invalidateCommentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] }),
      queryClient.invalidateQueries({ queryKey: ['products', 'comments'] }),
    ])
  }

  const updateVisibilityMutation = useMutation({
    mutationFn: ({ commentId, isHidden }: { commentId: string; isHidden: boolean }) =>
      updateAdminCommentVisibility(commentId, { isHidden }),
    onSuccess: async (updatedComment) => {
      await invalidateCommentData()
      void message.success(updatedComment.isHidden ? 'Đã ẩn bình luận' : 'Đã hiển thị bình luận')

      if (detailComment?.id === updatedComment.id) {
        setDetailComment({
          ...detailComment,
          ...updatedComment,
          user: updatedComment.user ?? detailComment.user,
          target: updatedComment.target ?? detailComment.target,
        })
      }
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: deleteAdminComment,
    onSuccess: async () => {
      await invalidateCommentData()
      void message.success('Đã xóa bình luận')
      setDetailComment(null)
    },
    onError: (error) => {
      void message.error(error.message)
    },
  })

  const columns: ColumnsType<AdminCommentItem> = [
    {
      title: 'Mục tiêu',
      key: 'target',
      width: 300,
      render: (_, record) => (
        <Space direction="vertical" size={1}>
          <Space size={6}>
            <Tag color="blue">Product</Tag>
            <Typography.Text strong className="line-clamp-1">
              {record.target?.name || 'N/A'}
            </Typography.Text>
          </Space>
          <Typography.Text type="secondary" className="text-xs">
            Target ID: {record.targetId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Người bình luận',
      key: 'user',
      width: 250,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Avatar src={record.user?.avatarUrl}>{record.user?.fullName?.charAt(0) ?? 'U'}</Avatar>
          <Space direction="vertical" size={0}>
            <Typography.Text strong className="line-clamp-1">
              {record.user?.fullName || record.user?.email || 'Người dùng'}
            </Typography.Text>
            <Typography.Text type="secondary" className="text-xs">
              {record.user?.email || `UID: ${record.userId}`}
            </Typography.Text>
          </Space>
        </div>
      ),
    },
    {
      title: 'Nội dung',
      key: 'content',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text className="line-clamp-2">{record.content}</Typography.Text>
          {record.parentId ? (
            <Typography.Text type="secondary" className="text-xs">
              Reply to: {record.parentId}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Hiển thị',
      key: 'visibility',
      width: 120,
      render: (_, record) => (
        <Tag color={record.isHidden ? 'red' : 'green'}>
          {record.isHidden ? 'Đã ẩn' : 'Hiển thị'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      key: 'createdAt',
      dataIndex: 'createdAt',
      width: 180,
      render: (value: string) => <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setDetailComment(record)
            }}
          >
          </Button>

          <Button
            type={record.isHidden ? 'primary' : 'default'}
            ghost={record.isHidden}
            loading={updateVisibilityMutation.isPending}
            onClick={() => {
              updateVisibilityMutation.mutate({
                commentId: record.id,
                isHidden: !record.isHidden,
              })
            }}
          >
            {record.isHidden ? 'Hiện' : 'Ẩn'}
          </Button>

          <Popconfirm
            title="Xóa bình luận này?"
            description="Hành động này không thể hoàn tác."
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => {
              deleteCommentMutation.mutate(record.id)
            }}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleteCommentMutation.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const comments = commentsQuery.data?.items ?? []
  const hiddenCount = comments.filter((comment) => comment.isHidden).length
  const replyCount = comments.filter((comment) => Boolean(comment.parentId)).length

  return (
    <div className="space-y-5">
      <div>
        <Typography.Title level={3} className="!mb-1">
          Quản lý bình luận
        </Typography.Title>
        <Typography.Text type="secondary">
          Kiểm duyệt, lọc và xử lý toàn bộ bình luận sản phẩm.
        </Typography.Text>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <Statistic title="Tổng bình luận (theo filter)" value={commentsQuery.data?.totalItems ?? 0} />
        </Card>
        <Card>
          <Statistic title="Bình luận đang ẩn (trang hiện tại)" value={hiddenCount} />
        </Card>
        <Card>
          <Statistic title="Bình luận phản hồi (trang hiện tại)" value={replyCount} />
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input.Search
            allowClear
            className="w-full md:max-w-sm"
            placeholder="Tìm theo nội dung bình luận"
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
            placeholder="Lọc theo targetId"
            value={targetIdInput}
            onChange={(event) => {
              setTargetIdInput(event.target.value)
              if (!event.target.value.trim()) {
                setPage(1)
                setTargetIdFilter('')
              }
            }}
            onSearch={(value) => {
              setPage(1)
              setTargetIdFilter(value.trim())
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
            value={targetModelFilter}
            className="w-full md:w-44"
            options={[
              { label: 'Tất cả mục tiêu', value: 'all' },
              { label: 'Product', value: 'product' },
            ]}
            onChange={(value) => {
              setPage(1)
              setTargetModelFilter(value as TargetModelFilter)
            }}
          />

          <Select
            value={visibilityFilter}
            className="w-full md:w-44"
            options={[
              { label: 'Tất cả hiển thị', value: 'all' },
              { label: 'Đang hiển thị', value: 'visible' },
              { label: 'Đã ẩn', value: 'hidden' },
            ]}
            onChange={(value) => {
              setPage(1)
              setVisibilityFilter(value as VisibilityFilter)
            }}
          />
        </div>

        {commentsQuery.isLoading ? (
          <div className="py-10 text-center">
            <Spin />
          </div>
        ) : null}

        {!commentsQuery.isLoading && comments.length === 0 ? (
          <Empty description="Không có bình luận phù hợp" />
        ) : null}

        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={comments}
          loading={commentsQuery.isFetching}
          scroll={{ x: 1450 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: commentsQuery.data?.totalItems ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => {
              setPage(nextPage)
            },
          }}
        />
      </Card>

      <Modal
        open={Boolean(detailComment)}
        title={detailComment ? `Chi tiết bình luận #${detailComment.id}` : 'Chi tiết bình luận'}
        footer={null}
        width={840}
        onCancel={() => {
          setDetailComment(null)
        }}
      >
        {!detailComment ? null : (
          <div className="space-y-4">
            <Descriptions
              bordered
              size="small"
              column={2}
              items={[
                {
                  key: 'targetModel',
                  label: 'Loại mục tiêu',
                  children: 'Product',
                },
                {
                  key: 'target',
                  label: 'Mục tiêu',
                  children: detailComment.target?.name || detailComment.targetId,
                },
                {
                  key: 'targetId',
                  label: 'Target ID',
                  children: detailComment.targetId,
                },
                {
                  key: 'user',
                  label: 'Người bình luận',
                  children:
                    detailComment.user?.fullName || detailComment.user?.email || detailComment.userId,
                },
                {
                  key: 'parentId',
                  label: 'Parent ID',
                  children: detailComment.parentId || '-',
                },
                {
                  key: 'status',
                  label: 'Hiển thị',
                  children: (
                    <Tag color={detailComment.isHidden ? 'red' : 'green'}>
                      {detailComment.isHidden ? 'Đã ẩn' : 'Hiển thị'}
                    </Tag>
                  ),
                },
                {
                  key: 'createdAt',
                  label: 'Ngày tạo',
                  children: formatDateTime(detailComment.createdAt),
                },
              ]}
            />

            <div>
              <Typography.Title level={5} className="!mb-2">
                Nội dung bình luận
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                {detailComment.content}
              </Typography.Paragraph>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type={detailComment.isHidden ? 'primary' : 'default'}
                ghost={detailComment.isHidden}
                loading={updateVisibilityMutation.isPending}
                onClick={() => {
                  updateVisibilityMutation.mutate({
                    commentId: detailComment.id,
                    isHidden: !detailComment.isHidden,
                  })
                }}
              >
                {detailComment.isHidden ? 'Hiện bình luận' : 'Ẩn bình luận'}
              </Button>

              <Popconfirm
                title="Xóa bình luận này?"
                description="Hành động này không thể hoàn tác."
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={() => {
                  deleteCommentMutation.mutate(detailComment.id)
                }}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleteCommentMutation.isPending}>
                  Xóa bình luận
                </Button>
              </Popconfirm>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
