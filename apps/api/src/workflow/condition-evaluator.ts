import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { WorkflowCondition } from './entities/workflow-definition.entity';
import { ConditionEvalResult } from './entities/workflow-instance.entity';
import * as vm from 'vm';

@Injectable()
export class ConditionEvaluator {
  private readonly logger = new Logger(ConditionEvaluator.name);

  async evaluate(condition: WorkflowCondition, document: any): Promise<ConditionEvalResult> {
    try {
      let result: boolean;

      switch (condition.type) {
        case 'field_value':
          result = this.evaluateFieldValue(condition, document);
          break;
        case 'amount_threshold':
          result = this.evaluateAmountThreshold(condition, document);
          break;
        case 'count':
          result = this.evaluateCount(condition, document);
          break;
        case 'expression':
          result = await this.evaluateExpression(condition, document);
          break;
        default:
          throw new BadRequestException(`Unknown condition type: ${condition.type}`);
      }

      return {
        conditionId: condition.id,
        description: `${condition.type}: ${condition.field || condition.expression}`,
        result,
        errorMessage: result ? undefined : condition.errorMessage,
      };
    } catch (error: any) {
      this.logger.error(`Condition evaluation failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Condition evaluation failed: ${condition.errorMessage || error.message}`,
      );
    }
  }

  async evaluateAll(
    conditions: WorkflowCondition[],
    document: any,
  ): Promise<ConditionEvalResult[]> {
    const results = await Promise.all(
      conditions.map((condition) => this.evaluate(condition, document)),
    );
    return results;
  }

  private evaluateFieldValue(condition: WorkflowCondition, document: any): boolean {
    const fieldValue = this.getFieldValue(document, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'neq':
        return fieldValue !== condition.value;
      case 'gt':
        return fieldValue > condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      default:
        throw new BadRequestException(`Unknown operator: ${condition.operator}`);
    }
  }

  private evaluateAmountThreshold(condition: WorkflowCondition, document: any): boolean {
    const fieldValue = Number(this.getFieldValue(document, condition.field));

    if (isNaN(fieldValue)) {
      throw new BadRequestException(
        `Field "${condition.field}" is not a valid number for amount threshold`,
      );
    }

    const threshold = Number(condition.value);

    switch (condition.operator) {
      case 'gt':
        return fieldValue > threshold;
      case 'gte':
        return fieldValue >= threshold;
      case 'lt':
        return fieldValue < threshold;
      case 'lte':
        return fieldValue <= threshold;
      case 'equals':
        return fieldValue === threshold;
      default:
        throw new BadRequestException(`Unsupported operator for amount: ${condition.operator}`);
    }
  }

  private evaluateCount(condition: WorkflowCondition, document: any): boolean {
    const fieldValue = this.getFieldValue(document, condition.field);

    if (!Array.isArray(fieldValue)) {
      throw new BadRequestException(`Field "${condition.field}" is not an array`);
    }

    const count = fieldValue.length;
    const expectedValue = Number(condition.value);

    switch (condition.operator) {
      case 'equals':
        return count === expectedValue;
      case 'gt':
        return count > expectedValue;
      case 'gte':
        return count >= expectedValue;
      case 'lt':
        return count < expectedValue;
      case 'lte':
        return count <= expectedValue;
      default:
        throw new BadRequestException(`Unsupported operator for count: ${condition.operator}`);
    }
  }

  private async evaluateExpression(condition: WorkflowCondition, document: any): Promise<boolean> {
    if (!condition.expression) {
      throw new BadRequestException('Expression condition requires "expression" field');
    }

    // Sandbox the expression evaluation
    const sandbox = {
      doc: document,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      JSON,
    };

    const script = new vm.Script(`(function() { return ${condition.expression}; })()`);

    try {
      // 5 second timeout for safety
      const result = script.runInNewContext(sandbox, { timeout: 5000 });
      return Boolean(result);
    } catch (error: any) {
      if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        throw new BadRequestException('Expression evaluation timeout (max 5 seconds)');
      }
      throw new BadRequestException(`Expression evaluation error: ${error.message}`);
    }
  }

  private getFieldValue(document: any, field: string): any {
    if (!field) return undefined;

    // Support nested field access: "lineItems[0].amount" → document.lineItems[0].amount
    const parts = field.split('.');
    let value = document;

    for (const part of parts) {
      if (!value) return undefined;

      // Handle array access: "lineItems[0]"
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        value = value[key]?.[index];
      } else {
        value = value[part];
      }
    }

    return value;
  }
}
