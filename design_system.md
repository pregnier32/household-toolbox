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
<button
  aria-label="Close modal"
  title="Close modal"
  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
>
  {/* icon SVG — use Icon Style format below */}
</button>
```
- **Use For**: Close buttons, icon-only actions (e.g. print, close, view)
- **Include**: 
  - `aria-label` for accessibility (e.g., `aria-label="Close modal"`)
  - `title` for tooltip on hover — all icon-only buttons must show a tooltip when the user hovers. Use the same text as `aria-label` (e.g., `title="Close modal"`).
- **Icon**: Use the standard **Icon Style** format below so all app icons match (outline style, light grey).

### Icon Style (standard for all tools)
Use this format for every icon in icon-only buttons and inline icons so icons look consistent across the app (outline/stroke style, light grey that lightens on hover).

- **Style**: Outline (stroke) icons only — no filled icons. Use `fill="none"` and `stroke="currentColor"` so the icon inherits the parent's text color.
- **Stroke**: `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"` for a clean, consistent line.
- **Size**: `className="h-5 w-5"` (20px) for standard icon buttons; use `h-6 w-6` where a larger icon is needed.
- **Color**: Set on the parent (e.g. the button). Use `text-slate-400` for default and `hover:text-slate-200` on hover so the icon is a light grey that lightens on hover.
- **ViewBox**: Use `viewBox="0 0 24 24"` for 24pt icon sets so scaling is consistent.

**Example — print icon in a button:**
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

**Example — close (X) icon:**
```tsx
<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
</svg>
```

### Dashboard Toggle (Switch)
Use this standard design for any "display on dashboard" or similar on/off toggle. The control is a capsule-shaped track with a white circular thumb that slides left (off) or right (on). When on, the track is emerald; when off, the track is slate.

```tsx
<label className="flex items-center gap-2 cursor-pointer" title="Display on dashboard">
  <span className="text-xs text-slate-400 whitespace-nowrap">Dashboard</span>
  <button
    type="button"
    role="switch"
    aria-checked={isOn}
    aria-label="Display on dashboard"
    title="Display on dashboard"
    onClick={() => toggle()}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 ${
      isOn ? 'bg-emerald-500' : 'bg-slate-700'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
        isOn ? 'translate-x-5' : 'translate-x-1'
      }`}
    />
  </button>
</label>
```
- **Use For**: "Display on dashboard" and any similar boolean toggle where the standard is a switch (not a checkbox).
- **Track**: 
  - Size: `h-6 w-11` (24px height, 44px width) — capsule shape via `rounded-full`
  - On state: `bg-emerald-500` (green)
  - Off state: `bg-slate-700`
  - Focus: `focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900`
- **Thumb**: 
  - Size: `h-5 w-5` (20px), `rounded-full`, `bg-white`, `shadow`
  - Position: `translate-x-1` when off (left), `translate-x-5` when on (right)
- **Label**: Place the label text (e.g. "Dashboard") to the left of the switch in `text-xs text-slate-400`. Use a `<label>` wrapping both so clicking the text toggles the switch.
- **Accessibility**: Use `role="switch"`, `aria-checked={boolean}`, and `aria-label` (and `title` for tooltip).

### Add New Record Button
```tsx
<button
  onClick={startAddingRecord}
  className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
>
  + Add New [Item Name]
