import { NavLink, useParams } from 'react-router-dom'

const LAST_CHAT_STORAGE_KEY = 'arhamchat:lastConversationId'

export function getLastChatPath() {
  const lastConversationId = window.localStorage.getItem(LAST_CHAT_STORAGE_KEY)
  return lastConversationId ? `/chats/${lastConversationId}` : null
}

export function AppNavbar() {
  const { conversationId } = useParams()
  const currentChatPath = conversationId ? `/chats/${conversationId}` : getLastChatPath()

  return (
    <>
      <style>{`
        .app-navbar {
          position: fixed;
          right: 0;
          bottom: 0;
          left: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-top: 1px solid #e5e7eb;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(10px);
          z-index: 20;
        }

        .app-navbar__link,
        .app-navbar__disabled {
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
        }

        .app-navbar__link {
          color: #6b7280;
        }

        .app-navbar__link--active {
          color: #1a1a2e;
          background: #f9fafb;
        }

        .app-navbar__disabled {
          color: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>

      <nav className="app-navbar" aria-label="Primary navigation">
        <NavLink
          to="/chats"
          className={({ isActive }) =>
            'app-navbar__link' + (isActive ? ' app-navbar__link--active' : '')
          }
        >
          Messages
        </NavLink>

        {currentChatPath ? (
          <NavLink
            to={currentChatPath}
            className={({ isActive }) =>
              'app-navbar__link' + (isActive ? ' app-navbar__link--active' : '')
            }
          >
            Current Chat
          </NavLink>
        ) : (
          <span className="app-navbar__disabled">Current Chat</span>
        )}
      </nav>
    </>
  )
}
