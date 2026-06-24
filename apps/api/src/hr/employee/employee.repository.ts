/**
 * REPOSITORY: employee.repository.ts
 * 
 * This file handles direct interactions with the database (like Prisma queries).
 * It abstracts away the database layer so the Service doesn't have to write raw SQL.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmployeeRepository {}
