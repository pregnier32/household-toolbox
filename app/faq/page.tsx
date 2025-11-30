'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HelpMenu } from '../components/HelpMenu';

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
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
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
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold text-slate-50 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Find answers to common questions about Household Toolbox. Can't find what you're looking for?{' '}
            <button
              onClick={() => router.push('/support')}
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              Contact Support
            </button>
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((faq, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden transition-all hover:border-slate-700"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-lg font-medium text-slate-100 pr-4">
                  {faq.question}
                </span>
                <svg
                  className={`h-5 w-5 text-slate-400 flex-shrink-0 transition-transform ${
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
                  <div className="pt-2 text-slate-300 leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Additional Help Section */}
        <div className="mt-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <h2 className="text-xl font-semibold text-emerald-200 mb-3">
            Still have questions?
          </h2>
          <p className="text-slate-300 mb-6">
            Our support team is here to help. Get in touch and we'll respond as soon as possible.
          </p>
          <button
            onClick={() => router.push('/support')}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
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

