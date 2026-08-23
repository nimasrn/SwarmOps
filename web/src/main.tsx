import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NimProvider, ToastProvider } from 'nim'
import 'nim/styles.css'
import { App } from './app'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NimProvider defaultColorway="teal" defaultScheme="light" defaultStyle="ledger">
      <ToastProvider>
        <App />
      </ToastProvider>
    </NimProvider>
  </StrictMode>,
)
