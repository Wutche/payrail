'use client'

import * as React from 'react'
import { Connect } from '@stacks/connect-react'
import { AppConfig, UserSession } from '@stacks/auth'

const appConfig = typeof window !== 'undefined' ? new AppConfig(['store_write', 'publish_data']) : null
export const userSession = typeof window !== 'undefined' ? new UserSession({ appConfig: appConfig! }) : null as unknown as UserSession

export function StacksProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const authOptions = {
    appDetails: {
      name: 'Payrail',
      icon: '/logo.png',
    },
    userSession: userSession as any,
    onFinish: () => {
      if (typeof window !== 'undefined') window.location.reload()
    },
    theme: 'dark' as any,
  }

  if (!mounted || !userSession) return <>{children}</>

  return (
    <Connect authOptions={authOptions as any}>
      {children}
    </Connect>
  )
}
