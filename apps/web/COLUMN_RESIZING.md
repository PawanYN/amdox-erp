# Column Resizing Feature — Excel-Style Table Resizing

## Overview

All tables in Amdox ERP now support draggable column resizing, just like Excel. Users can drag the right edge of any column header to resize it.

## Features

✅ **Drag-to-Resize** — Hover over the right edge of a column header and drag to resize
✅ **Persistent** — Column widths are saved to localStorage and restored on page reload
✅ **Smooth** — Smooth transitions with visual feedback
✅ **Minimum Width** — 80px minimum column width to prevent too-narrow columns
✅ **Optional** — Can be disabled per table if needed
✅ **Visual Feedback** — Blue highlight appears on column borders during resize

## Usage

### Enable Resizing (Default)

All tables have column resizing **enabled by default**:

```tsx
<DataTable
  data={vendors}
  columns={columns}
  keyExtractor={(v) => v.id}
  tableId="vendors-table" // Unique ID for localStorage persistence
/>
```

### Disable Resizing

To disable resizing for a specific table:

```tsx
<DataTable
  data={vendors}
  columns={columns}
  keyExtractor={(v) => v.id}
  tableId="vendors-table"
  resizable={false} // Disable resizing
/>
```

### Set Initial Column Widths

Specify initial widths in the column definition:

```tsx
const columns: ColumnDef<Vendor>[] = [
  {
    header: "Vendor",
    cell: (v) => <div>{v.name}</div>,
    width: 250, // Set initial width to 250px
  },
  {
    header: "Email",
    cell: (v) => <span>{v.email}</span>,
    width: 300,
  },
  {
    header: "Phone",
    accessorKey: "phone",
    width: 150,
  },
];
```

## Technical Details

### Component: `DataTable`

**Location:** `apps/web/src/components/ui/data-table.tsx`

**New Props:**
- `resizable?: boolean` — Enable/disable column resizing (default: `true`)
- `tableId?: string` — Unique identifier for localStorage persistence (default: `"default-table"`)

**Storage:**
- Column widths are stored in localStorage under key: `table-widths-{tableId}`
- Format: JSON array of numbers `[150, 300, 200, ...]`

### How It Works

1. **Mouse Down** — User presses mouse on column header right edge (within 10px)
2. **Drag** — Mouse moves while holding down → column width updates in real-time
3. **Mouse Up** — User releases mouse → resizing stops
4. **Save** — Column widths automatically saved to localStorage
5. **Reload** — On page reload, widths are restored from localStorage

### Constraints

- **Minimum Width:** 80px (prevents extremely narrow columns)
- **Visual Feedback:** Blue highlight (#1f5fa8) on resize handle
- **Hover Effect:** Resize handle appears with transparency
- **User Select:** Prevented during drag to prevent text selection

## Styling

### Resize Handle

- **Color:** #1f5fa8 (Sankirtan primary blue)
- **Width:** 10px (hover area)
- **Visible:** Hover over column border or during drag
- **Opacity:** 
  - Hover: 30%
  - Dragging: 50%
  - Default: 0% (invisible)

### Column Headers

- **Cursor:** Changes to `col-resize` when hovering over resize handle
- **Overflow:** Text truncated with ellipsis if too long
- **Whitespace:** No wrap (prevents multi-line headers)

## Examples

### Vendors Table

```tsx
export default function VendorsPage() {
  // ... component logic
  
  return (
    <DataTable
      data={vendors}
      columns={columns}
      keyExtractor={(v) => v.id}
      tableId="vendors-table" // Unique ID for persistence
      emptyMessage="No vendors found."
    />
  );
}
```

### Chart of Accounts

```tsx
// Can disable resizing if not needed
<DataTable
  data={accounts}
  columns={columns}
  keyExtractor={(a) => a.code}
  tableId="accounts-table"
  resizable={false} // Disable for this table
/>
```

## Browser Support

✅ Chrome/Edge (v90+)
✅ Firefox (v88+)
✅ Safari (v14+)

Requires:
- localStorage API
- CSS Grid or flexbox
- Mouse events

## FAQ

### Q: Do column widths persist across tabs?

**A:** Yes! Column widths are stored in localStorage, so they persist across tabs, windows, and page reloads.

### Q: Can I reset column widths to default?

**A:** Clear localStorage for that table:
```javascript
localStorage.removeItem('table-widths-vendors-table');
location.reload(); // Reload to see defaults
```

### Q: What if I have multiple tables on one page?

**A:** Use unique `tableId` for each table:
```tsx
<DataTable tableId="vendors-table" ... />
<DataTable tableId="products-table" ... />
// Each table will have its own localStorage entry
```

### Q: Can I disable resizing for specific columns?

**A:** Not directly, but you can:
1. Set `resizable={false}` to disable for entire table
2. Or provide fixed widths in initial column definitions

### Q: How do I set minimum/maximum column widths?

**A:** Currently:
- **Minimum:** Fixed at 80px globally
- **Maximum:** No limit (user can drag as wide as needed)

To customize, edit `data-table.tsx` and change the `minWidth` constant.

## Implementation Notes

### localStorage Key Format

```
table-widths-{tableId}
```

Examples:
- `table-widths-vendors-table`
- `table-widths-products-table`
- `table-widths-accounts-table`

### Performance

- No re-renders during drag (pure React state updates)
- Efficient mouseMove handling (no debouncing needed)
- localStorage writes only on mouseUp (not during drag)

### Accessibility

- Resize handle is indicated by cursor change
- Keyboard users: Use Tab to navigate, but resizing requires mouse
- Screen readers: Column header text is preserved

## Future Enhancements

Potential improvements:
- [ ] Keyboard support (Shift+Arrow keys to resize)
- [ ] Double-click column header to auto-fit content
- [ ] Right-click context menu to reset widths
- [ ] Drag-to-reorder columns
- [ ] Save/load layout profiles
- [ ] Per-user column preferences (backend storage)
