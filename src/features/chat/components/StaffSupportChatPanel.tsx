import { MessageOutlined, SearchOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Input, List, Space, Tag, Typography, message } from 'antd'
import { useMemo, useState } from 'react'

import { useStaffSupportChat } from '../hooks/useStaffSupportChat'
import { useAppSelector } from '@/app/store/hooks'

import type { ChatConversation, ChatMessage } from '../model/chat.types'

const { TextArea } = Input

const formatTime = (value?: string) => {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleString('vi-VN', { hour12: false })
}

const renderConversationTitle = (conversation: ChatConversation) => {
  if (conversation.customer?.fullName) {
    return conversation.customer.fullName
  }

  return conversation.customer?.email ?? 'Khách hàng'
}

const renderMessageBubble = (messageItem: ChatMessage, isMine: boolean) => {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isMine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
        }`}
      >
        <div className="whitespace-pre-wrap">{messageItem.content}</div>
        <div className={`mt-1 text-[11px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
          {formatTime(messageItem.createdAt)}
        </div>
      </div>
    </div>
  )
}

export const StaffSupportChatPanel = () => {
  const staffId = useAppSelector((state) => state.auth.user?.id)
  const [filter, setFilter] = useState('')
  const [inputValue, setInputValue] = useState('')
  const {
    conversations,
    activeConversationId,
    messages,
    selectConversation,
    sendMessage,
    isLoading,
  } = useStaffSupportChat()

  const filteredConversations = useMemo(() => {
    const keyword = filter.trim().toLowerCase()

    if (!keyword) {
      return conversations
    }

    return conversations.filter((conversation) => {
      const name = renderConversationTitle(conversation).toLowerCase()
      const email = conversation.customer?.email?.toLowerCase() ?? ''
      return name.includes(keyword) || email.includes(keyword)
    })
  }, [conversations, filter])

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content) {
      return
    }

    try {
      await sendMessage(content)
      setInputValue('')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể gửi tin nhắn'
      void message.error(errorMessage)
    }
  }

  return (
    <div className="grid min-h-[600px] grid-cols-[280px_1fr] gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Space direction="vertical" className="w-full" size={12}>
          <Typography.Text strong>Khách hàng đang chat</Typography.Text>
          <Input
            placeholder="Tìm theo tên hoặc email"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            allowClear
          />
        </Space>

        <List
          className="mt-4"
          loading={isLoading}
          dataSource={filteredConversations}
          locale={{ emptyText: 'Chưa có cuộc trò chuyện' }}
          renderItem={(conversation) => (
            <List.Item
              className={`cursor-pointer rounded-xl px-3 py-2 transition ${
                conversation.id === activeConversationId ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
              onClick={() => void selectConversation(conversation.id)}
            >
              <List.Item.Meta
                avatar={<Avatar src={conversation.customer?.avatarUrl} icon={<UserOutlined />} />}
                title={
                  <Space size={6}>
                    <Typography.Text>{renderConversationTitle(conversation)}</Typography.Text>
                    {conversation.id === activeConversationId && <Tag color="blue">Đang mở</Tag>}
                  </Space>
                }
                description={
                  <Typography.Text type="secondary" className="text-xs">
                    {conversation.customer?.email ?? 'Chưa có email'}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      </div>

      <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <Space>
            <MessageOutlined className="text-blue-600" />
            <Typography.Text strong>Khung trò chuyện</Typography.Text>
          </Space>
          {activeConversationId ? (
            <Typography.Text type="secondary" className="text-xs">
              Đang hỗ trợ khách hàng
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary" className="text-xs">
              Chọn cuộc trò chuyện để bắt đầu
            </Typography.Text>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {activeConversationId ? (
            <div className="flex flex-col gap-3">
              {messages.length === 0 ? (
                <Typography.Text type="secondary">Chưa có tin nhắn.</Typography.Text>
              ) : (
                messages.map((item) => renderMessageBubble(item, item.senderId === staffId))
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              Chọn khách hàng để xem nội dung chat.
            </div>
          )}
        </div>

          <div className="border-t border-slate-100 pt-3">
            <Space direction="vertical" className="w-full" size={8}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder="Nhập phản hồi cho khách hàng..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onPressEnter={(event) => {
                if (event.shiftKey) {
                  return
                }

                event.preventDefault()
                void handleSend()
              }}
              disabled={!activeConversationId}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={!inputValue.trim() || !activeConversationId}
              onClick={() => void handleSend()}
            >
              Gửi phản hồi
            </Button>
          </Space>
        </div>
      </div>
    </div>
  )
}
