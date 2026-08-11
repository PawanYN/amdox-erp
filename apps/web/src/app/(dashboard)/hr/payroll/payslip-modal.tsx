"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PayrollRecord } from "@/lib/types/hr";
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
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{
            borderRadius: "8px",
            border: "1px solid #dfe3e8",
            backgroundColor: "#f4f6f8",
            padding: "24px"
          }}>
            <p style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "#6b7280"
            }}>
              Amdox Technologies — Payslip
            </p>
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Employee</span>
                <span style={{ fontWeight: 500, color: "#2b2f36" }}>{record.employeeName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Pay period</span>
                <span style={{ fontWeight: 500, color: "#2b2f36" }}>{record.payPeriod}</span>
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #dfe3e8",
                paddingTop: "8px"
              }}>
                <span style={{ color: "#6b7280" }}>Gross pay</span>
                <span style={{ fontWeight: 500, color: "#2b2f36" }}>{formatINR(record.grossPay)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Deductions</span>
                <span style={{ fontWeight: 500, color: "#dc2626" }}>-{formatINR(record.deductions)}</span>
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid #dfe3e8",
                paddingTop: "8px",
                fontSize: "15px"
              }}>
                <span style={{ fontWeight: 600, color: "#2b2f36" }}>Net pay</span>
                <span style={{ fontWeight: 700, color: "#2b2f36" }}>{formatINR(record.netPay)}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
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
