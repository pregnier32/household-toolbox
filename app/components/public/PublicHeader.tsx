import Link from 'next/link';
import { HelpMenu } from '../HelpMenu';
import { SideLogo } from '../SideLogo';
import { PUBLIC_ANALYTICS_EVENTS } from '@/lib/public-analytics-events';
import { TrackedLink } from './TrackedLink';

const navLinkClass =
  'rounded-md px-1 py-2 text-sm text-slate-300 transition-colors hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

const menuLinkClass =
  'block rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export function PublicHeader() {
  return (
    <header className="border-b border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          <SideLogo priority />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-5 md:flex">
          <Link href="/" className={navLinkClass}>
            Home
          </Link>
          <Link href="/tools" className={navLinkClass}>
            Tools
          </Link>
          <Link href="/pricing" className={navLinkClass}>
            Pricing
          </Link>
          <HelpMenu />
          <TrackedLink href="/" eventName={PUBLIC_ANALYTICS_EVENTS.signupClick} eventParams={{ placement: 'header_sign_in' }} className={navLinkClass}>
            Sign In
          </TrackedLink>
          <TrackedLink
            href="/"
            eventName={PUBLIC_ANALYTICS_EVENTS.signupClick}
            eventParams={{ placement: 'header' }}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Get Started
          </TrackedLink>
        </nav>

        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:border-emerald-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            Menu
          </summary>
          <nav
            aria-label="Mobile"
            className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-lg"
          >
            <Link href="/" className={menuLinkClass}>
              Home
            </Link>
            <Link href="/tools" className={menuLinkClass}>
              Tools
            </Link>
            <Link href="/pricing" className={menuLinkClass}>
              Pricing
            </Link>
            <Link href="/faq" className={menuLinkClass}>
              FAQ
            </Link>
            <Link href="/support" className={menuLinkClass}>
              Support
            </Link>
            <TrackedLink href="/" eventName={PUBLIC_ANALYTICS_EVENTS.signupClick} eventParams={{ placement: 'mobile_sign_in' }} className={menuLinkClass}>
              Sign In
            </TrackedLink>
            <TrackedLink
              href="/"
              eventName={PUBLIC_ANALYTICS_EVENTS.signupClick}
              eventParams={{ placement: 'mobile_header' }}
              className="mt-1 block rounded-lg bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Get Started
            </TrackedLink>
          </nav>
        </details>
      </div>
    </header>
  );
}
