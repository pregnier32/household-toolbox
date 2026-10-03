# Household Toolbox UX Design Standard

This document is the authoritative source for how the Household Toolbox user interface should **look and behave**.

`system_design.md` remains the authoritative source for technical architecture, database standards, security, Supabase conventions, project setup, and other engineering standards.

This document is the single UX source of truth. Where older snippets in `system_design.md` disagree, this file wins.

Use this document to implement a screen or to audit whether an existing Household Toolbox tool follows the standard. A screen follows the standard when its layout, copy, interaction, and class patterns match the section that applies, including any [application-specific exception](#application-specific-ux-exceptions).

If a reference implementation conflicts with the written UX rule, **the written UX rule wins**. Reference snippets are examples, not overrides.

Class names are Tailwind utilities. In light mode, many `slate` utilities are remapped in `app/globals.css`. See [Theme — Light & Dark Mode](#theme--light--dark-mode) before treating a dark-mode class string as the color the user actually sees.

## Contents

1. [Purpose](#purpose)
2. [How these rules are audited](#how-these-rules-are-audited)
3. [Product UX Principles](#product-ux-principles)
4. [Visual Design](#visual-design)
5. [Theme — Light & Dark Mode](#theme--light--dark-mode)
6. [Typography](#typography)
7. [Layout & Spacing](#layout--spacing)
8. [Cards & Containers](#cards--containers)
9. [Buttons & Actions](#buttons--actions)
10. [Icons](#icons)
11. [Forms & Inputs](#forms--inputs)
12. [Record/List Patterns](#recordlist-patterns)
13. [Add & Edit Patterns](#add--edit-patterns)
14. [Delete, Archive & History Patterns](#delete-archive--history-patterns)
15. [Modals & Dialogs](#modals--dialogs)
16. [Tabs & Navigation](#tabs--navigation)
17. [Tool Header / Category Selector Patterns](#tool-header--category-selector-patterns)
18. [Search & Filtering](#search--filtering)
19. [Empty & Loading States](#empty--loading-states)
20. [Notifications, Errors & Success Feedback](#notifications-errors--success-feedback)
21. [Attachments](#attachments)
22. [Dashboard Calendar Integration](#dashboard-calendar-integration)
23. [Dates & Data Display](#dates--data-display)
24. [Print & Export Patterns](#print--export-patterns)
25. [Responsive / Mobile Design](#responsive--mobile-design)
26. [Accessibility](#accessibility)
27. [Application-Specific UX Exceptions](#application-specific-ux-exceptions)
28. [Audit rule index](#audit-rule-index)
29. [Future UX Considerations](#future-ux-considerations)

Audit-worthy requirements have stable IDs (`UX-BTN-001`, and so on). Use [`UX_AUDIT_CHECKLIST.md`](./UX_AUDIT_CHECKLIST.md) to evaluate one tool at a time. Philosophy, rationale, and code examples do not have IDs.

---

## Purpose

Household Toolbox is a digital toolbox for household management. It helps people track recurring maintenance, organize important records, and coordinate shared tasks so routine responsibilities are not missed.

This standard exists so every tool feels like the same product:

- Practical household tasks, immediately understandable, calm, and efficient.
- The same colors, type, cards, buttons, icons, forms, lists, modals, and feedback.
- The same attachment habit: a paperclip opens one modal.
- The same destructive-action habit: in-app confirmation, never a browser dialog.
- Explicit exceptions only where this document says a tool behaves differently.

Engineering setup, environment variables, deployment, database indexes, RLS, function search paths, migration procedure, storage SQL, and account-deletion architecture stay in `system_design.md`. User-facing file limits, quota messages, allowed types, and attachment interactions are in this document.

---

## How these rules are audited

Scoring, verification types, audit scopes, and the report template live in [`UX_AUDIT_CHECKLIST.md`](./UX_AUDIT_CHECKLIST.md). This section keeps the written rules aligned with that process.

### Written rule wins

The recipes in this document are authoritative. Calendar Events, Subscription Tracker, and other reference implementations are examples. If a reference conflicts with the written rule, follow the written rule.

### Results

Valid results are **Pass**, **Fail**, **N/A**, and **Not Exercised**.

- **Pass** — the rule applies and the observed behavior satisfies it.
- **Fail** — the rule applies and the observed behavior violates it.
- **N/A** — the rule does not apply to this application, screen, or workflow (no search, no tabs, no attachments, Dashboard-only rule during a Tool audit).
- **Not Exercised** — the rule applies, but the auditor could not test it because the needed state, fixture, file, latency, measurement, or source access was missing.

Do not count Not Exercised as N/A. Do not Fail a Code-only criterion from a screenshot. Do not guess colors, hit-box sizes, or z-index tokens.

### Severity is not the same as rule level

`MUST` does **not** automatically mean Major severity.

- **Level** says whether the requirement is mandatory.
- **Severity** says how much this specific failure hurts the user.

A MUST date-format miss is typically Minor. Horizontal clipping that hides required row actions is typically Major. An inaccessible destructive control is Major or Critical.

### Verification types

| Type | Meaning |
|------|---------|
| UI | Visible without a special fixture |
| UI + Interaction | Requires clicking, typing, opening a modal, or switching theme |
| Code | Requires source or class inspection |
| Fixture | Requires a specific data/file/state |
| UI + Code | Visual check plus source when available |
| UI + Fixture | Visual check that needs a prepared record or file |

If the required verification method is not available, use Not Exercised for that criterion.

### Audit scopes

| Scope | Typical use |
|-------|-------------|
| Tool | Inside an application |
| Dashboard / Shell | Dashboard chrome, Tool Box / Store, signed-out theme |
| Modal | Dialogs opened from a tool |
| Report | Export tab, export popup, print/PDF |
| All | Wherever the UI appears |

Run a Tool audit without scoring Dashboard / Shell rows as N/A. Use the matching checklist section.

### Button wording

Create workflows may use context-specific primary labels such as **Add Subscription**, **Add Event**, or **Create**. Edit workflows typically use **Save** or **Save Changes** where applicable. Labels should clearly describe the action.

Exact Save/Add wording is **not** globally standardized. Do not Fail a tool solely because its primary label is “Add Event” rather than “Save”. If a section in this document already names a specific label for a workflow, that specific label still wins.

### Success feedback

For rules that require a success notice or in-modal success line:

- The auditor must actively observe the action result.
- If the action succeeds and no required success notice appears, Fail.
- If the success state disappears too quickly or was not observed because of test limitations, Not Exercised.
- Do not Pass based only on the fact that the data changed.

Keep in-modal feedback (`UX-FBK-002`) separate from page-level `useAppNotice` (`UX-FBK-001`).

Suggested fixtures are listed in the checklist. Do not invent data or scripts as part of documenting the process.

Audit report findings also receive **Fix Scope** and **Remediation Status**. Those fields, the Cursor remediation workflow, and the safety rules live in [`UX_AUDIT_CHECKLIST.md`](./UX_AUDIT_CHECKLIST.md). They do not add UX requirements.

---

## Product UX Principles

1. **Practicality First.** Household Toolbox is designed for real-life household management. Every feature should solve a real problem that households face.

2. **Clarity Over Cleverness.** The interface should be immediately understandable. Users should not need to learn how to use the app. It should be intuitive.

3. **Peace of Mind.** The product helps users stay organized and avoid missing important tasks. The design should feel calm, organized, and trustworthy.

4. **Respect for User Time.** Household admin is already tedious. The interface should be efficient and minimize friction.

5. **Accessibility for Everyone.** The product should be usable by all members of a household, regardless of technical skill or ability.

---


#### UX-VIS-001 — Slate + emerald palette

**Level:** MUST

**Requirement:** Tool surfaces use the slate + emerald palette, including light-mode remaps.

**Pass criteria:**
- Page and cards read as slate/emerald (or remapped light gray/white + emerald).
- Primary accent is emerald, not an unrelated brand color.

**Fail examples:**
- A tool introduces a different primary accent or off-palette page chrome.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Visual Design

The UI is built around a **slate + emerald** palette. Tailwind class names in this section describe the **dark-mode appearance** unless a subsection says otherwise. In light mode, many of those utilities are remapped (see [Theme — Light & Dark Mode](#theme--light--dark-mode)).

### Color palette

#### Primary colors

- **Background:** `slate-950` (#020617) — main page background (matches `--background` in `app/globals.css` dark theme)
- **Surface:** `slate-900` (#0f172a) — card backgrounds, elevated surfaces
- **Surface secondary:** `slate-900/70` or `slate-900/50` — semi-transparent surfaces
- **Border:** `slate-800` (#1e293b) — primary border color for cards and containers
- **Border secondary:** `slate-700` (#334155) — secondary borders, form inputs

#### Text colors

- **Primary text:** `slate-50` (#f8fafc) — headings and primary content
- **Secondary text:** `slate-100` (#f1f5f9) — secondary headings
- **Body text:** `slate-200` (#e2e8f0) — regular body text
- **Muted text:** `slate-300` (#cbd5e1) — labels, helper text
- **Placeholder text:** `slate-400` (#94a3b8) — input placeholders
- **Disabled text:** `slate-500` (#64748b) — disabled elements

#### Accent colors

- **Primary accent:** `emerald-500` (#10b981) — primary buttons, active states, links
- **Primary accent hover:** `emerald-400` (#34d399) — button hover states
- **Primary accent light:** `emerald-300` (#6ee7b7) — active tab text, badges
- **Primary accent background:** `emerald-500/10` or `emerald-400/20` — accent backgrounds with opacity

#### Semantic colors

- **Success:** `emerald-500/50` border, `emerald-500/10` background, `emerald-300` text
- **Error:** `red-500/50` border, `red-500/10` background, `red-300` text
- **Warning:** `amber-500/50` border, `amber-500/10` background, `amber-300` text
- **Info / secondary action:** `blue-500/20` background, `blue-300` text

#### Button text on accent

- **Text on emerald:** `slate-950` (#020617) — text on primary emerald buttons (dark enough for contrast on `emerald-500`)

Primary buttons are theme-aware: light mode uses `emerald-600` and white text; dark mode uses `emerald-500` and `slate-950` text. See [Primary button](#primary-button).


#### UX-VIS-002 — Semantic color usage

**Level:** MUST

**Requirement:** Red, amber, and emerald semantic treatments are used only for error, warning, and success/positive meaning.

**Pass criteria:**
- Destructive actions are red; success/positive is emerald; warnings are amber.

**Fail examples:**
- Error styling is used for a neutral action, or a destructive action is styled as primary emerald.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Color usage

- Use emerald for primary actions, active states, and positive indicators.
- Use slate grays for all neutral elements.
- Use semantic colors (red, amber) sparingly and only for their intended purposes.
- Maintain sufficient contrast ratios for accessibility (WCAG AA minimum).


#### UX-VIS-003 — Theme-aware tag chips

**Level:** MUST

**Requirement:** Tag chips on records use the documented light/dark treatments.

**Pass criteria:**
- Light positive chips: emerald border/fill/text as documented.
- Light history/neutral chips: slate border/fill/text as documented.

**Fail examples:**
- Chips use dark-mode tinted emerald-on-emerald on a pale card.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Tag chips

For tag chips on document or record rows, use explicit light-mode classes so tags stay readable on white or pale cards.

- **Active / positive tag chips (light):** `border border-emerald-300 bg-emerald-50 text-emerald-800`
- **Neutral / history tag chips (light):** `border border-slate-300 bg-slate-100 text-slate-700`
- **Sizing:** keep compact chip sizing (`px-1.5 py-0.5 rounded text-xs font-medium`) unless a specific screen needs larger chips.

```tsx
className={
  resolvedTheme === 'light'
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300'
}
```

### Status and feedback color

Success, error, warning, and info use the semantic colors above. Message containers are specified under [Form validation messages](#form-validation-messages) and [Notifications, Errors & Success Feedback](#notifications-errors--success-feedback).

---

## Theme — Light & Dark Mode


#### UX-VIS-004 — Theme by auth state

**Level:** MUST

**Requirement:** Signed-out public routes stay dark. Signed-in users follow the saved theme preference.

**Pass criteria:**
- Marketing/auth routes do not apply a stored light preference.
- Signed-in switching light/dark updates `<html>` class and `data-theme`.

**Fail examples:**
- A signed-out page follows a leftover light preference from storage.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Behavior

- **Signed-out users** (marketing, auth, help, and similar public routes): the app **always uses dark appearance** so public pages stay visually consistent. Theme preference in storage does not apply until sign-in (see `AppThemeProvider`).
- **Signed-in users:** theme follows **`theme_preference`** from the session / DB (`PUT /api/user/theme`), cached in `localStorage` under `household-toolbox-theme`.
- **`<html>`:** has class **`light`** or **`dark`** and `data-theme="light"` or `data-theme="dark"` so CSS and scripts can target the active mode.

### CSS variables (`app/globals.css`)

- **Dark:** `--background` **`#020617`** (aligned with Tailwind `slate-950`); `--foreground` is light text.
- **Light:** `--background` **`#e9edf1`**; `--foreground` **`#0f172a`**. `body` uses these for base page chrome — a slightly cool gray canvas (between Tailwind slate-100 and slate-200), not pure white.

### Slate utility remaps in light mode

For elements matching substring selectors, light mode overrides backgrounds, text colors, and borders (see `app/globals.css`).

| Utility pattern | Approximate light-mode result |
|-----------------|-------------------------------|
| `bg-slate-950` | **`#e9edf1`** (page canvas; matches `--background`) |
| `bg-slate-900` | `#ffffff` (surfaces / cards) |
| `bg-slate-800` | `#e2e8f0` |
| `bg-slate-700` (hover, etc.) | `#cbd5e1` |
| `text-slate-50` … `text-slate-500` | Mapped to darker slate text for contrast on light surfaces |
| `border-slate-600` … `border-slate-900` | Cool gray borders |

Use these remaps for bulk legacy UI. For **popover-style UI** where remap grays look muddy on white, use **explicit** light styles and `useTheme().resolvedTheme`. See [Header dropdown menus — light mode](#header-dropdown-menus--light-mode).

### Assets

- Header **side logo:** `SideLogo` uses **`Logo_Side_White.png`** / **`Logo_Side_Black.png`** at URL path **`/images/logo/`** (files live under **`public/images/logo/`**) based on **`resolvedTheme`** (black asset in light mode).

### Defaults for new work

- Prefer **`resolvedTheme`** when choosing between mutually exclusive light vs dark class strings.
- **Primary buttons are theme-aware.** Light: `emerald-600` fill and white text. Dark: `emerald-500` fill and `slate-950` text. See [Buttons & Actions](#buttons--actions).
- Focus rings may still use `focus:ring-offset-*` tuned per surface when you add light-specific panels.
- **Icons on light surfaces:** default muted treatment is `text-slate-600` with `hover:text-slate-900`. Do not use `text-slate-400` / `hover:text-slate-200` on light chrome. Semantic icons (emerald Edit, red Delete) keep their semantic colors.
- **Tabs in every tool and on the dashboard:** light-mode active labels use `border-emerald-600 text-emerald-900 font-semibold`. Do not use `text-emerald-300` for an active tab in light mode. See [Tabs & Navigation](#tabs--navigation).

---


#### UX-TYP-001 — Documented typeface and scale

**Level:** MUST

**Requirement:** UI text uses Geist Sans and the documented heading/body sizes and weights.

**Pass criteria:**
- Page/tool titles use the documented heading size and `font-semibold`.
- Body/labels use the documented `text-sm` / `text-xs` patterns.

**Fail examples:**
- A tool uses an unrelated display font or heading scale.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Typography

### Font families

- **Primary font:** Geist Sans (via Next.js Google Fonts)
- **Monospace font:** Geist Mono (for code or technical content)
- **Fallback:** Arial, Helvetica, sans-serif

### Font sizes

- **Display:** `text-6xl` (3.75rem / 60px) — hero headings
- **H1:** `text-4xl` or `text-5xl` (2.25rem / 2.5rem) — page titles
- **H2:** `text-2xl` (1.5rem / 24px) — section headings
- **H3:** `text-xl` or `text-lg` (1.125rem / 1.25rem) — subsection headings
- **Body large:** `text-base` (1rem / 16px) — large body text
- **Body:** `text-sm` (0.875rem / 14px) — standard body text
- **Small:** `text-xs` (0.75rem / 12px) — labels, captions, helper text
- **Tiny:** `text-[11px]` — footer text, fine print

### Font weights

- **Semibold:** `font-semibold` (600) — headings, important text
- **Medium:** `font-medium` (500) — labels, button text
- **Regular:** default (400) — body text

### Typography patterns

- **Headings:** `font-semibold` with `text-slate-50` for H1/H2 and `text-slate-100` for H3
- **Body text:** `text-slate-200` or `text-slate-300`
- **Labels:** `text-sm font-medium text-slate-300`
- **Uppercase labels:** `text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300` for section labels
- **Line height:** default line-height is appropriate for most text. Use `leading-tight` or `leading-relaxed` when needed.

### Text utilities

- **Text balance:** `text-balance` for headings to prevent awkward line breaks
- **Text pretty:** `text-pretty` for paragraphs to improve line breaks
- **Whitespace:** `whitespace-pre-line` for multi-line text that preserves line breaks
- **Whitespace nowrap:** `whitespace-nowrap` for buttons or labels that should not wrap

Tool page titles use the H2 size. See [Tool header layout](#tool-header-layout).

---


#### UX-LAY-001 — Page padding and standard cards

**Level:** MUST

**Requirement:** Tool pages use the documented page padding and standard/nested card chrome.

**Pass criteria:**
- Page padding follows `px-4 py-10 sm:px-6 lg:px-8` (or equivalent).
- Primary cards are `rounded-2xl` with documented border/background.

**Fail examples:**
- Content is flush to the viewport with no page padding, or cards use an unrelated radius/chrome.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Layout & Spacing

### Container widths

- **Max content width:** `max-w-5xl` (1024px) — main content containers
- **Max form width:** `max-w-3xl` (768px) — forms and narrower content
- **Full width:** dashboard and tool interfaces

### Spacing system

- **Page padding:** `px-4 py-10 sm:px-6 lg:px-8`
- **Section spacing:** `mb-16` or `space-y-6` between sections
- **Card padding:** `p-4`, `p-5`, or `p-6`
- **Element spacing:**
  - Small gaps: `gap-2` (0.5rem)
  - Medium gaps: `gap-3` or `gap-4` (0.75rem / 1rem)
  - Large gaps: `gap-6` (1.5rem)
- **Vertical spacing:** `space-y-4` or `space-y-6` for form fields and lists

### Border radius

- **Cards:** `rounded-2xl` (1rem) — primary card containers
- **Buttons:** `rounded-lg` (0.5rem) — standard buttons
- **Small elements:** `rounded-md` (0.375rem) — small buttons, badges
- **Inputs:** `rounded-lg` (0.5rem) — form inputs

### Grid layouts

- **Responsive grid:** `grid gap-5 md:grid-cols-3` for feature cards
- **Form grid:** `grid grid-cols-1 md:grid-cols-2 gap-4` for two-column forms
- **Flex layouts:** `flex` with `gap-2`, `gap-4`, or `gap-6` for horizontal arrangements

### Shadows

- **Card shadow:** `shadow-2xl shadow-emerald-500/10` — subtle colored shadow for emphasis
- **Dropdown shadow:** `shadow-lg` — menu and dropdown shadows

### Backgrounds

- **Page background:** `bg-slate-950` (in light mode, remapped to **`#e9edf1`**)
- **Card background:** `bg-slate-900/70` or `bg-slate-900/50` with `border border-slate-800` (light: surfaces trend toward white / soft gray via the same remaps)
- **Input background:** `bg-slate-900/70`
- **Hover background:** `hover:bg-slate-800` or `hover:bg-slate-700`

---

## Cards & Containers

### Standard cards

- **Standard card:** `rounded-2xl border border-slate-800 bg-slate-900/70 p-4` or `p-6`
- **Nested card:** `rounded-lg border border-slate-700 bg-slate-800/50 p-4`
- **Card header:** `mb-4` below the header


#### UX-LAY-002 — Tool Box and Store card sizing

**Audit scope:** Dashboard / Shell. Do not score during a Tool audit.

**Level:** MUST

**Requirement:** Dashboard Tool Box and Store cards share the documented baseline height and content flow.

**Pass criteria:**
- Card wrapper includes `relative flex flex-col min-h-[180px]`.
- Content flow is icon area, then name, then price/status.

**Fail examples:**
- Store cards are a different height or stack title above the icon.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Tool app cards (Dashboard Tool Box and Store)

Use the same baseline sizing in both **Tool Box** and **Store** so card heights stay visually consistent across tabs.

- **Card wrapper:** include `relative flex flex-col min-h-[180px]` in addition to the standard card styles.
- **Icon container:** include `flex-1 min-h-[60px]` so the icon area reserves vertical space and aligns title/price rows.
- **Content flow:** icon area, then tool name, then price/status row. The wrapper is a column.
- **Reference:** `app/dashboard/page.tsx` (Tool Box and Store card blocks).

### Selector container

Tools with header or category cards wrap the selector in one standard card. See [Tool Header / Category Selector Patterns](#tool-header--category-selector-patterns).

### Modal cards

Modal containers are specified separately because the source gives more than one card treatment. See [Modals & Dialogs](#modals--dialogs).

---

## Buttons & Actions


#### UX-BTN-001 — Theme-aware primary button

**Level:** MUST

**Audit scope:** Tool / All

**Verification:** UI + Code

**Requirement:** Primary CTA buttons use the standard theme-aware primary-button treatment. The written recipe below is authoritative.

**UI criteria (Pass):**
- Light mode: the primary CTA appears as a strong / deep emerald button with white text. It must not look pale, mint, or disabled when enabled.
- Dark mode: the primary CTA appears emerald and the label appears dark / near-black.

**Code criteria (Pass, when source is available):**
- Light: `bg-emerald-600`, `text-white`, `hover:bg-emerald-500`.
- Dark: `bg-emerald-500`, `text-slate-950`, `hover:bg-emerald-400`.

**Fail examples:**
- Primary action uses an unrelated custom color.
- Light mode uses the dark-mode-only `emerald-500` + `slate-950` treatment as the only style.
- An enabled primary looks pale/mint or disabled.

**Not Exercised:**
- If only screenshots are available and the colors are too close to distinguish confidently, do not guess. Mark the token-level portion Not Exercised. Report only obvious visual failures.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Primary button

Primary buttons are **theme-aware**. Branch on `useTheme().resolvedTheme === 'light'` (or the tool’s `isLight` flag).

- **Light:** `bg-emerald-600`, `text-white`, `hover:bg-emerald-500`, `focus:ring-offset-white`
- **Dark:** `bg-emerald-500`, `text-slate-950`, `hover:bg-emerald-400`, `focus:ring-offset-slate-900`

Use this for every primary CTA (Submit, Save, Buy, Create Account, Add, Generate PDF Report, Export to PDF). Older `emerald-500` + `slate-950` snippets are **dark-mode only**.

Disabled `emerald-500` buttons on light cards read as weak mint/grey. The deeper light fill and white label keep contrast (WCAG). Do not pair **`text-emerald-300`** with **`bg-emerald-500/20`** for compact actions on pale cards.

**Reference:** `app/components/CalendarEventsTool.tsx` — `primaryButtonClass`, `compactEmeraldActionClass`, `primaryButtonCompactClass`.

#### Full-width / form primary (Add, Save, Create)

```tsx
className={
  resolvedTheme === 'light'
    ? 'rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
}
```

- **Use for:** primary actions (Submit, Save, Buy, Create Account)
- **Sizes:** standard `px-4 py-2.5`; small `px-2.5 py-1 text-xs`; full width add `w-full`
- **Disabled:** `disabled:opacity-50 disabled:cursor-not-allowed`

#### Compact emerald actions (Edit, Reactivate, similar text buttons)

Use a **white fill + dark emerald border + dark emerald text** in light mode. Do not use tinted `emerald-500/20` + `emerald-300` on light cards.

```tsx
className={
  resolvedTheme === 'light'
    ? 'rounded-lg border-2 border-emerald-700 bg-white px-3 py-1 text-sm font-semibold text-emerald-900 shadow-sm transition-colors hover:border-emerald-800 hover:bg-emerald-50'
    : 'rounded-lg bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30'
}
```

#### Tight inline primary (Save on small category / chip rows)

```tsx
className={
  resolvedTheme === 'light'
    ? 'flex-1 rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
    : 'flex-1 rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50'
}
```

#### Icon-only accent (export / secondary toolbar icon)

On light surfaces, prefer darker emerald for the stroke color:

```tsx
className={
  resolvedTheme === 'light'
    ? 'p-2 rounded-lg text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900'
    : 'p-2 rounded-lg text-emerald-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300'
}
```


#### UX-BTN-002 — Theme-aware secondary and Cancel

**Level:** MUST

**Audit scope:** Tool / Modal / Report

**Verification:** UI + Code

**Requirement:** Cancel and other secondary actions use the single 2px bordered secondary pattern, including Export Cancel.

A dark slate fill with the required 2px border is compliant. Do not treat a slate-filled dark Cancel as a contradiction.

**Pass criteria:**
- Dark secondary / Cancel: a slate-filled background is allowed. It MUST have the documented visible 2px border and the documented secondary-button treatment (`border-2 border-slate-500 bg-slate-800/70 text-slate-300`).
- Light secondary / Cancel: uses the documented light bordered secondary treatment (`border-2 border-slate-400 bg-slate-100 text-slate-800`).

**Fail examples:**
- Borderless filled slate Cancel.
- Legacy `bg-slate-700` Export Cancel.
- 1px legacy secondary treatment where this standard requires 2px.
- Visually primary-looking Cancel.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Secondary button (including Cancel)

There is **one** secondary button. Cancel always uses it, including Export Options.

**Canonical (2px bordered):**

- **Light:** `border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200/90 hover:border-slate-500 focus:ring-slate-400/40 focus:ring-offset-white`
- **Dark:** `border-2 border-slate-500 bg-slate-800/70 text-slate-300 hover:border-slate-400 focus:ring-offset-slate-900`

Do not use the older 1px `border-slate-700 bg-slate-800` recipe or the Export-only `bg-slate-700` Cancel.

**Rationale:** `bg-slate-100` is not remapped by the current global background rules, so the light fill stays predictable. A 2px mid-tone border reads as tappable on white cards.

**Reference:** `app/dashboard/profile/page.tsx` — `secondaryOutlineButtonClass` and `editProfileButtonClass`.

**Full width / form row (Cancel, Change Password):**

```tsx
className={
  resolvedTheme === 'light'
    ? 'rounded-lg border-2 border-slate-400 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200/90 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'rounded-lg border-2 border-slate-500 bg-slate-800/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-400 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
}
```

**With leading icon (Edit Profile):** prefix with `flex items-center gap-2` and use `py-2` if the control is shorter.

**Checklist**

- **Light default:** `border-2 border-slate-400`, `bg-slate-100`, `text-slate-800`
- **Light hover:** `hover:bg-slate-200/90`, `hover:border-slate-500`
- **Dark default:** `border-2 border-slate-500`, `bg-slate-800/70`, `text-slate-300`
- **Dark hover:** `hover:border-slate-400`
- **Disabled:** `disabled:cursor-not-allowed disabled:opacity-50`

### Text button / tab button

```tsx
className="px-3 py-2 text-sm font-medium transition-colors text-slate-400 hover:text-slate-300"
```

- **Use for:** tabs, navigation, less prominent actions
- **Active state:** use the theme-aware tab classes in [Tabs & Navigation](#tabs--navigation). Do not use `text-emerald-300` for an active tab in light mode.


#### UX-ICO-002 — Icon-only aria-label and title

**Level:** MUST

**Audit scope:** All

**Verification:** UI + Code

**Requirement:** Every icon-only interactive button MUST have an accessible name. `aria-label` and `title` should both be present and use matching wording unless there is a documented reason otherwise. The `title` attribute provides the expected native hover tooltip.

**Pass criteria:**
- `aria-label` exists.
- `title` exists.
- The wording matches.

**Fail examples:**
- Either attribute is missing.
- The wording conflicts.
- The button has no accessible name.

**Not Exercised:**
- If only an accessible name can be observed in the browser but the title / tooltip cannot be confirmed, mark Not Exercised unless source inspection is available.

Do not treat “an accessible name exists” as a complete Pass if this rule requires both attributes.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Icon button

```tsx
<button
  aria-label="Close modal"
  title="Close modal"
  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
>
  {/* icon SVG — use Icon Style */}
</button>
```

- **Use for:** close buttons, icon-only actions (print, close, view)
- **Include:**
  - `aria-label` for accessibility (for example `aria-label="Close modal"`)
  - `title` for a hover tooltip. Every icon-only button shows a tooltip. Use the same text as `aria-label`.
- **Icon:** [Icon Style](#icon-style)
- **Record lists:** use [Record row actions](#record-row-actions), not this plain icon button, for active and history rows.


#### UX-BTN-003 — Theme-aware switch

**Level:** MUST

**Requirement:** Boolean switches use the documented track, thumb, and theme-aware label colors.

**Pass criteria:**
- On track is emerald; off track is `slate-300` (light) or `slate-700` (dark).
- Control has `role="switch"`, `aria-checked`, `aria-label`, and `title`.

**Fail examples:**
- A dashboard/calendar boolean is a checkbox, or the light off-track stays `slate-700`.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Dashboard toggle (switch)

Every on/off switch uses the **same theme-aware track**. The calendar pin switch is the visual standard; only the label changes.

The control is a capsule track with a white circular thumb. On is emerald. Off is slate-300 in light mode and slate-700 in dark mode.

```tsx
<label className="flex items-center gap-2 cursor-pointer" title={switchTitle}>
  <span className={`text-xs whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
    {switchLabel}
  </span>
  <button
    type="button"
    role="switch"
    aria-checked={isOn}
    aria-label={switchLabel}
    title={switchTitle}
    onClick={() => toggle()}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 ${
      isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-slate-900'
    } ${isOn ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'}`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
        isOn ? 'translate-x-5' : 'translate-x-1'
      }`}
    />
  </button>
</label>
```

- **Use for:** “Display on dashboard” and any similar boolean toggle that should be a switch, not a checkbox.
- **Dashboard Calendar:** when the switch opts a *record* onto the Dashboard Calendar, use the label **Add to dashboard calendar**, default **off**, and follow [Dashboard Calendar Integration](#dashboard-calendar-integration). Do not reuse a generic “Dashboard” label for calendar pins.
- **Track:**
  - Size: `h-6 w-11` (24px height, 44px width), capsule via `rounded-full`
  - On: `bg-emerald-500`
  - Off: light `bg-slate-300`; dark `bg-slate-700`
  - Focus offset: light `focus:ring-offset-white`; dark `focus:ring-offset-slate-900`
- **Thumb:**
  - Size: `h-5 w-5` (20px), `rounded-full`, `bg-white`, `shadow`
  - Position: `translate-x-1` when off, `translate-x-5` when on
- **Label:** text to the left of the switch. Light: `text-xs text-slate-600`. Dark: `text-xs text-slate-400`. Wrap both in a `<label>` so clicking the text toggles the switch.
- **Accessibility:** `role="switch"`, `aria-checked={boolean}`, `aria-label`, and `title`.
- **Hit area:** the switch track is 44px wide. Keep the clickable label+control group large enough for touch. See [Responsive / Mobile Design](#responsive--mobile-design).


#### UX-BTN-004 — Loading and disabled on async actions

**Level:** MUST

**Audit scope:** Tool / Modal

**Verification:** Fixture

**Requirement:** Async actions show a loading label and a disabled state while the request is in flight.

**Pass criteria:**
- Button text becomes Processing/Saving/Loading and the control is disabled with reduced opacity and `not-allowed` cursor.

**Fail examples:**
- The user can double-submit, or the button stays enabled with no in-flight indication.

**Not Exercised:**
- No slow or observable in-flight request occurred. Do not guess from a fast save.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

`UX-EMP-002` is retired. Score this rule instead.

### Button guidelines

- Always include loading and disabled states for async actions.
- Use `transition-colors` for hover.
- Keep padding and sizing consistent within the same context.
- Group related buttons with `flex gap-2` or `flex gap-3`.
- Loading labels: “Processing...”, “Saving...”, or “Loading...”. Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`.
- **Primary labels are context-specific.** Create workflows may use Add Subscription, Add Event, Create, or the tool’s equivalent. Edit workflows typically use Save / Save Changes. Exact wording is not globally standardized unless a later section names a specific label.

#### UX-BTN-005 — Correct add-control type (retired)

**Level:** MUST — score `UX-ADD-001` or `UX-ADD-002` instead.

This ID is kept so older reports still resolve. It is not a separate checklist row.

The add control matches the tool type: filled Add New, section +, or header-card +. Simple single-list tools (including optional calendar pins) use filled “+ Add New [Item]”. Category-scoped tools use the small section +; header entities use the square +.

### Add controls

Three different add controls exist. Use the one that matches the tool. Full placement and flow rules are in [Add & Edit Patterns](#add--edit-patterns).

| Control | When |
|---------|------|
| Filled **+ Add New [Item Name]** | Simple single-list tools, **including** tools where an individual record can optionally be calendar-pinned (for example Subscription Tracker) |
| Small emerald **plus** beside the section title | Category-scoped / calendar-oriented tools, where the category (or equivalent scope) is the organizing structure |
| Square **+** in the header card row | Adding a header / category / entity card (a pet, a family member), not a record inside that category |

Calendar pinning is an optional attribute of a record. It does **not** by itself require the section plus. Use the section plus when the tool is organized by category (or equivalent scope) and the plus sits next to that section heading.

---

## Icons


#### UX-ICO-001 — Outline icon style

**Level:** MUST

**Requirement:** Icons are outline (stroke) icons using `fill="none"`, `stroke="currentColor"`, and `viewBox="0 0 24 24"`.

**Pass criteria:**
- Icons inherit the parent text color; stroke width is 2; glyphs are 16/20/24px as documented.

**Fail examples:**
- Filled icons or a mixed icon set with a different viewBox/stroke.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Icon style

Use this format for every icon in icon-only buttons and inline icons so icons match across the app (outline/stroke, inheriting the parent color).

- **Style:** outline (stroke) icons only. No filled icons. Use `fill="none"` and `stroke="currentColor"` so the icon inherits the parent’s text color.
- **Stroke:** `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- **Size:** glyph is `className="h-5 w-5"` (20px) for standard icons. Use `h-6 w-6` (24px) where a larger glyph is needed. The section-title plus glyph is `h-4 w-4` (16px). The header-card plus glyph is `h-6 w-6`.
- **Hit area:** the **button container** is at least 44×44px on touch interfaces (`min-h-11 min-w-11` or equivalent). The glyph stays 16/20/24px. The same rule applies to the small section plus and the three-dot menu. See [Responsive / Mobile Design](#responsive--mobile-design).

#### UX-ICO-003 — Light-mode muted icon color

**Level:** MUST

**Requirement:** Neutral icons on light surfaces use `text-slate-600` with `hover:text-slate-900`.

**Pass criteria:**
- Muted toolbar icons on pale cards are slate-600, not slate-400.

**Fail examples:**
- Light chrome uses `text-slate-400` / `hover:text-slate-200` for a neutral icon.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

- **Color:** set on the parent (the button). On **dark** surfaces use `text-slate-400` and `hover:text-slate-200`. On **light** surfaces the default muted treatment is **`text-slate-600 hover:text-slate-900`**. Semantic icons (emerald Edit, red Delete) keep their semantic colors.
- **ViewBox:** `viewBox="0 0 24 24"` for 24pt icon sets.

**Print icon:**

```tsx
<button
  type="button"
  onClick={() => window.print()}
  aria-label="Print list"
  title="Print list"
  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
>
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
</button>
```

**Close (X) icon:**

```tsx
<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
</svg>
```

**Plus icon** (section title and header-card add): path `M12 4v16m8-8H4`.

### Canonical record-action glyphs

Use these exact path values (from `CalendarEventsTool`) so row actions match across tools. Keep `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `viewBox="0 0 24 24"`.

- **Edit (emerald):**
  - `d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"`
- **Move to history / Archive (secondary):**
  - `d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"`
- **Reactivate / Restore (emerald, history rows):**
  - `d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"`
- **Delete (danger):**
  - `d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"`

| Action | Typical icon |
|--------|----------------|
| Attachments | Paperclip (`AttachmentButton`) — the only entry point for files on a record |
| Edit | Pencil / square-edit |
| Move to history / Archive | Archive box |
| Reactivate / Restore | Arrow U-turn / back |
| Delete | Trash |

Tooltip and `aria-label` match the action name (for example `title="Move to history"` and `aria-label="Move to history"`).

---

## Forms & Inputs


#### UX-FRM-001 — Standard field chrome

**Level:** MUST

**Requirement:** Text inputs, textareas, and selects use the documented rounded, bordered, focus-ring field chrome.

**Pass criteria:**
- Fields share `rounded-lg`, slate border/background, and emerald focus ring.

**Fail examples:**
- A form uses unstyled native controls or a different focus color as the default.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Text input

```tsx
<input
  type="text"
  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
/>
```

- **Background:** `bg-slate-900/70`
- **Border:** `border-slate-700`
- **Focus:** `focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50`
- **Text:** `text-slate-100`
- **Placeholder:** `placeholder-slate-500`

### Textarea

```tsx
<textarea
  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
/>
```

Same styling as text input. Add `resize-none` to prevent manual resizing.

### Select dropdown

```tsx
<select
  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
>
```

Same styling as text input. Use `px-4` for alignment with options.

### Grouped / hierarchical select

For dropdowns organized by category or area (for example Repair Items grouped by Area):

```tsx
<select
  value={selectedValue}
  onChange={(e) => setSelectedValue(e.target.value)}
  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
>
  <option value="">Select an item...</option>
  {getUniqueAreas().map((area) => {
    const areaItems = getItemsByArea(area);
    return (
      <optgroup key={area} label={area}>
        {areaItems.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </optgroup>
    );
  })}
</select>
```

- **Use for:** hierarchical lists (items grouped by area, category, or type).
- **Structure:** `<optgroup label="...">` for the parent (left-justified). `<option>` elements inside each group (the browser indents them).
- **Styling:** same as a standard select.
- **Default option:** “Select an item...” with an empty value.
- **Conditional display:** show the grouped dropdown only when it applies (for example Home categories). Otherwise use a standard text input.
- **Helpers:** `getUniqueAreas()` for parent categories and `getItemsByArea(area)` to filter children.

### Checkbox

```tsx
<input
  type="checkbox"
  className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
/>
```

- **Size:** `w-5 h-5` for standard checkboxes
- **Accent:** `text-emerald-500` for the checked state

Boolean “display on dashboard” controls use a switch, not a checkbox. See [Dashboard toggle](#dashboard-toggle-switch).

### Label

```tsx
<label className="block text-xs font-medium text-slate-300 mb-1.5">
  Field Name <span className="text-red-400">*</span>
</label>
```

- **Size:** `text-xs` or `text-sm`
- **Weight:** `font-medium`
- **Color:** `text-slate-300`
- **Required indicator:** `text-red-400` asterisk
- **Spacing:** `mb-1.5` or `mb-2` below the label

### Form container

```tsx
<form className="space-y-4">
  {/* Form fields */}
</form>
```

- Use `space-y-4` or `space-y-6` between fields.
- Group related fields in `grid grid-cols-1 md:grid-cols-2 gap-4` for two columns.

### Form validation messages

- **Error:** `border-red-500/50 bg-red-500/10 text-red-300`
- **Success:** `border-emerald-500/50 bg-emerald-500/10 text-emerald-300`
- **Warning:** `border-amber-500/50 bg-amber-500/10 text-amber-300`
- **Container:** `rounded-lg border px-3 py-2 text-sm`


#### UX-FRM-002 — Associated labels and required indicator

**Level:** MUST

**Requirement:** Fields have a `<label>` associated with `htmlFor`/`id`. Required fields show a red asterisk and `required`.

**Pass criteria:**
- Every input has a visible label; required fields are marked.

**Fail examples:**
- Placeholder-only fields, or required fields with no asterisk.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Form guidelines

- Always associate labels with inputs using `htmlFor` and `id`.
- Mark required fields with a red asterisk and the `required` attribute.
- Provide clear error messages near the relevant field.
- Use consistent spacing between form sections.
- Group related fields visually.
- Use `<fieldset>` and `<legend>` for related groups when appropriate.
- Use helper text below labels when a field needs a description.
- Never rely on placeholder text as the only label.


#### UX-FRM-003 — No standalone file field for record attachments

**Level:** MUST

**Requirement:** Files that belong to a tool record are not collected with a standalone “Choose file” field on add/edit forms.

**Pass criteria:**
- Record files go through the paperclip and Attachment modal.

**Fail examples:**
- An add/edit form has a full-width file picker for record attachments.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### File input (rare, not a record attachment)

**Tool record attachments** (files kept with a document, appointment, receipt, note, or similar) must use the paperclip and Attachment modal. See [Attachments](#attachments). Do not add a standalone “Choose file” field on add/edit forms for those files.

For rare file pickers that are not tied to a record, a custom styled input may replace the default browser control:

```tsx
<div className="relative">
  <input
    ref={fileInputRef}
    type="file"
    id="file-input-id"
    onChange={(e) => handleFileChange(e)}
    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    accept="image/*,.pdf"
  />
  <label
    htmlFor="file-input-id"
    className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
  >
    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <span className="text-slate-300">
      {selectedFile ? selectedFile.name : 'Select file'}
    </span>
  </label>
</div>
```

- Wrap the input and label in a `relative` container.
- Hide the native file input with `opacity-0` and position it absolutely.
- The visible clickable area is a `<label>` tied to the input with `htmlFor` and `id`.
- **Icon:** document icon for general files. For image-only uploads use path `M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z`.
- **Label layout:** `flex items-center gap-2`. Icon `w-5 h-5 text-slate-400`. Text `text-slate-300`. Hover `hover:bg-slate-800`.
- **Multiple files:** show a count, for example `` `${files.length} file(s) selected` `` or `` `${images.length} image(s) selected` ``. Placeholder when empty: “Select file”, “Select files”, or “Select images”.
- **Accessibility:** `htmlFor` / `id`, an `accept` attribute, and descriptive placeholder text.

The `accept="image/*,.pdf"` example is only this rare picker. Record attachments allow a wider set. See [Allowed files](#allowed-files).

---

## Record/List Patterns


#### UX-LST-001 — Icon-only bordered row actions

**Level:** MUST

**Requirement:** Active and history rows use icon-only, `border-2` actions on the right, not full text labels.

**Pass criteria:**
- Actions form a compact icon toolbar with emerald / secondary / danger tiers.

**Fail examples:**
- Rows use text buttons such as “Edit” / “Delete” as the default action chrome.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Record row actions (active and history)

For tool apps that list **active** records and an optional **History** (or inactive/archived) section, use **icon-only** actions on the right side of each row. Do not use full text labels. The result is a compact icon toolbar. This keeps dense lists scannable and matches Calendar Events and other tools that follow this standard.

#### Layout and placement

- **Row container:** `flex items-start justify-between` so the title and metadata sit on the **left** and actions on the **right**.
- **Action group (right):** `flex shrink-0 items-center gap-1.5 ml-4` — a tight horizontal group of square icon buttons, aligned to the top of the row when titles wrap.

#### UX-LST-002 — Slot-based action order

**Level:** MUST

**Requirement:** Row actions follow Attachments → View → Primary → Secondary/Lifecycle → Destructive. Missing slots are omitted, not reordered.

**Pass criteria:**
- Paperclip is first when attachments exist; View appears only when the tool has View.

**Fail examples:**
- Delete appears before Edit, or the paperclip is placed after Archive without a documented exception.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

- **Slot order (left to right).** Every tool uses this conceptual order. If a tool does not have an action, omit that slot. Do not reorder the remaining slots.

  1. **Attachments** — paperclip (`AttachmentButton`)
  2. **View** — only when the tool has a View action (for example Address Book)
  3. **Primary action** — Edit on active/editable rows; Reactivate / Restore on history rows that cannot be edited until restored
  4. **Secondary / lifecycle** — Archive, Move to history, or Deactivate
  5. **Destructive** — Delete, when supported

  In practice: Paperclip → View (when applicable) → Edit / Reactivate / Restore → Archive / Move to History → Delete.

- **Button element:** `type="button"`, Icon Style SVGs (`h-5 w-5`, `strokeWidth={2}`). Set **`aria-label`** and **`title`** to the same phrase. The button **hit area** is at least 44×44px on touch interfaces.

Per-tool notes in [Application-Specific UX Exceptions](#application-specific-ux-exceptions) say which slots exist (for example End of Life document rows omit Archive; Pet Care child rows may include Delete on the active row). They do not invent a different order.

#### Visual tiers — all actions use `border-2`

Every row icon is bordered (`border-2`) so controls read consistently on white or `slate-50` nested cards. Branch on **`resolvedTheme`**.

| Role | Meaning | Example actions |
|------|---------|-----------------|
| **Emerald (bordered)** | Primary constructive action on the row | Edit, Reactivate, Restore |
| **Secondary (slate, bordered)** | Move off the active list without deleting | Move to history, Archive, Deactivate |
| **Danger (red, bordered)** | Irreversible or destructive | Delete permanently (often only in History) |

#### Class recipes

**Emerald row icon** — Edit / Reactivate / Restore:

```tsx
const rowIconEmeraldClass =
  resolvedTheme === 'light'
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
```

**Secondary row icon** — Archive / Move to history:

```tsx
const rowIconSecondaryClass =
  resolvedTheme === 'light'
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
```

**Danger row icon** — Delete:

```tsx
const rowIconDangerClass =
  resolvedTheme === 'light'
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
```

**Reference:** `app/components/CalendarEventsTool.tsx` — `eventActionIconEditClass`, `eventActionIconSecondaryClass`, `eventActionIconDangerClass` on Active Events and History rows.

On add/edit forms, place the paperclip near the record title or the other header actions, not as a full-width file field in the form body.


#### UX-LST-003 — Card-based lists, not tables

**Level:** SHOULD

**Requirement:** Dense tool data uses card or row layouts rather than traditional HTML tables.

**Pass criteria:**
- Records are cards/rows with `space-y-4`.

**Fail examples:**
- A wide multi-column `<table>` is the only way to scan records on mobile.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Lists, tables, and status

- **Lists:** `space-y-4` between items.
- **Tables:** use card-based layouts rather than traditional tables, for a better mobile experience.
- **Status indicators:** color-coded badges or borders.
- **Dates:** see [Dates & Data Display](#dates--data-display).
- **On calendar chip:** see [Dashboard Calendar Integration](#dashboard-calendar-integration).

### Active list vs history

Selecting a category (or equivalent scope) on a calendar-pinnable tool shows the **active list**, not an add form. History stays collapsed below the active list.

Other tools use the same active-list-plus-optional-history structure when they have archive/history. Whether history rows stay editable is tool-specific. See [Delete, Archive & History Patterns](#delete-archive--history-patterns) and the per-tool attachment rules.

---

## Add & Edit Patterns

### Which add control to use

- **Simple single-list tools** use the filled **+ Add New [Item Name]** button, even when an individual record can optionally be pinned to the Dashboard Calendar. Subscription Tracker is the explicit example.
- **Category-scoped / calendar-oriented tools** use the small emerald plus beside the section title and the add modal. Calendar Events is the reference.
- Calendar pinning is an optional attribute of a record. It does not by itself require the section plus.


#### UX-ADD-001 — Filled Add New for single-list tools

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI

**Requirement:** Simple single-list tools use a filled “+ Add New [Item Name]” button, even when a record can optionally be calendar-pinned.

**Pass criteria:**
- Label is “+ Add New [Item]”; the control sits below tabs and above search.
- Subscription Tracker keeps this control.

**Fail examples:**
- A single-list tool uses only a section + , or the filled button is hidden while the list is empty with no other add path.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

`UX-BTN-005` is retired into this rule and `UX-ADD-002`. Score the matching add-control rule only.

### Filled “+ Add New [Item Name]” button

Use the [theme-aware primary button](#primary-button):

```tsx
<button
  onClick={startAddingRecord}
  className={
    resolvedTheme === 'light'
      ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
      : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900'
  }
>
  + Add New [Item Name]
</button>
```

- **Use for:** adding records in simple single-list tools (for example “+ Add New Subscription”, “+ Add New Record”).
- **Do not use** this filled button for category-scoped / calendar-oriented tools. Those tools use the green plus and popup below.
- **Styling:** theme-aware primary. `font-semibold` (not `font-medium`), padding `px-4 py-2.5`.
- **Text:** always prefix with “+” then “Add New [Item Name]”. Examples: “+ Add New Subscription”, “+ Add New Record”, “+ Add New Pet”.
- **Position:** below navigation tabs and above search/filter boxes. Container: `<div className="flex justify-start">`.
- **Visibility:** hide the button when the add form is open (`{!isAdding && (...)}`).
- **Empty state:** “No [items] found. Add one to get started!” plus this Add CTA.


#### UX-ADD-004 — Single-list inline add form

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI + Interaction

**Requirement:** Tools that use the simple single-list filled Add pattern hide that button while the inline add form is open, then return to the normal list after Save or Cancel.

Applies only to tools using the simple single-list pattern. N/A for category-scoped tools that add from a modal (`UX-ADD-002`).

**Pass criteria:**
- Filled `+ Add New [Item]` starts the add workflow.
- While the inline add form is open, the filled Add button is hidden.
- Successful save returns to the normal list state.
- Cancel returns to the list without creating a record.

**Fail examples:**
- The filled Add button stays visible beside the open form.
- Cancel creates a record, or Save leaves the form open with no return to the list.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.


#### UX-ADD-002 — Section plus and add modal

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI + Interaction

**Requirement:** Category-scoped / calendar-oriented tools add records with the small section + and a modal, not an inline add form on the list.

**Pass criteria:**
- Default view is the active list; + opens a modal; Save/Cancel close it.

**Fail examples:**
- The add form is permanently inline on the list, or the tool uses a filled Add New for a category-scoped list.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Green plus and add popup (category-scoped / calendar-oriented tools)

Standard for tools organized by category (or equivalent scope), typically with a section heading and an optional Dashboard Calendar pin.

**Reference:** Calendar Events (`app/components/CalendarEventsTool.tsx`). Pin helpers: `lib/calendarPins.ts` and `lib/calendarPinsServer.ts`. Table: `calendar_pins`.

Future tools that can appear on the Dashboard Calendar must use `calendar_pins`. Do not add a `show_on_dashboard` / `add_to_dashboard` column on the source table, and do not copy dates or titles into a calendar table.

#### Default view

Selecting a category (or equivalent scope) shows the **active list**, not an add form. Empty copy: “No [items] yet. Click + to add one.” Adapt the noun to the tool. History stays collapsed below the active list.

#### Green plus on the section title

Place a small emerald plus immediately to the right of the section heading (`Anniversary Calendar Events`, `Upcoming Appointments`, and similar). This is the same control used next to End of Life Planner subsection titles.

```tsx
<div className="flex items-center gap-2 mb-4">
  <h3 className={subtitleClass}>{selectedCategory.name} Calendar Events</h3>
  <button
    type="button"
    onClick={openAddModal}
    className={
      isLight
        ? 'inline-flex items-center justify-center rounded-md border-2 border-emerald-600 min-h-11 min-w-11 p-0.5 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800'
        : 'inline-flex items-center justify-center rounded-md border-2 border-emerald-400 min-h-11 min-w-11 p-0.5 text-emerald-400 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300'
    }
    aria-label="Add calendar event"
    title="Add calendar event"
  >
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  </button>
</div>
```

- This is **not** the large square “+” used to add a category / header card.
- This is **not** the filled “+ Add New [Item]” primary button.
- Hide or disable the plus only if adding is impossible in the current state.
- `aria-label` and `title` name the record (“Add calendar event”, or the tool’s equivalent).

#### Add popup

Clicking the plus opens a modal. The user fills the record there, then Save or Cancel. After a successful save, close the modal, reset the form, and return to the active list.

Use the [base modal](#base-modal) with the **`max-w-2xl`** size (or **`max-w-lg`** if the form is short) and `max-h-[90vh] overflow-y-auto`.

- Title: `Add [Category] Event` (or the tool’s record name). Close X in the top-right with `aria-label="Close"` and `title="Close"`.
- Escape closes the add modal unless a stacked picker (holiday list, attachments) is open. Stack those pickers at **`z-[60]`**.
- Primary **Add …** and secondary **Cancel**. Do not keep an inline add form on the list screen.


#### UX-ADD-003 — Calendar pin switch placement and default

**Level:** MUST

**Requirement:** When present, “Add to dashboard calendar” is the last optional control, default off, and must not turn on from prefills.

**Pass criteria:**
- The switch sits after Notes and before save; new/prefilled records stay off.

**Fail examples:**
- The switch defaults on, or a holiday/template picker turns it on automatically.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

#### Add to dashboard calendar switch

Last optional control in the add and edit forms, after Notes and before the save buttons. **Default off.** Creating or prefilling a record (including holiday / template pickers) must not turn it on.

Full switch markup is in [Dashboard Calendar Integration](#dashboard-calendar-integration).

### Header / category add and edit

Adding a header card uses the square plus and an inline form inside the selector card. Editing a header card is inline from the three-dot menu. See [Tool Header / Category Selector Patterns](#tool-header--category-selector-patterns).

### Edit records

The source does not define one global “edit always opens a modal” rule.

- Calendar-pinnable add happens in the add popup. Edit forms include the same calendar switch.
- Header/category edit is inline on the card.
- Per-tool surfaces (Edit Event, Edit expense, View modal, and similar) are specified under [Application-Specific UX Exceptions](#application-specific-ux-exceptions) where they change attachments or history.

---

## Delete, Archive & History Patterns


#### UX-DEL-001 — No browser dialogs

**Level:** MUST

**Requirement:** Tool and dashboard UI never call `alert()`, `confirm()`, or `prompt()`.

**Pass criteria:**
- Errors, success, and confirms stay on the page.

**Fail examples:**
- A workflow opens a native browser dialog.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Never use browser dialogs

Never use the browser’s `alert()`, `confirm()`, or `prompt()`. Those dialogs sit outside the app, block QA, and cannot be styled. Every user-facing message stays on the page.


#### UX-DEL-002 — Reversible in-app confirmation

**Level:** MUST

**Requirement:** Reversible actions use an in-app modal with a one-sentence question, primary confirm, and Cancel. Escape and Cancel do not perform the action.

**Pass criteria:**
- Archive / Create Shopping List-style confirms stay in-app.

**Fail examples:**
- A reversible action runs immediately with no confirm, or uses `window.confirm()`.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Reversible confirmation

**Non-destructive / reversible:** an in-app modal with a title, a one-sentence question, a primary confirm button, and Cancel. Escape and Cancel dismiss without doing the work. The confirm button is the user gesture that starts the action (needed for `keepalive` fetches).

Examples: Meal Planner “Create Shopping List”, End of Life Planner “Archive Plan”.


#### UX-DEL-003 — Typed-delete for permanent destruction

**Level:** MUST

**Audit scope:** Modal

**Verification:** UI + Interaction

**Requirement:** Permanent deletes require typing “delete” (case-insensitive) before the confirm button enables. The disabled state must be both functional and visually obvious.

**Pass criteria:**
- Warning states the action cannot be undone.
- The Delete button cannot activate until the confirmation text matches.
- The disabled button has a clear disabled visual state.
- Use the documented disabled treatment: reduced opacity and `not-allowed` cursor (`disabled:opacity-50 disabled:cursor-not-allowed`).

**Fail examples:**
- A permanent delete uses a single-click confirm or a browser dialog.
- A solid red button looks enabled while it is functionally disabled. That must not receive a full Pass.

If functionality can be tested but visual disabled styling is unclear, document the two observations separately (functional Pass/Fail; visual Pass/Fail or Not Exercised).

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Permanent / destructive confirmation (typed delete)

Typed-delete modal. Warning box (“This action cannot be undone”), instruction to type **delete**, confirm disabled until the field matches `delete` (case-insensitive).

Examples: Profile “Delete Account”, Admin Tools “Delete Tool”, and existing record/plan deletes.

Header/category delete uses the full modal below.

### Header / category delete modal

- **Menu option:** “Delete” with a trash icon, styled in red: `text-red-400 hover:bg-slate-700`
- **Confirmation modal:** required for all delete operations
  - **Overlay:** use the [base modal](#base-modal) overlay (`bg-black/60 backdrop-blur-sm`) at `z-50`, or `z-[70]` if it stacks on another modal
  - **Container:**
    - **Dark:** `rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4`
    - **Light:** `rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl`
  - **Title:**
    - **Dark:** `text-xl font-semibold text-slate-50 mb-2`
    - **Light:** `text-xl font-semibold text-slate-900 mb-2`
  - **Body copy:**
    - **Dark:** `text-slate-300` (or `text-slate-400 text-sm` for helper copy)
    - **Light:** `text-slate-700` (or `text-slate-600 text-sm` for helper copy)
  - **Confirmation input:**
    - **Dark:** `w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50`
    - **Light:** `w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50`
  - **Warning box:** `rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4`
    - **Light:** `rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4`
    - **Warning text:** dark `text-red-300 font-semibold` with a warning emoji; light `text-red-700 font-semibold` with a warning emoji
    - **Details:** dark `text-red-200 text-sm`; light `text-red-600 text-sm` explaining what will be deleted
  - **Confirmation input:** placeholder “Type 'delete' to confirm”. Standard input with a red focus border. The delete button stays disabled until the user types “delete” (case-insensitive). The header section also says “exactly”.
  - **Delete button:** `bg-red-600 text-white hover:bg-red-700`, with `disabled:opacity-50 disabled:cursor-not-allowed` until the text matches
  - **Cancel button:** standard secondary button styling
- **Keyboard:** Escape closes the modal

### Archive / move to history

- Active rows use the secondary archive icon (Move to history / Archive / Deactivate).
- History rows use emerald Reactivate / Restore, then danger Delete when delete is supported.
- **Calendar pin:** inactivate / archive keeps the pin so reactivate can restore dashboard presence. The dashboard feed must also require the source row to be active. Delete the source row or its category: delete the matching pins.


#### UX-DEL-004 — History attachment editability follows the record

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI + Interaction (History fixture)

**Requirement:** Attachments stay editable when the History/inactive record can still be edited. If the record is read-only until Reactivate/Restore, attachments are View/Download only. Completion-proof files stay read-only after complete.

This rule covers History editability. Do not also score the same behavior under `UX-ATT-007`. Use `UX-ATT-007` for which stores and surfaces exist.

**Pass criteria:**
- Calendar Events history paperclip is read-only; Shopping List history stays editable while Edit exists.

**Fail examples:**
- A read-only history row still allows add/remove, or an editable History paperclip is forced read-only.

**Not Exercised:**
- No History / inactive record was available, or add/remove on History was not attempted.
- History API rejection (add/remove on a read-only inactive record) is code/fixture-dependent. Do not Fail it from a screenshot.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### History and attachments

Whether history attachments are editable follows the **record**, not the word “History”.

- If the History / inactive record **can still be edited**, attachments stay editable.
- If the record is **read-only until Reactivate / Restore**, attachments are View/Download only (`AttachmentModal` `readOnly`). The API must reject add/remove until the record is restored.
- **Completion-proof** attachments (Cleaning Schedule and Home Maintenance completion files) stay read-only after the occurrence is completed, even if other files on that tool stay editable.

The paperclip and modal stay the same in all three cases. Password prompts still apply when the record is protected.


#### UX-FBK-002 — In-modal messages stay in the modal

**Level:** MUST

**Audit scope:** Modal

**Verification:** UI + Interaction

**Requirement:** Messages that already belong in an open modal stay there and do not also fire a page notice or browser dialog.

Keep this rule separate from page-level `useAppNotice` (`UX-FBK-001`).

**Pass criteria:**
- Download success is “File downloaded.” inside the Attachment modal.

**Fail examples:**
- A modal action also pops a toast and a browser alert.
- A required in-modal success line is missing after a successful download.

**Not Exercised:**
- The success line disappeared too quickly or the download was not performed.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### In-modal messages

Messages that already belong inside a modal stay in that modal. Do not also fire a notice or a browser dialog.

- Attachment download success: green line in the Attachment modal (“File downloaded.”).
- Wrong attachment password: error inside the password overlay; leave the overlay open so the user can retry.

---

## Modals & Dialogs


#### UX-MOD-001 — Modal base chrome

**Level:** MUST

**Requirement:** Dialogs use the shared overlay (`bg-black/60 backdrop-blur-sm`) and theme-aware card, with width by job.

**Pass criteria:**
- Light card: white / slate-200 border; dark card: slate-900 / slate-800 border.
- Confirm/Export use `max-w-md`; standard `max-w-lg`; large forms `max-w-2xl`.

**Fail examples:**
- Export or delete uses a one-off `bg-slate-800` / `bg-black/50` chrome.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Base modal

One modal system. Size is the only variant.

- **Overlay:** `fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4`
- **Card (theme-aware):**
  - Light: `rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl`
  - Dark: `rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl`
- **Width variants:**
  - `max-w-md` — confirmations, typed-delete, Export Options
  - `max-w-lg` — standard
  - `max-w-2xl` — larger add/edit forms (use `max-h-[90vh] overflow-y-auto`)
- **Close button:** top-right icon. Always include **`aria-label`** and **`title`** with the same text (for example `Close` or `Close modal`). Hit area at least 44×44px on touch.
- **Keyboard:** Escape closes the modal (implement with `useEffect`) unless a stacked child is open.
- **Export:** uses this same modal (`max-w-md`). Do not give Export its own overlay or `bg-slate-800` card.

### Size by job

| Job | Width |
|-----|-------|
| Typed delete, reversible confirm, Export Options | `max-w-md` |
| Standard modal | `max-w-lg` |
| Larger add/edit forms | `max-w-2xl` |


#### UX-MOD-002 — Modal stacking behavior and z-index

**Level:** MUST

**Audit scope:** Modal

**Verification:** UI + Interaction, plus Code for tokens

**Requirement:** The active child dialog appears above its parent. When source is available, stacked dialogs use `z-50` (normal), `z-[60]` (child), and `z-[70]` (password / destructive over a modal).

Score the two criteria separately. Do not Fail the code-specific criterion from a screenshot alone.

**UI + Interaction (UX-MOD-002A — stacking behavior):**
- Pass: the child modal is visibly above the parent; password / destructive confirmation appears above the Attachment modal; the parent does not cover the active child.
- Fail: the password overlay opens behind the Attachment modal, or the parent covers the active child.

**Code (UX-MOD-002B — z-index implementation):**
- Pass: normal modal uses `z-50`; child uses `z-[60]`; security / destructive overlay uses `z-[70]`.
- Fail: stacking depends only on render order at `z-50`, or tokens do not match.
- Not Exercised: source is not available. A visual stacking Pass is not a token Pass.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Stacking (explicit z-index)

Do not rely on DOM / render order.

| Layer | z-index | Use |
|-------|---------|-----|
| Normal modal | `z-50` | Add/edit, Attachment modal, Export, first-level dialogs |
| Child / stacked modal | `z-[60]` | Attachment modal opened over another modal, holiday/template pickers |
| Security / password / destructive confirm over a modal | `z-[70]` | Password, forgot-password, typed-delete or confirm that opens from attachments |

Event Budget Planner, Shopping List, Goals Tracking, and Address Book still render `AttachmentModal` after the parent dialog, but the Attachment overlay must use **`z-[60]`** when it stacks on another modal.

### Confirmations

Use an in-app modal, not `window.confirm()`. Rules for reversible vs typed-delete confirms are in [Delete, Archive & History Patterns](#delete-archive--history-patterns).

### Export options modal

Specified in full under [Print & Export Patterns](#print--export-patterns).


#### UX-MOD-003 — Escape and close control

**Level:** MUST

**Requirement:** Modals close with Escape unless a stacked child is open, and the close icon has matching `aria-label` and `title`.

**Pass criteria:**
- Escape on Attachment closes preview first, then the modal.

**Fail examples:**
- Escape does nothing, or the close icon has no accessible name.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Keyboard

- Escape closes modals (also implemented in ToolModal).
- Escape on an add modal does not close it while a stacked picker is open.
- Escape on the Attachment modal closes an open image preview first, then the modal.
- Enter submits forms (default browser behavior).

---

## Tabs & Navigation


#### UX-NAV-001 — Theme-aware tabs

**Level:** MUST

**Requirement:** Dashboard and in-tool tabs use the same light/dark active and inactive classes.

**Pass criteria:**
- Light active: `border-emerald-600 text-emerald-900 font-semibold`.
- Dark active: `border-emerald-500 text-emerald-300`.

**Fail examples:**
- An in-tool tab uses `text-emerald-300` as the active color in light mode.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Tab navigation (dashboard and every tool)

One tab system. Dashboard shell tabs and in-tool tabs use the same active/inactive classes.

- **Container:** `border-b border-slate-800` with `flex gap-2`
- **Tab:** `px-4 py-2 text-sm font-medium transition-colors`
- **Export tab naming:** a tool is **not** required to have an Export tab. When a dedicated cross-category export tab exists, name it **“Export”** (not “Reports” or other variations). Score `UX-EXP-001`. Header-icon or modal-only export makes the tab-naming rule N/A.

#### UX-NAV-002 — Export tab naming (retired)

**Level:** MUST — score `UX-EXP-001` instead.

This ID is kept so older reports still resolve. It is not a separate checklist row.

A tool is not required to have an Export tab. If a dedicated cross-category export tab exists, it must be named **Export**. If the tool exports through a documented header icon or popup instead of a tab, this rule is N/A. Do not Fail a tool solely because it exports through an icon or popup.

Branch on `useTheme().resolvedTheme`.

| Mode | Active tab | Inactive tab |
|------|------------|--------------|
| **Light** | `border-b-2 border-emerald-600 text-emerald-900 font-semibold` | `text-slate-600 hover:text-slate-900` |
| **Dark** | `border-b-2 border-emerald-500 text-emerald-300` | `text-slate-400 hover:text-slate-300` |

Do not use `text-emerald-300` for an active tab in light mode. It is too faint on the light canvas.

### Dashboard primary tabs

**Reference:** `app/dashboard/page.tsx` (main tab row: Dashboard / Calendar / Tool Box / Store; optional sub-tab row for open tools).

Active and inactive labels use the **same** classes as in-tool tabs above (`tabActiveClass` / `tabInactiveClass`).


#### UX-NAV-005 — Dashboard tab-strip background

**Level:** MUST

**Audit scope:** Dashboard / Shell. Do not score during a Tool audit.

**Verification:** UI + Code

**Requirement:** Dashboard tab strips use `bg-slate-950` so light mode remaps to the page canvas, not a white band.

**Pass criteria:**
- The tab row matches `#e9edf1` in light mode.

**Fail examples:**
- The tab row uses `bg-slate-900/50` and becomes a brighter white band than the canvas.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

#### Tab strip background

- Use **`bg-slate-950`** on the tab row container(s) so light mode picks up the same remap as the page: **`#e9edf1`**.
- Avoid `bg-slate-900/30`, `bg-slate-900/50`, and similar on these rows. The `[class*='bg-slate-900']` rule in `globals.css` forces **`#ffffff`**, which makes the menu band brighter than the main canvas.
- The top **header** (logo plus Admin / user menus) may stay on **`bg-slate-900/50`**, which becomes white in light mode for separation. The tab **strip** matches the body gray.

### Breadcrumbs

Breadcrumbs are not currently used. If needed, use `text-sm text-slate-400` with `hover:text-emerald-300` links.

### Menu items (dark / general)

`text-slate-300 hover:bg-slate-700` with `px-4 py-2`.

In light mode, header account, admin, and help menus use the dedicated classes below.


#### UX-NAV-003 — Header dropdown light/dark panels

**Level:** MUST

**Requirement:** Header account, admin, and help menus use explicit light (white panel) and dark (slate panel) classes via `resolvedTheme`.

**Pass criteria:**
- Light menus are white with slate-200 border and readable slate text.

**Fail examples:**
- A header menu in light mode is a remapped muddy `bg-slate-800` panel.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Header dropdown menus — light mode

Header dropdowns (account, admin, help) use explicit light-mode utility sets driven by `useTheme().resolvedTheme === 'light'` in the component. See `UserMenu`, `AdminMenu`, and `HelpMenu` under `app/components/`.

**Rationale:** `globals.css` remaps dark-theme slate classes on light pages (for example `bg-slate-800` becomes a flat gray-blue). Dropdown panels built only from those classes look muddy against the light gray canvas (`#e9edf1`) or white surfaces. Branching on `resolvedTheme` matches standard light UI (white panel, subtle ring/shadow, readable gray text).

#### Trigger button

| Mode | Classes |
|------|---------|
| **Light** | `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900` |
| **Dark** | `… text-slate-300 … hover:bg-slate-800 hover:text-slate-100` |

**Help menu** keeps an emerald hover accent in light mode: add `hover:text-emerald-700` (dark keeps `hover:text-emerald-300` with `hover:bg-slate-800/50`).

#### Dropdown panel

| Mode | Classes |
|------|---------|
| **Light** | `absolute right-0 z-50 mt-2 rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5` plus width (`w-48` or `w-56`) |
| **Dark** | `absolute right-0 z-50 mt-2 rounded-lg border border-slate-700 bg-slate-800 shadow-lg` plus width |

#### Menu rows (links / actions)

| Mode | Classes |
|------|---------|
| **Light** | `flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100` |
| **Dark** | `… text-slate-300 … hover:bg-slate-700` |

Use `shrink-0` on row icons where layout needs it. Use `type="button"` on interactive controls inside the menu.

#### Dividers

| Mode | Classes |
|------|---------|
| **Light** | `my-1 border-t border-slate-200` |
| **Dark** | `my-1 border-t border-slate-700` |

#### Theme segment control (UserMenu only)

| Part | Light mode | Dark mode |
|------|------------|-----------|
| **“Theme” label** | `mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500` | `… text-slate-400` |
| **Track** | `grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1` | `grid grid-cols-2 gap-1 rounded-lg bg-slate-900/70 p-1` |
| **Selected** | `rounded-md px-2 py-1 text-xs font-medium bg-white text-slate-900 shadow-sm ring-1 ring-slate-200` | `… bg-emerald-500 text-slate-950` |
| **Unselected** | `… text-slate-600 hover:bg-slate-200/80` | `… text-slate-300 hover:bg-slate-700` |

#### Sign out row (UserMenu only)

| Mode | Classes |
|------|---------|
| **Light** | `flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50` |
| **Dark** | `… text-red-400 … hover:bg-slate-700` |

#### Dropdown checklist

- Prefer **`resolvedTheme`** (not the stored preference alone) so the visible UI matches the applied document theme.
- Do not rely only on global slate remaps for popover surfaces in light mode. Use the explicit white panel, border, and ring pattern above.
- New header-style dropdowns should follow the same light/dark split.
- Category / header **three-dot menus** use this same explicit light/dark panel. Do not leave them on remapped `bg-slate-800` in light mode.

---


#### UX-LAY-003 — Tool header and category selector

**Level:** MUST

**Requirement:** Category/header tools use the documented title, one-line description, and selector card.

**Pass criteria:**
- Title is `text-2xl font-semibold`; description is one muted line.
- Selector lives in one standard card with entity cards plus a square +.

**Fail examples:**
- The selector is a plain `<select>` with no header cards, or the add-header form sits outside the selector card.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Tool Header / Category Selector Patterns

For tools that use header/category records (for example Pet Care Schedule, Repair History, Healthcare Appts & History), use this layout so those tools look and behave the same.

### Tool header layout

1. **Title and description**
   - **Title:** `text-2xl font-semibold text-slate-50 mb-2` (for example “Pet Care Schedule”, “Healthcare Appts & History”)
   - **Description:** `text-slate-400 text-sm` — one line explaining what the tool does

2. **Selector container**
   - **Wrapper:** one rounded card for the whole selector area: `rounded-2xl border border-slate-800 bg-slate-900/70 p-4`
   - **Label:** prompt above the cards, for example “Select your Pet” or “Select family member”:

   ```tsx
   <label className="block text-sm font-medium text-slate-300 mb-3">Select your [Entity]</label>
   ```

3. **Cards and Add button row**
   - **Row:** `flex items-center gap-3 flex-wrap`
   - **Header cards:** selectable cards (see below). Use `min-w-[120px]`.
   - **Add button:** square-ish “+” only, same height as the cards:

   ```tsx
   className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]"
   ```

   - Icon: plus SVG `h-6 w-6`, path `M12 4v16m8-8H4`
   - **Title:** `title="Add New [Entity]"`

4. **Add-new form (inline)**
   - Show the form **inside the same selector container**, not below it.
   - Row: `flex items-end gap-2 flex-wrap`
   - Include: name input (`flex-1 min-w-[200px]`), color picker (optional), Create button (primary), Cancel button (secondary).
   - Toggle between “cards + Add button” and “add-new form” with one boolean (for example `isCreatingNewHeader`). Do not show both at once.

**Reference:** Pet Care Schedule (“Select your Pet”) and Healthcare Appts & History (“Select family member”).

### Header card display

- **Card styling:** colored borders and backgrounds from `card_color`
  - Border: `borderColor: header.card_color || '#10b981'`
  - Background (selected): `${header.card_color}15` (15% opacity)
  - Background (unselected): `${header.card_color}08` (8% opacity)
  - Text color: `color: header.card_color || '#10b981'`
- **Selected state:** add `shadow-lg`
- **Click:** clicking the card selects it and loads its data


#### UX-NAV-004 — Category three-dot menus

**Level:** MUST

**Requirement:** Category/header three-dot menus use the same explicit light/dark panel as header dropdowns.

**Pass criteria:**
- Light panel is white with slate border; items are dark readable text.

**Fail examples:**
- The menu stays on remapped `bg-slate-800` in light mode.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Three-dot menu

Use the same **explicit light/dark panel** as [header dropdown menus](#header-dropdown-menus--light-mode). Do not rely on remapped `bg-slate-800` in light mode.

- **Menu button:** absolutely positioned in the top-right of the card. Hit area at least 44×44px on touch (`min-h-11 min-w-11`). Include `aria-label` and `title` (for example “Header menu”).
- **Menu icon:** vertical ellipsis (three dots)
- **Menu popup:**
  - Position: `absolute top-10 right-0 z-50`
  - **Light panel:** `rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 min-w-[160px] py-1`
  - **Dark panel:** `rounded-lg border border-slate-700 bg-slate-800 shadow-lg min-w-[160px] py-1`
  - **Light items:** `w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2`
  - **Dark items:** `w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2`

### Edit functionality

- **Menu option:** “Edit” with a pencil icon
- **Edit mode:** inline editing replaces the card display
  - Container: `px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]`
  - Border color: use `editingHeaderColor` for border and background
  - Name input: `flex-1 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm`
  - Color picker: `h-6 w-12 rounded border border-slate-600 cursor-pointer`
  - Actions: Save and Cancel
- **Save button:** use the [tight inline primary](#tight-inline-primary-save-on-small-category--chip-rows) recipe (light `emerald-600` + white text; dark `emerald-500` + `slate-950`).
- **Cancel button:** use the [secondary button](#secondary-button-including-cancel) pattern, compact (`text-xs`).

### Delete functionality

See [Header / category delete modal](#header--category-delete-modal).

### Implementation requirements

All header/category records support:

- Custom `card_color` (default `#10b981`)
- Edit name and color together in one form
- Delete with a confirmation modal that requires “delete” to be typed

State:

- `editingHeaderId` — which header is being edited
- `editingHeaderName` — current name
- `editingHeaderColor` — current color
- `deleteConfirmHeaderId` — which deletion is being confirmed
- `deleteConfirmText` — confirmation text
- `menuOpenHeaderId` — which menu is open (for click-outside-to-close)

### Click outside to close

When the menu is open, add an overlay `fixed inset-0 z-40` that closes the menu on click.

---


#### UX-SRH-001 — Standard search and filter controls

**Level:** SHOULD

**Audit scope:** Tool

**Verification:** UI

**Requirement:** Search uses standard input chrome. Filters use select/dropdown chrome. Additional structured filters may show as chips. A chip is **not** required for the search query itself.

**Pass criteria:**
- Search and filter sit above the list and look like other form controls.
- A text query remaining visible in the search input is sufficient indication that search is active.

**Fail examples:**
- Search is an unstyled native control with no relationship to the standard field chrome.

Do not Fail a tool just because the active search text is shown in the search input instead of a chip. Chips/badges are appropriate for additional structured filters where the interface uses them.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Search & Filtering

- **Search input:** standard input styling, with a search icon if needed
- **Filter dropdown:** select styling or a custom dropdown
- **Active search query:** the text remaining in the search input is enough. Do not require a chip for the query itself.
- **Structured filters:** show selected additional filters with badges or chips where the interface uses them

The source does not specify a shared search-icon SVG, debounce behavior, or empty-results copy beyond the general empty state.

Subscription Tracker: do not add a “Has attachments” filter yet. See that tool’s exception.

---

## Empty & Loading States


#### UX-EMP-001 — Empty-state copy matches tool type

**Level:** MUST

**Audit scope:** Tool

**Verification:** Fixture

**Requirement:** Empty lists use the copy and CTA that match the tool type.

**Pass criteria:**
- Single-list: “No [items] found. Add one to get started!” plus filled Add.
- Category-scoped: “No [items] yet. Click + to add one.” plus the section +.

**Fail examples:**
- A category-scoped tool shows the filled-Add empty sentence, or vice versa.

**Not Exercised:**
- No empty list or empty category was available.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Empty states

Two intentional patterns. Both use `text-slate-400 text-center py-8`.

| Tool type | Copy | Call to action |
|-----------|------|----------------|
| **Simple single-list / non-category tools** | “No [items] found. Add one to get started!” | The filled **+ Add New [Item Name]** button |
| **Category-scoped / calendar-oriented tools** | “No [items] yet. Click + to add one.” | The section-title **+** (no filled Add button) |

Adapt the noun (`subscriptions`, `calendar events`, `pets`, and so on). Do not mix the two treatments.

Print reports with no items use “No items.” inside the printable block.

Attachment modal empty state: “No attachments yet.” plus the drop zone.


#### UX-EMP-002 — Loading labels on in-flight actions (retired)

**Level:** MUST — score `UX-BTN-004` instead.

This ID is kept so older reports still resolve. It is not a separate checklist row.

In-flight buttons use Processing/Saving/Loading text and `disabled:opacity-50`. If no slow request occurred, mark `UX-BTN-004` Not Exercised.

### Loading states

- **Button loading:** show “Processing...”, “Saving...”, or “Loading...”
- **Disabled state:** `disabled:opacity-50 disabled:cursor-not-allowed`
- **Loading indicator:** consider a spinner or skeleton screens for longer operations
- **ARIA:** `aria-busy="true"` on loading elements
- **Attachments:** set `busy` on `AttachmentModal` while an upload, replace, or remove is in flight

---

## Notifications, Errors & Success Feedback


#### UX-FBK-001 — In-app notices for page-level feedback

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI + Interaction (fixture-dependent when success is required)

**Requirement:** Page-level errors and success use `useAppNotice` (`showError` / `showSuccess`), not browser dialogs.

Keep this rule separate from in-modal feedback (`UX-FBK-002`).

**Pass criteria:**
- Save failures and required create-success messages appear as in-app notices.
- The auditor actively observed the action result.

**Fail examples:**
- A failed save calls `alert()`.
- The action succeeds and no required success notice appears.

**Not Exercised:**
- The success state disappeared too quickly or was not observed because of test limitations. Do not Pass based only on the fact that the data changed.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### In-app notices

**Errors, validation, and success (not a confirm):** use the shared in-app notice (`AppNoticeProvider` in `app/layout.tsx`, `useAppNotice()` → `showError` / `showSuccess`).

Examples: save failed, grocery lines have no names, Shopping List created.

### Placement and color

- **Success:** green border/background with emerald text
- **Error:** red border/background with red text
- **Info:** blue or slate styling
- **Position:** display near the action that triggered the message (form top, button area, and similar)
- **Global toasts:** `useAppNotice` (`showError` / `showSuccess`) for page-level feedback
- **Confirms:** in-app modals. See [Delete, Archive & History Patterns](#delete-archive--history-patterns).

Form-level validation classes are in [Form validation messages](#form-validation-messages).

### What not to do

- Do not call `alert()`, `confirm()`, or `prompt()` anywhere in tool or dashboard UI.
- Do not use a browser dialog for download success, wrong password, validation, or “are you sure?”
- Do not open a confirm overlay behind the Attachment modal (use `z-[70]` or higher when it stacks on attachments).
- Do not also fire a notice for a message that already lives inside an open modal.

### Storage limit message

If an add would exceed the storage limit, reject it with a clear message (“would exceed your storage limit”) and do not upload.

---

## Attachments

Every tool that stores files with a record must use the same paperclip + modal experience. Users should not have to relearn how to add, view, download, or remove files when they move from Important Documents to Healthcare, Repair History, or any later tool.

**Reference implementation:** Important Documents (`app/components/ImportantDocumentsTool.tsx`) using `AttachmentButton` and `AttachmentModal`. Shared helpers live in `lib/attachments.ts`. Shared quota logic lives in `lib/user-storage.ts`.


#### UX-ATT-001 — Paperclip and Attachment modal only

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI

**Requirement:** A paperclip is the only attachment entry point. Clicking it opens `AttachmentModal` for add, view, download, replace, and remove.

This rule covers the shared paperclip + modal pattern. Do not also score paperclip placement against `UX-ATT-007`. Use `UX-ATT-007` only for the tool’s documented stores and forbidden surfaces.

**Pass criteria:**
- No extra download/view/choose-file icon sits beside the paperclip.

**Fail examples:**
- A card has a separate Download icon next to the paperclip.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions. Use `UX-ATT-007` for tool-specific surfaces that must not have a paperclip.

### Product rules

- **One entry point.** A paperclip icon is the only control for attachments on add forms, edit forms, active cards, and history cards. Do not put a download, view, or “choose file” icon next to the paperclip.
- **One modal.** Clicking the paperclip opens `AttachmentModal`. Add, view, download, replace, and remove all happen there.
- **Train the habit.** If a record has a file, the paperclip shows a count badge. Users learn: paperclip = files.
- **Same look, same limits.** Allowed types, 10 MB per file, drop zone, and storage footer stay the same across tools. Only `maxFiles` and password rules vary by tool.

### Shared components

Use these. Do not invent a per-tool upload UI.

| Piece | File | Role |
|-------|------|------|
| Paperclip trigger | `app/components/AttachmentButton.tsx` | Icon-only button; emerald + count badge when files exist |
| Attachment modal | `app/components/AttachmentModal.tsx` | List files, preview, add/replace, download, remove, storage footer |
| File helpers | `lib/attachments.ts` | Allowed types, 10 MB cap, `filterIncomingAttachments`, preview helpers |
| Quota helpers | `lib/user-storage.ts` | Plan limits, pre-upload check, recount after add/delete |

`AttachmentButton` props: `count`, `onClick`, optional `disabled` and `ariaLabel`. Default labels: “Add attachments” or “Attachments, N file(s)”.

`AttachmentModal` props:

- `open`, `onClose`, `title` (shown as `Attachments · {title}`)
- `files` (`AttachmentItem[]`), `onAdd`, `onRemove`
- `onView` / `onDownload` when the tool owns those actions (signed URLs, password, inline vs attachment). `onDownload` must return `true` only after a file was actually saved, so the modal can show the in-modal download notice. Return `false` (or throw) if a password prompt opened or the download failed.
- `previewItem` to open an in-modal image preview after a successful View
- `maxFiles` — omit for unlimited; set `1` for a single-file record (Important Documents)
- `busy` while an upload, replace, or remove is in flight
- `readOnly` — hide add/replace/remove when the **record** is not editable (or for completion-proof files after complete). View and Download stay available. Do not set `readOnly` only because the section is titled History.

### Paperclip placement

Put `AttachmentButton` in the record action toolbar. It always occupies the first slot. Remaining actions follow [Record row actions](#record-row-actions):

Paperclip → View (when applicable) → Edit / Reactivate / Restore → Archive / Move to History → Delete.

On add/edit forms, place the paperclip near the record title or the other header actions, not as a full-width file field in the form body.

### Modal behavior

- **Empty state:** “No attachments yet.” plus the drop zone.
- **List:** file name, size, and “queued until save” for files chosen before the parent record is created.
- **Actions per file:** View (images and PDFs only), Download (saved files only), Remove. Word, Excel, and any other non-image/non-PDF type show Download only. Do not show View, and do not pop an `alert` that preview is unavailable.
- **Download confirmation:** stay inside the Attachment modal. After a successful download, show a green in-modal line: “File downloaded.” Never use `alert()`, `confirm()`, or another browser dialog for download success. Chrome’s download chip is the browser’s own UI and cannot be suppressed.
- **Add / replace:** dashed drop zone plus Browse. Copy: “Images, PDFs, Word, and Excel up to 10 MB each.”
- **Single-file tools (`maxFiles={1}`):** drop/browse replaces the current file. Button label becomes “Replace file”.
- **Footer:** “Storage used: {used} of {limit}” from `GET /api/account/storage`.
- **Escape:** closes an open image preview first, then the modal.
- **Overlay:** `z-50` when it is the only modal; **`z-[60]`** when it stacks on another modal. Password and destructive confirms use `z-[70]`.


#### UX-ATT-002 — Allowed types and 10 MB limit

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI + Fixture

**Requirement:** Record attachments allow the documented image/PDF/Word/Excel types at 10 MB each.

**Pass criteria:**
- Drop-zone copy matches; oversize/disallowed files are rejected.

**Fail examples:**
- The UI only allows images/PDFs, or accepts an unlimited size.

**Not Exercised:**
- An upload of a rejected type or oversize file was not attempted. Drop-zone copy can still be scored from UI.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Allowed files

Shared constants in `lib/attachments.ts`:

- **Max size:** 10 MB per file (`ATTACHMENT_MAX_FILE_BYTES`)
- **Types:** JPEG, PNG, GIF, WebP, HEIC/HEIF, BMP, TIFF, PDF, Word (`.doc` / `.docx`), Excel (`.xls` / `.xlsx`)
- **Validation:** always run `filterIncomingAttachments` on the client (count, type, size, remaining quota). The API must repeat size, type, and quota checks.

Word and Excel can be stored and downloaded. They are not previewable in the app.

This list is authoritative for **record attachments**. The older storage-bucket language that allowed only `image/*` and `application/pdf` on a public bucket is **legacy**. Record files use **private** storage and an authenticated View/Download route. The rare non-record file picker may keep a narrower `accept` (for example `image/*,.pdf`).


#### UX-ATT-003 — View versus download

**Level:** MUST

**Audit scope:** Tool

**Verification:** Fixture

**Requirement:** Images preview in the modal; PDFs open inline; Word/Excel hide View and download only.

**Pass criteria:**
- View is not a disguised download. Saved files use the authenticated route.

**Fail examples:**
- Office files show View, or View forces a download of an image.

**Not Exercised:**
- No existing image, PDF, or Office file was available for that path.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### View vs download

Do not treat View as a disguised download.

| Kind | View | Download |
|------|------|----------|
| Image | Show inside the Attachment modal (`previewItem` or local object URL) | Force a file download |
| PDF | Open in a new tab with `Content-Disposition: inline` (download route `inline=1`) | Force a file download (`Content-Disposition: attachment`) |
| Word / Excel | Hide View | Force a file download |

Pending (unsaved) files may preview from a local `URL.createObjectURL`. Saved files must go through the tool’s authenticated download/view route. Never put a raw public storage URL in the browser.

A successful Download must not pop a site `alert` (“Document downloaded successfully.” or similar). The Attachment modal owns that confirmation (“File downloaded.”) when `onDownload` returns `true`.


#### UX-ATT-004 — Queue until save versus persist immediately

**Level:** MUST

**Audit scope:** Tool

**Verification:** Fixture (upload + interaction)

**Requirement:** Files chosen on a new record stay queued until save. Add/replace/remove on a saved record persist immediately and show `busy`.

**Pass criteria:**
- Unsaved files show “queued until save”; saved-record uploads call the API at once.

**Fail examples:**
- Creating a record uploads before save, or a saved-record add waits until a later form save.

**Not Exercised:**
- An upload was not performed, or no new unsaved record was available.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Create vs saved records

- **New record:** files chosen in the modal stay queued on the client until the user saves the parent record. Removing a queued file only clears local state. The list shows “queued until save”.
- **Saved record:** add/replace/remove call the tool API immediately, then refresh the record. Show `busy` on the modal while that request runs.
- **History / inactive records:** same paperclip and modal. Set `readOnly` only when the **record** is read-only until Reactivate / Restore. If History still has Edit, keep attachments editable. Completion-proof files stay read-only after complete. See [History and attachments](#history-and-attachments).


#### UX-ATT-006 — Password and download errors stay in-app

**Level:** MUST

**Audit scope:** Modal

**Verification:** Fixture

**Requirement:** Password prompts use the existing overlay at z-[70]. Wrong password and download success stay inside the relevant modal.

**Pass criteria:**
- Wrong password stays in the password overlay; download success is “File downloaded.”

**Fail examples:**
- Wrong password or download success uses `alert()`.

**Not Exercised:**
- No password-protected record existed, or a download was not performed.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Password-protected files

Important Documents (and any later tool that locks a file) must require the record password for **View, Download, Remove, and Replace**.

- Prompt with the existing password modal. Do not add a second password field inside the Attachment modal.
- Stacking: password and forgot-password overlays use `z-[70]` so they sit above the Attachment modal (`z-50`).
- The client must not call remove/replace until a password is entered (or the record is not protected).
- The API must also verify the password (bcrypt hash on the record). Never trust the UI alone. A request without a valid password must fail.
- After a correct password, complete the original intent (view, download, remove, or replace). Cancel/Escape clears any queued replacement file.
- Wrong password (and other verify failures) stay **inside** the password modal as an in-app error. Never use `alert()`, `confirm()`, or another browser dialog. The modal stays open so the user can retry.


#### UX-ATT-005 — Storage quota messaging

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI + Fixture

**Requirement:** Users see used-of-limit storage in the Attachment footer (and user menu / Storage page). Over-quota adds are rejected with a clear message.

**Pass criteria:**
- Footer shows “Storage used: {used} of {limit}”. Over-quota copy mentions the storage limit.

**Fail examples:**
- An over-quota add uploads anyway, or no usage line is shown in the modal.

**Not Exercised:**
- Footer copy can be scored from UI. Over-quota rejection is Not Exercised unless that fixture exists.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Storage quota (what the user sees)

Attachments share one per-user limit across all tool buckets.

| Plan | Included limit |
|------|----------------|
| Free | 200 MB |
| Paid | 1 GB |
| Add-on (later) | +1 GB per $1/month. UI may show disabled placeholder buttons. Do not enable billing yet. |

**Where users see usage:**

- User menu (top right): percent used, fetched when the menu opens from `GET /api/account/storage`. Clicking it goes to `/dashboard/storage`.
- Storage page: total used vs limit, plus a per-tool breakdown of buckets that hold files.
- Attachment modal footer: compact used-of-limit line.

**When the numbers update (user-visible freshness):**

- Do not scan every bucket when the user menu opens.
- Do check remaining quota before an upload.
- Do recount after a successful upload or storage delete, and when the user opens Storage (`/dashboard/storage`).

If an add would exceed the limit, reject it with a clear message (“would exceed your storage limit”) and do not upload.

Cache columns, SQL, and bucket policies stay in `system_design.md`.

### User-visible storage behavior

- Saved files are opened through the tool’s authenticated route, not a public URL in the browser.
- Password-protected view and download must fail without a valid password, then stream the file. Use `inline=1` only for View.
- Account erasure removes the user’s files. The profile control is the typed-delete flow (“Delete Account” / “Delete My Account & Data”). Deletion architecture stays in `system_design.md`.

### Rolling a tool onto this pattern

1. Remove any inline file input, card download icon, or one-off upload modal.
2. Add `AttachmentButton` on add, edit, active, and history surfaces.
3. Open `AttachmentModal` with that record’s files. Set `maxFiles={1}` only when the data model is one file per record.
4. Queue files on create; persist immediately on saved records.
5. Wire View/Download through the tool’s authenticated route (inline vs attachment). Download handlers return `true` on success so the shared modal can show “File downloaded.” Do not add a per-tool success `alert`.
6. Call the shared quota check on upload and recount after add/delete.
7. If the record can be password-protected, gate view/download/remove/replace in both UI and API, with the password overlay at `z-[70]`.
8. Register the bucket in `STORAGE_TOOL_BUCKETS` and in account-deletion cleanup. (Engineering step; see `system_design.md`.)

### What not to do

- Do not add a download or view icon beside the paperclip on cards or rows.
- Do not use the older File Input pattern for files that belong to a tool record.
- Do not call `alert()`, `confirm()`, or `prompt()` for user-facing errors, validation, success, or confirmation. Use the in-app notice or an in-app modal. Permanent deletes use a typed-delete modal (type “delete”). Other confirms use an in-app Archive/Create/Cancel modal.
- Do not call `alert()` (or any browser dialog) after a successful Download. Confirm inside the Attachment modal only.
- Do not call `alert()` for an incorrect attachment password. Show the error inside the password modal.
- Do not let a password or confirm dialog open behind the Attachment modal.
- Do not allow Remove or Replace on a protected file without a verified password (client and server).
- Do not preview Word/Excel in the browser; hide View and download them.
- Do not scan all buckets on every user-menu open.
- Do not enable paid storage / add-on buttons until billing is actually wired.

Per-tool file stores and paperclip placement are in [Application-Specific UX Exceptions](#application-specific-ux-exceptions). Do not treat those tools as identical to the global history `readOnly` note when the exception says otherwise.

---


#### UX-CAL-001 — calendar_pins only

**Level:** MUST

**Audit scope:** Tool

**Verification:** Code

**Requirement:** Dashboard Calendar pins use `calendar_pins`. Do not add `show_on_dashboard` / `add_to_dashboard` on the source table or copy dates/titles into a calendar table.

**Pass criteria:**
- The switch calls `syncCalendarPin`. Dates and titles stay on the source row.

**Fail examples:**
- The tool writes occurrence rows into `dashboard_items` or adds an `add_to_dashboard` column.

**Not Exercised:**
- Source inspection is not available. Persistence cannot be proven from a screenshot.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Dashboard Calendar Integration

Standard for tools that create a record and optionally show it on the Dashboard Calendar.

**Reference:** Calendar Events (`app/components/CalendarEventsTool.tsx`), `lib/calendarPins.ts`, `lib/calendarPinsServer.ts`, table `calendar_pins`.

### User flow

- Default view is the active list, not an add form. Empty copy adapts “No calendar events yet. Click + to add one.”
- Add control is the small emerald plus beside the section title, opening an add modal. See [Add & Edit Patterns](#add--edit-patterns).
- The calendar switch is the last optional control in add and edit forms, after Notes and before the save buttons.
- **Default off.** Creating or prefilling a record, including holiday and template pickers, must not turn it on.
- Do not use a generic “Dashboard” label for this switch. The label is **Add to dashboard calendar**.
- Do not use the filled “+ Add New [Item]” button for these records.

### Switch

Use the Dashboard Toggle track and thumb, with this label and light-mode track:

```tsx
<label className="flex items-center gap-2 cursor-pointer" title="Add to dashboard calendar">
  <span className={`text-xs whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
    Add to dashboard calendar
  </span>
  <button
    type="button"
    role="switch"
    aria-checked={isOn}
    aria-label="Add to dashboard calendar"
    title="Add to dashboard calendar"
    onClick={() => toggle()}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 ${
      isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-slate-900'
    } ${isOn ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'}`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
        isOn ? 'translate-x-5' : 'translate-x-1'
      }`}
    />
  </button>
</label>
```


#### UX-CAL-002 — On calendar chip

**Level:** MUST

**Audit scope:** Tool

**Verification:** Fixture

**Requirement:** Pinned rows show a compact “On calendar” chip next to the title on collapsed active and history rows.

**Pass criteria:**
- The chip uses the documented light/dark classes.

**Fail examples:**
- A pinned row has no chip, or uses different copy such as “Dashboard”.

**Not Exercised:**
- No pinned record existed.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### On calendar chip

When a saved row is pinned, show a compact chip next to the title on the collapsed row (active and history):

```tsx
<span
  className={
    isLight
      ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
      : 'inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300'
  }
>
  On calendar
</span>
```

### What the user gets from a pin

- One pin per source row (and per pin kind when one row has several dates).
- `pin_kind` is usually `default`. Use `start`, `end`, or `warranty` when one source row has several dates.
- Dates and titles stay on the source row. They are not copied into a separate calendar table.
- Use `syncCalendarPin` on create/update. Existing records stay off the calendar until the user turns the switch on.
- Inactivate / archive: keep the pin so reactivate can restore dashboard presence. The dashboard feed shows the item only when the source row is also active.
- Delete the source row or its category: delete the matching pins.
- Dashboard Calendar shows **pinned + active** source rows only.
- Do not add a `show_on_dashboard` / `add_to_dashboard` column on the source table.

`calendar_pins` is the current implementation (helpers in `lib/calendarPins.ts` / `lib/calendarPinsServer.ts`; schema in `supabase/archive/platform/calendar-pins.sql`; migration `supabase/archive/one-time/REMOVE_dashboard_items_and_calendar_flags.sql` drops `dashboard_items` and per-tool `add_to_dashboard` flags). The Calendar Events frequency appendix in `system_design.md` is **legacy design documentation** and is not a UX requirement.

---


#### UX-DAT-001 — Zero-padded MM/DD/YYYY

**Level:** MUST

**Requirement:** Visible dates use zero-padded MM/DD/YYYY (for example `02/06/2026`).

**Pass criteria:**
- Lists, cards, summaries, and report titles use that format.

**Fail examples:**
- The UI shows `2/6/2026` or `2026-02-06` as the user-visible date.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Dates & Data Display

Whenever a date is displayed to the user (lists, cards, summaries, report titles, report body), show it in **zero-padded MM/DD/YYYY**.

Examples: February 6, 2026 is **`02/06/2026`**. February 26, 2026 is **`02/26/2026`**. Do not show `2/6/2026` or `2026-02-26`.

Use a small helper to convert stored values (for example `YYYY-MM-DD` from `<input type="date">`) to that display format.

Form inputs may continue to use the native date picker and ISO date strings internally. Only the visible text shown to the user is MM/DD/YYYY.

Report titles use the same display format, for example “[List Name] — [MM/DD/YYYY]”.

---

## Print & Export Patterns


#### UX-EXP-001 — Export tab naming and pattern

**Level:** MUST

**Audit scope:** Report

**Verification:** UI

**Requirement:** When a dedicated cross-category export tab exists, it is named **Export** and follows the standard Export-tab pattern.

A tool is **not** required to have an Export tab. If the tool uses a documented header icon / modal export flow instead of a tab, this rule is **N/A**. Do not Fail a tool solely because it exports through an icon or popup.

`UX-NAV-002` is retired into this rule.

**Pass criteria:**
- The tab label is exactly Export.
- The tab is a focused generate-report screen: one card, heading, description, and Generate PDF Report.
- No search, filters, or record listings on the tab.
- The tab directs the user into the export popup.

**Fail examples:**
- The same job is labeled Reports, Print All, or similar.
- The Export tab lists every record or includes search.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Export tab

When a tool has a tab for viewing or exporting all records across categories, name it **“Export”**.

The Export tab is a clean, focused screen. No search/filter boxes and no record listings. All export functionality lives in the popup.

#### Export tab content

```tsx
{activeTab === 'export' && (
  <div className="space-y-6">
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h3 className="text-lg font-semibold text-slate-50 mb-4">Export [Tool Name] Report</h3>
      <p className="text-slate-300 mb-4">
        Generate a comprehensive PDF report of all your [data type]. The report will include all [specific details], summary statistics, and category breakdown.
      </p>
      <button
        onClick={() => setShowExportPopup(true)}
        className={primaryButtonClass}
      >
        Generate PDF Report
      </button>
    </div>
  </div>
)}
```

- **Container:** single card `rounded-2xl border border-slate-800 bg-slate-900/70 p-6`
- **Heading:** `text-lg font-semibold text-slate-50 mb-4`. Format: “Export [Tool Name] Report” (for example “Export Subscription Report”, “Export Repair History Report”)
- **Description:** `text-slate-300 mb-4`. Explain what the report includes (all records, summary statistics, category breakdown, and so on).
- **Button:** theme-aware primary, text “Generate PDF Report”, opens the export popup.


#### UX-EXP-002 — Export popup chrome and copy

**Level:** MUST

**Audit scope:** Report

**Verification:** UI

**Requirement:** Export Options uses the base modal, theme-aware primary “Export to PDF”, secondary Cancel, and a labeled close control. Copy describes contents and format, not internal theme.

**Pass criteria:**
- The popup does not say the report is generated in light mode.

**Fail examples:**
- Cancel uses a one-off slate slab, or the popup mentions light-mode rendering.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

#### Export popup

Use the [base modal](#base-modal) at **`max-w-md`**. Do not use a separate `bg-slate-800` / `bg-black/50` chrome.

- **Header:** title “Export Options”; close icon in the top-right with `aria-label="Close"` and `title="Close"`
- **Actions:** primary “Export to PDF” (`flex-1`, theme-aware primary); Cancel uses the [secondary button](#secondary-button-including-cancel)
- **Optional options:** checkboxes or filters (for example “Include inactive items”)
- **Copy:** describe the report contents and format. Do **not** say the report is generated in light mode, or mention internal theme or rendering implementation.
- **State:** `showExportPopup`; `exportToPDF` performs the export
- **Keyboard:** Escape to close, and tab navigation

The printed/exported page is still a white page with dark text and green section headings. That is a print/PDF rule, not popup copy.


#### UX-EXP-003 — Print and PDF report layout

**Level:** MUST

**Audit scope:** Report

**Verification:** Fixture

**Requirement:** Printed or exported reports are a white document: title, green uppercase section headings, black body, no app chrome.

**Pass criteria:**
- A dedicated print block (portal preferred) produces a single report without duplicate/blank pages.

**Fail examples:**
- The printed page includes modal chrome, or section headings stay on-screen emerald-300.

**Not Exercised:**
- No PDF export or print output was opened.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Report UI for printing

When a tool offers Print (for example an icon on a view modal), the content sent to the printer follows this layout so print and export output stays consistent: clean, hierarchical, and readable on white.

#### Design principles

- **Print-friendly:** white background, black body text, high contrast.
- **Hierarchical:** report title, then section/category headings, then list items or rows.
- **Document-like:** generous spacing, left-aligned, no app chrome (buttons, modals, card, or shadow) on the printed page.
- **Single page flow:** only one copy of the report should print; no duplicate pages.

#### Dedicated print-only block

Use a dedicated print-only block that contains only the report content (title, categories, list). Give it one class (for example `report-print`). Hide it on screen with inline styles (`position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden`) and set `aria-hidden="true"`.

**Preferred: portal the print block to `document.body`** so it is a direct child of `body`. Then in `@media print`, hide all other body children with `body > *:not(.report-print) { display: none !important; }`. Only the print block is displayed, so the app root and overlay take no space. Use `createPortal` from `react-dom` and guard with `typeof document !== 'undefined'` for SSR.

**Alternative: sibling to the modal.** Render the print-only block as a sibling of the modal (not inside it). In `@media print` use `body * { visibility: hidden; }` and `.report-print, .report-print * { visibility: visible !important; }`. Give the overlay a class and `display: none !important` in print so it does not reserve a full page. This can still leave a blank second page in some browsers if the app root has a large height. Prefer the portal approach if that happens.

#### Structure

1. **Printable container.** One element with a dedicated class (`report-print`). Prefer the dedicated print-only block so print output has no card chrome and no duplicate pages.
2. **Hide app chrome.** With a dedicated block, the modal and overlay are hidden and never shown in print. If you print from inside the modal instead, add `print-only-hidden` to the modal header and buttons and use `.report-print .print-only-hidden { display: none !important; }`.
3. **Print-only title.** Class `print-title`. If that block is only for print, the title can be visible there. If the same content is also in the modal, use `hidden` on screen and `display: block !important` in `@media print` for `.report-print .print-title`.
4. **Scoped print styles.** Inject a `<style>` that applies only when printing.

**Critical — override off-screen styles in print.** The print block is hidden on screen with inline styles (`position: absolute; left: -9999px; width: 1px; overflow: hidden`). In `@media print` you must override these or the content will not appear (a single blank page). Set `position: static !important; left: auto !important; overflow: visible !important; height: auto !important;` plus full width and a white background.

**Portal print CSS (recommended):**

```css
@media print {
  body > *:not(.report-print) { display: none !important; }
  .report-print {
    display: block !important;
    position: static !important; left: auto !important;
    width: 100% !important; max-width: none !important; height: auto !important;
    overflow: visible !important;
    background: white !important; color: black !important; padding: 1rem !important;
    border: none !important; border-radius: 0 !important; box-shadow: none !important;
  }
  .report-print .print-title { display: block !important; color: black; }
  .report-print .report-category { color: #059669; }
  .report-print p, .report-print ul, .report-print li { color: black; }
}
```

**Visibility print CSS (sibling block):**

```css
@media print {
  .report-overlay { display: none !important; }
  body * { visibility: hidden; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print {
    position: static !important; left: auto !important;
    width: 100% !important; max-width: none !important; height: auto !important;
    overflow: visible !important;
    background: white !important; color: black !important; padding: 1rem !important;
    border: none !important; border-radius: 0 !important; box-shadow: none !important;
  }
  .report-print .print-title { display: block !important; color: black; }
  .report-print .report-category { color: #059669; }
  .report-print p, .report-print ul, .report-print li { color: black; }
}
```

#### Typography and hierarchy

| Element | On-screen (optional) | When printed |
|--------|----------------------|--------------|
| **Report title** | Can live in the modal header (not printed) | `.print-title`: black, bold, larger (for example `text-lg font-semibold`). Format: “[Report Name] — [Date or context]”. Left-aligned, margin below. |
| **Section / category headings** | for example `text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-1` | Green (`#059669` / emerald-600), bold, uppercase, smaller than the title, space below (`mb-1` or `mb-2`) |
| **List items** | for example `text-sm text-slate-200 list-disc list-inside` | Black, regular weight, bulleted (`list-disc list-inside`), indented, tight vertical spacing (`space-y-0.5`) |

- **Report title:** one line, for example “[List Name] — [MM/DD/YYYY]” or “[Report Name] — [context]”. Use `mb-2` below.
- **Categories / sections:** uppercase labels (for example “BAKERY & BREAD”, “BEVERAGES”). Use a class like `report-category` and set its print color to green.
- **Body / list content:** simple bullet lists or rows; black text; no colored UI; adequate line height and spacing.

#### Layout and spacing

- **Container:** in print, full width, white background, `padding: 1rem` (or `p-4`).
- **Sections:** `space-y-4` between category blocks.
- **Lists:** `list-disc list-inside`, `space-y-0.5` between items, `ml-0` or a small indent.

#### Structure (portal)

Render the modal in place for on-screen use. Render the print block and its `<style>` via `createPortal(..., document.body)`.

The print block contains:

- `.print-title` with `{reportName} — {formatDateDisplay(date)}`
- Empty copy: “No items.” (`text-sm py-4`) when there is nothing to print
- Otherwise `space-y-4` groups, each with a `.report-category` uppercase label and a `ul` of items

The modal and the print block receive the same data. The print block stays off-screen until print. The injected CSS makes it the only visible content and overrides its inline styles.

#### Print guidelines

- Use the dedicated print-only block for new report UIs. Prefer portaling it to `document.body`.
- In print CSS, override the block’s off-screen inline styles or the printed page will be blank.
- Use the same report layout for any Print action that opens the browser print dialog.
- Apply the same hierarchy (title, green section headings, black list/body) to other tools, including export-to-PDF or print from the Export tab, so printed and exported reports match.
- Keep the printable area focused: no navigation, buttons, or decorative UI in the printed output.
- In print CSS, explicitly set `color: black` for title, list, and body, and `color: #059669` for `.report-category`, so on-screen Tailwind colors do not carry through.
- Date display: MM/DD/YYYY in the report title and anywhere dates appear in the report body.

---


#### UX-RSP-001 — 44×44 hit areas

**Level:** MUST

**Audit scope:** All

**Verification:** UI + Code

**Requirement:** Measure the clickable button container, not the icon glyph. The 16/20/24px icon can remain small. The interactive hit box must be at least 44×44px on touch interfaces, including the section + and three-dot controls.

**Pass criteria:**
- The clickable container is at least 44×44px.
- Icon buttons use `min-h-11 min-w-11` (or equivalent) when source is available, even when the SVG is 20px.

**Fail examples:**
- A 20px icon sits in a ~36px `p-2` hit target with no expanded touch area.

**Not Exercised:**
- The auditor only has a screenshot and cannot reliably measure the hit box. Do not guess from glyph size.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Responsive / Mobile Design

- **Mobile first:** design for mobile, enhance for desktop.
- **Touch targets:** buttons and interactive elements are at least 44×44px.
- **Text size:** keep body text readable on mobile (minimum 14px).
- **Spacing:** use responsive spacing utilities (`sm:`, `md:`, `lg:`).
- **Page padding:** `px-4 py-10 sm:px-6 lg:px-8`.

#### UX-RSP-002 — Responsive layout collapse

**Level:** MUST

**Requirement:** Two-column forms and multi-column card grids collapse on small viewports.

**Pass criteria:**
- Forms become one column below `md`; header cards wrap.

**Fail examples:**
- A two-column form stays side-by-side on a narrow phone viewport.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

- **Forms:** `grid grid-cols-1 md:grid-cols-2 gap-4` so two-column forms collapse to one column.
- **Feature cards:** `grid gap-5 md:grid-cols-3`.
- **Data display:** card-based layouts rather than traditional tables, for a better mobile experience.
- **Header cards:** `flex-wrap` so category cards and the add button wrap.
- **Modals:** `w-full` with `mx-4`, and add popups use `max-h-[90vh] overflow-y-auto`.

Keep 16/20/24px glyphs. Increase the **clickable container** to at least 44×44px on touch (`min-h-11 min-w-11`), including the section plus and the three-dot control. The visual icon stays compact; the hit area does not.


#### UX-RSP-003 — No unintended horizontal clipping or overflow

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI

**Requirement:** At supported mobile / narrow widths, primary content and record actions must remain usable without unintended horizontal clipping or sideways page scrolling.

This rule is separate from 44×44 hit targets (`UX-RSP-001`) and form-grid collapsing (`UX-RSP-002`).

**Pass criteria:**
- Row actions remain visible or adapt appropriately.
- Cards fit the viewport or intentionally scroll within a clearly designed container.
- The overall page does not require horizontal scrolling for normal use.
- Controls are not cut off.

**Fail examples:**
- Row actions are clipped offscreen.
- The page scrolls sideways because a card is wider than the viewport.
- Required controls become unreachable.
- Fixed-width content breaks the mobile layout.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

---

## Accessibility


#### UX-ACC-001 — Semantic controls and heading order

**Level:** MUST

**Requirement:** Interactive elements are `<button>` or links, not clickable `<div>`s. Headings follow a logical h1→h2→h3 order.

**Pass criteria:**
- Icon actions are buttons; the page has a sensible heading tree.

**Fail examples:**
- A clickable `<div>` is the only control, or headings skip levels without reason.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Semantic HTML

- Use a proper heading hierarchy (h1, then h2, then h3).
- Use semantic elements: `<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`.
- Use `<button>` for interactive elements, not a `<div>` with onClick.
- Use `<label>` elements associated with form inputs.

### ARIA labels

- **Icon buttons:** always include `aria-label` and `title` with the same text, so every icon shows a hover tooltip.
- **Form fields:** use `aria-describedby` for error messages when appropriate.
- **Loading states:** `aria-busy="true"` on loading elements.
- **Switches:** `role="switch"`, `aria-checked`, `aria-label`, and `title`.
- **Print-only block:** `aria-hidden="true"` (or `aria-hidden`) because it is off-screen until print.
- **Decorative SVGs** inside a labeled button may use `aria-hidden`.


#### UX-ACC-002 — Visible focus indicators

**Level:** MUST

**Requirement:** Every interactive element has a visible focus ring (buttons and inputs as documented).

**Pass criteria:**
- Tabbing shows `focus:ring` on buttons and a focus border/ring on fields.

**Fail examples:**
- `outline-none` is used with no replacement ring.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Keyboard navigation

- **Focus states:** every interactive element has a visible focus indicator.
  - Buttons: `focus:outline-none focus:ring-2 focus:ring-emerald-500/50`
  - Inputs: `focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50`
- **Tab order:** logical order through forms and interfaces.
- **Escape** closes modals (ToolModal and the modal rules above).
- **Enter** submits forms (default browser behavior).
- Export popup: Escape to close, and tab navigation.
- Attachment modal: Escape closes an image preview first, then the modal.
- Add modal: Escape does not close it while a stacked picker is open.


#### UX-ACC-003 — WCAG AA contrast

**Level:** MUST

**Requirement:** Text and controls meet WCAG AA on the actual surface, including light-mode remaps and explicit light cards.

**Pass criteria:**
- Primary text on page/cards passes AA; dashboard light tabs do not use `text-emerald-300`.

**Fail examples:**
- Muted emerald-300 text is used on the light gray canvas for an active tab or primary label.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

### Color contrast

WCAG AA minimum.

Documented dark-mode checks:

- `text-slate-50` on `bg-slate-950`: passes
- `text-slate-300` on `bg-slate-900`: passes
- `text-slate-950` on `bg-emerald-500`: passes

**Light mode:** after remaps, primary text on the page and cards is generally dark slate on light gray or white. Verify new components especially where you bypass globals (explicit white cards, colored banners). Test focus rings and placeholder text on real backgrounds.

Interactive elements need sufficient contrast for focus states.

`text-emerald-300` is not used for dashboard active tabs in light mode because it is too faint on the light canvas.

### Screen reader support

- **Alt text:** descriptive `alt` on images.
- **Form labels:** always use `<label>`. Never placeholder-only inputs.
- **Error messages:** associate them with fields using `aria-describedby`.
- **Status messages:** `role="status"` or `aria-live` for dynamic updates.
- **Alternative text** for images and icons (icon buttons use `aria-label`).

### Disabled states

- **Visual:** `disabled:opacity-50`
- **Cursor:** `disabled:cursor-not-allowed`
- **ARIA:** `aria-disabled="true"` when appropriate

### Form accessibility

- **Required fields:** red asterisk and the `required` attribute.
- **Error messages:** display clearly and associate with fields.
- **Field descriptions:** helper text below labels when needed.
- **Grouping:** `<fieldset>` and `<legend>` for related groups when appropriate.

### Best practices

- Test with keyboard-only navigation.
- Test with screen readers (NVDA, JAWS, VoiceOver).
- Ensure all functionality is available without a mouse.
- Provide alternative text for images and icons.
- Maintain a consistent focus order.
- Use sufficient color contrast (WCAG AA minimum).
- Provide clear error messages and recovery paths.

Responsive rules that also serve accessibility (touch size, minimum body text) are in [Responsive / Mobile Design](#responsive--mobile-design).

---


#### UX-ATT-007 — Tool-specific attachment exceptions

**Level:** MUST

**Audit scope:** Tool

**Verification:** UI

**Requirement:** Each tool is evaluated against its documented attachment stores and allowed paperclip surfaces. Documented exceptions are not failures.

Narrow this rule so it does not re-test:

- `UX-ATT-001` — paperclip is the only attachment entry (no extra file icons).
- `UX-DEL-004` — History attachment editability follows the record.

**Pass criteria:**
- Paperclips appear only on surfaces the tool section allows.
- Files use the documented store(s) for that tool.

**Fail examples:**
- A paperclip is added on a surface the tool forbids (for example categories, Export, or child rows that rebuild on save).
- A documented exception is treated as a global-rule failure.

**Exceptions:** None unless explicitly listed in Application-Specific UX Exceptions.

## Application-Specific UX Exceptions

These rules are intentional differences. They do not replace the global paperclip, modal, or confirmation standards. They say **which records** get files, whether history stays editable, and which chrome must not grow a paperclip. Approved layout and add-control exceptions are listed under the tool they apply to. They do not change the global rules for other tools.

Global defaults still apply unless a bullet below says otherwise: one paperclip, one Attachment modal, 10 MB, the shared type list, queue-until-save on create, immediate persist on saved records, and no browser dialogs.

### Important Documents

Reference implementation for the shared attachment UI (`app/components/ImportantDocumentsTool.tsx`).

- Single file per record: `maxFiles={1}`. Drop/browse replaces the current file. The button label becomes “Replace file”.
- Password-protected records require the record password for View, Download, Remove, and Replace. Use the existing password modal at `z-[70]`, not a second password field inside the Attachment modal.
- Wrong password stays inside the password modal.

### Cleaning Schedule

Two file stores. Do not attach files to scheduled tasks. A task is 1:1 with its library item, so task-level files would duplicate the item store.

- **Library item files** (`tools_cs_item_attachments`, bucket `cleaning-schedule`, path `{userId}/items/{itemId}/...`): standing photos or instructions for the item. Library add/edit/cards, schedule rows, View/Edit, and archived schedule paperclips all open this store. Files stay when a task is archived or deleted.
- **Completion files** (`tools_cs_completion_attachments`, path `{userId}/completions/{completionId}/...`): dated proof for one occurrence. Queue in the Complete dialog. After save they are read-only in completion History. No add/remove after complete.
- No paperclip on categories or Activate.

**Library and add-control exception (intentional):** Cleaning Schedule keeps its Library and Categories structure, the filled **+ Add New Cleaning Item** button, the existing inline Add New Cleaning Item workflow, and the filled **+ Add New Category** control. Do not convert this tool to the Calendar Events category-selector or section-plus pattern. This is the exception for `UX-LAY-003` and `UX-ADD-002`.

### Home Maintenance Schedule

Two file stores. Do not attach files to scheduled tasks. A task is 1:1 with its library item, so task-level files would duplicate the item store. Provider fields are columns on the task; do not add a second upload control.

- **Library item files** (`tools_hms_item_attachments`, bucket `home-maintenance-schedule`, path `{userId}/items/{itemId}/...`): standing manuals, invoices, and photos for the item. Library add/edit/cards, schedule rows, View/Edit, and archived (moved-to-history) paperclips all open this store. Files stay editable when a task is archived. Files stay when a task is deleted. Permanent item delete removes them.
- **Completion files** (`tools_hms_completion_attachments`, path `{userId}/completions/{completionId}/...`): dated proof for one occurrence. Queue in the Complete dialog. After save they are View/Download only on the Completed chip, History completion rows, and the in-modal Completion history table. No add/remove after complete.
- No paperclip on categories, Activate, Export, search/filter, or provider fields.

**Library and add-control exception (intentional):** Home Maintenance Schedule keeps its Library and category structure, the filled **+ Add New Maintenance Item** button, the existing inline add workflow, and the existing category-creation workflow, including the filled **+ Add New Category** control. Do not convert this tool to the Calendar Events category-selector or section-plus pattern. This is the exception for `UX-LAY-003` and `UX-ADD-002`.

### End of Life Planner

Five file stores on list rows that already had a place for scans. Do not attach files to contacts, device/online logins, financial rows, home/utility/provider/vehicle rows, next steps, 1:1 wish blobs, custom fields, sections, or plan cards.

- **Document files** (`tools_eolp_document_attachments`, bucket `end-of-life-planner`, path `{userId}/documents/{documentId}/...`): one scan per Important Documents row (`maxFiles={1}`). Paperclip on add/edit header and the row (paperclip, then Edit, then Delete). Custom tabs modeled after documents use the same store.
- **Insurance files** (`tools_eolp_insurance_attachments`, path `{userId}/insurance/{insuranceId}/...`): multiple cards/PDFs per policy. Same paperclip surfaces. Custom insurance tabs included.
- **Letter files** (`tools_eolp_letter_attachments`, path `{userId}/letters/{letterId}/...`): multiple optional scans per letter.
- **Personal item files** (`tools_eolp_personal_item_attachments`, path `{userId}/personal-items/{itemId}/...`): multiple photos/docs on My Wishes → Personal Items.
- **Other record files** (`tools_eolp_other_record_attachments`, path `{userId}/other/{recordId}/...`): multiple files on the Other record, never on custom fields (those rebuild on save).
- Keep `digital_location`, `document_location`, and `photo_reference` as optional text. Paperclip is the only file control.
- Archived plans stay editable (Show archived plans still has Edit). Files stay editable. No paperclip on Archive / Restore.
- No record-password overlay. Secret fields stay as they are.
- No paperclip on Categories-style chrome, Export, search, or plan History.

“Archive Plan” uses the reversible in-app confirm, not typed delete.

### HSA Tracker

Expense receipts only. Do not attach files to accounts, deposits, Summary KPIs, or Reports.

- **Expense files** (`tools_hsa_expense_receipts`, bucket `hsa-tracker`, path `{userId}/{expenseId}/...`): multiple optional receipts/EOBs. Paperclip on Add expense, Edit expense, and expense cards.
- Keep the yellow “Receipt still needed” banner when the warning checkbox is on **and** the expense has no files. Do not add a second “Attach receipt” button. Do not show file names on the card.
- Reimbursed is a field, not History. Files stay editable.
- No paperclip on account add/edit, deposits, or Reports.

**Add control exception (intentional):** HSA Tracker keeps the filled Add button and the existing inline workflow for expenses and deposits, including **+ Add New Expense**. Do not convert expenses or deposits to a section-plus or modal add pattern. This is the exception for `UX-ADD-002`.

### Travel Log

Trip files only. Do not attach files to lodging or journal notes until those child rows are upserted by id (they are currently deleted and re-inserted on every trip save).

- **Trip files** (`tools_tl_trip_attachments`, bucket `travel-log`, path `{userId}/{tripId}/...`): multiple optional tickets, boarding passes, photos, and receipts. Paperclip on Add trip, Edit trip, and trip cards.
- The “Trip History” heading is the trip list, not an archive. Files stay editable.
- No second “Upload receipts” control under Budget. No paperclip on lodging/journal modals or Export.

**Add placement exception (intentional):** Travel Log keeps Search before **+ Add New Trip**. Do not move the add button above the search area to satisfy the generic `UX-ADD-001` placement rule.

### Repair History

Repair-record files only. Flatten receipt, warranty, and pictures into one store. Do not attach files to Items or categories.

- **Repair files** (`tools_rh_record_attachments`, bucket `repair-history`, path `{userId}/{recordId}/...`): multiple optional receipts, warranties, and photos. Paperclip on Add repair, Edit repair, and repair cards.
- The **Repairs** tab is the live list, not Notes-style History. Files stay editable.
- Keep warranty end date, dashboard pin, insurance fields, and the Home manual URL on the form. Receipt / Warranty / Pictures file pickers and card-level Receipt/Warranty links are not separate controls. Insurance uses the same repair file store. No second upload UI.
- No paperclip on Items, categories, or Export.
- The cross-category export tab is named **Export**.

### Event Budget Planner

Event files and expense files. Do not attach files to vendors, categories, types, category-budget rows, or vendor-split rows (splits are deleted and re-inserted on every expense save).

- **Event files** (`tools_ebp_event_attachments`, bucket `event-budget-planner`, path `{userId}/events/{eventId}/...`): invitations, contracts, and other event-level docs. Paperclip on Add Event, Edit Event, active cards, and History cards.
- **Expense files** (`tools_ebp_expense_attachments`, path `{userId}/expenses/{expenseId}/...`): receipts and invoices for one expense. Paperclip on Add Expense, Edit Expense, and expense rows inside Edit Event. Attach to the expense, not to a split.
- History is real (`is_active = false`). History cards show the event paperclip as View/Download only. Expense files stay on the expense but are not reachable until Reactivate. The API must reject add/remove on inactive events.
- Edit Event is the detail surface. There is no separate event page.
- Queue files on create; persist immediately on saved records. `addExpense` returns `expenseId` so queued uploads can run after Save Expense.
- Render `AttachmentModal` after the expense modal. The Attachment overlay uses **`z-[60]`** when it stacks on the expense modal.
- No paperclip on Vendors, Categories, Types, category-budget rows, Calendar, or export.

**Add-form control order exception (intentional):** On Add New Event, the Birthday starter template stays after the Dashboard Calendar switch. Do not move controls so the Dashboard Calendar switch is literally the final optional control. This is the exception for `UX-ADD-003`.

### Meal Planner

Meal files only. Do not attach files to weekly plans, day-slot assignments, items, meal types, or the grocery modal.

- **Meal files** (`tools_mp_meal_attachments`, bucket `meal-planner`, path `{userId}/{mealId}/...`): multiple optional recipe photos and PDFs. Paperclip on Add Meal, Edit Meal, and meal rows (active and Inactive).
- Inactive is a hide-from-picker flag, not Notes-style History. Files stay editable. Plan History still has Edit and has no paperclip in this pass.
- Plan assignments are deleted and re-inserted on every plan save, so do not attach files to a day slot.
- Queue files on create; persist immediately on saved meals.
- No paperclip on plans, day cards, meal picker, grocery/shopping modal, Items, Meal Types, or Print.
- “Create Shopping List” uses the reversible in-app confirm.

### Shopping List

List files only. Do not attach files to master items, line items, Print, the Items tab, or the dashboard pin.

- **List files** (`tools_sl_list_attachments`, bucket `shopping-list`, path `{userId}/{listId}/...`): multiple optional receipts, store flyers, and photos of a handwritten list. Paperclip on Create list, Edit list, Active cards, History cards, and the View-detail modal header (beside Print).
- History is real (`is_active = false`) and has Reactivate, but History still has Edit. Files stay editable. Do not make the paperclip read-only while Edit works.
- Line items are deleted and re-inserted on every list save, so do not attach files to a line item.
- Queue files on create; persist immediately on saved lists. Save does not require a file.
- Building a new list from History or Meal Planner “Save as Shopping List” does not copy files.
- The View modal owns add/view/download/remove. Do not embed a second Attachments section above Print. Render `AttachmentModal` after the View modal. The Attachment overlay uses **`z-[60]`** when it stacks on the View modal.
- No paperclip on master-item Add/Edit, line-item rows, Print, Items, or the dashboard pin.

### Goals Tracking

Goal files and update files. Do not attach files to categories, phases, tasks, the dashboard pin, or reminders.

- **Goal files** (`tools_gt_goal_attachments`, bucket `goals-tracking`, path `{userId}/goals/{goalId}/...`): plans, policies, and other standing docs. Paperclip on New Goal, Edit Goal, the goal detail/progress card (next to Edit), and each goal list row.
- **Update files** (`tools_gt_update_attachments`, path `{userId}/updates/{noteId}/...`): photos and evidence for one update. Paperclip on the Add update composer (detail card and Edit Goal) and on each row in Update history and Edit Goal’s update list. Do not mix with the goal store.
- Completed is a status field, not Notes-style History. Files stay editable.
- Phases and tasks are first-class saved records, but do not add paperclips on those rows. Standing files stay on the goal. Dated evidence stays on updates.
- Queue files on create goal and until Add update. Persist immediately on saved goals and posted updates. Save / Add update does not require a file.
- Render `AttachmentModal` after the Update history and Edit Goal modals. The Attachment overlay uses **`z-[60]`** when it stacks on those modals.
- No paperclip on categories, phase/task rows, dashboard pin, or reminder controls.

### Healthcare Appointments & History

Appointment files only. The existing `tools_hcah_documents` store is the attachment store. Do not attach files to family-member headers or the provider text field.

- **Appointment files** (`tools_hcah_documents`, bucket `healthcare-appt-history`, path `{userId}/{recordId}/...`): multiple optional bills, EOBs, referrals, and visit photos. Paperclip on Add upcoming, Add history, Edit appointment, and appointment cards (Upcoming and History).
- Upcoming vs History is `is_upcoming` on the same record, not Notes-style History. Files stay editable.
- Do not use a body “Documents” picker, “Add more files”, an in-form View/Delete list, or file-name chips on cards. Badge only.
- Queue files on create; persist immediately on saved appointments. Save does not require a file.
- Add to HSA creates an HSA expense only. Do not copy files and do not add a second upload shortcut.
- View/Download go through the authenticated route (`inline=1` vs download).
- No paperclip on family-member chips, Report/Export, or the dashboard pin.
- Family-member selection uses the header card pattern (“Select family member”).

### Pet Care Schedule

Pet files, Documents-tab files, veterinary contacts, vaccinations, and appointments. Do not attach files to food, care plan, or notes. Those children are still deleted and re-inserted on every pet save.

- **Pet files** (`tools_pcs_pet_attachments`, bucket `pet-care-schedule`, path `{userId}/pets/{petId}/...`): pet photo and other pet-level files. Paperclip on Add Pet, Edit Pet, each pet card, and the Pet Info header. The photo is an image in the shared modal. No separate avatar uploader.
- **Document files** (`tools_pcs_document_attachments`, path `{userId}/documents/{documentId}/...`): files for one named Documents-tab record. Paperclip on Add Document, Edit, and the document row. Multiple files per document are allowed.
- **Veterinary / vaccination / appointment files** (`tools_pcs_veterinary_attachments`, `tools_pcs_vaccination_attachments`, `tools_pcs_appointment_attachments`): paperclip on add/edit and on the row (paperclip, then Edit, then Move to history if present, then Delete). Those child tables upsert by id so files stay linked.
- History stays editable. Veterinary/food/care/notes History still has Edit. Appointments “History” is past dates. Vaccinations titled “Vaccination History” is the live list.
- Queue files on create; persist immediately on saved pets and child records. Save does not require a file.
- No paperclip on Food, Care Plan, Notes, Export, or the dashboard pin.
- Pet selection uses the header card pattern (“Select your Pet”).
- The cross-category export tab is named **Export**.

### Calendar Events

Event-series files only (`tools_ce_event_attachments`, bucket `calendar-events`, path `{userId}/{eventId}/...`). Recurring events are frequency on the same `tools_ce_events` row. There are no occurrence records, so files belong to the series.

- Paperclip on Add Event (queue until save), Edit Event, each Active row (paperclip, then Edit, then Move to history), and each History row (View/Download only).
- History is `is_active = false` and has no Edit (Reactivate and Delete only). The modal is read-only and the API rejects add/remove until the event is reactivated. Reactivate restores the same files as editable.
- Queue files on create; persist immediately on saved events. Save does not require a file.
- Delete event or category removes storage objects before the rows.
- No paperclip on categories, Export, or calendar pins.
- This tool is the reference for bordered record-row icons, the light-surface primary button, the green plus, and the calendar pin switch.

### Subscription Tracker

Subscription files only (`tools_st_subscription_attachments`, bucket `subscription-tracker`, path `{userId}/{subscriptionId}/...`). Receipts, contracts, and renewal notices share this one store.

- Paperclip on Add New Subscription (queue until save), Edit Subscription, each Active row (paperclip, then Edit, then Move to history), and each History row (View/Download only).
- History is `is_active = false` and has no Edit (Reactivate and Delete only). The modal is read-only and the API rejects add/remove until the subscription is reactivated. Reactivate restores the same files as editable.
- Queue files on create; persist immediately on saved subscriptions. Save does not require a file.
- Delete subscription removes storage objects before the row.
- No paperclip on categories, search, Export, billed/renewal dates, or calendar pins. Do not add a “Has attachments” filter or Export attachment index yet.

**Add control exception (intentional):** Subscription Tracker is a simple single-list tool. Use the filled **+ Add New Subscription** button. Calendar pinning is an optional attribute of a subscription, not the organizing structure of the tool. Do not replace this control with the section plus.

### Address Book

Address files only (`tools_ab_address_attachments`, bucket `address-book`, path `{userId}/{addressId}/...`). Do not attach files to tags. `tools_ab_address_tags` is deleted and re-inserted on every save.

- Paperclip on Add New Address (queue until save), Edit Address, View Address (header, beside Close), each Active row (paperclip, then View, then Edit, then Move to history), and each History row (View/Download only).
- History is `is_active = false` and has no Edit (Restore and Delete only). The modal is read-only and the API rejects add/remove until the address is restored. Restore brings back the same files as editable.
- Queue files on create; persist immediately on saved addresses. Save does not require a file.
- Render `AttachmentModal` after the View Address dialog. The Attachment overlay uses **`z-[60]`** when it stacks on that dialog.
- Delete address removes storage objects before the row.
- No paperclip on the Tags tab, tag chips, Add/Edit tag, or Tag History.

**Add placement exception (intentional):** Address Book keeps the Search and tag-filter area before **+ Add New Address**. Do not move the add button above Search to satisfy the generic `UX-ADD-001` placement rule.

---


## Audit rule index

Stable IDs for machine-auditable requirements. Full pass/fail criteria sit in the section named here. Use [`UX_AUDIT_CHECKLIST.md`](./UX_AUDIT_CHECKLIST.md) to run an audit.

`MUST` is the rule level, not the finding severity. Score only the rows for the chosen audit scope.

| ID | Title | Level | Scope | Verification | Section |
|----|-------|-------|-------|--------------|---------|
| UX-VIS-001 | Slate + emerald palette | MUST | Tool | UI | Visual Design |
| UX-VIS-002 | Semantic color usage | MUST | Tool | UI | Visual Design |
| UX-VIS-003 | Theme-aware tag chips | MUST | Tool | UI | Visual Design |
| UX-VIS-004 | Theme by auth state | MUST | Dashboard / Shell | UI + Interaction | Theme |
| UX-TYP-001 | Documented typeface and scale | MUST | Tool | UI | Typography |
| UX-LAY-001 | Page padding and standard cards | MUST | Tool | UI | Layout & Spacing |
| UX-LAY-002 | Tool Box and Store card sizing | MUST | Dashboard / Shell | UI | Cards & Containers |
| UX-LAY-003 | Tool header and category selector | MUST | Tool | UI | Tool Header |
| UX-BTN-001 | Theme-aware primary button | MUST | Tool | UI + Code | Buttons & Actions |
| UX-BTN-002 | Theme-aware secondary and Cancel | MUST | Tool | UI + Code | Buttons & Actions |
| UX-BTN-003 | Theme-aware switch | MUST | Tool | UI + Interaction | Buttons & Actions |
| UX-BTN-004 | Loading and disabled on async actions | MUST | Tool | Fixture | Buttons & Actions |
| UX-BTN-005 | Correct add-control type | MUST | — | Retired → UX-ADD-001 / UX-ADD-002 | Buttons & Actions |
| UX-ICO-001 | Outline icon style | MUST | Tool | UI + Code | Icons |
| UX-ICO-002 | Icon-only aria-label and title | MUST | All | UI + Code | Buttons & Actions |
| UX-ICO-003 | Light-mode muted icon color | MUST | Tool | UI + Code | Icons |
| UX-FRM-001 | Standard field chrome | MUST | Tool | UI | Forms & Inputs |
| UX-FRM-002 | Associated labels and required indicator | MUST | Tool | UI | Forms & Inputs |
| UX-FRM-003 | No standalone file field for record attachments | MUST | Tool | UI | Forms & Inputs |
| UX-LST-001 | Icon-only bordered row actions | MUST | Tool | UI | Record/List Patterns |
| UX-LST-002 | Slot-based action order | MUST | Tool | UI | Record/List Patterns |
| UX-LST-003 | Card-based lists, not tables | SHOULD | Tool | UI | Record/List Patterns |
| UX-ADD-001 | Filled Add New for single-list tools | MUST | Tool | UI | Add & Edit Patterns |
| UX-ADD-002 | Section plus and add modal | MUST | Tool | UI + Interaction | Add & Edit Patterns |
| UX-ADD-003 | Calendar pin switch placement and default | MUST | Tool | UI + Interaction | Add & Edit Patterns |
| UX-ADD-004 | Single-list inline add form | MUST | Tool | UI + Interaction | Add & Edit Patterns |
| UX-DEL-001 | No browser dialogs | MUST | Tool | UI + Interaction | Delete, Archive & History |
| UX-DEL-002 | Reversible in-app confirmation | MUST | Tool | UI + Interaction | Delete, Archive & History |
| UX-DEL-003 | Typed-delete for permanent destruction | MUST | Modal | UI + Interaction | Delete, Archive & History |
| UX-DEL-004 | History attachment editability follows the record | MUST | Tool | UI + Interaction | Delete, Archive & History |
| UX-MOD-001 | Modal base chrome | MUST | Modal | UI | Modals & Dialogs |
| UX-MOD-002 | Modal stacking behavior and z-index | MUST | Modal | UI + Interaction / Code | Modals & Dialogs |
| UX-MOD-003 | Escape and close control | MUST | Modal | UI + Interaction | Modals & Dialogs |
| UX-NAV-001 | Theme-aware tabs | MUST | Tool / Dashboard | UI | Tabs & Navigation |
| UX-NAV-002 | Export tab naming | MUST | — | Retired → UX-EXP-001 | Tabs & Navigation |
| UX-NAV-003 | Header dropdown light/dark panels | MUST | Dashboard / Shell | UI | Tabs & Navigation |
| UX-NAV-004 | Category three-dot menus | MUST | Tool | UI | Tool Header |
| UX-NAV-005 | Dashboard tab-strip background | MUST | Dashboard / Shell | UI + Code | Tabs & Navigation |
| UX-SRH-001 | Standard search and filter controls | SHOULD | Tool | UI | Search & Filtering |
| UX-EMP-001 | Empty-state copy matches tool type | MUST | Tool | Fixture | Empty & Loading States |
| UX-EMP-002 | Loading labels on in-flight actions | MUST | — | Retired → UX-BTN-004 | Empty & Loading States |
| UX-FBK-001 | In-app notices for page-level feedback | MUST | Tool | UI + Interaction | Notifications |
| UX-FBK-002 | In-modal messages stay in the modal | MUST | Modal | UI + Interaction | Notifications |
| UX-ATT-001 | Paperclip and Attachment modal only | MUST | Tool | UI | Attachments |
| UX-ATT-002 | Allowed types and 10 MB limit | MUST | Tool | UI + Fixture | Attachments |
| UX-ATT-003 | View versus download | MUST | Tool | Fixture | Attachments |
| UX-ATT-004 | Queue until save versus persist immediately | MUST | Tool | Fixture | Attachments |
| UX-ATT-005 | Storage quota messaging | MUST | Tool | UI + Fixture | Attachments |
| UX-ATT-006 | Password and download errors stay in-app | MUST | Modal | Fixture | Attachments |
| UX-ATT-007 | Tool-specific attachment exceptions | MUST | Tool | UI | Application-Specific UX Exceptions |
| UX-CAL-001 | calendar_pins only | MUST | Tool | Code | Dashboard Calendar Integration |
| UX-CAL-002 | On calendar chip | MUST | Tool | Fixture | Dashboard Calendar Integration |
| UX-DAT-001 | Zero-padded MM/DD/YYYY | MUST | All | UI | Dates & Data Display |
| UX-EXP-001 | Export tab naming and pattern | MUST | Report | UI | Print & Export |
| UX-EXP-002 | Export popup chrome and copy | MUST | Report | UI | Print & Export |
| UX-EXP-003 | Print and PDF report layout | MUST | Report | Fixture | Print & Export |
| UX-RSP-001 | 44×44 hit areas | MUST | All | UI + Code | Responsive / Mobile |
| UX-RSP-002 | Responsive layout collapse | MUST | Tool | UI | Responsive / Mobile |
| UX-RSP-003 | No unintended horizontal clipping or overflow | MUST | Tool | UI | Responsive / Mobile |
| UX-ACC-001 | Semantic controls and heading order | MUST | All | UI + Code | Accessibility |
| UX-ACC-002 | Visible focus indicators | MUST | All | UI + Interaction | Accessibility |
| UX-ACC-003 | WCAG AA contrast | MUST | All | UI | Accessibility |

**Active scored rules:** 59 (57 MUST, 2 SHOULD).

**Retired IDs (do not score separately):** UX-BTN-005, UX-NAV-002, UX-EMP-002.

**Fixture-dependent (use Not Exercised if the state is missing):** UX-BTN-004, UX-EMP-001, UX-CAL-001 (code), UX-CAL-002, UX-ATT-002 through UX-ATT-006, UX-DEL-004, UX-FBK-001 / UX-FBK-002 success lines, UX-EXP-003, UX-MOD-002B tokens, UX-RSP-001 measurement when only a screenshot exists.

---
## Future UX Considerations

Recorded as future work in `system_design.md`. They are not current requirements.

- Document animation and transition patterns as they are added.
- Create a component library / storybook for reusable components.
- Expand the icon set as needed. Use the documented Icon Style (outline, stroke, `currentColor`).
- Document the responsive breakpoint strategy in more detail.
- Category three-dot menus now follow the header dropdown light/dark split. Apply that treatment when those menus are next implemented or audited.

---
