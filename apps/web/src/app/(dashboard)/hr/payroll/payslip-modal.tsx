"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PayrollRecord } from "@/lib/types";
import { hrApi } from "@/lib/api/hr-api";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function PayslipModal({
  record,
  onClose,
}: {
  record: PayrollRecord | null;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!record) return;
    setDownloading(true);
    try {
      const blob = await hrApi.downloadPayslip(record.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${record.employeeName.replace(/\s+/g, "-")}-${record.payPeriod}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download payslip PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open={record !== null}
      onClose={onClose}
      title="Payslip"
      description={record ? `${record.employeeName} · ${record.payPeriod}` : undefined}
    >
      {record && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-canvas p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Amdox Technologies — Payslip
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Employee</span>
                <span className="font-medium text-ink">{record.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Pay period</span>
                <span className="font-medium text-ink">{record.payPeriod}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="text-muted">Gross pay</span>
                <span className="font-medium text-ink">{formatINR(record.grossPay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Deductions</span>
                <span className="font-medium text-accent-red">
                  -{formatINR(record.deductions)}
                </span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <span className="font-semibold text-ink">Net pay</span>
                <span className="font-bold text-ink">{formatINR(record.netPay)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={downloading}
              icon={downloading ? <Loader2 size={16} className="animate-spin" /> : undefined}
            >
              {downloading ? "Downloading…" : "Download PDF"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
