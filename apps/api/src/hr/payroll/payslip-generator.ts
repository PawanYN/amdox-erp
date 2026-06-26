/**
 * ============================================================================
 * SERVICE: payslip-generator.ts
 * ============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This file replaces the old manual byte-array hack with a proper, standard-compliant
 * PDF generation service using `pdfkit`. It beautifully formats the payslip.
 * ============================================================================
 */
import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PayslipGenerator {
  async generatePdfBuffer(
    employeeName: string,
    payPeriod: string,
    amounts: { grossPay: number; deductions: number; netPay: number }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (buffer) => buffers.push(buffer));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('Amdox ERP Payslip', { align: 'center' })
          .moveDown();

        // Employee Info
        doc
          .fontSize(12)
          .font('Helvetica')
          .text(`Employee Name: ${employeeName}`)
          .text(`Pay Period: ${payPeriod}`)
          .moveDown();

        // Financials
        doc
          .text(`Gross Pay: $${amounts.grossPay.toFixed(2)}`)
          .text(`Deductions: $${amounts.deductions.toFixed(2)}`)
          .moveDown()
          .font('Helvetica-Bold')
          .text(`Net Pay: $${amounts.netPay.toFixed(2)}`);

        // Footer
        doc
          .moveDown(2)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text('This is a computer generated document and requires no signature.', { align: 'center', color: 'gray' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
