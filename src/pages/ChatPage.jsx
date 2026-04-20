import { useEffect, useRef, useState } from 'react'
import { Send, Smile } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AppNavbar } from '../components/AppNavbar'
import { Input } from '../components/ui/input'
import { formatSupabaseError } from '../lib/formatSupabaseError'
import { supabase } from '../supabaseClient'

const RECENT_EMOJIS_STORAGE_KEY = 'arhamchat:recentEmojis'
const MAX_RECENT_EMOJIS = 18
const EMOJI_LIBRARY = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '🥹',
  '😅',
  '😂',
  '🤣',
  '😊',
  '🙂',
  '😉',
  '😍',
  '🥰',
  '😘',
  '😗',
  '😙',
  '😚',
  '😋',
  '😛',
  '😜',
  '🤪',
  '😝',
  '🫠',
  '🤗',
  '🤭',
  '🤫',
  '🤔',
  '🫡',
  '😐',
  '😑',
  '😶',
  '🙄',
  '😏',
  '😌',
  '😮',
  '😲',
  '🥱',
  '😴',
  '😪',
  '😵',
  '🤯',
  '😎',
  '🤓',
  '🧐',
  '🥳',
  '🤩',
  '😇',
  '🔥',
  '✨',
  '⭐',
  '🌟',
  '💫',
  '⚡',
  '💥',
  '💯',
  '✅',
  '❌',
  '📌',
  '📍',
  '🎯',
  '🎉',
  '🎊',
  '🎁',
  '🎈',
  '🎵',
  '🎶',
  '📸',
  '🎬',
  '🍕',
  '🍔',
  '🍟',
  '🌮',
  '🍜',
  '🍣',
  '☕',
  '🍵',
  '🧋',
  '🥤',
  '🍩',
  '🍫',
  '🍰',
  '🫶',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '🤎',
  '💔',
  '❤️‍🔥',
  '❤️‍🩹',
  '💕',
  '💞',
  '💓',
  '💗',
  '💖',
  '👍',
  '👎',
  '👏',
  '🙌',
  '🙏',
  '🤝',
  '👊',
  '✌️',
  '🤘',
  '👌',
  '🤌',
  '🤟',
  '💪',
  '🫵',
  '👀',
  '🧠',
  '👑',
  '🚀',
  '🛠️',
  '📱',
  '💻',
  '⌚',
  '🔋',
  '🌍',
  '☀️',
  '🌙',
  '⭐',
  '🌧️',
  '⛈️',
  '❄️',
  '😬',
  '😔',
  '😕',
  '🙃',
  '😢',
  '😭',
  '😤',
  '😡',
  '🤬',
  '😱',
  '😨',
  '😰',
  '😮‍💨',
  '🤒',
  '🤕',
  '🤢',
  '🤮',
  '🤧',
  '😈',
  '💀',
  '👻',
  '🤖',
]

function getDisplayName(profile, fallbackEmail) {
  if (profile?.full_name) return profile.full_name
  if (profile?.email) return profile.email
  if (fallbackEmail) return fallbackEmail
  return 'Conversation'
}

function formatMessageTime(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function mergeMessage(list, incomingMessage) {
  if (!incomingMessage?.id) {
    return list
  }

  const nextList = list.some((message) => message.id === incomingMessage.id)
    ? list.map((message) =>
        message.id === incomingMessage.id ? { ...message, ...incomingMessage } : message,
      )
    : [...list, incomingMessage]

  return nextList.sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  )
}

function getMessageStatus(message) {
  if (message.read_at) {
    return {
      label: 'Read',
      ticks: '✓✓',
      className: 'chat-message-status--read',
    }
  }

  if (message.delivered_at) {
    return {
      label: 'Delivered',
      ticks: '✓',
      className: 'chat-message-status--delivered',
    }
  }

  return {
    label: 'Sent',
    ticks: '✓',
    className: 'chat-message-status--sent',
  }
}

