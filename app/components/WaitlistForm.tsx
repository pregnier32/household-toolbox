'use client'

import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Please set up your environment variables.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setMessage('')

    try {
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email, created_at: new Date().toISOString() }])

      if (error) {
        // Check if it's a duplicate email error
        if (error.code === '23505') {
          setMessage('You\'re already on the waitlist!')
          setStatus('success')
        } else {
          throw error
        }
      } else {
        setMessage('Thanks! We\'ll be in touch soon.')
        setStatus('success')
        setEmail('')
      }
    } catch (error) {
      console.error('Error adding to waitlist:', error)
      setMessage('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <>
      <form
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmit={handleSubmit}
      >
        <div className="flex-1">
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            placeholder="Enter your email to join the waitlist"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? 'Joining...' : 'Join the waitlist'}
        </button>
      </form>
      {message && (
        <p
          className={`mt-3 text-xs ${
            status === 'error' ? 'text-red-400' : 'text-emerald-400'
          }`}
        >
          {message}
        </p>
      )}
    </>
  )
}

