# Amdox ERP — Unified UI Design System (Sankirtan Style)

## Overview
All pages in the application now follow a consistent design system inspired by the Sankirtan Management Software demo. This ensures a cohesive, professional user experience across the entire ERP.

## Color Palette

### Primary Brand Colors
- **Primary Blue**: `#1f5fa8` (Sankirtan darker blue) — Used for active states, primary buttons, links
- **Dark Blue**: `#12406f` — Used for hover states and emphasis
- **Light Blue**: `#e8f1fb` — Used for backgrounds and light accents

### Text Colors
- **Main Text**: `#2b2f36` — Primary text color
- **Secondary Text**: `#555` — Secondary text elements
- **Muted Text**: `#6b7280` — Disabled, placeholder, and muted elements

### Surfaces
- **Page Background**: `#f4f6f8` — Main page background
- **Card Background**: `#ffffff` — Card and container backgrounds
- **Hover Background**: `#f7f9fb` — Hover states

### Borders & Dividers
- **Primary Border**: `#dfe3e8` — Main border color
- **Secondary Border**: `#e3e6ea` — Secondary borders

### Status Colors
- **Success**: `#1e7a3e` (dark green)
- **Warning/Pending**: `#8a6300` (amber)
- **Danger/Error**: `#d0392b` (red)

## Component Styles

### Buttons

#### Primary Button
```css
.btn.primary {
  background: #1f5fa8;
  border-color: #1f5fa8;
  color: #fff;
  padding: 8px 18px;
  border-radius: 4px;
  font-weight: 600;
}
.btn.primary:hover {
  background: #12406f;
}
```

#### Secondary Button (Default)
```css
.btn {
  background: #fff;
  border: 1px solid #dfe3e8;
  color: #2b2f36;
  padding: 8px 18px;
  border-radius: 4px;
}
.btn:hover {
  background: #f4f6f8;
}
```

### Forms

#### Form Row Layout (2-Column)
```css
.form-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f2f3f5;
}
```

#### Form Inputs
```css
input, select, textarea {
  width: 100%;
  max-width: 340px;
  padding: 7px 10px;
  border: 1px solid #dfe3e8;
  border-radius: 4px;
  color: #2b2f36;
  font-size: 13px;
}
input:focus, select:focus, textarea:focus {
  border-color: #1f5fa8;
  box-shadow: 0 0 0 3px rgb(31 95 168 / 0.10);
  outline: none;
}
```

### Cards
```css
.card {
  background: #ffffff;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  padding: 20px 24px;
}
```

### Tables
```css
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
table th {
  background: #f7f9fb;
  color: #6b7280;
  padding: 9px 12px;
  border-bottom: 1px solid #dfe3e8;
  font-weight: 600;
}
table td {
  padding: 9px 12px;
  border-bottom: 1px solid #f2f3f5;
}
table tr:hover td {
  background: #fafbfc;
}
```

### Badges / Status Indicators

#### Active Status
```css
background: #e6f4ea;
color: #1e7a3e;
border: 1px solid #1e7a3e;
```

#### Inactive Status
```css
background: #f7f9fb;
color: #6b7280;
border: 1px solid #dfe3e8;
```

#### Pending Status
```css
background: #fff6e0;
color: #8a6300;
border: 1px solid #8a6300;
```

#### Rejected/Error Status
```css
background: #fdecea;
color: #d0392b;
border: 1px solid #d0392b;
```

## Page Structure

All pages should follow this pattern:

```
Page Container (space-y-6)
├── Header Section
│   ├── Page Title (page-title class)
│   ├── Page Subtitle (page-subtitle class)
│   └── Action Button (Primary)
├── Stat Cards Row (grid grid-cols-2 gap-4)
│   ├── StatCard (Total Count)
│   └── StatCard (Active Count)
└── Data Table (Card)
    ├── Header with Search/Filters
    └── Table with Actions (Edit/Delete)
```

## Reusable Components

### FormRow Component
Located: `apps/web/src/components/ui/form-row.tsx`

```tsx
<FormRow label="Vendor Name" required>
  <FormInput
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="e.g. Acme Supplies"
  />
</FormRow>
```

### FormSelect Component
```tsx
<FormRow label="Status">
  <FormSelect value={status} onChange={(e) => setStatus(e.target.value)}>
    <option>Select...</option>
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </FormSelect>
</FormRow>
```

### Button Component
```tsx
<Button>Default</Button>
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="danger">Delete</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="outline">Outline</Button>
```

### Badge Component
```tsx
<Badge tone="active">Active</Badge>
<Badge tone="inactive">Inactive</Badge>
<Badge tone="pending">Pending</Badge>
<Badge tone="approved">Approved</Badge>
<Badge tone="rejected">Rejected</Badge>
```

## Global CSS Classes

The following utility classes are available globally:

- `.page-title` — Page heading (18px, 600 weight, #2b2f36)
- `.page-subtitle` — Page description (13px, #6b7280)
- `.btn` — Button base style
- `.btn.primary` — Primary button
- `.form-row` — Form row layout
- `.card` — Card container
- `.table-data` — Data table styling
- `.badge` — Status badge

## Typography

- **Font Family**: "Segoe UI", "Inter", Arial, system-ui
- **Body Font Size**: 14px
- **Line Height**: 1.5
- **Text Color**: #2b2f36

### Font Sizes
- Page Title: 18px (600 weight)
- Large Text: 16px
- Body Text: 14px
- Small Text: 13px
- Extra Small: 11-12px

## Spacing

- Grid/Gap: 4px, 6px, 8px, 12px, 16px, 20px, 24px, 32px, 40px
- Padding: 8px, 12px, 16px, 20px, 24px
- Margin: Same as padding

## Examples of Updated Pages

1. **Vendors** (`apps/web/src/app/(dashboard)/scm/vendors/page.tsx`)
   - Form with FormRow layout
   - Stat cards for metrics
   - Data table with actions
   - Modal forms with consistent styling

## Implementation Checklist

Pages to update (in priority order):

- [x] Vendors (SCM)
- [ ] Finance → Chart of Accounts
- [ ] Finance → Invoices (AP & AR)
- [ ] HR → Employees
- [ ] HR → Departments
- [ ] Projects → Overview
- [ ] Products (SCM)
- [ ] Purchase Orders (SCM)
- [ ] All other pages

## Notes

- All inline styles use the color variables defined above
- Hover states: Use `onMouseEnter/onMouseLeave` for interactive elements
- Focus states: Blue border (#1f5fa8) with 10% opacity shadow
- Transitions: 0.15s ease for smooth interactions
- Border radius: 4px for inputs/buttons, 6px for cards
