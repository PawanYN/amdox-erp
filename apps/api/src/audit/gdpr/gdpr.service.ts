import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, DataSubjectRequestType } from '@amdox/db';

@Injectable()
export class GdprService {
  private prisma = new PrismaClient();

  async createRequest(tenantId: string, subjectEmail: string, type: DataSubjectRequestType) {
    return this.prisma.dataSubjectRequest.create({
      data: { tenantId, subjectEmail, type, status: 'OPEN' },
    });
  }

  async listRequests(tenantId: string) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { tenantId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async fulfillRequest(tenantId: string, requestId: string) {
    const req = await this.prisma.dataSubjectRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!req) throw new NotFoundException('Data subject request not found');
    if (req.status === 'FULFILLED') {
      throw new BadRequestException('Request already fulfilled');
    }

    // tenant-scope-ok: `req` was just found via a tenantId-scoped findFirst above.
    return this.prisma.dataSubjectRequest.update({
      where: { id: requestId },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });
  }

  async recordConsent(
    tenantId: string,
    subjectEmail: string,
    consentType: string,
    granted: boolean,
  ) {
    return this.prisma.consentRecord.create({
      data: { tenantId, subjectEmail, consentType, granted },
    });
  }

  async listConsents(tenantId: string, subjectEmail?: string) {
    return this.prisma.consentRecord.findMany({
      where: {
        tenantId,
        ...(subjectEmail ? { subjectEmail } : {}),
      },
      orderBy: { recordedAt: 'desc' },
    });
  }
}
