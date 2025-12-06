'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HelpMenu } from '../components/HelpMenu';

type RequestType = 'question' | 'support' | 'feature' | 'custom_tool';

export default function Support() {
  const router = useRouter();
  const [requestType, setRequestType] = useState<RequestType>('question');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const requestTypeOptions: { value: RequestType; label: string; description: string; icon: string }[] = [
    {
      value: 'question',
      label: 'Ask a Question',
      description: 'Have a question about Household Toolbox?',
      icon: '❓',
    },
    {
      value: 'support',
      label: 'Support Request',
      description: 'Need help with an issue or problem?',
      icon: '🛟',
    },
    {
      value: 'feature',
      label: 'Recommend a Feature',
      description: 'Have an idea for a new feature?',
      icon: '💡',
    },
    {
      value: 'custom_tool',
      label: 'Request a Custom Tool',
      description: 'Need a custom tool built just for you?',
      icon: '🔧',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: requestType,
          name,
          email,
          subject,
          message,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSuccess(true);
      // Reset form
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setRequestType('question');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="flex items-center"
            >
              <Image
                src="/images/logo/Logo_Side_White.png"
                alt="Household Toolbox"
                width={200}
                height={40}
                className="h-auto"
                priority
              />
            </button>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex items-center">
            <button
              onClick={() => router.push('/')}
              className="hover:text-emerald-300 transition-colors"
            >
              Home
            </button>
            <HelpMenu />
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold text-slate-50 mb-4">
            Contact Support
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            We're here to help! Choose how you'd like to reach out and we'll get back to you as soon as possible.
          </p>
        </div>

        {/* Request Type Selection */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-300 mb-4">
            How can we help you?
          </label>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {requestTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRequestType(option.value)}
                className={`rounded-2xl border p-5 text-left transition-all ${
                  requestType === option.value
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                <div className="text-3xl mb-2">{option.icon}</div>
                <div className="font-semibold text-slate-100 mb-1">
                  {option.label}
                </div>
                <div className="text-xs text-slate-400">
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                placeholder="Your name"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                placeholder="your@email.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              placeholder="Brief summary of your request"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={8}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
              placeholder="Please provide as much detail as possible..."
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-slate-500">
              Your message will be sent to support@householdtoolbox.com
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </div>

          {success && (
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              Thank you for contacting us! We've received your message and will get back to you soon.
              <br />
              Please monitor your Junk Mail folder for our reply.
            </div>
          )}
        </form>

        {/* Additional Help Section */}
        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-3">
            Before you contact us
          </h2>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Check our <button onClick={() => router.push('/faq')} className="text-emerald-400 hover:text-emerald-300 underline">FAQ page</button> for common questions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>Include as much detail as possible in your message</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>We typically respond within 24-48 hours</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