export function ChatPage({
  embedded = false,
  conversationId: conversationIdOverride,
  onBack,
  onConversationRead,
}) {
  const navigate = useNavigate()
  const params = useParams()
  const conversationId = conversationIdOverride ?? params.conversationId
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [participantName, setParticipantName] = useState('Conversation')
  const [otherParticipantId, setOtherParticipantId] = useState(null)
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [recentEmojis, setRecentEmojis] = useState([])
  const bottomRef = useRef(null)
  const emojiPickerRef = useRef(null)

  const visibleLibraryEmojis = EMOJI_LIBRARY.filter((emoji) => !recentEmojis.includes(emoji))

  function rememberRecentEmoji(emoji) {
    setRecentEmojis((currentEmojis) => {
      const nextRecentEmojis = [emoji, ...currentEmojis.filter((item) => item !== emoji)].slice(
        0,
        MAX_RECENT_EMOJIS,
      )

      window.localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(nextRecentEmojis))

      return nextRecentEmojis
    })
  }

  async function markConversationRead() {
    if (!conversationId || !user?.id) {
      return
    }

    const { error: markReadError } = await supabase.rpc('mark_conversation_read', {
      target_conversation_id: conversationId,
    })

    if (markReadError) {
      return
    }

    onConversationRead?.(conversationId)
  }

  useEffect(() => {
    if (!conversationId) {
      return
    }

    window.localStorage.setItem('arhamchat:lastConversationId', conversationId)
  }, [conversationId])

  useEffect(() => {
    const storedValue = window.localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY)

    if (!storedValue) {
      return
    }

    try {
      const parsed = JSON.parse(storedValue)

      if (!Array.isArray(parsed)) {
        return
      }

      const validRecentEmojis = parsed
        .filter((emoji) => typeof emoji === 'string' && EMOJI_LIBRARY.includes(emoji))
        .slice(0, MAX_RECENT_EMOJIS)

      setRecentEmojis(validRecentEmojis)
    } catch {
      setRecentEmojis([])
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    let isActive = true

    async function loadConversation() {
      if (!conversationId || !user?.id) {
        if (isActive) {
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      setError('')

      const {
        data: participantRows,
        error: participantError,
      } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)

      if (participantError) {
        if (isActive) {
          setError(formatSupabaseError(participantError))
          setIsLoading(false)
        }
        return
      }

      const otherParticipantId = participantRows?.[0]?.user_id

      if (isActive) {
        setOtherParticipantId(otherParticipantId || null)
      }

      if (otherParticipantId) {
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('id', otherParticipantId)
          .maybeSingle()

        if (profileError) {
          if (isActive) {
            setError(formatSupabaseError(profileError))
          }
        } else if (isActive) {
          setParticipantName(getDisplayName(profileRow))
        }
      }

      const { data: messageRows, error: messagesError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, delivered_at, read_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (messagesError) {
        if (isActive) {
          setError(formatSupabaseError(messagesError))
          setIsLoading(false)
        }
        return
      }

      if (isActive) {
        setMessages(messageRows || [])
        setIsLoading(false)
      }

      await markConversationRead()
    }

    loadConversation()

    return () => {
      isActive = false
    }
  }, [conversationId, user?.id])

  useEffect(() => {
    if (!otherParticipantId) {
      return undefined
    }

    const profileChannel = supabase
      .channel(`profile:${otherParticipantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${otherParticipantId}`,
        },
        (payload) => {
          setParticipantName(getDisplayName(payload.new))
        },
      )
      .subscribe()

    return () => {
      profileChannel.unsubscribe()
    }
  }, [otherParticipantId])

  useEffect(() => {
    if (!conversationId) {
      return undefined
    }

    const subscription = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((currentMessages) => mergeMessage(currentMessages, payload.new))

          if (payload.new?.sender_id !== user?.id) {
            void markConversationRead()
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((currentMessages) => mergeMessage(currentMessages, payload.new))
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [conversationId, user?.id])

  useEffect(() => {
    if (!isEmojiPickerOpen) {
      return undefined
    }

    function handleDocumentPointerDown(event) {
      if (!emojiPickerRef.current?.contains(event.target)) {
        setIsEmojiPickerOpen(false)
      }
    }

    function handleDocumentKeyDown(event) {
      if (event.key === 'Escape') {
        setIsEmojiPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [isEmojiPickerOpen])

  async function handleSend(event) {
    event.preventDefault()

    const content = draft.trim()

    if (!content || !user?.id || !conversationId || isSending) {
      return
    }

    setIsSending(true)
    setError('')

    const { data, error: sendError } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_id: user.id,
          content,
        },
      ])
      .select('id, conversation_id, sender_id, content, created_at, delivered_at, read_at')
      .single()

    if (sendError) {
      setError(formatSupabaseError(sendError))
      setIsSending(false)
      return
    }

    setMessages((currentMessages) => mergeMessage(currentMessages, data))
    setDraft('')
    setIsEmojiPickerOpen(false)
    setIsSending(false)
  }

  function handleEmojiPick(emoji) {
    setDraft((currentDraft) => currentDraft + emoji)
    rememberRecentEmoji(emoji)
    setIsEmojiPickerOpen(false)
  }

  function handleBack() {
    if (onBack) {
      onBack()
      return
    }

    navigate('/chats')
  }

  const showBackButton = !embedded || Boolean(onBack)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');

        .chat-thread-screen {
          height: ${embedded ? '100%' : '100dvh'};
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          padding-bottom: ${embedded ? '0' : '84px'};
          background: #ffffff;
          color: #111827;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        .chat-thread-header {
          display: grid;
          grid-template-columns: 72px 1fr 72px;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .chat-thread-header--embedded {
          grid-template-columns: 1fr;
        }

        .chat-thread-back {
          justify-self: start;
          border: none;
          padding: 6px 0;
          background: transparent;
          color: #1a1a2e;
          font: inherit;
          font-size: 1.3rem;
          line-height: 1;
          cursor: pointer;
        }

        .chat-thread-title {
          margin: 0;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 1rem;
          font-weight: 700;
          color: #111827;
        }

        .chat-thread-title--embedded {
          text-align: left;
        }

        .chat-thread-spacer {
          width: 72px;
        }

        .chat-thread-body {
          overflow-y: auto;
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
          padding: 18px 16px 12px;
          background: #ffffff;
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #f1f5f9;
        }

        .chat-thread-body::-webkit-scrollbar {
          width: 10px;
        }

        .chat-thread-body::-webkit-scrollbar-track {
          background: #f8fafc;
        }

        .chat-thread-body::-webkit-scrollbar-thumb {
          border: 2px solid #f8fafc;
          border-radius: 999px;
          background: #94a3b8;
        }

        .chat-thread-body::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        .chat-thread-status,
        .chat-thread-error,
        .chat-thread-empty {
          margin: 0;
          padding: 16px 0;
          font-size: 0.95rem;
        }

        .chat-thread-error {
          color: #dc2626;
        }

        .chat-thread-empty,
        .chat-thread-status {
          color: #6b7280;
        }

        .chat-thread-empty-state {
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .chat-message-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .chat-message-row {
          display: flex;
          flex-direction: column;
          max-width: 82%;
        }

        .chat-message-row--sent {
          align-self: flex-end;
          align-items: flex-end;
        }

        .chat-message-row--received {
          align-self: flex-start;
          align-items: flex-start;
        }

        .chat-message-bubble {
          padding: 12px 14px;
          border-radius: 18px;
          font-size: 0.96rem;
          line-height: 1.45;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .chat-message-bubble--sent {
          border-bottom-right-radius: 4px;
          background: #1a1a2e;
          color: #ffffff;
        }

        .chat-message-bubble--received {
          border-bottom-left-radius: 4px;
          background: #f0f0f0;
          color: #111827;
        }

        .chat-message-time {
          margin-top: 6px;
          color: #9ca3af;
          font-size: 0.74rem;
          font-weight: 500;
        }

        .chat-message-meta {
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .chat-message-status {
          font-size: 0.74rem;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.02em;
          user-select: none;
        }

        .chat-message-status--sent,
        .chat-message-status--delivered {
          margin-top: 6px;
          color: #9ca3af;
        }

        .chat-message-status--read {
          color: #3b82f6;
        }

        .chat-thread-composer {
          position: sticky;
          bottom: 0;
          padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .chat-thread-form {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .chat-thread-input-wrap {
          position: relative;
          width: 100%;
        }

        .chat-thread-inline-actions {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding-right: 6px;
        }

        .chat-thread-emoji,
        .chat-thread-send {
          min-width: 38px;
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .chat-thread-emoji {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
          transition:
            border-color 0.2s ease,
            background-color 0.2s ease,
            color 0.2s ease;
        }

        .chat-thread-emoji:hover {
          border-color: #94a3b8;
          background: #f8fafc;
          color: #0f172a;
        }

        .chat-thread-emoji--active {
          border-color: #94a3b8;
          background: #f1f5f9;
          color: #0f172a;
        }

        .chat-thread-emoji-icon {
          width: 18px;
          height: 18px;
        }

        .chat-thread-emoji-picker {
          position: absolute;
          right: 44px;
          bottom: calc(100% + 8px);
          width: 296px;
          max-height: 280px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #f1f5f9;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px;
          background: #ffffff;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.2);
          z-index: 30;
        }

        .chat-thread-emoji-picker::-webkit-scrollbar {
          width: 8px;
        }

        .chat-thread-emoji-picker::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 10px;
        }

        .chat-thread-emoji-picker::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #94a3b8;
        }

        .chat-thread-emoji-picker::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        .chat-thread-emoji-group + .chat-thread-emoji-group {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #f1f5f9;
        }

        .chat-thread-emoji-group-title {
          margin: 0 0 6px;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .chat-thread-emoji-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 4px;
        }

        .chat-thread-emoji-option {
          border: 0;
          border-radius: 8px;
          background: transparent;
          font-size: 1.12rem;
          line-height: 1;
          min-height: 34px;
          cursor: pointer;
        }

        .chat-thread-emoji-option:hover {
          background: #f1f5f9;
        }

        .chat-thread-input {
          width: 100%;
          min-height: 46px;
          padding: 0 14px;
          border: 1px solid #d1d5db;
          border-radius: 999px;
          background: #ffffff;
          color: #111827;
          font: inherit;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .chat-thread-input::placeholder {
          color: #9ca3af;
        }

        .chat-thread-input:focus {
          outline: none;
          border-color: #1a1a2e;
          box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.12);
        }

        .chat-thread-send {
          border: none;
          background: #1a1a2e;
          color: #ffffff;
        }

        .chat-thread-send:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .chat-thread-back:focus-visible,
        .chat-thread-send:focus-visible,
        .chat-thread-emoji:focus-visible {
          outline: 2px solid #1a1a2e;
          outline-offset: 2px;
        }

        .chat-thread-back--embedded {
          display: none;
        }

        @media (max-width: 960px) {
          .chat-thread-header {
            padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
          }

          .chat-thread-title {
            font-size: 0.96rem;
          }

          .chat-thread-body {
            padding: 14px 12px 10px;
          }

          .chat-message-row {
            max-width: 88%;
          }

          .chat-thread-composer {
            padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
          }

          .chat-thread-inline-actions {
            gap: 3px;
            padding-right: 4px;
          }

          .chat-thread-emoji,
          .chat-thread-send {
            min-width: 36px;
            width: 36px;
            height: 36px;
          }

          .chat-thread-back--embedded {
            display: inline-flex;
            align-items: center;
          }

          .chat-thread-header--embedded {
            grid-template-columns: 72px 1fr 72px;
          }

          .chat-thread-title--embedded {
            text-align: center;
          }

          .chat-thread-emoji-picker {
            width: min(320px, calc(100vw - 24px));
            max-height: min(44svh, 320px);
            right: 0;
          }
        }

        @media (max-width: 420px) {
          .chat-thread-header--embedded {
            grid-template-columns: 56px 1fr 56px;
          }

          .chat-thread-spacer {
            width: 56px;
          }

          .chat-thread-back {
            font-size: 1.15rem;
          }

          .chat-thread-title {
            font-size: 0.92rem;
          }

          .chat-message-bubble {
            font-size: 0.92rem;
          }
        }
      `}</style>

      <main className="chat-thread-screen">
        <header
          className={'chat-thread-header' + (embedded ? ' chat-thread-header--embedded' : '')}
        >
          {showBackButton ? (
            <button
              className={
                'chat-thread-back' + (embedded ? ' chat-thread-back--embedded' : '')
              }
              type="button"
              onClick={handleBack}
              aria-label="Back to messages"
            >
              &larr;
            </button>
          ) : null}

          <h1 className={'chat-thread-title' + (embedded ? ' chat-thread-title--embedded' : '')}>
            {participantName}
          </h1>

          {showBackButton ? <div className="chat-thread-spacer" aria-hidden="true" /> : null}
        </header>

        <section className="chat-thread-body">
          {isLoading ? (
            <p className="chat-thread-status">Loading conversation...</p>
          ) : error && messages.length === 0 ? (
            <p className="chat-thread-error">{error}</p>
          ) : messages.length === 0 ? (
            <div className="chat-thread-empty-state">
              <p className="chat-thread-empty">No messages yet. Say hello!</p>
            </div>
          ) : (
            <div className="chat-message-list">
              {messages.map((message) => {
                const isSentByCurrentUser = message.sender_id === user?.id

                return (
                  <article
                    key={message.id}
                    className={
                      'chat-message-row ' +
                      (isSentByCurrentUser
                        ? 'chat-message-row--sent'
                        : 'chat-message-row--received')
                    }
                  >
                    <div
                      className={
                        'chat-message-bubble ' +
                        (isSentByCurrentUser
                          ? 'chat-message-bubble--sent'
                          : 'chat-message-bubble--received')
                      }
                    >
                      {message.content}
                    </div>
                    <div className="chat-message-meta">
                      <time className="chat-message-time" dateTime={message.created_at}>
                        {formatMessageTime(message.created_at)}
                      </time>
                      {isSentByCurrentUser ? (
                        <span
                          aria-label={getMessageStatus(message).label}
                          className={'chat-message-status ' + getMessageStatus(message).className}
                          title={getMessageStatus(message).label}
                        >
                          {getMessageStatus(message).ticks}
                        </span>
                      ) : null}
                    </div>
                  </article>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <footer className="chat-thread-composer">
          <form className="chat-thread-form" onSubmit={handleSend}>
            <div className="chat-thread-input-wrap">
              <Input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message"
                autoComplete="off"
                className="h-12 rounded-full pe-24"
              />

              <div className="chat-thread-inline-actions" ref={emojiPickerRef}>
                <button
                  className={
                    'chat-thread-emoji' + (isEmojiPickerOpen ? ' chat-thread-emoji--active' : '')
                  }
                  type="button"
                  onClick={() => setIsEmojiPickerOpen((current) => !current)}
                  aria-label="Open emoji picker"
                  title="Add emoji"
                >
                  <Smile className="chat-thread-emoji-icon" strokeWidth={2} aria-hidden="true" />
                </button>

                {isEmojiPickerOpen ? (
                  <div className="chat-thread-emoji-picker" role="dialog" aria-label="Emoji picker">
                    {recentEmojis.length > 0 ? (
                      <section className="chat-thread-emoji-group" aria-label="Recently used emojis">
                        <p className="chat-thread-emoji-group-title">Recent</p>
                        <div className="chat-thread-emoji-grid" role="listbox">
                          {recentEmojis.map((emoji) => (
                            <button
                              key={`recent-${emoji}`}
                              className="chat-thread-emoji-option"
                              type="button"
                              onClick={() => handleEmojiPick(emoji)}
                              aria-label={`Insert ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    <section className="chat-thread-emoji-group" aria-label="All emojis">
                      <p className="chat-thread-emoji-group-title">All Emojis</p>
                      <div className="chat-thread-emoji-grid" role="listbox">
                        {visibleLibraryEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            className="chat-thread-emoji-option"
                            type="button"
                            onClick={() => handleEmojiPick(emoji)}
                            aria-label={`Insert ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                ) : null}

                <button
                  className="chat-thread-send"
                  type="submit"
                  disabled={!draft.trim() || isSending}
                  aria-label="Send message"
                  title="Send"
                >
                  <Send size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
          {error && messages.length > 0 ? <p className="chat-thread-error">{error}</p> : null}
        </footer>
        {!embedded ? <AppNavbar /> : null}
      </main>
    </>
  )
}
