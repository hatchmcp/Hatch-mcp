'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase/client'

type AuthState = {
  session: Session | null
  loading: boolean
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>
} {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  return {
    ...state,
    signOut: async () => {
      await getSupabaseClient().auth.signOut()
    },
  }
}
