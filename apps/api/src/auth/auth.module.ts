/**
 * MODULE: auth.module.ts
 * 
 * This file bundles together all the controllers and services for this specific feature.
 * It acts as the "glue" that tells NestJS how these files depend on each other.
 */
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { KeycloakStrategy } from './strategies/keycloak.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak' })],
  providers: [KeycloakStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
