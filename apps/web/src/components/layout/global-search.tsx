"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  CalendarOff,
  FileText,
  Loader2,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Users,
  X,
} from "lucide-react";
import {
  searchApi,
  type SearchResponse,
  type SearchAuditLogHit,
  type SearchCustomerHit,
  type SearchEmployeeHit,
  type SearchInvoiceHit,
  type SearchJournalEntryHit,
  type SearchLeaveRequestHit,
  type SearchProductHit,
  type SearchProjectHit,
  type SearchPurchaseOrderHit,
  type SearchVendorHit,
} from "@/lib/api/search-api";

// ── Hit union type ────────────────────────────────────────────────────────────

type SearchHit =
  | { kind: "vendor"; item: SearchVendorHit }
  | { kind: "product"; item: SearchProductHit }
  | { kind: "employee"; item: SearchEmployeeHit }
  | { kind: "purchaseOrder"; item: SearchPurchaseOrderHit }
  | { kind: "invoice"; item: SearchInvoiceHit }
  | { kind: "customer"; item: SearchCustomerHit }
  | { kind: "project"; item: SearchProjectHit }
  | { kind: "leaveRequest"; item: SearchLeaveRequestHit }
  | { kind: "auditLog"; item: SearchAuditLogHit }
  | { kind: "journalEntry"; item: SearchJournalEntryHit };

// ── Route map ─────────────────────────────────────────────────────────────────

