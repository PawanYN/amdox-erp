/**
 * ============================================================================
 * SERVICE: vendor.service.ts
 * ============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This service is responsible for managing "Vendors" (also known as suppliers).
 * It handles the core business logic for creating, reading, updating, and 
 * softly deleting vendor records in the database.
 * 
 * HOW IT IS IMPLEMENTED:
 * - We use Prisma ORM to interact with the database.
 * - Multi-tenancy is enforced on every query by explicitly requiring `tenantId`.
 * - We use a "soft delete" pattern for the `remove` method. Instead of actually 
 *   dropping the record from the database, we set `deletedAt` to the current 
 *   timestamp and `isActive` to false. This preserves historical Purchase Orders 
 *   associated with this vendor.
 * 
 * RELEVANT CONTEXT FOR NEW DEVS:
 * Before a Purchase Order can be created, a Vendor must exist. Products can 
 * also have a `defaultVendorId` which points to records created by this service.
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';

@Injectable()
export class VendorService {
  private prisma = new PrismaClient();

  async create(tenantId: string, createVendorDto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        ...createVendorDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.vendor.findMany({
      where: { tenantId, deletedAt: null },
    });
  }

  async findOne(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(tenantId: string, id: string, updateVendorDto: UpdateVendorDto) {
    await this.findOne(tenantId, id); // Ensure existence

    return this.prisma.vendor.update({
      where: { id },
      data: updateVendorDto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    
    // Soft delete
    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
