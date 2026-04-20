import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { formatSupabaseError } from '../lib/formatSupabaseError'
import { supabase } from '../supabaseClient'
import { ChatPage } from './ChatPage'

const PROFILE_IMAGES_BUCKET = 'profile-images'

function getDisplayName(profile, fallbackEmail) {
  if (profile?.full_name) return profile.full_name
  if (profile?.email) return profile.email
  if (fallbackEmail) return fallbackEmail
  return 'Unknown User'
}

function getInitials(label) {
  const source = (label || 'Unknown User').trim()

  if (!source) {
    return 'U'
  }

  const cleaned = source.includes('@') ? source.split('@')[0] : source
  const parts = cleaned
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return source.slice(0, 1).toUpperCase()
  }

  return parts.map((part) => part[0]?.toUpperCase() || '').join('')
}

function formatTimestamp(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  if (isSameDay) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function sortConversationsByRecentMessage(conversations) {
  return [...conversations].sort((left, right) => {
    const leftTime = left.lastMessage?.created_at
      ? new Date(left.lastMessage.created_at).getTime()
      : 0
    const rightTime = right.lastMessage?.created_at
      ? new Date(right.lastMessage.created_at).getTime()
      : 0

    return rightTime - leftTime
  })
}

export function ChatListPage() {
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState('')
  const [selectedProfileImageFile, setSelectedProfileImageFile] = useState(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const profileMenuRef = useRef(null)
  const conversationsRef = useRef([])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const applyRealtimeInsertToConversations = useCallback(
    (message) => {
      if (!message?.conversation_id) {
        return
      }

      setConversations((currentConversations) => {
        let conversationFound = false

        const nextConversations = currentConversations.map((conversation) => {
          if (conversation.id !== message.conversation_id) {
            return conversation
          }

          conversationFound = true

          const isUnreadForCurrentUser =
            message.sender_id !== user?.id && !message.read_at && conversationId !== message.conversation_id

          return {
            ...conversation,
            lastMessage: {
              ...(conversation.lastMessage || {}),
              ...message,
            },
            unreadCount: isUnreadForCurrentUser
              ? (conversation.unreadCount || 0) + 1
              : conversation.unreadCount || 0,
          }
        })

        return conversationFound
          ? sortConversationsByRecentMessage(nextConversations)
          : currentConversations
      })
    },
    [conversationId, user?.id],
  )

  const applyRealtimeUpdateToConversations = useCallback(
    (message) => {
      if (!message?.conversation_id) {
        return
      }

      setConversations((currentConversations) => {
        return currentConversations.map((conversation) => {
          if (conversation.id !== message.conversation_id) {
            return conversation
          }

          const shouldDecrementUnread = message.sender_id !== user?.id && Boolean(message.read_at)
          const nextUnreadCount = shouldDecrementUnread
            ? Math.max(0, (conversation.unreadCount || 0) - 1)
            : conversation.unreadCount || 0

          return {
            ...conversation,
            unreadCount: nextUnreadCount,
            lastMessage:
              conversation.lastMessage?.id === message.id
                ? {
                    ...conversation.lastMessage,
                    ...message,
                  }
                : conversation.lastMessage,
          }
        })
      })
    },
    [user?.id],
  )

  const clearConversationUnreadLocally = useCallback((targetConversationId) => {
    if (!targetConversationId) {
      return
    }

    setConversations((currentConversations) => {
      return currentConversations.map((conversation) => {
        if (conversation.id !== targetConversationId) {
          return conversation
        }

        return {
          ...conversation,
          unreadCount: 0,
        }
      })
    })
  }, [])

  const loadCurrentProfile = useCallback(async () => {
    if (!user?.id) {
      setCurrentProfile(null)
      return
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setError(formatSupabaseError(profileError))
      return
    }

    setCurrentProfile(data || null)
  }, [user?.id])

  const loadConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    const {
      data: participantRows,
      error: participantError,
    } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (participantError) {
      setError(formatSupabaseError(participantError))
      setConversations([])
      setIsLoading(false)
      return
    }

    const conversationIds = [...new Set((participantRows || []).map((row) => row.conversation_id))]

    if (conversationIds.length === 0) {
      setConversations([])
      setIsLoading(false)
      return
    }

    const {
      data: otherParticipantRows,
      error: otherParticipantsError,
    } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds)
      .neq('user_id', user.id)

    if (otherParticipantsError) {
      setError(formatSupabaseError(otherParticipantsError))
      setConversations([])
      setIsLoading(false)
      return
    }

    const otherUserIds = [
      ...new Set((otherParticipantRows || []).map((row) => row.user_id).filter(Boolean)),
    ]

    let profilesById = {}

    if (otherUserIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', otherUserIds)

      if (profilesError) {
        setError(formatSupabaseError(profilesError))
      }

      profilesById = (profileRows || []).reduce((accumulator, profile) => {
        accumulator[profile.id] = profile
        return accumulator
      }, {})
    }

    const {
      data: messageRows,
      error: messagesError,
    } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at, read_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    if (messagesError) {
      setError(formatSupabaseError(messagesError))
      setConversations([])
      setIsLoading(false)
      return
    }

    const latestMessageByConversation = {}
    const unreadCountByConversation = {}

    for (const message of messageRows || []) {
      if (!latestMessageByConversation[message.conversation_id]) {
        latestMessageByConversation[message.conversation_id] = message
      }

      if (message.sender_id !== user.id && !message.read_at) {
        unreadCountByConversation[message.conversation_id] =
          (unreadCountByConversation[message.conversation_id] || 0) + 1
      }
    }

    const nextConversations = conversationIds.map((conversationId) => {
      const otherParticipant = (otherParticipantRows || []).find(
        (participant) => participant.conversation_id === conversationId,
      )
      const profile = otherParticipant ? profilesById[otherParticipant.user_id] : null
      const title = getDisplayName(profile, otherParticipant?.email)

      return {
        id: conversationId,
        participant: {
          id: otherParticipant?.user_id ?? conversationId,
          displayName: title,
          email: profile?.email ?? '',
          avatarUrl: profile?.avatar_url ?? '',
          initials: getInitials(title),
        },
        lastMessage: latestMessageByConversation[conversationId] ?? null,
        unreadCount: unreadCountByConversation[conversationId] || 0,
      }
    })

    setConversations(sortConversationsByRecentMessage(nextConversations))
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    void loadConversations()
    void loadCurrentProfile()
  }, [loadConversations, loadCurrentProfile])

  useEffect(() => {
    return () => {
      if (profileImagePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(profileImagePreviewUrl)
      }
    }
  }, [profileImagePreviewUrl])

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined
    }

    function handleDocumentPointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false)
      }
    }

    function handleDocumentKeyDown(event) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [isProfileMenuOpen])

  useEffect(() => {
    if (!user?.id) {
      return undefined
    }

    const channel = supabase
      .channel(`chat-list:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          applyRealtimeInsertToConversations(payload.new)

          const hasConversation = conversationsRef.current.some(
            (conversation) => conversation.id === payload.new?.conversation_id,
          )

          if (!hasConversation) {
            void loadConversations()
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          applyRealtimeUpdateToConversations(payload.new)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          void loadConversations()

          if (payload.new?.id === user.id) {
            void loadCurrentProfile()
          }
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [
    user?.id,
    loadConversations,
    loadCurrentProfile,
    applyRealtimeInsertToConversations,
    applyRealtimeUpdateToConversations,
  ])

  async function handleCreateConversation(event) {
    event.preventDefault()
    setError('')

    const email = recipientEmail.trim().toLowerCase()

    if (!email) {
      setError('Enter an email address to start a chat.')
      return
    }

    if (email === user?.email?.toLowerCase()) {
      setError('Use another email address to start a conversation.')
      return
    }

    setIsCreatingConversation(true)

    const { data: recipientMatches, error: recipientError } = await supabase.rpc(
      'find_profile_by_email',
      {
        search_email: email,
      },
    )

    if (recipientError) {
      setError(formatSupabaseError(recipientError))
      setIsCreatingConversation(false)
      return
    }

    const recipientProfile = Array.isArray(recipientMatches)
      ? recipientMatches[0]
      : recipientMatches

    if (!recipientProfile?.id) {
      setError('No user was found with that email address.')
      setIsCreatingConversation(false)
      return
    }

    const { data: myConversationRows, error: myConversationError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (myConversationError) {
      setError(formatSupabaseError(myConversationError))
      setIsCreatingConversation(false)
      return
    }

    const myConversationIds = (myConversationRows || []).map((row) => row.conversation_id)

    if (myConversationIds.length > 0) {
      const { data: recipientConversationRows, error: recipientConversationError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', recipientProfile.id)
        .in('conversation_id', myConversationIds)

      if (recipientConversationError) {
        setError(formatSupabaseError(recipientConversationError))
        setIsCreatingConversation(false)
        return
      }

      const existingConversationId = recipientConversationRows?.[0]?.conversation_id

      if (existingConversationId) {
        setRecipientEmail('')
        setIsComposerOpen(false)
        setIsCreatingConversation(false)
        navigate(`/chats/${existingConversationId}`)
        return
      }
    }

    const conversationId = crypto.randomUUID()

    const { error: conversationError } = await supabase
      .from('conversations')
      .insert([
        {
          id: conversationId,
        },
      ])

    if (conversationError) {
      setError(formatSupabaseError(conversationError))
      setIsCreatingConversation(false)
      return
    }

    const { error: currentUserParticipantError } = await supabase
      .from('conversation_participants')
      .insert([
        {
          conversation_id: conversationId,
          user_id: user.id,
        },
      ])

    if (currentUserParticipantError) {
      setError(formatSupabaseError(currentUserParticipantError))
      setIsCreatingConversation(false)
      return
    }

    const { error: recipientParticipantError } = await supabase
      .from('conversation_participants')
      .insert([
        {
          conversation_id: conversationId,
          user_id: recipientProfile.id,
        },
      ])

    if (recipientParticipantError) {
      setError(formatSupabaseError(recipientParticipantError))
      setIsCreatingConversation(false)
      return
    }

    await loadConversations()
    setRecipientEmail('')
    setIsComposerOpen(false)
    setIsCreatingConversation(false)
    navigate(`/chats/${conversationId}`)
  }

  async function handleLogout() {
    setIsProfileMenuOpen(false)

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(formatSupabaseError(signOutError))
      return
    }

    setConversations([])
    setError('')
    navigate('/login', { replace: true })
  }

  function openProfileEditor() {
    setIsProfileMenuOpen(false)
    setProfileName(currentProfile?.full_name || '')
    setProfileImagePreviewUrl(currentProfile?.avatar_url || '')
    setSelectedProfileImageFile(null)
    setIsProfileOpen(true)
  }

  function closeProfileEditor() {
    if (profileImagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(profileImagePreviewUrl)
    }

    setIsProfileOpen(false)
    setSelectedProfileImageFile(null)
    setProfileImagePreviewUrl(currentProfile?.avatar_url || '')
  }

  function handleProfileImageChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (profileImagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(profileImagePreviewUrl)
    }

    setSelectedProfileImageFile(file)
    setProfileImagePreviewUrl(URL.createObjectURL(file))
  }

  async function handleProfileSave(event) {
    event.preventDefault()

    if (!user?.id || isSavingProfile) {
      return
    }

    setIsSavingProfile(true)

    let uploadedAvatarUrl = currentProfile?.avatar_url || null

    if (selectedProfileImageFile) {
      const extension = selectedProfileImageFile.name?.split('.').pop()?.toLowerCase() || 'jpg'
      const filePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(PROFILE_IMAGES_BUCKET)
        .upload(filePath, selectedProfileImageFile, {
          upsert: true,
          cacheControl: '3600',
        })

      if (uploadError) {
        setError(formatSupabaseError(uploadError))
        setIsSavingProfile(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from(PROFILE_IMAGES_BUCKET)
        .getPublicUrl(filePath)

      uploadedAvatarUrl = publicUrlData?.publicUrl || uploadedAvatarUrl
    }

    const { error: saveError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          full_name: profileName.trim() || null,
          avatar_url: uploadedAvatarUrl,
        },
        {
          onConflict: 'id',
        },
      )

    if (saveError) {
      setError(formatSupabaseError(saveError))
      setIsSavingProfile(false)
      return
    }

    await loadCurrentProfile()
    await loadConversations()
    setIsSavingProfile(false)
    closeProfileEditor()
  }

  const currentProfileName = getDisplayName(currentProfile, user?.email)
  const currentProfileInitials = getInitials(currentProfileName)
  const totalUnreadCount = conversations.reduce(
    (total, conversation) => total + (conversation.unreadCount || 0),
    0,
  )

  const content = useMemo(() => {
    if (isLoading) {
      return <p className="chat-list-status">Loading conversations...</p>
    }

    if (error) {
      return (
        <div className="chat-list-feedback">
          <p className="chat-list-error">{error}</p>
        </div>
      )
    }

    if (conversations.length === 0) {
      return (
        <div className="chat-list-feedback">
          <p className="chat-list-empty-title">No conversations yet</p>
          <p className="chat-list-empty-copy">
            When you start chatting, your latest messages will appear here.
          </p>
        </div>
      )
    }

    return (
      <ul className="chat-list" role="list">
        {conversations.map((conversation) => (
          <li key={conversation.id} className="chat-list-item">
            <Link
              className={
                'chat-row ' +
                (conversation.unreadCount > 0 ? 'chat-row--unread' : 'chat-row--read') +
                (conversation.id === conversationId ? ' chat-row--selected' : '')
              }
              to={`/chats/${conversation.id}`}
            >
              <div className="chat-avatar-wrap" aria-hidden="true">
                <Avatar className="chat-avatar">
                  <AvatarImage
                    src={conversation.participant.avatarUrl || undefined}
                    alt={conversation.participant.displayName}
                  />
                  <AvatarFallback className="chat-avatar-fallback">
                    {conversation.participant.initials}
                  </AvatarFallback>
                </Avatar>

                {conversation.unreadCount > 0 ? (
                  <Badge className="chat-avatar-badge border-background px-1">
                    {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                  </Badge>
                ) : null}
              </div>

              <div className="chat-copy">
                <div className="chat-copy-top">
                  <p
                    className={
                      'chat-name ' +
                      (conversation.unreadCount > 0 ? 'chat-name--unread' : 'chat-name--read')
                    }
                  >
                    {conversation.participant.displayName}
                  </p>

                  <span
                    className={
                      'chat-time ' +
                      (conversation.unreadCount > 0 ? 'chat-time--unread' : 'chat-time--read')
                    }
                  >
                    {formatTimestamp(conversation.lastMessage?.created_at)}
                  </span>
                </div>

                <p
                  className={
                    'chat-preview ' +
                    (conversation.unreadCount > 0
                      ? 'chat-preview--unread'
                      : 'chat-preview--read')
                  }
                >
                  {conversation.lastMessage?.content || 'No messages yet'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    )
  }, [conversations, error, isLoading])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');

        .chat-app-screen {
          height: 100dvh;
          background: #ffffff;
          color: #111827;
          font-family: 'DM Sans', sans-serif;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          overflow: hidden;
        }

        .chat-app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
          z-index: 12;
        }

        .chat-app-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .chat-app-actions {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-left: auto;
        }

        .chat-workspace-screen {
          min-height: 0;
          height: 100%;
          display: grid;
          grid-template-columns: minmax(320px, 390px) minmax(0, 1fr);
          background: #ffffff;
          overflow: hidden;
        }

        .chat-list-screen {
          min-height: 0;
          height: 100%;
          background: #ffffff;
          color: #111827;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-list-profile-btn,
        .chat-list-logout,
        .chat-list-new {
          border: none;
          padding: 0;
          background: transparent;
          color: #1a1a2e;
          font: inherit;
          cursor: pointer;
        }

        .chat-list-profile-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 40px;
          min-height: 40px;
          border-radius: 999px;
        }

        .chat-list-profile-wrap {
          position: relative;
        }

        .chat-list-profile-total-badge {
          position: absolute;
          top: -4px;
          left: 100%;
          min-width: 20px;
          height: 20px;
          transform: translateX(-14px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-width: 2px;
          border-style: solid;
          font-size: 0.68rem;
          line-height: 1;
          z-index: 2;
        }

        .chat-list-profile-avatar {
          width: 34px;
          height: 34px;
          border: 1px solid #d1d5db;
        }

        .chat-list-profile-fallback {
          font-size: 0.72rem;
          font-weight: 700;
          color: #1a1a2e;
        }

        .chat-list-logout,
        .chat-list-new {
          font-size: 0.95rem;
          font-weight: 700;
        }

        .chat-list-new {
          min-height: 38px;
          border-radius: 999px;
          padding: 0 14px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #1f2937;
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            color 0.2s ease;
        }

        .chat-list-new:hover {
          border-color: #94a3b8;
          background: #f8fafc;
          color: #0f172a;
        }

        .chat-list-new:active {
          background: #f1f5f9;
        }

        .chat-list-profile-btn:focus-visible,
        .chat-list-logout:focus-visible,
        .chat-list-new:focus-visible,
        .chat-row:focus-visible {
          outline: 2px solid #1a1a2e;
          outline-offset: 2px;
        }

        .chat-list-profile-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 170px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
          padding: 6px;
          z-index: 25;
        }

        .chat-list-profile-menu-item {
          width: 100%;
          text-align: left;
          border: 0;
          background: transparent;
          color: #0f172a;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 600;
          border-radius: 8px;
          padding: 9px 10px;
          cursor: pointer;
        }

        .chat-list-profile-menu-item:hover {
          background: #f1f5f9;
        }

        .chat-list-profile-menu-item--danger {
          color: #b91c1c;
        }

        .chat-list-body {
          padding: 0;
          background: #ffffff;
          flex: 1;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #f1f5f9;
        }

        .chat-list-body::-webkit-scrollbar {
          width: 10px;
        }

        .chat-list-body::-webkit-scrollbar-track {
          background: #f8fafc;
        }

        .chat-list-body::-webkit-scrollbar-thumb {
          border: 2px solid #f8fafc;
          border-radius: 999px;
          background: #94a3b8;
        }

        .chat-list-body::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }

        .chat-list,
        .chat-list-item {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .chat-list-item {
          border-bottom: 1px solid #e5e7eb;
        }

        .chat-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          color: inherit;
          text-decoration: none;
          background: #ffffff;
          transition: background-color 0.2s ease;
        }

        .chat-row--unread {
          background: #f8fafc;
        }

        .chat-row:active {
          background: #f9fafb;
        }

        .chat-row--selected {
          background: #eef2ff;
        }

        .chat-avatar-wrap {
          position: relative;
          width: 48px;
          height: 48px;
          flex-shrink: 0;
        }

        .chat-avatar {
          width: 48px;
          height: 48px;
          border: 1px solid #e5e7eb;
          background: #f3f4f6;
        }

        .chat-avatar-fallback {
          font-size: 0.95rem;
          font-weight: 700;
          color: #1a1a2e;
        }

        .chat-avatar-badge {
          position: absolute;
          top: -2px;
          left: 100%;
          min-width: 20px;
          height: 20px;
          transform: translateX(-16px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-width: 2px;
          border-style: solid;
          font-size: 0.7rem;
          line-height: 1;
        }

        .chat-copy {
          min-width: 0;
          flex: 1;
        }

        .chat-copy-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
        }

        .chat-name {
          min-width: 0;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 1rem;
          color: #111827;
        }

        .chat-name--read {
          font-weight: 600;
        }

        .chat-name--unread {
          font-weight: 700;
        }

        .chat-time {
          font-size: 0.8rem;
          font-weight: 500;
          flex-shrink: 0;
        }

        .chat-time--read {
          color: #6b7280;
        }

        .chat-time--unread {
          color: #1e3a8a;
        }

        .chat-preview {
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.92rem;
          line-height: 1.4;
        }

        .chat-preview--read {
          color: #6b7280;
        }

        .chat-preview--unread {
          color: #1f2937;
          font-weight: 600;
        }

        .chat-list-feedback,
        .chat-list-status {
          padding: 24px 20px;
          font-size: 0.95rem;
        }

        .chat-list-composer {
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #ffffff;
        }

        .chat-list-form {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .chat-list-submit {
          min-width: 92px;
          min-height: 46px;
          border: none;
          border-radius: 12px;
          padding: 0 14px;
          background: #1a1a2e;
          color: #ffffff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .chat-list-submit:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .chat-list-error {
          margin: 0;
          color: #dc2626;
        }

        .chat-list-empty-title {
          margin: 0 0 6px;
          font-size: 1rem;
          font-weight: 700;
          color: #111827;
        }

        .chat-list-empty-copy {
          margin: 0;
          color: #6b7280;
          line-height: 1.5;
        }

        .chat-profile-backdrop {
          position: fixed;
          inset: 0;
          z-index: 30;
          background: rgba(15, 23, 42, 0.28);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px;
        }

        .chat-profile-dialog {
          width: min(460px, 100%);
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.24);
          padding: 16px;
        }

        .chat-profile-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .chat-profile-subtitle {
          margin: 6px 0 14px;
          color: #64748b;
          font-size: 0.9rem;
        }

        .chat-profile-form {
          display: grid;
          gap: 12px;
        }

        .chat-profile-field {
          display: grid;
          gap: 6px;
        }

        .chat-profile-actions {
          margin-top: 6px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .chat-profile-preview {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }

        .chat-profile-preview-copy {
          margin: 0;
          color: #475569;
          font-size: 0.86rem;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chat-profile-cancel,
        .chat-profile-save {
          min-height: 38px;
          border-radius: 10px;
          padding: 0 12px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .chat-profile-cancel {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #1e293b;
        }

        .chat-profile-save {
          border: 1px solid #1e293b;
          background: #1e293b;
          color: #ffffff;
        }

        .chat-profile-save:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .chat-workspace-thread {
          min-height: 0;
          height: 100%;
          background: #ffffff;
          overflow: hidden;
        }

        .chat-workspace-empty {
          height: 100%;
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          color: #64748b;
          font-size: 0.96rem;
        }

        @media (max-width: 960px) {
          .chat-workspace-screen {
            display: block;
          }

          .chat-app-header {
            padding-inline: 16px;
          }

          .chat-app-title {
            font-size: 1.05rem;
          }

          .chat-list-new {
            min-height: 34px;
            padding-inline: 14px;
            font-size: 0.88rem;
          }

          .chat-list-screen {
            border-right: none;
          }

          .chat-workspace-thread {
            display: none;
          }

          .chat-workspace-screen--thread-active .chat-list-screen {
            display: none;
          }

          .chat-workspace-screen--thread-active .chat-workspace-thread {
            display: block;
          }
        }

        @media (max-width: 640px) {
          .chat-app-screen {
            height: 100svh;
          }

          .chat-app-header {
            position: sticky;
            top: 0;
            padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
          }

          .chat-app-title {
            font-size: 1rem;
          }

          .chat-app-actions {
            gap: 8px;
          }

          .chat-list-new {
            min-height: 36px;
            padding-inline: 12px;
            font-size: 0.82rem;
          }

          .chat-list-profile-avatar {
            width: 32px;
            height: 32px;
          }

          .chat-list-profile-total-badge {
            top: -3px;
            min-width: 18px;
            height: 18px;
            transform: translateX(-12px);
            font-size: 0.62rem;
          }

          .chat-list-profile-menu {
            min-width: 156px;
          }

          .chat-list-composer {
            padding: 12px;
          }

          .chat-list-form {
            gap: 8px;
          }

          .chat-list-submit {
            min-width: 82px;
            min-height: 42px;
            border-radius: 10px;
          }

          .chat-list-body {
            padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          }

          .chat-row {
            gap: 10px;
            padding: 13px 12px;
          }

          .chat-avatar-wrap {
            width: 42px;
            height: 42px;
          }

          .chat-avatar {
            width: 42px;
            height: 42px;
          }

          .chat-avatar-badge {
            min-width: 18px;
            height: 18px;
            transform: translateX(-14px);
            font-size: 0.62rem;
          }

          .chat-name {
            font-size: 0.94rem;
          }

          .chat-time {
            font-size: 0.74rem;
          }

          .chat-preview {
            font-size: 0.86rem;
          }

          .chat-list-feedback,
          .chat-list-status {
            padding: 18px 12px;
          }
        }
      `}</style>

      <main className="chat-app-screen">
        <header className="chat-app-header">
          <h1 className="chat-app-title">Messages</h1>

          <div className="chat-app-actions">
            <button
              className="chat-list-new"
              type="button"
              onClick={() => setIsComposerOpen((current) => !current)}
            >
              New Chat
            </button>

            <div className="chat-list-profile-wrap" ref={profileMenuRef}>
              <button
                className="chat-list-profile-btn"
                type="button"
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                aria-label={
                  totalUnreadCount > 0
                    ? `Profile menu, ${totalUnreadCount} unread messages`
                    : 'Profile menu'
                }
                title="Profile menu"
              >
                <Avatar className="chat-list-profile-avatar">
                  <AvatarImage
                    src={currentProfile?.avatar_url || undefined}
                    alt={currentProfileName}
                  />
                  <AvatarFallback className="chat-list-profile-fallback">
                    {currentProfileInitials}
                  </AvatarFallback>
                </Avatar>
              </button>

              {totalUnreadCount > 0 ? (
                <Badge className="chat-list-profile-total-badge border-background px-1">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Badge>
              ) : null}

              {isProfileMenuOpen ? (
                <div className="chat-list-profile-menu" role="menu" aria-label="Profile actions">
                  <button
                    className="chat-list-profile-menu-item"
                    type="button"
                    onClick={openProfileEditor}
                    role="menuitem"
                  >
                    Edit Profile
                  </button>
                  <button
                    className="chat-list-profile-menu-item chat-list-profile-menu-item--danger"
                    type="button"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section
          className={
            'chat-workspace-screen' +
            (conversationId ? ' chat-workspace-screen--thread-active' : '')
          }
        >
          <section className="chat-list-screen">

            {isComposerOpen ? (
              <section className="chat-list-composer">
                <form className="chat-list-form" onSubmit={handleCreateConversation}>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    placeholder="Enter recipient email"
                    autoComplete="email"
                    required
                  />
                  <button
                    className="chat-list-submit"
                    type="submit"
                    disabled={isCreatingConversation}
                  >
                    {isCreatingConversation ? 'Starting...' : 'Start'}
                  </button>
                </form>
              </section>
            ) : null}

            <section className="chat-list-body">{content}</section>
          </section>

          <section className="chat-workspace-thread">
            {conversationId ? (
              <ChatPage
                embedded
                conversationId={conversationId}
                onBack={() => navigate('/chats')}
                onConversationRead={clearConversationUnreadLocally}
              />
            ) : (
              <div className="chat-workspace-empty">
                <p>Select a conversation to start chatting.</p>
              </div>
            )}
          </section>
        </section>
      </main>

      {isProfileOpen ? (
        <div className="chat-profile-backdrop" onClick={closeProfileEditor}>
          <section
            className="chat-profile-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Edit profile"
          >
            <h2 className="chat-profile-title">Edit profile</h2>
            <p className="chat-profile-subtitle">
              Update your display name and upload a photo from your device.
            </p>

            <form className="chat-profile-form" onSubmit={handleProfileSave}>
              <div className="chat-profile-field">
                <Label htmlFor="profile-name">Display name</Label>
                <Input
                  id="profile-name"
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                />
              </div>

              <div className="chat-profile-field">
                <Label htmlFor="profile-image-file">Profile image</Label>
                <Input
                  id="profile-image-file"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                />
                <div className="chat-profile-preview">
                  <Avatar className="chat-list-profile-avatar">
                    <AvatarImage src={profileImagePreviewUrl || undefined} alt={currentProfileName} />
                    <AvatarFallback className="chat-list-profile-fallback">
                      {currentProfileInitials}
                    </AvatarFallback>
                  </Avatar>
                  <p className="chat-profile-preview-copy">
                    {selectedProfileImageFile
                      ? `Selected: ${selectedProfileImageFile.name}`
                      : 'No new image selected'}
                  </p>
                </div>
              </div>

              <div className="chat-profile-actions">
                <button
                  type="button"
                  className="chat-profile-cancel"
                  onClick={closeProfileEditor}
                >
                  Cancel
                </button>
                <button className="chat-profile-save" type="submit" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
