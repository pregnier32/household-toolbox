'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SiteMaintenancePage() {
  const [signUpsDisabled, setSignUpsDisabled] = useState(false);
  const [platformFee, setPlatformFee] = useState<number>(5.00);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingFee, setIsSavingFee] = useState(false);
  const [isSyncingBilling, setIsSyncingBilling] = useState(false);
  const [billingSyncResult, setBillingSyncResult] = useState<{ success: boolean; message?: string; count?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ userStatus?: string } | null>(null);
  const [openModal, setOpenModal] = useState<'user-registration' | 'platform-fee' | 'billing-sync' | 'terms' | 'privacy' | null>(null);
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [termsLastUpdated, setTermsLastUpdated] = useState<string | null>(null);
  const [privacyLastUpdated, setPrivacyLastUpdated] = useState<string | null>(null);
  const [isLoadingLegal, setIsLoadingLegal] = useState(false);
  const [isSavingLegal, setIsSavingLegal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication and superadmin status
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          if (data.user.userStatus !== 'superadmin') {
            router.push('/dashboard');
            return;
          }
          // Load site maintenance settings
          loadSettings();
          // Load legal documents
          loadLegalDocuments();
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/site-maintenance');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load settings');
      }

      setSignUpsDisabled(data.setting?.signUpsDisabled || false);
      setPlatformFee(data.platformFee || 5.00);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      setIsLoading(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/site-maintenance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signUpsDisabled: newValue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setSignUpsDisabled(newValue);
      setSuccess(
        newValue
          ? 'New user sign ups have been disabled'
          : 'New user sign ups have been enabled'
      );
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBillingSync = async () => {
    setIsSyncingBilling(true);
    setError(null);
    setSuccess(null);
    setBillingSyncResult(null);

    try {
      const response = await fetch('/api/admin/billing/sync-all');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync billing');
      }

      setBillingSyncResult({
        success: true,
        message: data.message,
        count: data.count,
      });
      setSuccess(`Billing sync completed: ${data.message}`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
        setBillingSyncResult(null);
      }, 5000);
    } catch (err) {
      console.error('Error syncing billing:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync billing');
      setBillingSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSyncingBilling(false);
    }
  };

  const handlePlatformFeeUpdate = async (newFee: number) => {
    setIsSavingFee(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/site-maintenance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platformFee: newFee,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update platform fee');
      }

      setPlatformFee(newFee);
      setSuccess(`Platform fee updated to ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(newFee)}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating platform fee:', err);
      setError(err instanceof Error ? err.message : 'Failed to update platform fee');
    } finally {
      setIsSavingFee(false);
    }
  };

  const loadLegalDocuments = async () => {
    setIsLoadingLegal(true);
    try {
      // Load Terms of Service
      const termsResponse = await fetch('/api/admin/legal?type=terms');
      const termsData = await termsResponse.json();
      if (termsResponse.ok) {
        // If no content exists, load default from current page structure
        if (!termsData.content) {
          // Set default content (will be populated from current page)
          setTermsContent('');
        } else {
          setTermsContent(termsData.content);
        }
        setTermsLastUpdated(termsData.lastUpdated || null);
      }

      // Load Privacy Policy
      const privacyResponse = await fetch('/api/admin/legal?type=privacy');
      const privacyData = await privacyResponse.json();
      if (privacyResponse.ok) {
        // If no content exists, load default from current page structure
        if (!privacyData.content) {
          // Set default content (will be populated from current page)
          setPrivacyContent('');
        } else {
          setPrivacyContent(privacyData.content);
        }
        setPrivacyLastUpdated(privacyData.lastUpdated || null);
      }
    } catch (err) {
      console.error('Error loading legal documents:', err);
    } finally {
      setIsLoadingLegal(false);
    }
  };

  const loadLegalDocumentForEditing = async (type: 'terms' | 'privacy') => {
    setIsLoadingLegal(true);
    try {
      const response = await fetch(`/api/admin/legal?type=${type}`);
      const data = await response.json();
      if (response.ok) {
        if (type === 'terms') {
          setTermsContent(data.content || getDefaultTermsContent());
          setTermsLastUpdated(data.lastUpdated || null);
        } else {
          setPrivacyContent(data.content || getDefaultPrivacyContent());
          setPrivacyLastUpdated(data.lastUpdated || null);
        }
      }
    } catch (err) {
      console.error(`Error loading ${type}:`, err);
    } finally {
      setIsLoadingLegal(false);
    }
  };

  const getDefaultTermsContent = () => {
    return `<p>Welcome to <strong>Household Toolbox</strong> ("Company," "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of our website, tools, and services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

<h2>1. Eligibility</h2>
<p>You must be at least 18 years old to use the Service. By using the Service, you represent that you meet this requirement.</p>

<h2>2. Your Account</h2>
<p>To use certain features, you may need to create an account.</p>
<p>You agree to:</p>
<ul>
<li>Provide accurate and current information</li>
<li>Maintain the security of your login credentials</li>
<li>Notify us immediately of any unauthorized access</li>
<li>Accept responsibility for all activities under your account</li>
</ul>
<p>We may suspend or terminate accounts that violate these Terms.</p>

<h2>3. Use of the Service</h2>
<p>You agree not to:</p>
<ul>
<li>Use the Service for any unlawful purpose</li>
<li>Attempt to access or modify systems without authorization</li>
<li>Copy, distribute, or reverse engineer the Service</li>
<li>Upload malicious code, spam, or harmful content</li>
<li>Interfere with or disrupt the Service's functionality</li>
</ul>
<p>We reserve the right to restrict or terminate access if misuse occurs.</p>

<h2>4. Subscription & Payments (If Applicable)</h2>
<p>If the Service includes paid features:</p>
<ul>
<li>Pricing and billing terms will be presented at checkout.</li>
<li>All fees are non-refundable unless required by law.</li>
<li>We may update pricing with notice.</li>
</ul>
<p>You authorize us or our payment processor to charge your payment method.</p>

<h2>5. Intellectual Property</h2>
<p>All content, branding, software, design, and functionality on the Service are owned by Household Toolbox or our licensors and protected by intellectual property laws.</p>
<p>You may use the Service only as permitted. You do not obtain ownership of any part of the Service by using it.</p>

<h2>6. User Content</h2>
<p>You may upload or enter data into the Service ("User Content").</p>
<p>You retain ownership of your User Content. You grant us a limited, non-exclusive license to store and process User Content solely for the purpose of providing the Service.</p>
<p>You represent that:</p>
<ul>
<li>You have the rights to submit the User Content</li>
<li>Your User Content does not violate any laws or rights of others</li>
</ul>
<p>We may remove User Content that violates these Terms.</p>

<h2>7. Privacy</h2>
<p>Your use of the Service is also governed by our <a href="/privacy-policy" class="text-emerald-400 hover:text-emerald-300 underline">Privacy Policy</a>, which explains how we collect, use, and store your information.</p>

<h2>8. Third-Party Services</h2>
<p>The Service may integrate with third-party tools or links. We are not responsible for their content, policies, or actions. Use them at your own risk.</p>

<h2>9. Service Availability</h2>
<p>We strive to keep the Service running smoothly but do not guarantee:</p>
<ul>
<li>Uninterrupted availability</li>
<li>Error-free performance</li>
<li>Preservation of your data</li>
</ul>
<p>We may modify or discontinue parts of the Service at any time.</p>

<h2>10. Disclaimer of Warranties</h2>
<p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We disclaim all warranties, including merchantability, fitness for a particular purpose, and non-infringement.</p>
<p>Some jurisdictions do not allow certain disclaimers; in those cases, some may not apply.</p>

<h2>11. Limitation of Liability</h2>
<p>To the fullest extent permitted by law, Household Toolbox and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</p>
<p>Our total liability for any claim will not exceed the amount you paid us in the past 12 months, or $50 if you have not made any payments.</p>

<h2>12. Indemnification</h2>
<p>You agree to indemnify and hold harmless Household Toolbox, its affiliates, and employees from any claims, damages, or expenses arising from:</p>
<ul>
<li>Your use of the Service</li>
<li>Your violation of these Terms</li>
<li>Your violation of any law or third-party rights</li>
</ul>

<h2>13. Termination</h2>
<p>We may suspend or terminate your access at any time for any reason, including violation of these Terms.</p>
<p>Upon termination:</p>
<ul>
<li>Your right to use the Service ends</li>
<li>Sections of these Terms that should reasonably survive termination will continue</li>
</ul>

<h2>14. Changes to These Terms</h2>
<p>We may update these Terms occasionally. When we do, we will update the "Last Updated" date above.</p>
<p>If changes are significant, we may provide additional notice. Continued use of the Service means you accept the updated Terms.</p>

<h2>15. Governing Law</h2>
<p>These Terms are governed by the laws of the state of [Your State], without regard to conflict of law principles.</p>

<h2>16. Contact Us</h2>
<p>If you have questions about these Terms, contact us at:</p>
<p><strong>support@householdtoolbox.com</strong></p>`;
  };

  const getDefaultPrivacyContent = () => {
    return `<p>Household Toolbox ("Company," "we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our website, tools, and services (collectively, the "Service").</p>

<p>By using the Service, you agree to the practices described in this Privacy Policy.</p>

<h2>1. Information We Collect</h2>

<h3>1.1 Information You Provide</h3>
<ul>
<li><strong>Account Information:</strong> Name, email address, password, profile details.</li>
<li><strong>User Content:</strong> Information you enter into Household Toolbox tools (notes, lists, tasks, schedules, stored data, etc.).</li>
<li><strong>Support Requests:</strong> Communications you send to us (support tickets, emails, feedback).</li>
</ul>

<h3>1.2 Automatically Collected Information</h3>
<p>When you use the Service, we may automatically collect:</p>
<ul>
<li><strong>Usage data:</strong> Pages visited, features used, time spent, referring pages.</li>
<li><strong>Device data:</strong> Browser type, operating system, device type, IP address.</li>
<li><strong>Cookies & tracking technologies:</strong> Used to remember preferences, enable login sessions, and analyze usage.</li>
</ul>

<h3>1.3 Third-Party Data</h3>
<p>If you connect third-party tools or services, we may receive limited information from them as permitted by their policies.</p>

<h2>2. How We Use Your Information</h2>
<p>We use your information to:</p>
<ul>
<li>Provide, maintain, and improve the Service</li>
<li>Operate features you choose to use</li>
<li>Communicate with you about updates, support, or account issues</li>
<li>Personalize your experience</li>
<li>Monitor usage to enhance performance and security</li>
<li>Comply with legal obligations</li>
</ul>
<p>We do <strong>not</strong> sell your data.</p>

<h2>3. How We Share Your Information</h2>

<h3>3.1 Service Providers</h3>
<p>We may share information with trusted third-party vendors who assist in:</p>
<ul>
<li>Hosting and infrastructure</li>
<li>Email delivery</li>
<li>Analytics</li>
<li>Customer support</li>
</ul>
<p>They may only use your information to perform services on our behalf.</p>

<h3>3.2 Legal Requirements</h3>
<p>We may disclose information if required to comply with laws, court orders, government requests, or to protect our rights, users, or the public.</p>

<h3>3.3 Business Transfers</h3>
<p>If Household Toolbox is involved in a merger, acquisition, or asset sale, your information may be transferred as part of the transaction.</p>

<p>We <strong>do not</strong> share your data with advertisers.</p>

<h2>4. Data Retention</h2>
<p>We retain your information as long as your account is active or as needed to:</p>
<ul>
<li>Provide the Service</li>
<li>Comply with legal obligations</li>
<li>Resolve disputes</li>
<li>Enforce agreements</li>
</ul>
<p>You may request deletion at any time.</p>

<h2>5. How We Protect Your Information</h2>
<p>We use industry-standard administrative, technical, and physical safeguards to protect your data, including:</p>
<ul>
<li>Encrypted connections (HTTPS)</li>
<li>Secure authentication</li>
<li>Access control</li>
<li>Regular monitoring</li>
</ul>
<p>However, no online service can guarantee 100% security.</p>

<h2>6. Your Rights & Choices</h2>
<p>Depending on your location, you may have rights such as:</p>
<ul>
<li><strong>Access:</strong> Request a copy of your data</li>
<li><strong>Correction:</strong> Update inaccurate information</li>
<li><strong>Deletion:</strong> Request that we delete your account or stored data</li>
<li><strong>Restriction:</strong> Limit how your data is used</li>
<li><strong>Portability:</strong> Receive your data in a transferable format</li>
</ul>
<p>You can also update account info, opt out of non-essential emails, or disable cookies.</p>
<p>To exercise rights, email: <strong>support@householdtoolbox.com</strong></p>

<h2>7. Cookies & Tracking Technologies</h2>
<p>We use cookies to:</p>
<ul>
<li>Keep you logged in</li>
<li>Remember settings</li>
<li>Analyze performance</li>
</ul>
<p>You can modify cookie settings in your browser, but certain features may stop working.</p>

<h2>8. Children's Privacy</h2>
<p>The Service is not intended for anyone under 18. We do not knowingly collect information from children. If you believe a minor has provided data, contact us so we can delete it.</p>

<h2>9. International Users</h2>
<p>If you access the Service from outside the U.S., your information may be transferred to and stored in the U.S. By using the Service, you consent to this transfer.</p>

<h2>10. Changes to This Privacy Policy</h2>
<p>We may update this Privacy Policy periodically. When we do, we will update the "Last Updated" date above. If changes are significant, we may provide additional notice.</p>

<p>Continued use of the Service means you accept the updated policy.</p>

<h2>11. Contact Us</h2>
<p>If you have questions about this Privacy Policy, contact us:</p>
<p><strong>support@householdtoolbox.com</strong></p>`;
  };

  const handleSaveLegalDocument = async (type: 'terms' | 'privacy') => {
    setIsSavingLegal(true);
    setError(null);
    setSuccess(null);

    try {
      const content = type === 'terms' ? termsContent : privacyContent;
      const response = await fetch('/api/admin/legal', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save document');
      }

      if (type === 'terms') {
        setTermsLastUpdated(data.lastUpdated);
      } else {
        setPrivacyLastUpdated(data.lastUpdated);
      }

      setSuccess(`${type === 'terms' ? 'Terms of Service' : 'Privacy Policy'} saved successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setIsSavingLegal(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading settings...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Image
              src="/images/logo/Logo_Side_White.png"
              alt="Household Toolbox"
              width={200}
              height={40}
              className="h-auto"
              priority
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-300"
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
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-semibold text-slate-50">Site Maintenance</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage site-wide settings and maintenance options
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Settings Cards Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* User Registration Card */}
          <button
            onClick={() => setOpenModal('user-registration')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">User Registration</h2>
              <p className="text-sm text-slate-400">
                Control whether new users can sign up for accounts
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {signUpsDisabled ? 'Sign ups disabled' : 'Sign ups enabled'}
              </span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Platform Fee Card */}
          <button
            onClick={() => setOpenModal('platform-fee')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Platform Fee</h2>
              <p className="text-sm text-slate-400">
                Set the monthly platform fee charged to users
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Current: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee)}/month
              </span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Billing Sync Card */}
          <button
            onClick={() => setOpenModal('billing-sync')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Billing Sync</h2>
              <p className="text-sm text-slate-400">
                Force sync billing records for all users
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Manual sync tool</span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Cron Job Logs Card */}
          <button
            onClick={() => router.push('/dashboard/admin/cron-logs')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Cron Job Logs</h2>
              <p className="text-sm text-slate-400">
                View execution history and status of automated jobs
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">View logs</span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Promo Codes Card */}
          <button
            onClick={() => router.push('/dashboard/admin/promo-codes')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Promo Codes</h2>
              <p className="text-sm text-slate-400">
                Create and manage promotional codes for discounts
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Manage codes</span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Welcome Email Card */}
          <button
            onClick={() => router.push('/dashboard/admin/welcome-email')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Welcome Email</h2>
              <p className="text-sm text-slate-400">
                Edit the welcome email sent to new users
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Edit template</span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Terms of Service Card */}
          <button
            onClick={() => {
              setOpenModal('terms');
              loadLegalDocumentForEditing('terms');
            }}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Terms of Service</h2>
              <p className="text-sm text-slate-400">
                Edit the Terms of Service document
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {termsLastUpdated ? `Updated ${new Date(termsLastUpdated).toLocaleDateString()}` : 'Not set'}
              </span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Privacy Policy Card */}
          <button
            onClick={() => {
              setOpenModal('privacy');
              loadLegalDocumentForEditing('privacy');
            }}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Privacy Policy</h2>
              <p className="text-sm text-slate-400">
                Edit the Privacy Policy document
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {privacyLastUpdated ? `Updated ${new Date(privacyLastUpdated).toLocaleDateString()}` : 'Not set'}
              </span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Modal */}
        {openModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpenModal(null)}
          >
            <div 
              className="w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User Registration Modal */}
              {openModal === 'user-registration' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">User Registration</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Control whether new users can sign up for accounts
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label htmlFor="signUpsToggle" className="block text-sm font-medium text-slate-200 mb-1">
                        Disable New User Sign Ups
                      </label>
                      <p className="text-xs text-slate-400">
                        {signUpsDisabled
                          ? 'New user registration is currently disabled. Users will not be able to create new accounts.'
                          : 'New user registration is currently enabled. Users can create new accounts.'}
                      </p>
                    </div>
                    <div className="ml-6">
                      <button
                        type="button"
                        id="signUpsToggle"
                        onClick={() => handleToggle(!signUpsDisabled)}
                        disabled={isSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 ${
                          signUpsDisabled ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                        role="switch"
                        aria-checked={signUpsDisabled}
                        aria-label="Toggle new user sign ups"
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            signUpsDisabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {signUpsDisabled && (
                    <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3">
                      <p className="text-sm text-amber-300">
                        <strong>Note:</strong> When sign ups are disabled, the "Sign Up" button on the main page will be disabled and users will not be able to create new accounts.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Platform Fee Modal */}
              {openModal === 'platform-fee' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">Platform Fee</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Set the monthly platform fee charged to users who have at least one active tool subscription
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="platformFeeModal" className="block text-sm font-medium text-slate-200 mb-2">
                        Monthly Platform Fee
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-xs">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-slate-400 text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="platformFeeModal"
                            min="0"
                            step="0.01"
                            value={platformFee}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                setPlatformFee(value);
                              }
                            }}
                            onBlur={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value !== platformFee) {
                                handlePlatformFeeUpdate(value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            disabled={isSavingFee}
                            className="block w-full pl-7 pr-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="5.00"
                          />
                        </div>
                        {isSavingFee && (
                          <span className="text-sm text-slate-400">Saving...</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        This fee is charged monthly to users who have at least one active or trial tool subscription. 
                        Users with no active tools are not charged the platform fee.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                      <p className="text-sm text-slate-300">
                        <strong>Current fee:</strong>{' '}
                        <span className="text-emerald-300 font-medium">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee)}
                        </span>
                        {' '}per month
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Billing Sync Modal */}
              {openModal === 'billing-sync' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">Billing Sync</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Force sync billing records for all users. The nightly cron job automatically syncs all users, 
                    but you can run this manually anytime if you need to update billing data immediately.
                  </p>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6">
                      <p className="text-sm text-slate-300 mb-4">
                        This will populate the <code className="text-emerald-400">billing_active</code> table 
                        based on current tool subscriptions from the <code className="text-emerald-400">users_tools</code> table.
                      </p>
                      <button
                        onClick={handleBillingSync}
                        disabled={isSyncingBilling}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        {isSyncingBilling ? 'Syncing...' : 'Force Sync All Users Billing'}
                      </button>
                      {billingSyncResult && (
                        <div className={`mt-4 p-3 rounded-lg ${
                          billingSyncResult.success 
                            ? 'bg-emerald-500/20 border border-emerald-500/50' 
                            : 'bg-red-500/20 border border-red-500/50'
                        }`}>
                          <p className={`text-sm ${
                            billingSyncResult.success ? 'text-emerald-300' : 'text-red-300'
                          }`}>
                            {billingSyncResult.message}
                            {billingSyncResult.count !== undefined && ` (${billingSyncResult.count} users)`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Terms of Service Modal */}
              {openModal === 'terms' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">Terms of Service</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Edit the Terms of Service document. This content will be displayed on the public Terms of Service page. Use HTML tags for formatting (e.g., &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;a&gt;).
                  </p>

                  {isLoadingLegal ? (
                    <div className="py-8 text-center text-slate-400">Loading content...</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="termsContent" className="block text-sm font-medium text-slate-200 mb-2">
                          Content
                        </label>
                        <textarea
                          id="termsContent"
                          value={termsContent}
                          onChange={(e) => setTermsContent(e.target.value)}
                          rows={25}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          placeholder="Enter Terms of Service content..."
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          Use HTML tags for formatting. Links should use &lt;a href="/privacy-policy"&gt;Privacy Policy&lt;/a&gt; format.
                        </p>
                      </div>

                      {termsLastUpdated && (
                        <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                          <p className="text-sm text-slate-300">
                            <strong>Last updated:</strong>{' '}
                            <span className="text-emerald-300">
                              {new Date(termsLastUpdated).toLocaleString('en-US', {
                                dateStyle: 'long',
                                timeStyle: 'short',
                              })}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setOpenModal(null)}
                          className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveLegalDocument('terms')}
                          disabled={isSavingLegal || !termsContent.trim()}
                          className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingLegal ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Privacy Policy Modal */}
              {openModal === 'privacy' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">Privacy Policy</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Edit the Privacy Policy document. This content will be displayed on the public Privacy Policy page. Use HTML tags for formatting (e.g., &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;).
                  </p>

                  {isLoadingLegal ? (
                    <div className="py-8 text-center text-slate-400">Loading content...</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="privacyContent" className="block text-sm font-medium text-slate-200 mb-2">
                          Content
                        </label>
                        <textarea
                          id="privacyContent"
                          value={privacyContent}
                          onChange={(e) => setPrivacyContent(e.target.value)}
                          rows={25}
                          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 font-mono focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          placeholder="Enter Privacy Policy content..."
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          Use HTML tags for formatting.
                        </p>
                      </div>

                      {privacyLastUpdated && (
                        <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                          <p className="text-sm text-slate-300">
                            <strong>Last updated:</strong>{' '}
                            <span className="text-emerald-300">
                              {new Date(privacyLastUpdated).toLocaleString('en-US', {
                                dateStyle: 'long',
                                timeStyle: 'short',
                              })}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setOpenModal(null)}
                          className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveLegalDocument('privacy')}
                          disabled={isSavingLegal || !privacyContent.trim()}
                          className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingLegal ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

