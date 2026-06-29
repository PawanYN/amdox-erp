import { Account, JournalEntry, Invoice, AgingRecord } from "../types";

export const mockAccounts: Account[] = [
  { id: "1010", name: "Cash in Bank", type: "Asset", balance: 150000 },
  { id: "1200", name: "Accounts Receivable", type: "Asset", balance: 45000 },
  { id: "2010", name: "Accounts Payable", type: "Liability", balance: -25000 },
  { id: "3000", name: "Owner's Equity", type: "Equity", balance: -100000 },
  { id: "4000", name: "Sales Revenue", type: "Revenue", balance: -85000 },
  { id: "5010", name: "Office Expenses", type: "Expense", balance: 15000 },
];

export const mockJournalEntries: JournalEntry[] = [
  {
    id: "JE-001",
    date: "2026-06-01",
    description: "Initial Capital Investment",
    debitAccount: "1010 - Cash in Bank",
    creditAccount: "3000 - Owner's Equity",
    amount: 100000,
    status: "Posted",
  },
  {
    id: "JE-002",
    date: "2026-06-15",
    description: "Office Supplies Purchase",
    debitAccount: "5010 - Office Expenses",
    creditAccount: "1010 - Cash in Bank",
    amount: 5000,
    status: "Draft",
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: "INV-2026-001",
    clientId: "CLI-01",
    clientName: "Acme Corp",
    date: "2026-05-15",
    dueDate: "2026-06-15",
    amount: 15000,
    status: "Overdue",
  },
  {
    id: "INV-2026-002",
    clientId: "CLI-02",
    clientName: "Global Tech",
    date: "2026-06-01",
    dueDate: "2026-07-01",
    amount: 25000,
    status: "Sent",
  },
  {
    id: "INV-2026-003",
    clientId: "CLI-03",
    clientName: "Beta Solutions",
    date: "2026-05-01",
    dueDate: "2026-05-31",
    amount: 10000,
    status: "Paid",
  },
];

export const mockAgingData: AgingRecord[] = [
  {
    clientId: "CLI-01",
    clientName: "Acme Corp",
    current: 0,
    days30: 15000,
    days60: 5000,
    days90: 0,
    days90Plus: 0,
    total: 20000,
  },
  {
    clientId: "CLI-02",
    clientName: "Global Tech",
    current: 25000,
    days30: 0,
    days60: 0,
    days90: 0,
    days90Plus: 0,
    total: 25000,
  },
];
