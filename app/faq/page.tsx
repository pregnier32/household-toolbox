'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserMenu } from '../components/UserMenu';
import { SideLogo } from '../components/SideLogo';
import { useTheme } from '../components/AppThemeProvider';

type FAQItem = {
  question: string;
  answer: string;
};

const faqData: FAQItem[] = [
  {
    question: 'What is Household Toolbox?',
    answer: 'Household Toolbox is a digital command center for managing your home. It helps you organize maintenance schedules, important documents, checklists, and planning tools all in one place so nothing around the house slips through the cracks.',
  },
  {
    question: 'When will Household Toolbox be available?',
    answer: 'Household Toolbox is coming soon in 2026. We\'re working hard to build the best household management tool for you and your family.',
  },
  {
    question: 'How do I sign up?',
    answer: 'You can sign up for an account using the sign-up form on our homepage. Simply provide your email, password, and name to create your account.',
  },
  {
    question: 'What features will be available?',
    answer: 'Household Toolbox will include maintenance timelines with reminders, a document vault for warranties and important records, shared checklists for coordinating tasks, and a dashboard to see what needs attention at a glance.',
  },
  {
    question: 'Can multiple people use the same account?',
    answer: 'Yes! Household Toolbox is designed for households with multiple members. You can share responsibility with partners, roommates, or family members and see who\'s doing what and when.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we take data security seriously. Your information is encrypted and stored securely. We follow industry best practices to protect your household data.',
  },
  {
    question: 'How much will it cost?',
    answer: 'Pricing details will be announced closer to launch. We\'re committed to providing value that makes home management easier and more affordable.',
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes, you\'ll be able to export your data at any time. We believe you should have full control over your information.',
  },
];

export default function FAQ() {
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
  const pageTitleClass = isLight
    ? 'text-4xl font-semibold text-slate-900 mb-4'
    : 'text-4xl font-semibold text-slate-50 mb-4';
  const introTextClass = isLight
    ? 'text-slate-600 max-w-2xl mx-auto'
    : 'text-slate-400 max-w-2xl mx-auto';
  const introLinkClass = isLight
    ? 'text-emerald-700 hover:text-emerald-800 underline'
    : 'text-emerald-400 hover:text-emerald-300 underline';
  const faqCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white overflow-hidden transition-all hover:border-slate-300 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden transition-all hover:border-slate-700';
  const faqTriggerClass = isLight
    ? 'w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors'
    : 'w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors';
  const faqQuestionClass = isLight
    ? 'text-lg font-medium text-slate-900 pr-4'
    : 'text-lg font-medium text-slate-100 pr-4';
  const faqChevronClass = isLight ? 'h-5 w-5 text-slate-500 flex-shrink-0 transition-transform' : 'h-5 w-5 text-slate-400 flex-shrink-0 transition-transform';
  const faqAnswerClass = isLight
    ? 'pt-2 text-slate-700 leading-relaxed'
    : 'pt-2 text-slate-300 leading-relaxed';
  const helpCardClass = isLight
    ? 'mt-12 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center'
    : 'mt-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center';
  const helpTitleClass = isLight
    ? 'text-xl font-semibold text-emerald-900 mb-3'
    : 'text-xl font-semibold text-emerald-200 mb-3';
  const helpTextClass = isLight ? 'text-slate-700 mb-6' : 'text-slate-300 mb-6';
  const supportButtonClass = isLight
    ? 'inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';

  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [user, setUser] = useState<{ firstName: string; lastName?: string } | null>(null);

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

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
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
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className={pageTitleClass}>
            Frequently Asked Questions
          </h1>
          <p className={introTextClass}>
            Find answers to common questions about Household Toolbox. Can't find what you're looking for?{' '}
            <button
              type="button"
              onClick={() => router.push('/support')}
              className={introLinkClass}
            >
              Contact Support
            </button>
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <div
              key={index}
              className={faqCardClass}
            >
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                className={faqTriggerClass}
              >
                <span className={faqQuestionClass}>
                  {faq.question}
                </span>
                <svg
                  className={`${faqChevronClass} ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <div className={faqAnswerClass}>
                    {faq.answer}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Additional Help Section */}
        <div className={helpCardClass}>
          <h2 className={helpTitleClass}>
            Still have questions?
          </h2>
          <p className={helpTextClass}>
            Our support team is here to help. Get in touch and we'll respond as soon as possible.
          </p>
          <button
            type="button"
            onClick={() => router.push('/support')}
            className={supportButtonClass}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Contact Support
          </button>
        </div>
      </div>
    </main>
  );
}

