import { Injectable, Logger } from '@nestjs/common';
import { CreateInvoiceDto, InvoiceType } from '../dto/create-invoice.dto';

/**
 * Service to simulate OCR parsing of an invoice PDF/image into structured JSON.
 * 
 * WHAT: Parses a binary document buffer into structured invoice data (amount, lines, vendor).
 * WHY: F-03 AP Automation requires >= 95% OCR accuracy. In a production system, this service 
 * delegates to an engine like AWS Textract or Tesseract (not an LLM) to reliably extract fields.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  /**
   * WHAT: Mocks the process of extracting data from a physical or digital document.
   * WHY: Allows the rest of the AP flow (3-way match, outbox pattern) to be tested
   * end-to-end without incurring real OCR API costs.
   */
  async extractInvoiceData(documentBuffer: Buffer): Promise<{ data: CreateInvoiceDto, confidenceScore: number }> {
    this.logger.log('Simulating OCR extraction from document buffer...');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mocked high confidence extraction
    const mockConfidence = 0.96; // 96% accuracy
    
    const mockData: CreateInvoiceDto = {
      type: InvoiceType.AP,
      invoiceNumber: `INV-OCR-${Math.floor(Math.random() * 10000)}`,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
      totalAmount: 1500.00,
      lines: [
        {
          description: 'Extracted Line Item 1',
          quantity: 10,
          unitPrice: 100,
          lineTotal: 1000,
        },
        {
          description: 'Extracted Line Item 2',
          quantity: 5,
          unitPrice: 100,
          lineTotal: 500,
        }
      ]
    };

    this.logger.log(`OCR Extraction complete. Confidence: ${mockConfidence * 100}%`);

    return {
      data: mockData,
      confidenceScore: mockConfidence,
    };
  }
}