</button>
```
- **Use For**: Adding new records/items in tool apps (e.g., "+ Add New Subscription", "+ Add New Record")
- **Styling**: 
  - Emerald green background (`bg-emerald-500`) with dark text (`text-slate-950`)
  - Font weight: `font-semibold` (not `font-medium`)
  - Padding: `px-4 py-2.5`
- **Text Format**: Always prefix with "+" followed by "Add New [Item Name]"
  - Examples: "+ Add New Subscription", "+ Add New Record", "+ Add New Pet"
- **Positioning**: 
  - Place below navigation tabs and above search/filter boxes
  - Use `flex justify-start` for left alignment
  - Container: `<div className="flex justify-start">`
- **Visibility**: Hide the button when the add form is open (`{!isAdding && (...)}`)
- **States**: Same hover and focus patterns as primary button

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

### File Input
For file upload inputs, use a custom styled approach that replaces the default browser "Choose File" button with an icon and custom label:
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
- **Structure**: 
  - Wrap input and label in a `relative` container
  - Hide the default file input with `opacity-0` and position it absolutely
  - Use a custom `label` element as the visible clickable area
  - Associate label with input using `htmlFor` and `id` attributes
- **Icon**: 
  - Use a document icon (SVG) for general file uploads
  - Use an image/gallery icon for image-only uploads: `<path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />`
- **Styling**: 
  - Label: `flex items-center gap-2` for icon and text alignment
  - Icon: `w-5 h-5 text-slate-400` for consistent sizing and color
  - Text: `text-slate-300` for the file name or placeholder text
  - Hover: `hover:bg-slate-800` for visual feedback
- **Multiple Files**: 
  - For multiple file inputs, show count: `{files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Select files'}`
  - For image uploads: `{images.length > 0 ? `${images.length} image${images.length > 1 ? 's' : ''} selected` : 'Select images'}`
- **Display Selected File**: 
  - Show the selected file name when a file is chosen
  - Show placeholder text ("Select file", "Select images", etc.) when no file is selected
- **Accessibility**: 
  - Always use `htmlFor` and `id` to associate label with input
  - Include `accept` attribute to specify allowed file types
  - Use descriptive placeholder text

### Grouped/Hierarchical Select Dropdown
For dropdowns that need to display items organized by categories or areas (e.g., Repair Items grouped by Area):
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
- **Use For**: Dropdowns that need hierarchical organization (e.g., items grouped by area, category, or type)
- **Structure**: 
  - Use `<optgroup>` with `label` attribute for the parent category/area (left-justified)
  - Use `<option>` elements inside each `<optgroup>` for items (automatically indented by browser)
- **Styling**: Same as standard select dropdown
- **Default Option**: Include a default "Select an item..." option with empty value
- **Conditional Display**: Only show grouped dropdown when applicable (e.g., for Home categories), otherwise use standard text input
- **Implementation Pattern**:
  - Create helper functions: `getUniqueAreas()` to get unique parent categories
  - Create helper functions: `getItemsByArea(area)` to filter items by area
  - Map through areas, then map through items within each area

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
- **Export Tab Naming**: When tools have a tab for viewing/exporting all records across categories, it should be named **"Export"** (not "Reports" or other variations). This ensures consistency across all tools (e.g., Pet Care Schedule, Repair History).

### Export Tab UI Pattern

For tools that include an Export tab, use this consistent UI pattern to provide a clean, focused export experience:

#### Export Tab Content
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
        className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
      >
        Generate PDF Report
      </button>
    </div>
  </div>
)}
```

#### Structure Requirements
- **Container**: Single card (`rounded-2xl border border-slate-800 bg-slate-900/70 p-6`)
- **Heading**: `text-lg font-semibold text-slate-50 mb-4`
  - Format: "Export [Tool Name] Report" (e.g., "Export Subscription Report", "Export Repair History Report")
- **Description**: `text-slate-300 mb-4`
  - Should explain what the report includes (all records, summary statistics, category breakdown, etc.)
- **Button**: Primary emerald button with "Generate PDF Report" text
  - Styling: `px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold`
  - Opens export popup modal

#### Export Popup Modal
```tsx
{showExportPopup && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-50">Export Options</h3>
        <button
          onClick={() => setShowExportPopup(false)}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Optional: Export options (checkboxes, filters, etc.) */}
        
        <div className="flex gap-3 pt-4">
          <button
            onClick={exportToPDF}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Export to PDF
          </button>
          <button
            onClick={() => setShowExportPopup(false)}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

#### Modal Requirements
- **Overlay**: `fixed inset-0 bg-black/50 flex items-center justify-center z-50`
- **Container**: `bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4`
- **Header**: 
  - Title: "Export Options"
  - Close button (X icon) in top-right
- **Actions**:
  - Primary: "Export to PDF" button (emerald, full width with `flex-1`)
  - Secondary: "Cancel" button (slate, standard width)
- **Optional Options**: Can include checkboxes or filters for export customization (e.g., "Include inactive items")

#### State Management
- **Popup State**: `const [showExportPopup, setShowExportPopup] = useState(false)`
- **Export Function**: Implement `exportToPDF` function to handle actual PDF generation

#### Implementation Guidelines
- Keep the Export tab content simple and focused—no search/filter boxes or record listings
- The Export tab should be a clean interface that directs users to generate a report
- All export functionality should be contained within the popup modal
- Use consistent button styling matching the primary button pattern
- Ensure the modal is keyboard accessible (Escape to close, tab navigation)

