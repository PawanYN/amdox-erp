import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { VendorPortalService } from './vendor-portal.service';

@Injectable()
export class VendorPortalGuard implements CanActivate {
  constructor(private readonly vendorPortalService: VendorPortalService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.headers['x-tenant-id'] as string | undefined;
    const accessKey = req.headers['x-vendor-key'] as string | undefined;

    if (!tenantId || !accessKey) {
      throw new UnauthorizedException('Missing X-Tenant-Id or X-Vendor-Key header');
    }

    const vendor = await this.vendorPortalService.resolveVendor(tenantId, accessKey);
    if (!vendor) {
      throw new UnauthorizedException('Invalid vendor portal credentials');
    }

    req.vendor = vendor;
    req.user = { tenantId, vendorId: vendor.id };
    return true;
  }
}