function routeForHit(hit: SearchHit): string {
  switch (hit.kind) {
    case "vendor":
      return "/scm/vendors";
    case "product":
      return "/scm/products";
    case "employee":
      return "/hr/employees";
    case "purchaseOrder":
      return "/scm/purchase-orders";
    case "invoice":
      return "/finance/invoices";
    case "customer":
      return "/finance/customers";
    case "project":
      return "/pm/projects";
    case "leaveRequest":
      return "/hr/leave-requests";
    case "auditLog":
      return "/settings/audit-logs";
    case "journalEntry":
      return "/finance/journal-entries";
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

const EMPTY_RESULTS: SearchResponse = {
  vendors: [],
  products: [],
  employees: [],
  purchaseOrders: [],
  invoices: [],
  customers: [],
  projects: [],
  leaveRequests: [],
  auditLogs: [],
  journalEntries: [],
};

// ── Main component ────────────────────────────────────────────────────────────

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const flatHits: SearchHit[] = results
    ? [
        ...(results.vendors ?? []).map((item) => ({ kind: "vendor" as const, item })),
        ...(results.products ?? []).map((item) => ({ kind: "product" as const, item })),
        ...(results.employees ?? []).map((item) => ({ kind: "employee" as const, item })),
        ...(results.purchaseOrders ?? []).map((item) => ({ kind: "purchaseOrder" as const, item })),
        ...(results.invoices ?? []).map((item) => ({ kind: "invoice" as const, item })),
        ...(results.customers ?? []).map((item) => ({ kind: "customer" as const, item })),
        ...(results.projects ?? []).map((item) => ({ kind: "project" as const, item })),
        ...(results.leaveRequests ?? []).map((item) => ({ kind: "leaveRequest" as const, item })),
        ...(results.auditLogs ?? []).map((item) => ({ kind: "auditLog" as const, item })),
        ...(results.journalEntries ?? []).map((item) => ({ kind: "journalEntry" as const, item })),
      ]
    : [];

  const reset = useCallback(() => {
    setQuery("");
    setResults(null);
    setError(null);
    setLoading(false);
    setActiveIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    debounceRef.current = setTimeout(async () => {
      const reqId = ++requestIdRef.current;
      try {
        const data = (await searchApi.search(q)) as SearchResponse;
        if (reqId !== requestIdRef.current) return;
        setResults({ ...EMPTY_RESULTS, ...data });
        setActiveIndex(0);
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        setResults(null);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const navigateToHit = (hit: SearchHit) => {
    handleClose();
    router.push(routeForHit(hit));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatHits.length === 0) return;
      setActiveIndex((i) => (i + 1) % flatHits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatHits.length === 0) return;
      setActiveIndex((i) => (i - 1 + flatHits.length) % flatHits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flatHits[activeIndex];
      if (hit) navigateToHit(hit);
    }
  };

  if (!open) return null;

  const hasResults = flatHits.length > 0;
  const showEmpty = !loading && !error && query.trim().length >= 2 && !hasResults;
  const showHint = query.trim().length < 2 && !loading && !error;

  // Offset tracker for keyboard nav across groups
  let offset = 0;
  function nextOffset(count: number) {
    const o = offset;
    offset += count;
    return o;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-[2px] px-4 pt-[12vh] animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white shadow-modal border border-slate-200 overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search employees, invoices, POs, projects…"
            className="flex-1 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
            aria-label="Search query"
          />
          {loading && <Loader2 size={15} className="animate-spin text-slate-400" />}
          <kbd className="hidden sm:inline text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 font-medium">
            ESC
          </kbd>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close search"
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto custom-scrollbar">
          {showHint && (
            <p className="px-4 py-6 text-[13px] text-slate-500 text-center">
              Type at least 2 characters to search
            </p>
          )}
          {error && <p className="px-4 py-6 text-[13px] text-red-600 text-center">{error}</p>}
          {showEmpty && (
            <p className="px-4 py-6 text-[13px] text-slate-500 text-center">
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          {hasResults && (
            <div className="py-2">
              {(results?.employees ?? []).length > 0 && (
                <ResultGroup
                  title="Employees"
                  icon={<Users size={12} />}
                  items={results!.employees}
                  startIndex={nextOffset(results!.employees.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "employee", item })}
                  onHover={setActiveIndex}
                  getLabel={(e) => e.fullName}
                  renderMeta={(e) => e.designation ?? e.department ?? "Employee"}
                />
              )}
              {(results?.purchaseOrders ?? []).length > 0 && (
                <ResultGroup
                  title="Purchase Orders"
                  icon={<ShoppingCart size={12} />}
                  items={results!.purchaseOrders}
                  startIndex={nextOffset(results!.purchaseOrders.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "purchaseOrder", item })}
                  onHover={setActiveIndex}
                  getLabel={(p) => p.poNumber}
                  renderMeta={(p) => p.vendorName ?? p.status ?? "PO"}
                />
              )}
              {(results?.invoices ?? []).length > 0 && (
                <ResultGroup
                  title="Invoices"
                  icon={<FileText size={12} />}
                  items={results!.invoices}
                  startIndex={nextOffset(results!.invoices.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "invoice", item })}
                  onHover={setActiveIndex}
                  getLabel={(i) => i.invoiceNumber}
                  renderMeta={(i) => i.vendorName ?? i.customerName ?? i.status ?? "Invoice"}
                />
              )}
              {(results?.customers ?? []).length > 0 && (
                <ResultGroup
                  title="Customers"
                  icon={<Briefcase size={12} />}
                  items={results!.customers}
                  startIndex={nextOffset(results!.customers.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "customer", item })}
                  onHover={setActiveIndex}
                  getLabel={(c) => c.name}
                  renderMeta={(c) => c.email ?? (c.isActive ? "Active" : "Inactive")}
                />
              )}
              {(results?.projects ?? []).length > 0 && (
                <ResultGroup
                  title="Projects"
                  icon={<Receipt size={12} />}
                  items={results!.projects}
                  startIndex={nextOffset(results!.projects.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "project", item })}
                  onHover={setActiveIndex}
                  getLabel={(p) => p.name}
                  renderMeta={(p) => p.status ?? "Project"}
                />
              )}
              {(results?.leaveRequests ?? []).length > 0 && (
                <ResultGroup
                  title="Leave Requests"
                  icon={<CalendarOff size={12} />}
                  items={results!.leaveRequests}
                  startIndex={nextOffset(results!.leaveRequests.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "leaveRequest", item })}
                  onHover={setActiveIndex}
                  getLabel={(l) => l.employeeName ?? "Leave Request"}
                  renderMeta={(l) => l.status ?? "Leave"}
                />
              )}
              {(results?.vendors ?? []).length > 0 && (
                <ResultGroup
                  title="Vendors"
                  icon={<Store size={12} />}
                  items={results!.vendors}
                  startIndex={nextOffset(results!.vendors.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "vendor", item })}
                  onHover={setActiveIndex}
                  getLabel={(v) => v.name}
                  renderMeta={(v) => v.email ?? "Vendor"}
                />
              )}
              {(results?.products ?? []).length > 0 && (
                <ResultGroup
                  title="Products"
                  icon={<Package size={12} />}
                  items={results!.products}
                  startIndex={nextOffset(results!.products.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "product", item })}
                  onHover={setActiveIndex}
                  getLabel={(p) => p.name}
                  renderMeta={(p) => (p.sku ? `SKU ${p.sku}` : "Product")}
                />
              )}
              {(results?.journalEntries ?? []).length > 0 && (
                <ResultGroup
                  title="Journal Entries"
                  icon={<BookOpen size={12} />}
                  items={results!.journalEntries}
                  startIndex={nextOffset(results!.journalEntries.length)}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "journalEntry", item })}
                  onHover={setActiveIndex}
                  getLabel={(j) => j.reference}
                  renderMeta={(j) => j.sourceModule ?? j.status ?? "Journal"}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span className="flex gap-2 flex-wrap justify-end">
            Employees · Invoices · POs · Projects · Vendors · Products
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Result group ──────────────────────────────────────────────────────────────

function ResultGroup<T extends { id: string }>({
  title,
  icon,
  items,
  startIndex,
  activeIndex,
  onSelect,
  onHover,
  getLabel,
  renderMeta,
}: {
  title: string;
  icon: ReactNode;
  items: T[];
  startIndex: number;
  activeIndex: number;
  onSelect: (item: T) => void;
  onHover: (index: number) => void;
  getLabel: (item: T) => string;
  renderMeta: (item: T) => string;
}) {
  return (
    <div className="mb-1">
      <div className="px-4 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {title}
      </div>
      <ul>
        {items.map((item, i) => {
          const index = startIndex + i;
          const active = index === activeIndex;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                onMouseEnter={() => onHover(index)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                  active ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className={`text-[13px] font-medium truncate ${active ? "text-blue-700" : "text-slate-800"}`}
                >
                  {getLabel(item)}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0 truncate max-w-[45%]">
                  {renderMeta(item)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Keyboard shortcut hook ────────────────────────────────────────────────────

/** Opens search on `/` (when not typing) or Ctrl/Cmd+K. */
export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
        return;
      }
      if (e.key === "/" && !mod && !e.altKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
