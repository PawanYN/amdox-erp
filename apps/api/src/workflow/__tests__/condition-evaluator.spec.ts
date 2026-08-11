import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConditionEvaluator } from '../condition-evaluator';
import { WorkflowCondition } from '../entities/workflow-definition.entity';

describe('ConditionEvaluator', () => {
  let service: ConditionEvaluator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConditionEvaluator],
    }).compile();

    service = module.get<ConditionEvaluator>(ConditionEvaluator);
  });

  describe('field_value conditions', () => {
    it('should evaluate equals operator', async () => {
      const condition: WorkflowCondition = {
        id: 'test-1',
        type: 'field_value',
        field: 'status',
        operator: 'equals',
        value: 'active',
      };

      const document = { status: 'active' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
      expect(result.conditionId).toBe('test-1');
    });

    it('should evaluate neq (not equals) operator', async () => {
      const condition: WorkflowCondition = {
        id: 'test-2',
        type: 'field_value',
        field: 'status',
        operator: 'neq',
        value: 'inactive',
      };

      const document = { status: 'active' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should evaluate contains operator', async () => {
      const condition: WorkflowCondition = {
        id: 'test-3',
        type: 'field_value',
        field: 'email',
        operator: 'contains',
        value: '@company.com',
      };

      const document = { email: 'user@company.com' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should evaluate in operator', async () => {
      const condition: WorkflowCondition = {
        id: 'test-4',
        type: 'field_value',
        field: 'role',
        operator: 'in',
        value: ['admin', 'manager', 'user'],
      };

      const document = { role: 'admin' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should handle nested field access', async () => {
      const condition: WorkflowCondition = {
        id: 'test-5',
        type: 'field_value',
        field: 'vendor.status',
        operator: 'equals',
        value: 'approved',
      };

      const document = { vendor: { status: 'approved' } };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should handle array access', async () => {
      const condition: WorkflowCondition = {
        id: 'test-6',
        type: 'field_value',
        field: 'lineItems[0].amount',
        operator: 'gt',
        value: 100,
      };

      const document = { lineItems: [{ amount: 150 }, { amount: 50 }] };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should return false when condition not met', async () => {
      const condition: WorkflowCondition = {
        id: 'test-7',
        type: 'field_value',
        field: 'status',
        operator: 'equals',
        value: 'approved',
        errorMessage: 'Status must be approved',
      };

      const document = { status: 'draft' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(false);
      expect(result.errorMessage).toBe('Status must be approved');
    });
  });

  describe('amount_threshold conditions', () => {
    it('should evaluate greater than', async () => {
      const condition: WorkflowCondition = {
        id: 'test-8',
        type: 'amount_threshold',
        field: 'totalAmount',
        operator: 'gt',
        value: 5000,
      };

      const document = { totalAmount: 5500 };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should evaluate less than', async () => {
      const condition: WorkflowCondition = {
        id: 'test-9',
        type: 'amount_threshold',
        field: 'totalAmount',
        operator: 'lt',
        value: 5000,
      };

      const document = { totalAmount: 4500 };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should throw error if field is not numeric', async () => {
      const condition: WorkflowCondition = {
        id: 'test-10',
        type: 'amount_threshold',
        field: 'amount',
        operator: 'gt',
        value: 1000,
      };

      const document = { amount: 'not-a-number' };

      await expect(service.evaluate(condition, document)).rejects.toThrow(BadRequestException);
    });
  });

  describe('count conditions', () => {
    it('should count array elements', async () => {
      const condition: WorkflowCondition = {
        id: 'test-11',
        type: 'count',
        field: 'lineItems',
        operator: 'gte',
        value: 1,
      };

      const document = { lineItems: [{ id: 1 }, { id: 2 }] };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should return false when count not met', async () => {
      const condition: WorkflowCondition = {
        id: 'test-12',
        type: 'count',
        field: 'lineItems',
        operator: 'gte',
        value: 3,
        errorMessage: 'Must have at least 3 line items',
      };

      const document = { lineItems: [{ id: 1 }] };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(false);
      expect(result.errorMessage).toBe('Must have at least 3 line items');
    });

    it('should throw error if field is not array', async () => {
      const condition: WorkflowCondition = {
        id: 'test-13',
        type: 'count',
        field: 'amount',
        operator: 'gt',
        value: 5,
      };

      const document = { amount: 100 };

      await expect(service.evaluate(condition, document)).rejects.toThrow(BadRequestException);
    });
  });

  describe('expression conditions', () => {
    it('should evaluate simple expression', async () => {
      const condition: WorkflowCondition = {
        id: 'test-14',
        type: 'expression',
        expression: 'doc.amount > 5000',
      };

      const document = { amount: 6000 };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should evaluate complex expression', async () => {
      const condition: WorkflowCondition = {
        id: 'test-15',
        type: 'expression',
        expression: 'doc.amount > 5000 && doc.status === "pending" && doc.vendor !== null',
      };

      const document = { amount: 6000, status: 'pending', vendor: 'acme' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should return false when expression evaluates to false', async () => {
      const condition: WorkflowCondition = {
        id: 'test-16',
        type: 'expression',
        expression: 'doc.amount > 5000',
        errorMessage: 'Amount must be greater than $5000',
      };

      const document = { amount: 3000 };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(false);
      expect(result.errorMessage).toBe('Amount must be greater than $5000');
    });

    it('should timeout long-running expressions', async () => {
      const condition: WorkflowCondition = {
        id: 'test-17',
        type: 'expression',
        expression: 'while(true) {}', // Infinite loop
      };

      const document = {};

      await expect(service.evaluate(condition, document)).rejects.toThrow(BadRequestException);
    });

    it('should prevent access to require() and other dangerous functions', async () => {
      const condition: WorkflowCondition = {
        id: 'test-18',
        type: 'expression',
        expression: 'require("fs").readFileSync("/etc/passwd")',
      };

      const document = {};

      await expect(service.evaluate(condition, document)).rejects.toThrow(BadRequestException);
    });
  });

  describe('evaluateAll', () => {
    it('should evaluate all conditions and return all results', async () => {
      const conditions: WorkflowCondition[] = [
        {
          id: 'c1',
          type: 'field_value',
          field: 'status',
          operator: 'equals',
          value: 'active',
        },
        {
          id: 'c2',
          type: 'count',
          field: 'items',
          operator: 'gte',
          value: 1,
        },
      ];

      const document = { status: 'active', items: [1, 2, 3] };
      const results = await service.evaluateAll(conditions, document);

      expect(results).toHaveLength(2);
      expect(results[0].result).toBe(true);
      expect(results[1].result).toBe(true);
    });

    it('should continue evaluating even if one fails', async () => {
      const conditions: WorkflowCondition[] = [
        {
          id: 'c1',
          type: 'field_value',
          field: 'status',
          operator: 'equals',
          value: 'approved',
        },
        {
          id: 'c2',
          type: 'count',
          field: 'items',
          operator: 'gte',
          value: 1,
        },
      ];

      const document = { status: 'draft', items: [1, 2] };
      const results = await service.evaluateAll(conditions, document);

      expect(results).toHaveLength(2);
      expect(results[0].result).toBe(false);
      expect(results[1].result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined fields', async () => {
      const condition: WorkflowCondition = {
        id: 'test-19',
        type: 'field_value',
        field: 'nonexistent',
        operator: 'equals',
        value: 'something',
      };

      const document = { status: 'active' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(false);
    });

    it('should handle null values', async () => {
      const condition: WorkflowCondition = {
        id: 'test-20',
        type: 'field_value',
        field: 'vendor',
        operator: 'neq',
        value: null,
      };

      const document = { vendor: 'acme' };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });

    it('should handle empty arrays', async () => {
      const condition: WorkflowCondition = {
        id: 'test-21',
        type: 'count',
        field: 'items',
        operator: 'equals',
        value: 0,
      };

      const document = { items: [] };
      const result = await service.evaluate(condition, document);

      expect(result.result).toBe(true);
    });
  });
});
