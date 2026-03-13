import {
  CloseOutlined,
  GiftOutlined,
  MessageOutlined,
  OrderedListOutlined,
  ReloadOutlined,
  RobotOutlined,
  SendOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Avatar, Badge, Button, Divider, Drawer, Empty, Input, Space, Spin, Typography, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { askChatbot } from '@/features/chatbot/api/chatbot.api'
import type { ChatbotUiMessage } from '@/features/chatbot/model/chatbot.types'
import { buildProductDetailPath, ROUTE_PATHS } from '@/shared/constants/routes'

const { TextArea } = Input

const CHATBOT_STORAGE_KEY = 'golden-billiards-chatbot:v1'
const MAX_HISTORY_MESSAGES = 40
const QUICK_PROMPTS = [
  'Gợi ý sản phẩm bán chạy',
  'Có phương thức thanh toán nào?',
  'Làm sao theo dõi đơn hàng?',
  'Chính sách đổi trả như thế nào?',
]
const QUICK_ACTIONS = [
  {
    label: 'Xem sản phẩm',
    icon: <ShoppingOutlined />,
    url: ROUTE_PATHS.PRODUCTS,
  },
  {
    label: 'Xem giỏ hàng',
    icon: <ShoppingCartOutlined />,
    url: ROUTE_PATHS.CHECKOUT,
  },
  {
    label: 'Theo dõi đơn hàng',
    icon: <OrderedListOutlined />,
    url: ROUTE_PATHS.ACCOUNT_ORDERS,
  },
  {
    label: 'Ưu đãi hôm nay',
    icon: <GiftOutlined />,
    question: 'Có chương trình ưu đãi nào hôm nay không?',
  },
]

const formatVndCurrency = (value: number) => {
  return `${value.toLocaleString('vi-VN')} đ`
}

const createMessageId = () => {
  return `chatbot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const getDefaultMessages = (): ChatbotUiMessage[] => {
  return [
    {
      id: createMessageId(),
      role: 'assistant',
      content:
        'Xin chào, mình là trợ lý mua hàng của Golden Billiards. Bạn có thể hỏi về sản phẩm, thanh toán, vận chuyển hoặc đơn hàng.',
      createdAt: new Date().toISOString(),
      followUpQuestions: QUICK_PROMPTS,
    },
  ]
}

const loadPersistedMessages = () => {
  if (typeof window === 'undefined') {
    return getDefaultMessages()
  }

  try {
    const raw = window.localStorage.getItem(CHATBOT_STORAGE_KEY)

    if (!raw) {
      return getDefaultMessages()
    }

    const parsed = JSON.parse(raw) as ChatbotUiMessage[]

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return getDefaultMessages()
    }

    return parsed.slice(-MAX_HISTORY_MESSAGES)
  } catch {
    return getDefaultMessages()
  }
}

export const CustomerChatbotWidget = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [messagesState, setMessagesState] = useState<ChatbotUiMessage[]>(() => loadPersistedMessages())
  const [unreadCount, setUnreadCount] = useState(0)
  const [drawerWidth, setDrawerWidth] = useState(420)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)

  const askMutation = useMutation({
    mutationFn: askChatbot,
  })

  const isWaitingAnswer = askMutation.isPending
  const statusText = isWaitingAnswer ? 'Đang phản hồi...' : 'Sẵn sàng hỗ trợ'

  const appendMessage = (nextMessage: ChatbotUiMessage) => {
    setMessagesState((prev) => [...prev, nextMessage].slice(-MAX_HISTORY_MESSAGES))
  }

  const appendAssistantReply = (nextMessage: ChatbotUiMessage) => {
    appendMessage(nextMessage)

    if (!open) {
      setUnreadCount((prev) => Math.min(prev + 1, 99))
    }
  }

  const sendQuestion = (rawQuestion?: string) => {
    const question = (rawQuestion ?? inputValue).trim()

    if (!question || isWaitingAnswer) {
      return
    }

    const customerMessage: ChatbotUiMessage = {
      id: createMessageId(),
      role: 'customer',
      content: question,
      createdAt: new Date().toISOString(),
    }

    appendMessage(customerMessage)
    setInputValue('')

    askMutation.mutate(
      {
        question,
        context: {
          path: location.pathname,
        },
      },
      {
        onSuccess: (data) => {
          appendAssistantReply({
            id: createMessageId(),
            role: 'assistant',
            content: data.answer,
            createdAt: new Date().toISOString(),
            actions: data.actions,
            followUpQuestions: data.followUpQuestions,
            suggestedProducts: data.suggestedProducts,
          })
        },
        onError: (error) => {
          appendAssistantReply({
            id: createMessageId(),
            role: 'assistant',
            content:
              'Mình đang gặp sự cố tạm thời. Bạn vui lòng thử lại sau vài giây hoặc để lại câu hỏi ngắn gọn hơn.',
            createdAt: new Date().toISOString(),
          })
          void message.error((error as Error).message)
        },
      }
    )
  }

  const messages = useMemo(() => {
    return messagesState
  }, [messagesState])

  const shouldShowQuickPromptPanel = messages.length <= 1

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(CHATBOT_STORAGE_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    if (!open) {
      return
    }

    setUnreadCount(0)
  }, [open])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateDrawerWidth = () => {
      setDrawerWidth(window.innerWidth < 640 ? window.innerWidth : 420)
    }

    updateDrawerWidth()
    window.addEventListener('resize', updateDrawerWidth)

    return () => {
      window.removeEventListener('resize', updateDrawerWidth)
    }
  }, [])

  useEffect(() => {
    if (!messageContainerRef.current) {
      return
    }

    messageContainerRef.current.scrollTo({
      top: messageContainerRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, open, isWaitingAnswer])

  const handleNavigate = (targetUrl: string) => {
    const normalizedUrl = targetUrl?.trim()

    if (!normalizedUrl) {
      return
    }

    if (normalizedUrl.startsWith('/products/')) {
      const productId = normalizedUrl.replace('/products/', '').trim()

      if (productId) {
        navigate(buildProductDetailPath(productId))
        setOpen(false)
        return
      }
    }

    navigate(normalizedUrl)
    setOpen(false)
  }

  const resetConversation = () => {
    const nextMessages = getDefaultMessages()
    setMessagesState(nextMessages)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CHATBOT_STORAGE_KEY, JSON.stringify(nextMessages))
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
            aria-label="Mở chatbot hỗ trợ khách hàng"
            onClick={() => {
              setOpen(true)
            }}
          >
            Trợ lý mua hàng
          </Button>
        </Badge>
      </div>

      <Drawer
        title={
          <Space size={8}>
            <Avatar icon={<RobotOutlined />} size={28} />
            <Space direction="vertical" size={0}>
              <Typography.Text strong>Chatbot hỗ trợ khách hàng</Typography.Text>
              <Typography.Text type="secondary" className="text-xs">
                {statusText}
              </Typography.Text>
            </Space>
          </Space>
        }
        placement="right"
        width={drawerWidth}
        open={open}
        onClose={() => setOpen(false)}
        closeIcon={<CloseOutlined />}
        destroyOnClose={false}
        extra={
          <Button type="text" icon={<ReloadOutlined />} onClick={resetConversation}>
            Làm mới
          </Button>
        }
        styles={{
          body: {
            padding: 12
          },
          footer: {
            padding: 12
          }
        }}
        footer={
          <Space direction="vertical" size={8} className="w-full">
            <TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder="Nhập câu hỏi cho chatbot..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onPressEnter={(event) => {
                if (event.shiftKey) {
                  return
                }

                event.preventDefault()
                sendQuestion()
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={isWaitingAnswer}
              disabled={!inputValue.trim()}
              className="w-full"
              onClick={() => sendQuestion()}
            >
              Gửi
            </Button>
            <Typography.Text type="secondary" className="text-xs">
              Mẹo: nhấn Enter để gửi, Shift + Enter để xuống dòng.
            </Typography.Text>
          </Space>
        }
      >
        <div ref={messageContainerRef} className="flex max-h-[calc(100vh-300px)] flex-col gap-3 overflow-y-auto pr-1">
          {shouldShowQuickPromptPanel && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Typography.Text strong className="block">
                Bắt đầu nhanh
              </Typography.Text>
              <Typography.Text type="secondary" className="mb-3 block text-xs">
                Chọn nhanh để khám phá sản phẩm hoặc hỏi trợ lý.
              </Typography.Text>
              <Space wrap size={[6, 6]} className="mb-3">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    size="small"
                    icon={action.icon}
                    onClick={() => {
                      if (action.url) {
                        handleNavigate(action.url)
                      } else if (action.question) {
                        sendQuestion(action.question)
                      }
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </Space>
              <Divider className="!my-2" />
              <Space wrap size={[6, 6]}>
                {QUICK_PROMPTS.map((question) => (
                  <Button
                    key={`prompt-${question}`}
                    size="small"
                    type="dashed"
                    onClick={() => sendQuestion(question)}
                  >
                    {question}
                  </Button>
                ))}
              </Space>
            </div>
          )}

          {messages.length === 0 ? (
            <Empty description="Chưa có tin nhắn" />
          ) : (
            messages.map((item) => {
              const isAssistant = item.role === 'assistant'

              return (
                <div key={item.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 ${
                      isAssistant
                        ? 'border border-slate-200 bg-slate-100 text-slate-900'
                        : 'bg-blue-600 text-white shadow-sm'
                    }`}
                  >
                    <Space align="start" size={8}>
                      <Avatar
                        size={24}
                        icon={isAssistant ? <RobotOutlined /> : <UserOutlined />}
                        className={isAssistant ? '' : '!bg-blue-700'}
                      />
                      <div>
                        <Typography.Paragraph
                          className={`!mb-1 whitespace-pre-wrap ${isAssistant ? '' : '!text-white'}`}
                        >
                          {item.content}
                        </Typography.Paragraph>
                        <Typography.Text className={`text-[11px] ${isAssistant ? 'text-slate-500' : '!text-blue-100'}`}>
                          {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </Typography.Text>

                        {Array.isArray(item.suggestedProducts) && item.suggestedProducts.length > 0 && (
                          <div className="mb-2 flex flex-col gap-2">
                            <Divider className="!my-2" />
                            <Typography.Text strong className="text-xs">
                              Gợi ý phù hợp
                            </Typography.Text>
                            {item.suggestedProducts.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left"
                                onClick={() => handleNavigate(product.url)}
                              >
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="h-10 w-10 rounded-md object-cover"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-md bg-slate-200" />
                                )}

                                <div className="min-w-0">
                                  <Typography.Text strong className="block truncate">
                                    {product.name}
                                  </Typography.Text>
                                  <Typography.Text type="secondary" className="text-xs">
                                    {product.brand} · Đã bán {product.soldCount}
                                  </Typography.Text>
                                  {typeof product.priceFrom === 'number' && (
                                    <Typography.Text className="block text-xs text-blue-700">
                                      Từ {formatVndCurrency(product.priceFrom)}
                                    </Typography.Text>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {Array.isArray(item.actions) && item.actions.length > 0 && (
                          <Space wrap size={[6, 6]} className="mb-1">
                            {item.actions.map((action) => (
                              <Button
                                key={`${item.id}-${action.label}`}
                                size="small"
                                type="default"
                                onClick={() => handleNavigate(action.url)}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </Space>
                        )}

                        {Array.isArray(item.followUpQuestions) && item.followUpQuestions.length > 0 && (
                          <Space wrap size={[6, 6]}>
                            {item.followUpQuestions.map((question) => (
                              <Button
                                key={`${item.id}-${question}`}
                                size="small"
                                type="dashed"
                                onClick={() => sendQuestion(question)}
                              >
                                {question}
                              </Button>
                            ))}
                          </Space>
                        )}
                      </div>
                    </Space>
                  </div>
                </div>
              )
            })
          )}

          {isWaitingAnswer && (
            <div className="flex items-center gap-2 px-2 text-slate-500">
              <Spin size="small" />
              <Typography.Text type="secondary" className="text-xs">
                Đang phân tích yêu cầu và tìm gợi ý phù hợp...
              </Typography.Text>
            </div>
          )}
        </div>
      </Drawer>
    </>
  )
}
