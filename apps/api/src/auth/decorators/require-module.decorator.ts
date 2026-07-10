import { SetMetadata } from '@nestjs/common';
import { ErpModule } from '../erp-modules';

export const MODULE_KEY = 'erpModule';
export const SKIP_MODULE_KEY = 'skipModuleCheck';

/** Require one or more ERP modules (user needs any listed module). */
export const RequireModule = (...modules: ErpModule[]) => SetMetadata(MODULE_KEY, modules);

/** Skip module check on a handler (e.g. GET /employees/me). */
export const SkipModuleCheck = () => SetMetadata(SKIP_MODULE_KEY, true);
