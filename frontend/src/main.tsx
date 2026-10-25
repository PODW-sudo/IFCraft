import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DestructiveActionHost } from './components/common/DestructiveActionHost.tsx'
import { UserMessageHost } from './components/common/UserMessageHost.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* STEP-10: app-wide destructive confirmation + user-visible message channel. */}
    <DestructiveActionHost />
    <UserMessageHost />
  </StrictMode>,
)
