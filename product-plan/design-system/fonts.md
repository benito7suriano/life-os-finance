# Typography Configuration

## Google Fonts Import

Add to your HTML `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Or import in your CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

## Font Usage

### Headings: Inter

Used for all headings, navigation, buttons, and labels.

```jsx
// Page titles
<h1 className="text-2xl font-bold">Dashboard</h1>

// Section headings
<h2 className="text-lg font-semibold">Recent Transactions</h2>

// Card titles
<h3 className="font-medium">Net Worth</h3>
```

### Body Text: Inter

Used for paragraphs, descriptions, and general content.

```jsx
// Regular body text
<p className="text-sm text-slate-600">Here's your financial summary</p>

// Small labels
<span className="text-xs font-medium uppercase tracking-wider">This month</span>
```

### Monospace: JetBrains Mono

Used for amounts, account numbers, verification codes, and technical data.

```jsx
// Currency amounts
<span className="font-mono text-2xl font-bold">$12,450.00</span>

// Account numbers / card digits
<span className="font-mono text-sm">****1234</span>

// Verification codes
<input className="font-mono tracking-widest" placeholder="000000" />
```

## Tailwind Configuration

If using Tailwind, configure your font families:

```js
// In your CSS (Tailwind v4)
@theme {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

Then use with utility classes:

```jsx
<span className="font-sans">Regular text</span>
<span className="font-mono">$1,234.56</span>
```

## Font Weights

- **Regular (400):** Body text, descriptions
- **Medium (500):** Labels, navigation items, secondary buttons
- **Semibold (600):** Subheadings, card titles, primary buttons
- **Bold (700):** Page titles, large amounts, emphasis
