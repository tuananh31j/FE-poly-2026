import {
  CloseOutlined,
  MessageOutlined,
  ReloadOutlined,
  RobotOutlined,
  ShoppingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Avatar, Button, Drawer, Empty, Space, Spin, Typography, message } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { askChatbot, listChatbotPresets } from '@/features/chatbot/api/chatbot.api'
import type {
  ChatbotPresetOption,
  ChatbotUiMessage,
} from '@/features/chatbot/model/chatbot.types'
import { queryKeys } from '@/shared/api/queryKeys'
import { buildProductDetailPath } from '@/shared/constants/routes'

const createMessageId = () => {
  return `chatbot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const formatVndCurrency = (value: number) => {
  return `${value.toLocaleString('vi-VN')} đ`
}

const buildWelcomeMessage = (presetOptions: ChatbotPresetOption[]): ChatbotUiMessage => {
  return {
    id: createMessageId(),
    role: 'assistant',
    content:
      presetOptions.length > 0
        ? 'Chọn một câu hỏi có sẵn để mình gợi ý đúng nhóm sản phẩm mà cửa hàng đã cấu hình.'
        : 'Cửa hàng chưa cấu hình câu hỏi chatbot. Bạn có thể quay lại sau hoặc chat trực tiếp với nhân viên.',
    createdAt: new Date().toISOString(),
    followUpQuestions: presetOptions,
  }
}

export const CustomerChatbotWidget = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(420)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)

  const presetsQuery = useQuery({
    queryKey: queryKeys.chatbot.presets,
    queryFn: listChatbotPresets,
    staleTime: 60_000,
  })

  const askMutation = useMutation({
    mutationFn: askChatbot,
  })

  const presetOptions = presetsQuery.data ?? []
  const isWaitingAnswer = askMutation.isPending
   const statusText = presetsQuery.isLoading
    ? 'Đang tải câu hỏi mẫu...'
    : isWaitingAnswer
      ? 'Đang phản hồi...'
      : 'Chỉ hỗ trợ theo câu hỏi mẫu'

  const appendMessage = (nextMessage: ChatbotUiMessage) => {
    setMessagesState((prev) => [...prev, nextMessage])
  }

  const resetConversation = () => {
    setMessagesState([buildWelcomeMessage(presetOptions)])
  }
  }


  useEffect(() => {
    if (!presetsQuery.isSuccess || initializedRef.current) {
      return
    }

    initializedRef.current = true
    setMessagesState([buildWelcomeMessage(presetOptions)])
  }, [presetOptions, presetsQuery.isSuccess])
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
  }, [messagesState, open, isWaitingAnswer])

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

  const sendPresetQuestion = (preset: ChatbotPresetOption) => {
    if (isWaitingAnswer) {
      return
    }

    appendMessage({
      id: createMessageId(),
      role: 'customer',
      content: preset.question,
      createdAt: new Date().toISOString(),
    })

    askMutation.mutate(
      {
        presetId: preset.id,
        context: {
          path: location.pathname,
        },
      },
      {
        onSuccess: (data) => {
          appendMessage({
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
          appendMessage({
            id: createMessageId(),
            role: 'assistant',
            content: 'Chatbot đang tạm thời gián đoạn. Bạn vui lòng thử lại sau ít phút.',
            createdAt: new Date().toISOString(),
            followUpQuestions: presetOptions,
          })
          void message.error((error as Error).message)
        },
      }
    )
  }

  const messages = useMemo(() => messagesState, [messagesState])

  
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[90]">
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
        
        }}
        
      >
        <div ref={messageContainerRef} className="flex max-h-[calc(100vh-180px)] flex-col gap-3 overflow-y-auto pr-1">
          {presetsQuery.isLoading && messages.length === 0 ? (
            <div className="flex items-center gap-2 px-2 text-slate-500">
              <Spin size="small" />
              <Typography.Text type="secondary" className="text-xs">
                Đang tải câu hỏi mẫu...
              </Typography.Text>
               
              
            </div>
          

          ) : messages.length === 0 ? (
            <Empty description="Chưa có nội dung chatbot" />
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
                        <Typography.Text
                          className={`text-[11px] ${isAssistant ? 'text-slate-500' : '!text-blue-100'}`}
                        >
                          {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })}
                        </Typography.Text>

                        {Array.isArray(item.suggestedProducts) && item.suggestedProducts.length > 0 && (
                          <div className="mb-2 flex flex-col gap-2">
                            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                              <ShoppingOutlined />
                              <span>Sản phẩm phù hợp</span>
                            </div>
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
                                    className="h-12 w-12 rounded-md object-cover"
                                  />
                                ) : (
                                  <div className="h-12 w-12 rounded-md bg-slate-200" />
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
                          <Space wrap size={[6, 6]} className="mb-1 mt-3">
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
                          <Space wrap size={[6, 6]} className="mt-3">
                            {item.followUpQuestions.map((question) => (
                              <Button
                                key={`${item.id}-${question.id}`}
                                size="small"
                                type="dashed"
                                onClick={() => sendPresetQuestion(question)}
                              >
                                {question.question}
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
                Đang lấy danh sách sản phẩm phù hợp...
              </Typography.Text>
            </div>
          )}
        </div>
      </Drawer>
    </>
  )
}
