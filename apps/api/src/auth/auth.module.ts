import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeycloakStrategy } from './strategies/keycloak.strategy';
import { AuthController } from './auth.controller';
import { AccessService } from './access.service';
import { ModuleGuard } from './guards/module.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak' })],
  controllers: [AuthController],
  providers: [KeycloakStrategy, AccessService, ModuleGuard],
  exports: [PassportModule, AccessService, ModuleGuard],
})
export class AuthModule {}
