import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { prisma, DataSubjectRequestType } from '@amdox/db';
import { StorageService } from '../../infrastructure/common/storage/storage.service';
import { PassThrough } from 'stream';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createArchive = require('archiver') as (
  format: string,
  options?: { zlib?: { level?: number } },
) => import('archiver').Archiver;

@Injectable()
export class GdprService {
  constructor(private readonly storage: StorageService) {}

  async createRequest(tenantId: string, subjectEmail: string, type: DataSubjectRequestType) {
    return prisma.dataSubjectRequest.create({
      data: { tenantId, subjectEmail, type, status: 'OPEN' },
    });
  }

  async listRequests(tenantId: string) {
    return prisma.dataSubjectRequest.findMany({
      where: { tenantId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async fulfillRequest(tenantId: string, requestId: string) {
    const req = await prisma.dataSubjectRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!req) throw new NotFoundException('Data subject request not found');
    if (req.status === 'FULFILLED') {
      throw new BadRequestException('Request already fulfilled');
    }

    let exportKey: string | undefined;
    let erasedCount = 0;

    if (req.type === 'ACCESS' || req.type === 'PORTABILITY') {
      exportKey = await this.buildExportZip(tenantId, req.subjectEmail, requestId);
    } else if (req.type === 'ERASURE') {
      erasedCount = await this.eraseSubjectData(tenantId, req.subjectEmail);
    }

    return prisma.dataSubjectRequest
      .update({
        where: { id: requestId },
        data: { status: 'FULFILLED', fulfilledAt: new Date() },
        // Return metadata via a separate lookup — schema has no exportKey field
      })
      .then((updated) => ({
        ...updated,
        exportKey,
        erasedRecords: erasedCount,
      }));
  }

  async getExportBuffer(tenantId: string, requestId: string): Promise<Buffer> {
    const req = await prisma.dataSubjectRequest.findFirst({
      where: { id: requestId, tenantId, status: 'FULFILLED' },
    });
    if (!req) throw new NotFoundException('Fulfilled request not found');
    if (req.type !== 'ACCESS' && req.type !== 'PORTABILITY') {
      throw new BadRequestException('This request type has no export artifact');
    }
    const key = `gdpr/${tenantId}/${requestId}/export.zip`;
    try {
      return await this.storage.download(key);
    } catch {
      throw new NotFoundException('Export artifact not found — re-fulfill the request');
    }
  }

  private async collectSubjectData(tenantId: string, subjectEmail: string) {
    const [user, employee, leaveRequests, attendance, consents, notifications] = await Promise.all([
      prisma.user.findFirst({ where: { tenantId, email: subjectEmail } }),
      prisma.employee.findFirst({
        where: { tenantId, email: subjectEmail },
        include: { department: true, payslips: true },
      }),
      prisma.leaveRequest.findMany({
        where: { tenantId, employee: { email: subjectEmail } },
      }),
      prisma.attendanceRecord.findMany({
        where: { tenantId, employee: { email: subjectEmail } },
      }),
      prisma.consentRecord.findMany({ where: { tenantId, subjectEmail } }),
      prisma.notification.findMany({
        where: { tenantId, user: { email: subjectEmail } },
        take: 500,
      }),
    ]);
    return { user, employee, leaveRequests, attendance, consents, notifications };
  }

  private async buildExportZip(
    tenantId: string,
    subjectEmail: string,
    requestId: string,
  ): Promise<string> {
    const data = await this.collectSubjectData(tenantId, subjectEmail);
    const zipBuffer = await this.zipJson({
      'user.json': data.user,
      'employee.json': data.employee,
      'leave-requests.json': data.leaveRequests,
      'attendance.json': data.attendance,
      'consents.json': data.consents,
      'notifications.json': data.notifications,
      'manifest.json': {
        subjectEmail,
        tenantId,
        exportedAt: new Date().toISOString(),
        requestId,
      },
    });

    const key = `gdpr/${tenantId}/${requestId}/export.zip`;
    await this.storage.upload(key, zipBuffer, 'application/zip');
    return key;
  }

  private zipJson(files: Record<string, unknown>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = createArchive('zip', { zlib: { level: 9 } });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
      archive.on('error', reject);
      archive.pipe(stream);
      for (const [name, content] of Object.entries(files)) {
        archive.append(JSON.stringify(content, null, 2), { name });
      }
      archive.finalize();
    });
  }

  private async eraseSubjectData(tenantId: string, subjectEmail: string): Promise<number> {
    const anonTag = `erased-${Date.now()}`;
    const anonEmail = `${anonTag}@anonymized.local`;
    let count = 0;

    const user = await prisma.user.findFirst({ where: { tenantId, email: subjectEmail } });
    if (user) {
      await prisma.notification.deleteMany({ where: { tenantId, userId: user.id } });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: anonEmail,
          fullName: 'Anonymized User',
          passwordHash: null,
          isActive: false,
          deletedAt: new Date(),
        },
      });
      count += 1;
    }

    const employee = await prisma.employee.findFirst({ where: { tenantId, email: subjectEmail } });
    if (employee) {
      await prisma.$transaction([
        prisma.leaveRequest.deleteMany({ where: { tenantId, employeeId: employee.id } }),
        prisma.attendanceRecord.deleteMany({ where: { tenantId, employeeId: employee.id } }),
        prisma.employee.update({
          where: { id: employee.id },
          data: {
            email: anonEmail,
            fullName: 'Anonymized Employee',
            status: 'TERMINATED',
            deletedAt: new Date(),
          },
        }),
      ]);
      count += 1;
    }

    await prisma.consentRecord.deleteMany({ where: { tenantId, subjectEmail } });

    return count;
  }

  async recordConsent(
    tenantId: string,
    subjectEmail: string,
    consentType: string,
    granted: boolean,
  ) {
    return prisma.consentRecord.create({
      data: { tenantId, subjectEmail, consentType, granted },
    });
  }

  async listConsents(tenantId: string, subjectEmail?: string) {
    return prisma.consentRecord.findMany({
      where: {
        tenantId,
        ...(subjectEmail ? { subjectEmail } : {}),
      },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
