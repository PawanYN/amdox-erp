"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package, Search, Store, X } from "lucide-react";
import { searchApi, SearchResponse, SearchProductHit, SearchVendorHit } from "@/lib/api/search-api";

type SearchHit =
  | { kind: "vendor"; item: SearchVendorHit }
  | { kind: "product"; item: SearchProductHit };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

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

  const flatHits: SearchHit[] = [
    ...(results?.vendors ?? []).map((item) => ({ kind: "vendor" as const, item })),
    ...(results?.products ?? []).map((item) => ({ kind: "product" as const, item })),
  ];

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
        setResults({
          vendors: Array.isArray(data?.vendors) ? data.vendors : [],
          products: Array.isArray(data?.products) ? data.products : [],
        });
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
    if (hit.kind === "vendor") {
      router.push("/scm/vendors");
      return;
    }
    router.push("/scm/products");
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

  const showEmpty = !loading && !error && query.trim().length >= 2 && flatHits.length === 0;
  const showHint = query.trim().length < 2 && !loading && !error;

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
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search vendors, products…"
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

        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
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

          {results && (results.vendors.length > 0 || results.products.length > 0) && (
            <div className="py-2">
              {results.vendors.length > 0 && (
                <ResultGroup
                  title="Vendors"
                  icon={<Store size={12} />}
                  items={results.vendors}
                  startIndex={0}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "vendor", item })}
                  onHover={setActiveIndex}
                  renderMeta={(v) => v.email || "Vendor"}
                  getLabel={(v) => v.name}
                />
              )}
              {results.products.length > 0 && (
                <ResultGroup
                  title="Products"
                  icon={<Package size={12} />}
                  items={results.products}
                  startIndex={results.vendors.length}
                  activeIndex={activeIndex}
                  onSelect={(item) => navigateToHit({ kind: "product", item })}
                  onHover={setActiveIndex}
                  renderMeta={(p) => (p.sku ? `SKU ${p.sku}` : "Product")}
                  getLabel={(p) => p.name}
                />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span>Vendors &amp; products</span>
        </div>
      </div>
    </div>
  );
}

function ResultGroup<T extends { id: string; name: string }>({
  title,
  icon,
  items,
  startIndex,
  activeIndex,
  onSelect,
  onHover,
  renderMeta,
  getLabel,
}: {
  title: string;
  icon: ReactNode;
  items: T[];
  startIndex: number;
  activeIndex: number;
  onSelect: (item: T) => void;
  onHover: (index: number) => void;
  renderMeta: (item: T) => string;
  getLabel: (item: T) => string;
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
                  className={`text-[13px] font-medium truncate ${
                    active ? "text-blue-700" : "text-slate-800"
                  }`}
                >
                  {getLabel(item)}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0 truncate max-w-[40%]">
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

/** Hook: open search on `/` (when not typing) or Ctrl/Cmd+K. */
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
