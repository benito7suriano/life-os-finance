# Tailwind Color Configuration

## Color Choices

- **Primary:** `emerald` - Used for buttons, links, key accents, active states
- **Secondary:** `amber` - Used for tags, highlights, warning states, sinking fund indicators
- **Neutral:** `slate` - Used for backgrounds, text, borders

## Usage Examples

### Primary (Emerald)

```jsx
// Buttons
<button className="bg-emerald-600 hover:bg-emerald-700 text-white">
  Primary Button
</button>

// Links and active states
<span className="text-emerald-600 dark:text-emerald-400">Active item</span>

// Progress bars
<div className="bg-emerald-500 h-2 rounded-full" />

// Success indicators
<span className="text-emerald-600">+$250 this month</span>
```

### Secondary (Amber)

```jsx
// Tags and badges
<span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded">
  Sinking Fund
</span>

// Warning states
<span className="text-amber-600 dark:text-amber-400">85% of budget used</span>

// Notification badges
<span className="bg-amber-500 text-white rounded-full px-2">3</span>
```

### Neutral (Slate)

```jsx
// Backgrounds
<div className="bg-slate-50 dark:bg-slate-900" />
<div className="bg-slate-100 dark:bg-slate-800" />

// Text
<p className="text-slate-900 dark:text-slate-100">Primary text</p>
<p className="text-slate-600 dark:text-slate-400">Secondary text</p>
<p className="text-slate-500 dark:text-slate-500">Muted text</p>

// Borders
<div className="border border-slate-200 dark:border-slate-700" />
```

## Dark Mode

Always include dark mode variants:

```jsx
// Background with dark mode
<div className="bg-white dark:bg-slate-800">

// Text with dark mode
<p className="text-slate-900 dark:text-slate-100">

// Border with dark mode
<div className="border-slate-200 dark:border-slate-700">
```

## Semantic Color Patterns

### Income (positive amounts)
```jsx
<span className="text-emerald-600 dark:text-emerald-400">+$1,250.00</span>
```

### Expenses (negative amounts)
```jsx
<span className="text-rose-600 dark:text-rose-400">-$450.00</span>
```

### Debt balances
```jsx
<span className="text-rose-600 dark:text-rose-400">-$2,500.00</span>
```

### Over budget
```jsx
<span className="text-amber-600 dark:text-amber-400">115% spent</span>
```
