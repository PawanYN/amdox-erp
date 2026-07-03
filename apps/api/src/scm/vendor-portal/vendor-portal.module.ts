import { Module } from '@nestjs/common';
import { VendorPortalController } from './vendor-portal.controller';
import { VendorPortalService } from './vendor-portal.service';
import { VendorPortalGuard } from './vendor-portal.guard';

@Module({
  controllers: [VendorPortalController],
  providers: [VendorPortalService, VendorPortalGuard],
  exports: [VendorPortalService],
})
export class VendorPortalModule {}
