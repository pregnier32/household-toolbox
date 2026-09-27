import Link from 'next/link';

const linkClass =
  'text-slate-400 transition-colors hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm';

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 pt-8 text-sm">
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Product</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/tools" className={linkClass}>
                Tools
              </Link>
            </li>
            <li>
              <Link href="/pricing" className={linkClass}>
                Pricing
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Help</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/faq" className={linkClass}>
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/support" className={linkClass}>
                Support
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Account</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link href="/" className={linkClass}>
                Sign In
              </Link>
            </li>
            <li>
              <Link href="/" className={linkClass}>
                Create Account
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} Household Toolbox. All rights reserved.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terms-of-service" className={linkClass}>
            Terms
          </Link>
          <Link href="/privacy-policy" className={linkClass}>
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
