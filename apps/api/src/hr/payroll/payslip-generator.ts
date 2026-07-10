/**
 * ============================================================================
 * SERVICE: payslip-generator.ts
 * ============================================================================
 *
 * Formats payslip PDFs with itemised statutory deductions (PF, ESI, PT, TDS, etc.).
 * ============================================================================
 */
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PayrollAmounts } from './payroll-deductions';

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

@Injectable()
export class PayslipGenerator {
  async generatePdfBuffer(
    employeeName: string,
    payPeriod: string,
    amounts: PayrollAmounts,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (buffer) => buffers.push(buffer));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('Amdox ERP Payslip', { align: 'center' })
          .moveDown();

        doc.fontSize(16).text('PAYSLIP', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).fillColor('gray').text(`Employee Name: ${employeeName}`);
        doc.fillColor('black').text(`Pay Period: ${payPeriod}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').fontSize(13).text('Earnings');
        doc.font('Helvetica').fontSize(12);
        doc.text(`Base Salary: ${formatInr(amounts.baseSalary)}`);
        if (amounts.overtimePay > 0) {
          doc.text(`Overtime Pay: ${formatInr(amounts.overtimePay)}`);
        }
        doc.font('Helvetica-Bold').text(`Gross Pay: ${formatInr(amounts.grossPay)}`);
        doc.moveDown();

        doc.font('Helvetica-Bold').fontSize(13).text('Employee Deductions');
        doc.font('Helvetica').fontSize(12);
        doc.text(`Provident Fund (PF): ${formatInr(amounts.pfEmployee)}`);
        if (amounts.esiEmployee > 0) {
          doc.text(`ESI: ${formatInr(amounts.esiEmployee)}`);
        }
        doc.text(`Professional Tax: ${formatInr(amounts.professionalTax)}`);
        doc.text(`Labour Welfare Fund: ${formatInr(amounts.labourWelfareFund)}`);
        doc.text(`Income Tax (TDS): ${formatInr(amounts.incomeTax)}`);
        doc
          .font('Helvetica-Bold')
          .text(`Total Deductions: ${formatInr(amounts.totalEmployeeDeductions)}`)
          .moveDown();

        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(`Net Pay: ${formatInr(amounts.netPay)}`);
        doc.moveDown();

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('gray')
          .text('Employer Contributions (informational)');
        doc.font('Helvetica').fontSize(10);
        doc.text(`PF (Employer): ${formatInr(amounts.pfEmployer)}`);
        if (amounts.esiEmployer > 0) {
          doc.text(`ESI (Employer): ${formatInr(amounts.esiEmployer)}`);
        }
        doc.text(`Gratuity Accrual: ${formatInr(amounts.gratuityAccrual)}`);

        doc
          .moveDown(2)
          .fontSize(10)
          .font('Helvetica-Oblique')
          .fillColor('gray')
          .text('This is a computer generated document and requires no signature.', {
            align: 'center',
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
