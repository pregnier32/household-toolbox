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
            className="w-full rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-emerald-400/50 transition focus:border-emerald-400 focus:ring disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