### Report UI for Printing

When a tool offers "Print" (e.g. from an icon on a view modal), the content that is sent to the printer should follow this report layout so all print/export output is consistent: clean, hierarchical, and readable on white.

#### Design principles
- **Print-friendly**: White background, black body text, high contrast for readability.
- **Hierarchical**: Clear levels — report title → section/category headings → list items (or rows).
- **Document-like**: Generous spacing, left-aligned, no app chrome (buttons, modals, card, or shadow) on the printed page.
- **Single page**: Only one copy of the report should print; no duplicate pages.

#### Recommended: Dedicated print-only block

To avoid the modal card (border, shadow, max-width) and overlay appearing in print and to prevent duplicate or blank pages, use a **dedicated print-only block** that contains only the report content (title + categories + list). Give it a single class (e.g. `report-print`). Hide it on screen with inline styles (e.g. `position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden`) and set `aria-hidden="true"`.

**Preferred: Portal the print block to `document.body`** so it is a direct child of `body`. Then in `@media print`, hide all other body children with `body > *:not(.report-print) { display: none !important; }`. Only the print block is displayed, so the app root and overlay take no space — no blank second page. Use `createPortal` from `react-dom` and guard with `typeof document !== 'undefined'` for SSR. Example: `createPortal(<> <style>…</style> <div className="report-print" …>…</div> </>, document.body)`.

**Alternative: Sibling to the modal.** Render the print-only block as a sibling to the modal (not inside it). In `@media print` use `body * { visibility: hidden; }` and `.report-print, .report-print * { visibility: visible !important; }`. Give the overlay a class and `display: none !important` in print so it doesn’t reserve a full page. This can still leave a blank second page in some browsers if the app root has large height; prefer the portal approach if that occurs.

#### Structure and CSS (print only)

1. **Printable container**  
   Use a single element with a dedicated class (e.g. `report-print`). Prefer the **dedicated print-only block** (sibling to the modal) so print output has no card/chrome and no duplicate pages. Alternatively, you can put the class on the modal’s inner content div and rely on visibility so only that div prints (simpler but the modal wrapper can still affect layout in some browsers).

2. **Hide app chrome when printing**  
   With a dedicated print-only block, the modal and overlay are hidden via `body * { visibility: hidden }` and never shown in print. If you print from inside the modal instead, add `print-only-hidden` to modal header and buttons and use `.report-print .print-only-hidden { display: none !important; }`.

3. **Print-only title**  
   Inside the printable block, include the report title in an element with class `print-title`. If that block is only for print, the title can be visible there; if the same content is also in the modal, use `hidden` on screen and `display: block !important` in `@media print` for `.report-print .print-title`.

4. **Scoped print styles**  
   Inject a `<style>` (e.g. with `dangerouslySetInnerHTML`) that applies only when printing. Two patterns:

   **Portal approach (recommended):** Print block is a direct child of `body` (rendered via `createPortal`). Hide all other body children so only the report prints; no second page.

   **Visibility approach:** Print block is a sibling to the modal. Hide overlay with `display: none`, then use `body * { visibility: hidden }` and show only `.report-print` and its descendants.

   **Critical — override off-screen styles in print:** The print block is hidden on screen with inline styles (`position: absolute; left: -9999px; width: 1px; overflow: hidden`). In `@media print` you **must** override these or the content will not appear (single blank page). Set `position: static !important; left: auto !important; overflow: visible !important; height: auto !important;` (and full width, white background, etc.) so the content is visible on the printed page.

**Example — portal approach (single page, no blank second page):**

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

**Example — visibility approach (sibling block, overlay hidden):**

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

- **Preventing duplicate or blank pages:** Prefer the **portal approach**: render the print block (and its `<style>`) with `createPortal(..., document.body)` and use `body > *:not(.report-print) { display: none !important; }` so only the report is in the print layout. If using the sibling approach, give the overlay a class and `display: none !important` in print. In both cases, **always override** the print block’s off-screen inline styles in print (`position: static`, `left: auto`, `overflow: visible`, `height: auto`) so the content is visible.

#### Typography and hierarchy

