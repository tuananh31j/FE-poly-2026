import { CloseOutlined, MessageOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Badge, Button, Drawer, Input, message, Space, Spin, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ROUTE_PATHS } from '@/shared/constants/routes'

import { useCustomerSupportChat } from '../hooks/useCustomerSupportChat'
import type { ChatMessage } from '../model/chat.types'

const { TextArea } = Input

const formatTime = (value?: string) => {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleString('vi-VN', { hour12: false })
}

const isSameDay = (a: string, b: string) => {
  const dateA = new Date(a)
  const dateB = new Date(b)
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

const groupMessages = (messages: ChatMessage[]) => {
  const groups: Array<{ date: string; items: ChatMessage[] }> = []

  messages.forEach((message) => {
    const current = groups[groups.length - 1]

    if (!current || !isSameDay(current.date, message.createdAt)) {
      groups.push({ date: message.createdAt, items: [message] })
    } else {
      current.items.push(message)
    }
  })

  return groups
}

interface CustomerSupportChatWidgetProps {
  isAuthenticated: boolean
}

export const CustomerSupportChatWidget = ({ isAuthenticated }: CustomerSupportChatWidgetProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [drawerWidth, setDrawerWidth] = useState(420)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const lastNotifiedMessageIdRef = useRef<string | null>(null)

  const { messages, sendMessage, isReady, isLoading, currentUserId, lastIncomingMessage } =
    useCustomerSupportChat(open)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateWidth = () => {
      setDrawerWidth(window.innerWidth < 640 ? window.innerWidth : 420)
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  useEffect(() => {
    if (!open || !messageContainerRef.current) {
      return
    }

    messageContainerRef.current.scrollTo({
      top: messageContainerRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, open])

  useEffect(() => {
    if (open) {
      setUnreadCount(0)
    }
  }, [open])

  useEffect(() => {
    if (!lastIncomingMessage || lastNotifiedMessageIdRef.current === lastIncomingMessage.id) {
      return
    }

    lastNotifiedMessageIdRef.current = lastIncomingMessage.id

    if (!open) {
      setUnreadCount((prev) => prev + 1)
    }

    void message.info({
      content:
        lastIncomingMessage.content.length > 80
          ? `Nhân viên vừa phản hồi: ${lastIncomingMessage.content.slice(0, 77)}...`
          : `Nhân viên vừa phản hồi: ${lastIncomingMessage.content}`,
      duration: 4,
    })
  }, [lastIncomingMessage, open])

  const groupedMessages = useMemo(() => groupMessages(messages), [messages])

  const handleSend = async () => {
    if (!isAuthenticated) {
      void message.warning('Bạn cần đăng nhập để chat trực tiếp với nhân viên')
      return
    }

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
    <>
      <div className="fixed bottom-6 right-6 z-[90]">
        <Badge count={unreadCount} overflowCount={99} size="small">
          <Button
            type="primary"
            className="!h-12 !rounded-full !px-4 shadow-lg"
            icon={<MessageOutlined />}
            aria-label="Mở chat với nhân viên"
            onClick={() => {
              if (!isAuthenticated) {
                const redirect = `${location.pathname}${location.search}${location.hash}`
                navigate(`${ROUTE_PATHS.LOGIN}?redirect=${encodeURIComponent(redirect)}`)
                return
              }

              setOpen(true)
            }}
          >
            Chat với nhân viên
          </Button>
        </Badge>
      </div>

      <Drawer
        title={
          <Space size={8}>
            <Avatar icon={<UserOutlined />} size={28} />
            <Space direction="vertical" size={0}>
              <Typography.Text strong>Hỗ trợ trực tuyến</Typography.Text>
              <Typography.Text type="secondary" className="text-xs"></Typography.Text>
            </Space>
          </Space>
        }
        placement="right"
        width={drawerWidth}
        open={open}
        onClose={() => setOpen(false)}
        closeIcon={<CloseOutlined />}
        destroyOnClose={false}
        styles={{
          body: { padding: 12 },
          footer: { padding: 12 },
        }}
        footer={
          <Space direction="vertical" size={8} className="w-full">
            <TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder={
                isAuthenticated
                  ? 'Nhập tin nhắn cho nhân viên...'
                  : 'Đăng nhập để chat với nhân viên'
              }
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onPressEnter={(event) => {
                if (event.shiftKey) {
                  return
                }

                event.preventDefault()
                void handleSend()
              }}
              disabled={!isAuthenticated}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={isLoading}
              disabled={!inputValue.trim() || !isAuthenticated}
              className="w-full"
              onClick={() => void handleSend()}
            >
              Gửi tin nhắn
            </Button>
            <Typography.Text type="secondary" className="text-xs">
              Nhân viên sẽ phản hồi ngay khi online. Tin nhắn được lưu lại theo tài khoản.
            </Typography.Text>
          </Space>
        }
      >
        <div
          ref={messageContainerRef}
          className="flex max-h-[calc(100vh-300px)] flex-col gap-3 overflow-y-auto pr-1"
        >
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spin />
            </div>
          ) : groupedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
              <Typography.Text>Chưa có tin nhắn nào.</Typography.Text>
              <Typography.Text className="text-xs">
                Hãy gửi lời chào tới nhân viên hỗ trợ.
              </Typography.Text>
            </div>
          ) : (
            groupedMessages.map((group) => (
              <div key={group.date} className="flex flex-col gap-3">
                <div className="text-center text-xs text-slate-400">{formatTime(group.date)}</div>
                {group.items.map((item) => {
                  const isMine = currentUserId ? item.senderId === currentUserId : false

                  return (
                    <div
                      key={item.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          isMine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{item.content}</div>
                        <div
                          className={`mt-1 text-[11px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}
                        >
                          {formatTime(item.createdAt)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </Drawer>
    </>
  )
}
