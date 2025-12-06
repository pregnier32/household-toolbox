'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HelpMenu } from '../components/HelpMenu';

export default function TermsOfService() {
  const router = useRouter();

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
            Terms of Service
          </h1>
          <p className="text-sm text-slate-400 mb-8">
            Last Updated: December 5, 2025
          </p>

          <div className="prose prose-invert max-w-none text-slate-300 space-y-6">
            <p>
              Welcome to <strong>Household Toolbox</strong> (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of our website, tools, and services (collectively, the &ldquo;Service&rdquo;). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">1. Eligibility</h2>
            <p>You must be at least 18 years old to use the Service. By using the Service, you represent that you meet this requirement.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">2. Your Account</h2>
            <p>To use certain features, you may need to create an account.</p>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and current information</li>
              <li>Maintain the security of your login credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
            <p>We may suspend or terminate accounts that violate these Terms.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">3. Use of the Service</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to access or modify systems without authorization</li>
              <li>Copy, distribute, or reverse engineer the Service</li>
              <li>Upload malicious code, spam, or harmful content</li>
              <li>Interfere with or disrupt the Service&rsquo;s functionality</li>
            </ul>
            <p>We reserve the right to restrict or terminate access if misuse occurs.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">4. Subscription &amp; Payments (If Applicable)</h2>
            <p>If the Service includes paid features:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Pricing and billing terms will be presented at checkout.</li>
              <li>All fees are non-refundable unless required by law.</li>
              <li>We may update pricing with notice.</li>
            </ul>
            <p>You authorize us or our payment processor to charge your payment method.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">5. Intellectual Property</h2>
            <p>All content, branding, software, design, and functionality on the Service are owned by Household Toolbox or our licensors and protected by intellectual property laws.</p>
            <p>You may use the Service only as permitted. You do not obtain ownership of any part of the Service by using it.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">6. User Content</h2>
            <p>You may upload or enter data into the Service (&ldquo;User Content&rdquo;).</p>
            <p>You retain ownership of your User Content. You grant us a limited, non-exclusive license to store and process User Content solely for the purpose of providing the Service.</p>
            <p>You represent that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have the rights to submit the User Content</li>
              <li>Your User Content does not violate any laws or rights of others</li>
            </ul>
            <p>We may remove User Content that violates these Terms.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">7. Privacy</h2>
            <p>Your use of the Service is also governed by our{' '}
              <button
                onClick={() => router.push('/privacy-policy')}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Privacy Policy
              </button>, which explains how we collect, use, and store your information.
            </p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">8. Third-Party Services</h2>
            <p>The Service may integrate with third-party tools or links. We are not responsible for their content, policies, or actions. Use them at your own risk.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">9. Service Availability</h2>
            <p>We strive to keep the Service running smoothly but do not guarantee:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Uninterrupted availability</li>
              <li>Error-free performance</li>
              <li>Preservation of your data</li>
            </ul>
            <p>We may modify or discontinue parts of the Service at any time.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">10. Disclaimer of Warranties</h2>
            <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. We disclaim all warranties, including merchantability, fitness for a particular purpose, and non-infringement.</p>
            <p>Some jurisdictions do not allow certain disclaimers; in those cases, some may not apply.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">11. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, Household Toolbox and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</p>
            <p>Our total liability for any claim will not exceed the amount you paid us in the past 12 months, or $50 if you have not made any payments.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">12. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Household Toolbox, its affiliates, and employees from any claims, damages, or expenses arising from:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any law or third-party rights</li>
            </ul>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">13. Termination</h2>
            <p>We may suspend or terminate your access at any time for any reason, including violation of these Terms.</p>
            <p>Upon termination:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your right to use the Service ends</li>
              <li>Sections of these Terms that should reasonably survive termination will continue</li>
            </ul>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">14. Changes to These Terms</h2>
            <p>We may update these Terms occasionally. When we do, we will update the &ldquo;Last Updated&rdquo; date above.</p>
            <p>If changes are significant, we may provide additional notice. Continued use of the Service means you accept the updated Terms.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">15. Governing Law</h2>
            <p>These Terms are governed by the laws of the state of [Your State], without regard to conflict of law principles.</p>

            <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-4">16. Contact Us</h2>
            <p>If you have questions about these Terms, contact us at:</p>
            <p><strong className="text-emerald-400">support@householdtoolbox.com</strong></p>
          </div>
        </div>
      </div>
    </main>
  );
}