| Element | On-screen (optional) | When printed |
|--------|----------------------|--------------|
| **Report title** | Can be in modal header (not printed) | Shown via `.print-title`: black, bold, larger (e.g. `text-lg font-semibold`). Format: "[Report Name] — [Date or context]". Left-aligned, margin below. |
| **Section / category headings** | e.g. `text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-1` | Green (e.g. `#059669` / emerald-600), bold, uppercase, smaller than title, space below (`mb-1` or `mb-2`). |
| **List items** | e.g. `text-sm text-slate-200 list-disc list-inside` | Black (inherit from container), regular weight, bulleted (`list-disc list-inside`), indented, tight vertical spacing (`space-y-0.5`). |

- **Report title**: One line, e.g. "[List Name] — [MM/DD/YYYY]" or "[Report Name] — [context]". Use `mb-2` below.
- **Categories/sections**: Uppercase labels (e.g. "BAKERY & BREAD", "BEVERAGES"). Use a class like `report-category` and set its color to green in the print stylesheet so it stays green in print.
- **Body/list content**: Simple bullet lists or rows; black text, no colored UI; adequate line height and spacing.

#### Layout and spacing

- **Container**: In print, full width, white background, `padding: 1rem` (or `p-4`).
- **Sections**: `space-y-4` between each category/section block.
- **Lists**: `list-disc list-inside`, `space-y-0.5` between items, `ml-0` or small indent so bullets and text align cleanly.

#### Example structure (React/JSX)

**Option A — Portal (recommended):** Render the modal in place for on-screen use. Render the print block and its `<style>` via `createPortal(..., document.body)` so the print block is a direct child of `body`. In print, `body > *:not(.report-print) { display: none }` so only the report prints — one page, no blank second page.

