'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Github } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/logo'

export default function LoginPage() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && session) router.replace('/')
  }, [loading, session, router])

  async function signInWithGitHub() {
    setOauthLoading(true)
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    })
    if (error) {
      toast.error(error.message)
      setOauthLoading(false)
    }
    // Otherwise the browser redirects away — no further state to manage.
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setSending(true)
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    setSending(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSentTo(email)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-bg">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo size={32} />
        </div>

        {/* Card */}
        <div className="border border-border rounded-md bg-surface p-7">
          <h1 className="text-lg font-semibold tracking-tight mb-1">
            Sign in to your account
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            New here? An account is created on first sign-in.
          </p>

          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={signInWithGitHub}
            disabled={oauthLoading}
          >
            <Github />
            {oauthLoading ? 'Redirecting…' : 'Continue with GitHub'}
          </Button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-text-tertiary font-mono">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {sentTo ? (
            <div className="text-sm text-text-secondary leading-relaxed">
              <p className="text-text-primary font-medium mb-1">Check your email</p>
              <p>
                We sent a magic link to{' '}
                <span className="font-mono text-text-primary">{sentTo}</span>. Click it
                to finish signing in.
              </p>
              <button
                type="button"
                onClick={() => setSentTo(null)}
                className="mt-3 text-text-tertiary hover:text-text-secondary text-xs underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="space-y-2.5">
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={sending}
              />
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={sending || !email}
              >
                {sending ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
          )}
        </div>

        {/* ToS */}
        <p className="text-[11px] text-text-tertiary text-center mt-6 leading-relaxed">
          By continuing you agree to our{' '}
          <a href="#" className="text-text-secondary hover:text-text-primary underline underline-offset-2">
            Terms
          </a>{' '}
          and{' '}
          <a href="#" className="text-text-secondary hover:text-text-primary underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  )
}
