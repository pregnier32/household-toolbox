'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserMenu } from '../components/UserMenu';
import { SideLogo } from '../components/SideLogo';
import { useTheme } from '../components/AppThemeProvider';

type RequestType = 'question' | 'support' | 'feature' | 'custom_tool';

export default function Support() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const headerBarClass = isLight
    ? 'border-b-2 border-slate-400 bg-slate-900/50'
    : 'border-b border-slate-800 bg-slate-900/50';
  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';
  const topNavHomeClass = isLight
    ? 'text-slate-700 transition-colors hover:text-emerald-700'
    : 'text-slate-300 transition-colors hover:text-emerald-300';
  const pageTitleClass = isLight ? 'text-4xl font-semibold text-slate-900 mb-4' : 'text-4xl font-semibold text-slate-50 mb-4';
  const pageSubtitleClass = isLight ? 'text-slate-600 max-w-2xl mx-auto' : 'text-slate-400 max-w-2xl mx-auto';
  const sectionLabelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-4' : 'block text-sm font-medium text-slate-300 mb-4';
  const requestCardSelectedClass = isLight
    ? 'border-emerald-300 bg-emerald-50'
    : 'border-emerald-500 bg-emerald-500/10';
  const requestCardUnselectedClass = isLight
    ? 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700';
  const requestCardTitleClass = isLight ? 'font-semibold text-slate-900 mb-1' : 'font-semibold text-slate-100 mb-1';
  const requestCardDescClass = isLight ? 'text-xs text-slate-600' : 'text-xs text-slate-400';
  const errorAlertClass = isLight
    ? 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300';
  const successAlertClass = isLight
    ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
    : 'rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300';
  const inputLabelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const submitMetaClass = isLight ? 'text-xs text-slate-600' : 'text-xs text-slate-500';
  const submitButtonClass = isLight
    ? 'rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const helpCardClass = isLight
    ? 'mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'mt-12 rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const helpTitleClass = isLight ? 'text-lg font-semibold text-slate-900 mb-3' : 'text-lg font-semibold text-slate-100 mb-3';
  const helpListClass = isLight ? 'space-y-2 text-sm text-slate-700' : 'space-y-2 text-sm text-slate-400';
  const helpBulletClass = isLight ? 'text-emerald-700 mt-0.5' : 'text-emerald-400 mt-0.5';
  const helpLinkClass = isLight ? 'text-emerald-700 hover:text-emerald-800 underline' : 'text-emerald-400 hover:text-emerald-300 underline';

  const router = useRouter();
  const [user, setUser] = useState<{ firstName: string; lastName?: string } | null>(null);
  const [requestType, setRequestType] = useState<RequestType>('question');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser({
            firstName: data.user.firstName,
            lastName: data.user.lastName,
          });
        }
      })
      .catch(() => {
        // Keep page accessible as public route if session check fails.
      });
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/');
  };

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
      <header className={headerBarClass}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <button onClick={() => router.push('/')} className="flex items-center">
                <SideLogo priority />
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className={headerChromeButtonClass}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Dashboard</span>
              </button>
              <UserMenu
                userName={`${user.firstName} ${user.lastName || ''}`.trim()}
                onSignOut={handleSignOut}
              />
            </div>
          ) : (
            <nav className="hidden gap-6 text-sm sm:flex items-center">
              <button
                type="button"
                onClick={() => router.push('/')}
                className={topNavHomeClass}
              >
                Home
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className={pageTitleClass}>
            Contact Support
          </h1>
          <p className={pageSubtitleClass}>
            We're here to help! Choose how you'd like to reach out and we'll get back to you as soon as possible.
          </p>
        </div>

        {/* Request Type Selection */}
        <div className="mb-8">
          <label className={sectionLabelClass}>
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
                    ? requestCardSelectedClass
                    : requestCardUnselectedClass
                }`}
              >
                <div className="text-3xl mb-2">{option.icon}</div>
                <div className={requestCardTitleClass}>
                  {option.label}
                </div>
                <div className={requestCardDescClass}>
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className={errorAlertClass}>
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="name" className={inputLabelClass}>
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClass}
                placeholder="Your name"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="email" className={inputLabelClass}>
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="your@email.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="subject" className={inputLabelClass}>
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className={inputClass}
              placeholder="Brief summary of your request"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="message" className={inputLabelClass}>
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={8}
              className={`${inputClass} resize-none`}
              placeholder="Please provide as much detail as possible..."
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <p className={submitMetaClass}>
              Your message will be sent to support@householdtoolbox.com
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className={submitButtonClass}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </div>

          {success && (
            <div className={successAlertClass}>
              Thank you for contacting us! We've received your message and will get back to you soon.
              <br />
              Please monitor your Junk Mail folder for our reply.
            </div>
          )}
        </form>

        {/* Additional Help Section */}
        <div className={helpCardClass}>
          <h2 className={helpTitleClass}>
            Before you contact us
          </h2>
          <ul className={helpListClass}>
            <li className="flex items-start gap-2">
              <span className={helpBulletClass}>•</span>
              <span>Check our <button type="button" onClick={() => router.push('/faq')} className={helpLinkClass}>FAQ page</button> for common questions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={helpBulletClass}>•</span>
              <span>Include as much detail as possible in your message</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={helpBulletClass}>•</span>
              <span>We typically respond within 24-48 hours</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

