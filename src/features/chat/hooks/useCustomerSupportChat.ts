import { useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useMutation, useQuery } from '@tanstack/react-query'

import { env } from '@/shared/constants/env'
import { useAppSelector } from '@/app/store/hooks'
import { useMeQuery } from '@/features/auth/hooks/useMeQuery'
import {
  createSupportConversation,
  listConversationMessages,
  listSupportConversations,
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

export const useCustomerSupportChat = (open: boolean) => {
    const accessToken = useAppSelector((state) => state.auth.accessToken)
    const authUserId = useAppSelector((state) => state.auth.user?.id)
  const { data: meData } = useMeQuery()
    const socketRef = useRef<Socket | null>(null)
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])

    const [lastIncomingMessage, setLastIncomingMessage] = useState<ChatMessage | null>(null)
  const currentUserId = meData?.id ?? authUserId ?? null

    const conversationsQuery = useQuery({
        queryKey: ['support-conversations', accessToken],
        queryFn: () => listSupportConversations(1, 1),
         enabled: Boolean(accessToken),
    })

    const createConversationMutation = useMutation({
        mutationFn: createSupportConversation,
        onSuccess: (conversation) => {
        setActiveConversationId(conversation.id)
        },
    })

    const sendMessageMutation = useMutation({
        mutationFn: sendConversationMessage,
    })

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
        if (!accessToken) {
            return
        }

        const existingConversation = conversationsQuery.data?.items[0]

        if (existingConversation) {
            setActiveConversationId(existingConversation.id)
            return
        }

        if (conversationsQuery.isSuccess && !createConversationMutation.isPending) {
            createConversationMutation.mutate({})
        }
}, [accessToken, conversationsQuery.data, conversationsQuery.isSuccess])

    useEffect(() => {
        const conversationId = activeConversationId
        const socket = socketRef.current

     if (!conversationId || !socket) {
            return
        }

        socket.emit('room:join', { roomId: `conversation:${conversationId}` })

        const handleMessage = (payload: { conversationId?: string; message?: ChatMessage }) => {
            if (payload?.conversationId !== conversationId || !payload.message) {
                return
            }

             if (nextMessage.senderId !== currentUserId) {
        setLastIncomingMessage(nextMessage)
      }

            setMessages((prev) => {
                const exists = prev.some((item) => item.id === payload.message?.id)
                if (exists) {
                    return prev
                }

                return [...prev, payload.message].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            })
        }

        socket.on('chat:message_created', handleMessage)

        return () => {
        socket.off('chat:message_created', handleMessage)
        }
    }, [activeConversationId, currentUserId])

    useEffect(() => {
        if (!activeConversationId || !open) {
            setMessages([])
            return
        }

        let cancelled = false

        const load = async () => {
            const data = await listConversationMessages(activeConversationId, 1, 40)
            if (!cancelled) {
                const sorted = [...data].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                setMessages(sorted)
            }
        }
        void load()

        return () => {
        cancelled = true
        }
    }, [activeConversationId, open])

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

            setMessages((prev) =>
                prev.map((item) => (item.id === optimisticMessage.id ? saved : item))
            )
        } catch {
            setMessages((prev) => prev.filter((item) => item.id !== optimisticMessage.id))
            throw new Error('Không thể gửi tin nhắn lúc này')
        }
    }

    const conversation = useMemo<ChatConversation | null>(() => {
        const existingConversation = conversationsQuery.data?.items[0]
        return existingConversation ?? null
    }, [conversationsQuery.data])

    return {
        conversation,
        messages,
        sendMessage,
        currentUserId,
    lastIncomingMessage,
        isReady: Boolean(activeConversationId),
        isLoading:
         open &&
      (conversationsQuery.isLoading || createConversationMutation.isPending || !activeConversationId),
    }
}