const fs = require('fs');
const path = require('path');

const basePath = path.join('w:', 'amdox-erp', 'apps', 'api', 'src');

const filesToCreate = [
  // Auth
  'auth/auth.module.ts',
  'auth/auth.controller.ts',
  'auth/auth.service.ts',
  'auth/strategies/.gitkeep',
  'auth/guards/.gitkeep',
  'auth/dto/.gitkeep',
  // Finance
  'finance/finance.module.ts',
  'finance/gl/gl.controller.ts',
  'finance/gl/gl.service.ts',
  'finance/gl/account.repository.ts',
  'finance/gl/journal-entry.repository.ts',
  'finance/ap/ap.controller.ts',
  'finance/ap/ap.service.ts',
  'finance/ap/invoice-matching.service.ts',
  'finance/ar/ar.controller.ts',
  'finance/ar/ar.service.ts',
  'finance/fx/fx-rate.service.ts',
  'finance/dto/.gitkeep',
  // HR
  'hr/hr.module.ts',
  'hr/employee/employee.controller.ts',
  'hr/employee/employee.service.ts',
  'hr/employee/employee.repository.ts',
  'hr/leave/leave.controller.ts',
  'hr/leave/leave.service.ts',
  'hr/leave/leave-state-machine.ts',
  'hr/attendance/attendance.controller.ts',
  'hr/attendance/attendance.service.ts',
  'hr/payroll/payroll.controller.ts',
  'hr/payroll/payroll.service.ts',
  'hr/payroll/payroll.processor.ts',
  'hr/payroll/tax-engine.ts',
  'hr/payroll/payslip-generator.ts',
  'hr/dto/.gitkeep',
  // SCM
  'scm/scm.module.ts',
  'scm/vendor/vendor.controller.ts',
  'scm/vendor/vendor.service.ts',
  'scm/vendor/vendor.repository.ts',
  'scm/purchase-order/po.controller.ts',
  'scm/purchase-order/po.service.ts',
  'scm/purchase-order/po-state-machine.ts',
  'scm/inventory/inventory.controller.ts',
  'scm/inventory/inventory.service.ts',
  'scm/inventory/reorder.service.ts',
  'scm/goods-receipt/gr.controller.ts',
  'scm/goods-receipt/gr.service.ts',
  'scm/dto/.gitkeep',
  // Notification
  'notification/notification.module.ts',
  'notification/notification.controller.ts',
  'notification/notification.service.ts',
  'notification/channels/email.channel.ts',
  'notification/channels/in-app.channel.ts',
  'notification/channels/webhook.channel.ts',
  'notification/event-listeners/.gitkeep',
  'notification/notification.processor.ts',
  // Audit
  'audit/audit.module.ts',
  'audit/audit.controller.ts',
  'audit/audit.service.ts',
  'audit/audit.interceptor.ts',
  'audit/hash-chain.service.ts',
  'audit/gdpr/gdpr.controller.ts',
  'audit/gdpr/gdpr.service.ts',
];

const getCommentForFile = (filename) => {
  if (filename.includes('.module.ts')) {
    return `/**\n * MODULE: ${path.basename(filename)}\n * \n * This file bundles together all the controllers and services for this specific feature.\n * It acts as the "glue" that tells NestJS how these files depend on each other.\n */\n`;
  }
  if (filename.includes('.controller.ts')) {
    return `/**\n * CONTROLLER: ${path.basename(filename)}\n * \n * This file acts as the "Traffic Cop". It receives incoming HTTP requests (like GET or POST)\n * from the frontend, reads the URL, and forwards the work to the correct Service file.\n * DO NOT put heavy database logic here!\n */\n`;
  }
  if (filename.includes('.service.ts')) {
    return `/**\n * SERVICE: ${path.basename(filename)}\n * \n * This file is the "Brain" of the operation. All business logic, calculations, and \n * database queries belong here. The Controller calls this service to do the actual heavy lifting.\n */\n`;
  }
  if (filename.includes('.repository.ts')) {
    return `/**\n * REPOSITORY: ${path.basename(filename)}\n * \n * This file handles direct interactions with the database (like Prisma queries).\n * It abstracts away the database layer so the Service doesn't have to write raw SQL.\n */\n`;
  }
  if (filename.includes('state-machine')) {
    return `/**\n * STATE MACHINE: ${path.basename(filename)}\n * \n * This file manages complex status transitions (e.g., Pending -> Approved -> Rejected).\n * It ensures the business rules are followed perfectly before a status changes.\n */\n`;
  }
  if (filename.includes('processor') || filename.includes('engine') || filename.includes('generator')) {
    return `/**\n * BACKGROUND WORKER: ${path.basename(filename)}\n * \n * This file handles heavy, asynchronous jobs that run in the background (like processing payroll,\n * calculating tax slabs, or generating PDF documents).\n */\n`;
  }
  if (filename.includes('.channel.ts')) {
    return `/**\n * NOTIFICATION CHANNEL: ${path.basename(filename)}\n * \n * This file contains the logic to send messages via a specific medium (like Email, SMS, or Webhooks).\n */\n`;
  }
  return `/**\n * FILE: ${path.basename(filename)}\n * \n * Auto-generated utility file.\n */\n`;
};

const getBoilerplate = (filename) => {
  if (filename.endsWith('.gitkeep')) return '';
  const basename = path.basename(filename, '.ts');
  const className = basename.split(/[\\.\\-]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  const comments = getCommentForFile(filename);
  
  if (filename.includes('.module.ts')) {
    return `${comments}import { Module } from '@nestjs/common';\n\n@Module({})\nexport class ${className} {}\n`;
  } else if (filename.includes('.controller.ts')) {
    return `${comments}import { Controller } from '@nestjs/common';\n\n@Controller()\nexport class ${className} {}\n`;
  } else if (filename.includes('.service.ts') || filename.includes('repository.ts') || filename.includes('processor') || filename.includes('channel') || filename.includes('engine') || filename.includes('generator') || filename.includes('state-machine')) {
    return `${comments}import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class ${className} {}\n`;
  }
  return `${comments}export class ${className} {}\n`;
};

for (const file of filesToCreate) {
  const fullPath = path.join(basePath, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, getBoilerplate(file));
}

console.log('Successfully added explanatory comments to all files!');
