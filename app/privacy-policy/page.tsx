'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { HelpMenu } from '../components/HelpMenu';

export default function PrivacyPolicy() {
  const router = useRouter();
  const [content, setContent] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch content from API
    fetch('/api/legal?type=privacy')
      .then((res) => res.json())
      .then((data) => {
        if (data.content) {
          setContent(data.content);
          setLastUpdated(data.lastUpdated);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Error loading Privacy Policy:', err);
        setIsLoading(false);
      });
  }, []);

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

      {/* Back to Sign Up Link */}
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Sign Up
        </Link>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 sm:p-12">
          <h1 className="text-4xl font-semibold text-slate-50 mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-400 mb-8">
            {lastUpdated 
              ? `Last Updated: ${new Date(lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
              : 'Last Updated: December 5, 2025'}
          </p>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400">Loading...</div>
          ) : content ? (
            <div 
              className="prose prose-invert max-w-none text-slate-300 space-y-6"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="prose prose-invert max-w-none text-slate-300 space-y-6">
            <p>
              Household Toolbox (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our website, tools, and services (collectively, the &ldquo;Service&rdquo;).
            </p>

            <p>By using the Service, you agree to the practices described in this Privacy Policy.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">1. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-slate-100 mt-6 mb-3">1.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, password, profile details.</li>
              <li><strong>User Content:</strong> Information you enter into Household Toolbox tools (notes, lists, tasks, schedules, stored data, etc.).</li>
              <li><strong>Support Requests:</strong> Communications you send to us (support tickets, emails, feedback).</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-100 mt-6 mb-3">1.2 Automatically Collected Information</h3>
            <p>When you use the Service, we may automatically collect:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Usage data:</strong> Pages visited, features used, time spent, referring pages.</li>
              <li><strong>Device data:</strong> Browser type, operating system, device type, IP address.</li>
              <li><strong>Cookies & tracking technologies:</strong> Used to remember preferences, enable login sessions, and analyze usage.</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-100 mt-6 mb-3">1.3 Third-Party Data</h3>
            <p>If you connect third-party tools or services, we may receive limited information from them as permitted by their policies.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Operate features you choose to use</li>
              <li>Communicate with you about updates, support, or account issues</li>
              <li>Personalize your experience</li>
              <li>Monitor usage to enhance performance and security</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>We do <strong>not</strong> sell your data.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">3. How We Share Your Information</h2>

            <h3 className="text-xl font-semibold text-slate-100 mt-6 mb-3">3.1 Service Providers</h3>
            <p>We may share information with trusted third-party vendors who assist in:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Hosting and infrastructure</li>
              <li>Email delivery</li>
              <li>Analytics</li>
              <li>Customer support</li>
            </ul>
            <p>They may only use your information to perform services on our behalf.</p>

            <h3 className="text-xl font-semibold text-slate-100 mt-6 mb-3">3.2 Legal Requirements</h3>
            <p>We may disclose information if required to comply with laws, court orders, government requests, or to protect our rights, users, or the public.</p>

            <h3 className="text-xl font-semibold text-slate-100 mt-6 mb-3">3.3 Business Transfers</h3>
            <p>If Household Toolbox is involved in a merger, acquisition, or asset sale, your information may be transferred as part of the transaction.</p>

            <p>We <strong>do not</strong> share your data with advertisers.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">4. Data Retention</h2>
            <p>We retain your information as long as your account is active or as needed to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide the Service</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes</li>
              <li>Enforce agreements</li>
            </ul>
            <p>You may request deletion at any time.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">5. How We Protect Your Information</h2>
            <p>We use industry-standard administrative, technical, and physical safeguards to protect your data, including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encrypted connections (HTTPS)</li>
              <li>Secure authentication</li>
              <li>Access control</li>
              <li>Regular monitoring</li>
            </ul>
            <p>However, no online service can guarantee 100% security.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">6. Your Rights & Choices</h2>
            <p>Depending on your location, you may have rights such as:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your data</li>
              <li><strong>Correction:</strong> Update inaccurate information</li>
              <li><strong>Deletion:</strong> Request that we delete your account or stored data</li>
              <li><strong>Restriction:</strong> Limit how your data is used</li>
              <li><strong>Portability:</strong> Receive your data in a transferable format</li>
            </ul>
            <p>You can also update account info, opt out of non-essential emails, or disable cookies.</p>
            <p>To exercise rights, email: <strong className="text-emerald-400">support@householdtoolbox.com</strong></p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">7. Cookies & Tracking Technologies</h2>
            <p>We use cookies to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Keep you logged in</li>
              <li>Remember settings</li>
              <li>Analyze performance</li>
            </ul>
            <p>You can modify cookie settings in your browser, but certain features may stop working.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">8. Children&rsquo;s Privacy</h2>
            <p>The Service is not intended for anyone under 18. We do not knowingly collect information from children. If you believe a minor has provided data, contact us so we can delete it.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">9. International Users</h2>
            <p>If you access the Service from outside the U.S., your information may be transferred to and stored in the U.S. By using the Service, you consent to this transfer.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">10. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy periodically. When we do, we will update the &ldquo;Last Updated&rdquo; date above. If changes are significant, we may provide additional notice.</p>

            <p>Continued use of the Service means you accept the updated policy.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us:</p>
            <p><strong className="text-emerald-400">support@householdtoolbox.com</strong></p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

