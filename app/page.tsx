import WaitlistForm from './components/WaitlistForm'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Page wrapper */}
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        {/* Nav */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 ring-1 ring-emerald-400/40">
              <span className="text-lg font-semibold text-emerald-300">HT</span>
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-200">
              Household Toolbox
            </span>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex">
            <a href="#features" className="hover:text-emerald-300">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-emerald-300">
              How it works
            </a>
          </nav>
        </header>

        {/* Hero */}
        <section className="mb-16 grid flex-1 gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
              All your home life admin, in one place
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
              The digital toolbox
              <br />
              for your whole household.
            </h1>

            <p className="mt-4 max-w-xl text-pretty text-sm text-slate-300 sm:text-base">
              Household Toolbox brings your maintenance schedules, important documents,
              checklists, and planning tools together so nothing around the house slips
              through the cracks again!
            </p>

            {/* CTA + Email form */}
            <WaitlistForm />

            <p className="mt-3 text-xs text-slate-400">
              No spam. Just an occasional update when new tools go live.
            </p>
          </div>

          {/* Right side “card” */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-2xl shadow-emerald-500/10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
              At-a-glance
            </p>
            <h2 className="mt-3 text-lg font-semibold text-slate-50">
              Your household control panel
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              See what needs attention this week across maintenance, bills, and
              tasks—without digging through emails, texts, and paper folders.
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mt-0.5 h-7 w-7 flex-none rounded-lg bg-emerald-400/10 text-center text-lg">
                  🧰
                </div>
                <div>
                  <p className="font-medium text-slate-100">Maintenance timeline</p>
                  <p className="text-xs text-slate-400">
                    Track filters, gutters, inspections, and more with reminders.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mt-0.5 h-7 w-7 flex-none rounded-lg bg-emerald-400/10 text-center text-lg">
                  📂
                </div>
                <div>
                  <p className="font-medium text-slate-100">Important documents</p>
                  <p className="text-xs text-slate-400">
                    Keep warranties, policies, and records organized and easy to find.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mt-0.5 h-7 w-7 flex-none rounded-lg bg-emerald-400/10 text-center text-lg">
                  ✅
                </div>
                <div>
                  <p className="font-medium text-slate-100">Shared checklists</p>
                  <p className="text-xs text-slate-400">
                    Coordinate move-in, hosting, packing, and seasonal checklists with
                    your whole household.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mb-16">
          <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
            Designed for real-life households
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Household Toolbox isn’t another todo app. It’s a practical command center
            for the boring but important stuff that keeps your home running.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">🗓️</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Preventive maintenance
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Build a repeating schedule for home tasks so you stay ahead of repairs
                instead of reacting to them.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">👥</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Everyone on the same page
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Share responsibility with partners, roommates, or family—see who&apos;s
                doing what and when.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">🔐</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Peace-of-mind records
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Store key details and docs in one place so you&apos;re not hunting
                through drawers or old emails.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mb-10">
          <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
            How Household Toolbox works
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Step 1
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                Add your home basics
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Enter your home type, key systems, and existing maintenance habits.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Step 2
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                Build your toolbox
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Turn on the tools you need: maintenance calendar, document vault,
                checklists, and more.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Step 3
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                Stay ahead effortlessly
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Get gentle reminders and a single dashboard view of what matters this
                week.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p>© {new Date().getFullYear()} Household Toolbox. All rights reserved.</p>
            <p className="text-[11px] text-slate-500">
              Built to make home life admin less painful.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
