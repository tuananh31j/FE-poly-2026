import { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useMutation, useQuery } from '@tanstack/react-query'

import { env } from '@/shared/constants/env'
import { useAppSelector } from '@/app/store/hooks'
import { useMeQuery } from '@/features/auth/hooks/useMeQuery'

import {
  joinSupportConversation,
  listConversationMessages,
  listSupportConversationsAsStaff,
  sendConversationMessage,
} from '../api/chat.api'
import type { ChatConversation, ChatMessage } from '../model/chat.types'

const getSocketBaseUrl = () => {
  try {
    return new URL(env.apiBaseUrl).origin
  } catch {
    return window.location.origin
  }
}

export const useStaffSupportChat = () => {
  const accessToken = useAppSelector((state) => state.auth.accessToken)
  const authUserId = useAppSelector((state) => state.auth.user?.id)
  const { data: meData } = useMeQuery()
  const socketRef = useRef<Socket | null>(null)

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const currentUserId = meData?.id ?? authUserId ?? null

  const conversationsQuery = useQuery({
    queryKey: ['support-conversations-staff', accessToken],
    queryFn: () => listSupportConversationsAsStaff(1, 20),
    enabled: Boolean(accessToken),
  })

  const joinMutation = useMutation({ mutationFn: joinSupportConversation })
  const sendMessageMutation = useMutation({ mutationFn: sendConversationMessage })

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = io(getSocketBaseUrl(), {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socketRef.current = socket

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) {
        socketRef.current = null
      }
    }
  }, [accessToken])

  useEffect(() => {
    if (!activeConversationId || !accessToken) {
      setMessages([])
      return
    }

    let cancelled = false

    const load = async () => {
      const data = await listConversationMessages(activeConversationId, 1, 50)
      if (!cancelled) {
        const sorted = [...data].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        setMessages(sorted)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [activeConversationId, accessToken])

  useEffect(() => {
    const conversationId = activeConversationId
    const socket = socketRef.current

    if (!conversationId || !socket) {
      return
    }

    socket.emit('room:join', { roomId: `conversation:${conversationId}` })

    const handleMessage = (payload: { conversationId?: string; message?: ChatMessage }) => {
      const nextMessage = payload?.message

      if (payload?.conversationId !== conversationId || !nextMessage) {
        return
      }

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === nextMessage.id)
        if (exists) {
          return prev
        }

        return [...prev, nextMessage].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      })
    }

    socket.on('chat:message_created', handleMessage)
    socket.on('staff:notification', (payload: { type?: string; metadata?: Record<string, unknown> }) => {
      if (payload?.type !== 'chat_message') {
        return
      }

      void conversationsQuery.refetch()
    })

    return () => {
      socket.off('chat:message_created', handleMessage)
      socket.off('staff:notification')
    }
  }, [activeConversationId, conversationsQuery])

  const sendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim()) {
      return
    }

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId,
      senderId: currentUserId ?? 'me',
      content,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMessage])

    try {
      const saved = await sendMessageMutation.mutateAsync({
        conversationId: activeConversationId,
        content,
      })

      setMessages((prev) => prev.map((item) => (item.id === optimisticMessage.id ? saved : item)))
    } catch {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticMessage.id))
      throw new Error('Không thể gửi tin nhắn')
    }
  }

  const conversations = useMemo<ChatConversation[]>(() => {
    return conversationsQuery.data?.items ?? []
  }, [conversationsQuery.data])

  const selectConversation = async (conversationId: string) => {
    if (!conversationId) {
      return
    }

    if (conversationId !== activeConversationId) {
      await joinMutation.mutateAsync(conversationId)
      setActiveConversationId(conversationId)
    }
  }

  return {
    conversations,
    messages,
    activeConversationId,
    currentUserId,
    selectConversation,
    sendMessage,
    isLoading: conversationsQuery.isLoading || joinMutation.isPending,
  }
}
