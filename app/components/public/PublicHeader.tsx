import Link from 'next/link';
import { HelpMenu } from '../HelpMenu';
import { SideLogo } from '../SideLogo';

const navLinkClass =
  'rounded-sm hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export function PublicHeader() {
  return (
    <header className="mb-10 border-b border-slate-800">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 pt-10 pb-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <SideLogo priority />
        </Link>

        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm text-slate-300"
        >
          <Link href="/tools" className={navLinkClass}>
            Tools
          </Link>
          <Link href="/#features" className={navLinkClass}>
            Features
          </Link>
          <Link href="/pricing" className={navLinkClass}>
            Pricing
          </Link>
          <HelpMenu />
        </nav>
      </div>
    </header>
  );
}
