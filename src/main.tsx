import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { MantineProvider } from '@mantine/core'
import { NextUIProvider } from '@nextui-org/react'
import { Notifications } from '@mantine/notifications';
import { theme } from './theme.ts'
import './index.css'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

const mantineTheme = theme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
      <Notifications />
      <NextUIProvider>
          <main className="dark text-foreground bg-background">
            <App />
          </main>
      </NextUIProvider>
    </MantineProvider>
  </React.StrictMode>,
)
