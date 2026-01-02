# Household Toolbox Design System

This document defines the design standards for Household Toolbox to ensure consistency across all features and tools.

## Product Principles

1. **Practicality First**: Household Toolbox is designed for real-life household management. Every feature should solve a real problem that households face.

2. **Clarity Over Cleverness**: The interface should be immediately understandable. Users shouldn't need to learn how to use the app—it should be intuitive.

3. **Peace of Mind**: The product helps users stay organized and avoid missing important tasks. The design should feel calm, organized, and trustworthy.

4. **Respect for User Time**: Household admin is already tedious. The interface should be efficient and minimize friction.

5. **Accessibility for Everyone**: The product should be usable by all members of a household, regardless of technical skill or ability.

## Visual Style - Colors

### Color Palette

The application uses a dark theme with a slate-based color system and emerald as the primary accent color.

#### Primary Colors
- **Background**: `slate-950` (#0a0a0a) - Main page background
- **Surface**: `slate-900` (#0f172a) - Card backgrounds, elevated surfaces
- **Surface Secondary**: `slate-900/70` or `slate-900/50` - Semi-transparent surfaces
- **Border**: `slate-800` (#1e293b) - Primary border color for cards and containers
- **Border Secondary**: `slate-700` (#334155) - Secondary borders, form inputs

#### Text Colors
- **Primary Text**: `slate-50` (#f8fafc) - Headings and primary content
- **Secondary Text**: `slate-100` (#f1f5f9) - Secondary headings
- **Body Text**: `slate-200` (#e2e8f0) - Regular body text
- **Muted Text**: `slate-300` (#cbd5e1) - Labels, helper text
- **Placeholder Text**: `slate-400` (#94a3b8) - Input placeholders
- **Disabled Text**: `slate-500` (#64748b) - Disabled elements

#### Accent Colors
- **Primary Accent**: `emerald-500` (#10b981) - Primary buttons, active states, links
- **Primary Accent Hover**: `emerald-400` (#34d399) - Button hover states
- **Primary Accent Light**: `emerald-300` (#6ee7b7) - Active tab text, badges
- **Primary Accent Background**: `emerald-500/10` or `emerald-400/20` - Accent backgrounds with opacity

#### Semantic Colors
- **Success**: `emerald-500/50` border, `emerald-500/10` background, `emerald-300` text
- **Error**: `red-500/50` border, `red-500/10` background, `red-300` text
- **Warning**: `amber-500/50` border, `amber-500/10` background, `amber-300` text
- **Info/Secondary Action**: `blue-500/20` background, `blue-300` text

#### Button Text on Accent
- **Text on Emerald**: `slate-950` (#0f172a) - Text color for buttons with emerald background

### Color Usage Guidelines
- Use emerald for primary actions, active states, and positive indicators
- Use slate grays for all neutral elements
- Use semantic colors (red, amber) sparingly and only for their intended purposes
- Maintain sufficient contrast ratios for accessibility (WCAG AA minimum)

## Visual Style - Typography

### Font Families
- **Primary Font**: Geist Sans (via Next.js Google Fonts)
- **Monospace Font**: Geist Mono (for code or technical content)
- **Fallback**: Arial, Helvetica, sans-serif

### Font Sizes
- **Display**: `text-6xl` (3.75rem / 60px) - Hero headings
- **H1**: `text-4xl` or `text-5xl` (2.25rem / 2.5rem) - Page titles
- **H2**: `text-2xl` (1.5rem / 24px) - Section headings
- **H3**: `text-xl` or `text-lg` (1.125rem / 1.25rem) - Subsection headings
- **Body Large**: `text-base` (1rem / 16px) - Large body text
- **Body**: `text-sm` (0.875rem / 14px) - Standard body text
- **Small**: `text-xs` (0.75rem / 12px) - Labels, captions, helper text
- **Tiny**: `text-[11px]` - Footer text, fine print

### Font Weights
- **Semibold**: `font-semibold` (600) - Headings, important text
- **Medium**: `font-medium` (500) - Labels, button text
- **Regular**: Default (400) - Body text

### Typography Patterns
- **Headings**: Use `font-semibold` with appropriate text color (`text-slate-50` for H1/H2, `text-slate-100` for H3)
- **Body Text**: Use `text-slate-200` or `text-slate-300` for readability
- **Labels**: Use `text-sm font-medium text-slate-300`
- **Uppercase Labels**: Use `text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300` for section labels
- **Line Height**: Default line-height is appropriate for most text. Use `leading-tight` or `leading-relaxed` when needed

### Text Utilities
- **Text Balance**: Use `text-balance` for headings to prevent awkward line breaks
- **Text Pretty**: Use `text-pretty` for paragraphs to improve line breaks
- **Whitespace**: Use `whitespace-pre-line` for multi-line text that preserves line breaks
- **Whitespace Nowrap**: Use `whitespace-nowrap` for buttons or labels that shouldn't wrap

## Layout Rules

### Container Widths
- **Max Content Width**: `max-w-5xl` (1024px) - Main content containers
- **Max Form Width**: `max-w-3xl` (768px) - Forms and narrower content
- **Full Width**: Use for dashboard and tool interfaces

### Spacing System
- **Page Padding**: `px-4 py-10 sm:px-6 lg:px-8` - Standard page padding
- **Section Spacing**: `mb-16` or `space-y-6` - Vertical spacing between sections
- **Card Padding**: `p-4`, `p-5`, or `p-6` - Internal card padding
- **Element Spacing**: 
  - Small gaps: `gap-2` (0.5rem)
  - Medium gaps: `gap-3` or `gap-4` (0.75rem / 1rem)
  - Large gaps: `gap-6` (1.5rem)
- **Vertical Spacing**: `space-y-4` or `space-y-6` for form fields and lists

### Border Radius
- **Cards**: `rounded-2xl` (1rem) - Primary card containers
- **Buttons**: `rounded-lg` (0.5rem) - Standard buttons
- **Small Elements**: `rounded-md` (0.375rem) - Small buttons, badges
- **Inputs**: `rounded-lg` (0.5rem) - Form inputs

### Grid Layouts
- **Responsive Grid**: Use `grid gap-5 md:grid-cols-3` for feature cards
- **Form Grid**: Use `grid grid-cols-1 md:grid-cols-2 gap-4` for two-column forms
- **Flex Layouts**: Use `flex` with `gap-2`, `gap-4`, or `gap-6` for horizontal arrangements

### Shadows
- **Card Shadow**: `shadow-2xl shadow-emerald-500/10` - Subtle colored shadow for emphasis
- **Dropdown Shadow**: `shadow-lg` - Menu and dropdown shadows

### Backgrounds
- **Page Background**: `bg-slate-950`
- **Card Background**: `bg-slate-900/70` or `bg-slate-900/50` with `border border-slate-800`
- **Input Background**: `bg-slate-900/70`
- **Hover Background**: `hover:bg-slate-800` or `hover:bg-slate-700`

## Components - Buttons

### Primary Button
```tsx
className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
```
- **Use For**: Primary actions (Submit, Save, Buy, Create Account)
- **States**: 
  - Default: `bg-emerald-500 text-slate-950`
  - Hover: `hover:bg-emerald-400`
  - Focus: `focus:ring-2 focus:ring-emerald-500/50`
  - Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`
- **Sizes**: 
  - Standard: `px-4 py-2.5`
  - Small: `px-2.5 py-1 text-xs`
  - Full Width: Add `w-full`

### Secondary Button
```tsx
className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
```
- **Use For**: Cancel, secondary actions, alternative options
- **States**: Similar hover and focus patterns as primary

### Text Button / Tab Button
```tsx
className="px-3 py-2 text-sm font-medium transition-colors text-slate-400 hover:text-slate-300"
```
- **Use For**: Tabs, navigation, less prominent actions
- **Active State**: `border-b-2 border-emerald-500 text-emerald-300` for active tabs

### Icon Button
```tsx
className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
```
- **Use For**: Close buttons, icon-only actions
- **Include**: `aria-label` for accessibility

### Button Guidelines
- Always include loading/disabled states for async actions
- Use `transition-colors` for smooth hover effects
- Maintain consistent padding and sizing within the same context
- Group related buttons with `flex gap-2` or `flex gap-3`

## Components - Forms

### Text Input
```tsx
<input
  type="text"
  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
/>
```
- **Background**: `bg-slate-900/70`
- **Border**: `border-slate-700`
- **Focus**: `focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50`
- **Text**: `text-slate-100`
- **Placeholder**: `placeholder-slate-500`

### Textarea
```tsx
<textarea
  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
/>
```
- Same styling as text input
- Add `resize-none` to prevent manual resizing

### Select Dropdown
```tsx
<select
  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
>
```
- Same styling as text input
- Use `px-4` for better visual alignment with options

### Checkbox
```tsx
<input
  type="checkbox"
  className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
/>
```
- **Size**: `w-5 h-5` for standard checkboxes
- **Accent**: `text-emerald-500` for checked state

### Label
```tsx
<label className="block text-xs font-medium text-slate-300 mb-1.5">
  Field Name <span className="text-red-400">*</span>
</label>
```
- **Size**: `text-xs` or `text-sm`
- **Weight**: `font-medium`
- **Color**: `text-slate-300`
- **Required Indicator**: `text-red-400` asterisk
- **Spacing**: `mb-1.5` or `mb-2` below label

### Form Container
```tsx
<form className="space-y-4">
  {/* Form fields */}
</form>
```
- Use `space-y-4` or `space-y-6` for vertical spacing between fields
- Group related fields in `grid grid-cols-1 md:grid-cols-2 gap-4` for two-column layouts

### Form Validation Messages
- **Error**: `border-red-500/50 bg-red-500/10 text-red-300`
- **Success**: `border-emerald-500/50 bg-emerald-500/10 text-emerald-300`
- **Warning**: `border-amber-500/50 bg-amber-500/10 text-amber-300`
- **Container**: `rounded-lg border px-3 py-2 text-sm`

### Form Guidelines
- Always associate labels with inputs using `htmlFor` and `id`
- Mark required fields with red asterisk
- Provide clear error messages near the relevant field
- Use consistent spacing between form sections
- Group related fields visually

## UX Rules

### Modal Patterns
- **Overlay**: `fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm`
- **Modal Container**: `w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl`
- **Close Button**: Position in top-right with `aria-label="Close modal"`
- **Keyboard**: Support Escape key to close (implement with `useEffect`)

### Tab Navigation
- **Container**: `border-b border-slate-800` with `flex gap-2`
- **Tab**: `px-4 py-2 text-sm font-medium transition-colors`
- **Active Tab**: `border-b-2 border-emerald-500 text-emerald-300`
- **Inactive Tab**: `text-slate-400 hover:text-slate-300`

### Card Patterns
- **Standard Card**: `rounded-2xl border border-slate-800 bg-slate-900/70 p-4` or `p-6`
- **Nested Card**: `rounded-lg border border-slate-700 bg-slate-800/50 p-4`
- **Card Header**: Use `mb-4` for spacing below header

### Loading States
- **Button Loading**: Show "Processing...", "Saving...", or "Loading..." text
- **Disabled State**: `disabled:opacity-50 disabled:cursor-not-allowed`
- **Loading Indicator**: Consider spinner or skeleton screens for longer operations

### Empty States
- **Message**: `text-slate-400 text-center py-8` - "No items found. Add one to get started!"
- **Action**: Provide clear call-to-action button to add first item

### Search and Filter
- **Search Input**: Use standard input styling with search icon if needed
- **Filter Dropdown**: Use select styling or custom dropdown
- **Active Filters**: Show selected filters with badges or chips

### Data Display
- **Lists**: Use consistent spacing (`space-y-4`) between items
- **Tables**: Use card-based layouts rather than traditional tables for better mobile experience
- **Status Indicators**: Use color-coded badges or borders

### Navigation
- **Breadcrumbs**: Not currently used, but if needed, use `text-sm text-slate-400` with `hover:text-emerald-300` links
- **Menu Items**: `text-slate-300 hover:bg-slate-700` with `px-4 py-2`

### Feedback Patterns
- **Success Messages**: Green border/background with emerald text
- **Error Messages**: Red border/background with red text
- **Info Messages**: Blue or slate styling
- **Position**: Display near the action that triggered them (form top, button area, etc.)

## Accessibility

### Semantic HTML
- Use proper heading hierarchy (h1 → h2 → h3)
- Use semantic elements: `<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`
- Use `<button>` for interactive elements, not `<div>` with onClick
- Use `<label>` elements properly associated with form inputs

### ARIA Labels
- **Icon Buttons**: Always include `aria-label` (e.g., `aria-label="Close modal"`)
- **Form Fields**: Use `aria-describedby` for error messages when appropriate
- **Loading States**: Use `aria-busy="true"` for loading elements

### Keyboard Navigation
- **Focus States**: All interactive elements must have visible focus indicators
  - Buttons: `focus:outline-none focus:ring-2 focus:ring-emerald-500/50`
  - Inputs: `focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50`
- **Tab Order**: Ensure logical tab order through forms and interfaces
- **Keyboard Shortcuts**: 
  - Escape key closes modals (implemented in ToolModal)
  - Enter submits forms (default browser behavior)

### Color Contrast
- **Text on Background**: Ensure WCAG AA contrast ratios
  - `text-slate-50` on `bg-slate-950`: ✅ Passes
  - `text-slate-300` on `bg-slate-900`: ✅ Passes
  - `text-slate-950` on `bg-emerald-500`: ✅ Passes
- **Interactive Elements**: Ensure sufficient contrast for focus states

### Screen Reader Support
- **Alt Text**: All images should have descriptive `alt` attributes
- **Form Labels**: Always use `<label>` elements, never placeholder-only inputs
- **Error Messages**: Associate error messages with form fields using `aria-describedby`
- **Status Messages**: Use `role="status"` or `aria-live` regions for dynamic content updates

### Responsive Design
- **Mobile First**: Design for mobile, enhance for desktop
- **Touch Targets**: Ensure buttons and interactive elements are at least 44x44px
- **Text Size**: Maintain readable text sizes on mobile (minimum 14px for body text)
- **Spacing**: Use responsive spacing utilities (`sm:`, `md:`, `lg:`)

### Disabled States
- **Visual Indication**: `disabled:opacity-50` provides clear visual feedback
- **Cursor**: `disabled:cursor-not-allowed` indicates non-interactive state
- **ARIA**: Use `aria-disabled="true"` when appropriate

### Form Accessibility
- **Required Fields**: Mark with visual indicator (red asterisk) and `required` attribute
- **Error Messages**: Display errors clearly and associate with fields
- **Field Descriptions**: Use helper text below labels when needed
- **Grouping**: Use `<fieldset>` and `<legend>` for related form groups when appropriate

### Best Practices
- Test with keyboard-only navigation
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Ensure all functionality is accessible without a mouse
- Provide alternative text for all images and icons
- Maintain consistent focus order
- Use sufficient color contrast (WCAG AA minimum)
- Provide clear error messages and recovery paths

---

## Implementation Notes

- This design system uses **Tailwind CSS** for styling
- All color values reference Tailwind's color palette
- Spacing uses Tailwind's spacing scale (multiples of 0.25rem)
- The application is built with **Next.js** and **React**
- Dark theme is enforced via `className="dark"` on the root `<html>` element
- Custom CSS variables are defined in `globals.css` for theme consistency

## Future Considerations

- Consider adding a light theme option (currently only dark theme is implemented)
- Document animation and transition patterns as they're added
- Create component library/storybook for reusable components
- Establish icon system guidelines (currently using DynamicIcon component)
- Document responsive breakpoint strategy in more detail
