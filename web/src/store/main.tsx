import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@nim.zone/ui/styles.css'
import { StoreRoot } from './app'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreRoot />
  </StrictMode>,
)
