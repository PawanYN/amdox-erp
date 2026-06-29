import { InventoryItem, PurchaseOrder, Vendor } from "../types";

export const mockInventory: InventoryItem[] = [
  {
    id: "ITM-001",
    name: "ThinkPad T14",
    category: "Electronics",
    stock: 45,
    minStock: 10,
    unitPrice: 1200,
    status: "In Stock",
  },
  {
    id: "ITM-002",
    name: "Ergonomic Chair",
    category: "Furniture",
    stock: 8,
    minStock: 15,
    unitPrice: 250,
    status: "Low Stock",
  },
  {
    id: "ITM-003",
    name: "Mechanical Keyboard",
    category: "Electronics",
    stock: 0,
    minStock: 20,
    unitPrice: 150,
    status: "Out of Stock",
  },
];

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: "PO-1001",
    vendorId: "VND-001",
    vendorName: "TechSource",
    date: "2026-06-15",
    amount: 15000,
    status: "Sent",
  },
  {
    id: "PO-1002",
    vendorId: "VND-002",
    vendorName: "OfficeSupplies Inc",
    date: "2026-06-20",
    amount: 3200,
    status: "Draft",
  },
  {
    id: "PO-1003",
    vendorId: "VND-001",
    vendorName: "TechSource",
    date: "2026-06-05",
    amount: 45000,
    status: "Fulfilled",
  },
];

export const mockVendors: Vendor[] = [
  {
    id: "VND-001",
    name: "TechSource",
    contactPerson: "Alice Smith",
    email: "alice@techsource.com",
    phone: "+1-555-0192",
    rating: 4.8,
    status: "Active",
  },
  {
    id: "VND-002",
    name: "OfficeSupplies Inc",
    contactPerson: "Bob Jones",
    email: "bob@officesupplies.inc",
    phone: "+1-555-8832",
    rating: 4.2,
    status: "Active",
  },
  {
    id: "VND-003",
    name: "Global Logistics",
    contactPerson: "Charlie Brown",
    email: "contact@globallogistics.com",
    phone: "+1-555-1122",
    rating: 3.5,
    status: "Inactive",
  },
];
