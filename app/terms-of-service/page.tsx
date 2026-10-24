import Link from 'next/link';
import { PublicHeader } from '../components/public/PublicHeader';
import { formatLegalDate, LEGAL_LAST_UPDATED, TERMS_OF_SERVICE_HTML } from '@/lib/legal-documents';

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <PublicHeader />

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
            Last Updated: {formatLegalDate(LEGAL_LAST_UPDATED)}
          </p>

          <div
            className="prose prose-invert max-w-none text-slate-300 space-y-6"
            dangerouslySetInnerHTML={{ __html: TERMS_OF_SERVICE_HTML }}
          />
        </div>
      </div>
    </main>
  );
}
