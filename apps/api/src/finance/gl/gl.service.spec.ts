import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';

// Mock the shared Prisma client so the double-entry guard is tested without a DB.
vi.mock('@amdox/db', () => {
  const tx = {
    fiscalPeriod: { findFirst: vi.fn() },
    journalEntry: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    __tx: tx,
  };
  return { prisma };
});

import { prisma } from '@amdox/db';
import { GlService } from './gl.service';

type MockTx = {
  fiscalPeriod: { findFirst: Mock };
  journalEntry: { create: Mock };
};
const tx = (prisma as unknown as { __tx: MockTx }).__tx;

const OPEN_PERIOD = { id: 'fp1', name: '2026-07', isLocked: false };
const LOCKED_PERIOD = { id: 'fp1', name: '2026-06', isLocked: true };

function dto(lines: { accountId: string; debit: number; credit: number }[]) {
  return {
    fiscalPeriodId: 'fp1',
    reference: 'TEST-1',
    description: 'test entry',
    lines,
  };
}

describe('GlService.createJournalEntry — double-entry guard (F-02)', () => {
  let service: GlService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GlService({ emit: vi.fn() } as never, { indexJournalEntry: vi.fn() } as never);
    tx.journalEntry.create.mockResolvedValue({
      id: 'je1',
      reference: 'TEST-1',
      lines: [],
    });
  });

  it('posts a balanced entry (debits = credits)', async () => {
    tx.fiscalPeriod.findFirst.mockResolvedValue(OPEN_PERIOD);

    const entry = await service.createJournalEntry(
      't1',
      dto([
        { accountId: 'a1', debit: 500, credit: 0 },
        { accountId: 'a2', debit: 0, credit: 500 },
      ]),
    );

    expect(entry.id).toBe('je1');
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an unbalanced entry and never writes it', async () => {
    tx.fiscalPeriod.findFirst.mockResolvedValue(OPEN_PERIOD);

    await expect(
      service.createJournalEntry(
        't1',
        dto([
          { accountId: 'a1', debit: 500, credit: 0 },
          { accountId: 'a2', debit: 0, credit: 499 },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('accepts a multi-line entry whose sides balance in aggregate', async () => {
    tx.fiscalPeriod.findFirst.mockResolvedValue(OPEN_PERIOD);

    await service.createJournalEntry(
      't1',
      dto([
        { accountId: 'a1', debit: 300, credit: 0 },
        { accountId: 'a2', debit: 200, credit: 0 },
        { accountId: 'a3', debit: 0, credit: 500 },
      ]),
    );
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1);
  });

  it('rejects posting into a locked fiscal period (period close control)', async () => {
    tx.fiscalPeriod.findFirst.mockResolvedValue(LOCKED_PERIOD);

    await expect(
      service.createJournalEntry(
        't1',
        dto([
          { accountId: 'a1', debit: 100, credit: 0 },
          { accountId: 'a2', debit: 0, credit: 100 },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects when the fiscal period does not exist', async () => {
    tx.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(
      service.createJournalEntry(
        't1',
        dto([
          { accountId: 'a1', debit: 100, credit: 0 },
          { accountId: 'a2', debit: 0, credit: 100 },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