```tsx
import { createPortal } from 'react-dom';

// When report modal is open:
const printContent = (
  <>
    <style dangerouslySetInnerHTML={{ __html: `@media print { body > *:not(.report-print){ display: none !important; } .report-print { display: block !important; position: static !important; left: auto !important; width: 100% !important; height: auto !important; overflow: visible !important; background: white !important; color: black !important; padding: 1rem !important; border: none !important; box-shadow: none !important; } .report-print .print-title { display: block !important; color: black; } .report-print .report-category { color: #059669; } .report-print p, .report-print ul, .report-print li { color: black; } }` }} />
    <div
      className="report-print"
      aria-hidden
      style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
    >
      <div className="print-title mb-2 text-lg font-semibold">{reportName} — {formatDateDisplay(date)}</div>
      {items.length === 0 ? <p className="text-sm py-4">No items.</p> : (
        <div className="space-y-4">
          {groups.map(({ category, items: categoryItems }) => (
            <div key={category}>
              <p className="report-category text-xs font-semibold uppercase tracking-[0.18em] mb-1">{category}</p>
              <ul className="text-sm list-disc list-inside ml-0 space-y-0.5">
                {categoryItems.map((item) => <li key={item.id}>{item.name}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  </>
);

return (
  <>
    <div className="report-overlay fixed inset-0 z-50 ..." onClick={() => setCloseModal(null)}>
      <div className="... card ...">
        <div className="... print-only-hidden">… <button onClick={() => window.print()}>Print</button> …</div>
        <div className="overflow-y-auto ...">{/* On-screen content (same data) */}</div>
      </div>
    </div>
    {typeof document !== 'undefined' && createPortal(printContent, document.body)}
  </>
);
```

**Option B — Sibling block:** Same as before: fragment contains `<style>`, overlay + modal, and a sibling `<div className="report-print" style={{ position: 'absolute', left: '-9999px', ... }}>` with the report content. Use the visibility-based print CSS and overlay `display: none` in print. Override the print block’s inline styles in print (`position: static`, `left: auto`, `overflow: visible`, `height: auto`) so the content is visible.

- The modal and the print block receive the same data (`reportName`, `date`, `groups`). The print block is off-screen until print; the injected CSS makes it the only visible content and overrides its inline styles so it appears on the printed page.

#### Guidelines

- **Use the dedicated print-only block** for new report UIs. Prefer **portaling** it to `document.body` with `createPortal` so that in print you can use `body > *:not(.report-print) { display: none }` — this avoids a blank second page. Guard with `typeof document !== 'undefined'` for SSR.
- **In print CSS, override the block’s off-screen inline styles** so the content is visible: set `position: static !important; left: auto !important; overflow: visible !important; height: auto !important` (and full width, white background, etc.). Without these overrides, the printed page will be blank because the block stays off-screen or clipped.
- Use the same report layout for any "Print" action that opens the browser print dialog (e.g. print icon on a view modal).
- Apply the same hierarchy (title → green section headings → black list/body) to other tools (e.g. export-to-PDF or print from Export tab) so printed and exported reports match this pattern.
- Keep the printable area focused: no navigation, buttons, or decorative UI in the printed output.
- In print CSS, explicitly set `color: black` for title, list, and body, and `color: #059669` for `.report-category`, so Tailwind’s on-screen colors don’t carry through.
- Date display: Use MM/DD/YYYY in the report title and anywhere dates appear in the report body.

### Card Patterns
- **Standard Card**: `rounded-2xl border border-slate-800 bg-slate-900/70 p-4` or `p-6`
- **Nested Card**: `rounded-lg border border-slate-700 bg-slate-800/50 p-4`
- **Card Header**: Use `mb-4` for spacing below header

### Header/Category Management Patterns

For tools that use header/category records (e.g., Pet Care Schedule, Repair History, Healthcare Appts & History), use the following layout and patterns so that all such tools look and behave consistently.

#### Tool Header Layout (Page Structure)

Use this structure at the top of the tool so the header selector matches across applications:

1. **Title and description**
   - **Title**: `text-2xl font-semibold text-slate-50 mb-2` (e.g. "Pet Care Schedule", "Healthcare Appts & History")
   - **Description**: `text-slate-400 text-sm` — one line explaining what the tool does (e.g. "Manage all aspects of your pet's care..." or "Track upcoming appointments and healthcare history for each family member.")

2. **Selector container**
   - **Wrapper**: Single rounded card that holds the entire selector area
     ```tsx
     className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
     ```
   - **Label**: Prompt above the cards, e.g. "Select your Pet" or "Select family member"
     ```tsx
     <label className="block text-sm font-medium text-slate-300 mb-3">Select your [Entity]</label>
     ```

3. **Cards and Add button row**
   - **Row**: `flex items-center gap-3 flex-wrap` so header cards and the add button sit on one line.
   - **Header cards**: Individual selectable cards (see Header Card Display below). Use `min-w-[120px]` so card size is consistent.
   - **Add button**: Square-ish button with a "+" icon only, same height as the cards:
     ```tsx
     className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]"
     ```
     - Icon: Plus SVG `h-6 w-6`, e.g. path "M12 4v16m8-8H4"
     - **Title**: Use `title="Add New [Entity]"` for accessibility.

4. **Add-new form (inline)**
   - When the user is adding a new header/category, show the form **inside the same selector container** (not below it), so the layout stays one cohesive block.
   - Use a row layout: `flex items-end gap-2 flex-wrap`
   - Include: name input (`flex-1 min-w-[200px]`), color picker (optional), Create button (primary), Cancel button (secondary).
   - Toggle between "cards + Add button" and "add-new form" with a single boolean (e.g. `isCreatingNewHeader`); do not show both at once.

**Reference**: Pet Care Schedule ("Select your Pet") and Healthcare Appts & History ("Select family member") both use this layout.

#### Header Card Display
- **Card Styling**: Use colored borders and backgrounds based on `card_color` property
  - Border: `borderColor: header.card_color || '#10b981'`
  - Background (selected): `${header.card_color}15` (15% opacity)
  - Background (unselected): `${header.card_color}08` (8% opacity)
  - Text color: `color: header.card_color || '#10b981'`
- **Selected State**: Add `shadow-lg` class when selected
- **Click to Select**: Clicking the card selects it and loads its data

#### Three-Dot Menu
- **Menu Button**: Positioned absolutely in top-right corner of card
  ```tsx
  className="absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors"
  ```
- **Menu Icon**: Vertical ellipsis (three dots) SVG
- **Menu Popup**: 
  - Position: `absolute top-10 right-0 z-50`
  - Container: `bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1`
  - Menu Items: `w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2`

#### Edit Functionality
- **Menu Option**: "Edit" with pencil icon
- **Edit Mode**: Inline editing replaces the card display
  - Container: `px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]`
  - Border color: Use `editingHeaderColor` for border and background
  - Fields:
    - Name input: `flex-1 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm`
    - Color picker: `h-6 w-12 rounded border border-slate-600 cursor-pointer`
  - Actions: Save and Cancel buttons
- **Save Button**: `flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400`
- **Cancel Button**: `px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600`

#### Delete Functionality
- **Menu Option**: "Delete" with trash icon, styled in red
  - `text-red-400 hover:bg-slate-700`
- **Confirmation Modal**: Required for all delete operations
  - **Overlay**: `fixed inset-0 bg-black/50 flex items-center justify-center z-50`
  - **Container**: `rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4`
  - **Warning Box**: Prominent red warning box at top
    ```tsx
    className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4"
    ```
    - Warning text: `text-red-300 font-semibold` with ⚠️ emoji
    - Details: `text-red-200 text-sm` explaining what will be deleted
  - **Confirmation Input**: 
    - Placeholder: "Type 'delete' to confirm"
    - Styling: Standard input with red focus border
    - Validation: Button disabled until user types exactly "delete" (case-insensitive)
  - **Delete Button**: 
    - `bg-red-600 text-white hover:bg-red-700`
    - Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`
    - Disabled until confirmation text matches
  - **Cancel Button**: Standard secondary button styling
- **Keyboard Support**: Escape key closes the modal

#### Implementation Requirements
- All header/category records should support:
  - Custom `card_color` property (default: `#10b981`)
  - Edit name and color together in one form
  - Delete with confirmation modal requiring "delete" to be typed
- State management:
  - `editingHeaderId`: Tracks which header is being edited
  - `editingHeaderName`: Current name being edited
  - `editingHeaderColor`: Current color being edited
  - `deleteConfirmHeaderId`: Tracks which header deletion is being confirmed
  - `deleteConfirmText`: Text input for confirmation
  - `menuOpenHeaderId`: Tracks which menu is open (for click-outside-to-close)

#### Click Outside to Close
- When menu is open, add overlay: `fixed inset-0 z-40` that closes menu on click
- This prevents menu from staying open when clicking elsewhere

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
- **Date Display**: Whenever a date is displayed to the user (e.g. in lists, cards, summaries), show it in **MM/DD/YYYY** format. Use a small helper to convert from stored values (e.g. `YYYY-MM-DD` from `<input type="date">`) to display format, e.g. `2/26/2026` not `2026-02-26`. Form inputs may continue to use the native date picker and ISO date strings internally; only the visible text shown to the user should be MM/DD/YYYY.

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
- **Icon Buttons**: Always include `aria-label` (e.g., `aria-label="Close modal"`) and `title` (e.g., `title="Close modal"`) so that all icons show a tooltip on hover. Use the same text for both attributes.
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

## Database Standards

### Performance Optimizations

#### Foreign Key Indexes
All foreign key columns must have covering indexes to ensure optimal query performance, especially for JOIN operations and DELETE CASCADE operations.

**Migration File**: `supabase/add-performance-indexes.sql`

**Standard Pattern**:
- For foreign keys that can be NULL: Use partial indexes with `WHERE column IS NOT NULL`
- For foreign keys that are NOT NULL: Use standard indexes

**Example**:
```sql
-- For nullable foreign keys
CREATE INDEX IF NOT EXISTS idx_table_name_fkey_column 
  ON table_name(fkey_column) 
  WHERE fkey_column IS NOT NULL;

-- For non-nullable foreign keys
CREATE INDEX IF NOT EXISTS idx_table_name_fkey_column 
  ON table_name(fkey_column);
```

**Tables with Foreign Key Indexes** (13 total):
- `billing_active.tool_id`
- `billing_history.tool_id`
- `tools_ce_categories.tool_id`
- `tools_ce_events.tool_id`
- `tools_id_documents.tool_id`
- `tools_id_tags.tool_id`
- `tools_note_notes.tool_id`
- `tools_note_tags.tool_id`
- `tools_pcs_pets.tool_id`
- `tools_rh_headers.tool_id`
- `tools_rh_items.tool_id`
- `tools_rh_records.tool_id`
- `tools_st_subscriptions.tool_id`
- `user_dashboard_kpis.tool_id`

#### RLS Policy Performance
All Row Level Security (RLS) policies must use optimized `auth.uid()` calls to prevent re-evaluation for each row.

**Migration File**: `supabase/optimize-rls-policies.sql`

**Standard Pattern**:
- ❌ **Incorrect**: `auth.uid() = user_id`
- ✅ **Correct**: `(select auth.uid()) = user_id`

**Why**: Wrapping `auth.uid()` in a subquery prevents PostgreSQL from re-evaluating the function for each row, significantly improving query performance at scale.

**Example**:
```sql
-- Optimized RLS policy
CREATE POLICY "Users can view their own records" ON table_name
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);
```

**Special Cases**:
- For tables without `user_id` columns (e.g., junction tables, security_questions), use EXISTS subqueries:
```sql
CREATE POLICY "Users can view their own items" ON junction_table
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_table
      WHERE parent_table.id = junction_table.parent_id
      AND parent_table.user_id = (select auth.uid())
    )
  );
```

**Total Policies Optimized**: 103 RLS policies across all tables

### Storage Buckets and Policies

#### Storage Bucket Setup
When creating storage buckets for file uploads, follow this standardized pattern:

**Bucket Configuration**:
- **Name**: Use kebab-case (e.g., `repair-history`, `pet-care-schedule`, `important-documents`)
- **Public**: `true` (or `false` if using signed URLs)
- **File Size Limit**: `10MB`
- **Allowed MIME Types**: `image/*`, `application/pdf`

**Folder Structure**:
Files are organized by user ID in subfolders:
```
{bucket-name}/{userId}/{timestamp}-{filename}
```
Example: `repair-history/receipts/{userId}/1734567890123-Test_Document.pdf`

#### Storage Policy Pattern
All storage buckets must have Row Level Security (RLS) policies to ensure users can only access their own files.

**Policy Naming Convention**:
Use bucket-specific policy names to avoid conflicts:
```
"{bucket-name}: Users can upload to their own folder"
"{bucket-name}: Users can read their own files"
"{bucket-name}: Users can update their own files"
"{bucket-name}: Users can delete their own files"
```

**Standard Policy Template**:
```sql
-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "{bucket-name}: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "{bucket-name}: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "{bucket-name}: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "{bucket-name}: Users can delete their own files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their own folder
CREATE POLICY "{bucket-name}: Users can upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = '{bucket-name}' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "{bucket-name}: Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = '{bucket-name}' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "{bucket-name}: Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = '{bucket-name}' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = '{bucket-name}' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "{bucket-name}: Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = '{bucket-name}' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Implementation Steps**:
1. Create the storage bucket in Supabase Dashboard > Storage
2. Create a SQL script file: `supabase/create-{bucket-name}-storage-bucket.sql`
3. Include bucket creation instructions and the policy template
4. Run the SQL script in Supabase SQL Editor to apply policies

**Current Storage Buckets**:
- `repair-history` - Stores receipts, warranties, and repair pictures
- `pet-care-schedule` - Stores pet documents
- `important-documents` - Stores important documents (warranties, policies, records)

**Why These Policies Matter**:
- **Security**: Ensures users can only access files in their own folder (`{userId}/...`)
- **Defense in Depth**: Provides protection even if client-side access is added later
- **Consistency**: All buckets follow the same security pattern
- **Idempotent**: Scripts can be safely re-run (DROP IF EXISTS before CREATE)

### Security Standards

#### Function Search Path
All database functions must have an explicit `search_path` set to prevent search path injection attacks.

**Migration File**: `supabase/fix-function-search-path.sql`

**Standard Pattern**:
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Function body
END;
$$;
```

**Why**: Functions without an explicit `search_path` are vulnerable to search path injection attacks where malicious users could potentially manipulate which schemas are searched first.

**Required for All Functions**:
- All trigger functions (e.g., `update_*_updated_at()`)
- All custom functions
- All stored procedures

**Total Functions Secured**: 28 functions

**Function Categories**:
- Billing functions (1)
- Calendar Events functions (2)
- Dashboard functions (1)
- Important Documents functions (3)
- Notes functions (3)
- Pet Care Schedule functions (8)
- Repair History functions (3)
- Subscription Tracker functions (1)
- User Dashboard KPIs functions (1)
- Users functions (1)
- Additional functions (4): promo_codes, tools, tool_icons, users_tools

### Database Migration Guidelines

1. **Always add indexes for foreign keys** when creating new tables
2. **Always use optimized RLS policies** with `(select auth.uid())` pattern
3. **Always set search_path** on all function definitions
4. **Test migrations** in development before applying to production
5. **Document any special cases** in migration file comments

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
- Expand the icon set as needed; use the documented Icon Style (outline, stroke, currentColor) for consistency
- Document responsive breakpoint strategy in more detail
