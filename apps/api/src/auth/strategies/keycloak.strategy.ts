import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { prisma } from '@amdox/db';
import { RedisService } from '../../common/redis/redis.service';
import { AmdoxLogger } from '../../common/logger/amdox-logger';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  constructor(private redisService: RedisService) {
    super({
      secretOrKeyProvider: (req, rawJwtToken, done) => {
        try {
          AmdoxLogger.auth('Processing token verification…');
          const payloadBase64 = rawJwtToken.split('.')[1];
          const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          const iss = payload.iss;
          AmdoxLogger.debug('Token issuer', iss);

          const baseUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8180';
          if (!iss || !iss.startsWith(baseUrl)) {
            AmdoxLogger.critical('Invalid token issuer', `Expected base: ${baseUrl}, got: ${iss}`);
            return done(new Error('Invalid token issuer'));
          }

          const jwksUri = `${iss}/protocol/openid-connect/certs`;
          AmdoxLogger.debug('Fetching JWKS keys', jwksUri);
          const secretProvider = passportJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri,
          });
          secretProvider(req, rawJwtToken, done);
        } catch (err) {
          AmdoxLogger.error('secretOrKeyProvider error', (err as Error).message);
          done(err as Error);
        }
      },
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      passReqToCallback: true, // Needed to read the raw token
    });
  }

  async validate(req: any, payload: any) {
    AmdoxLogger.auth('Token signature verified', `sub=${payload.sub}`);

    // Verify client audience or authorized party
    const expectedClient = process.env.KEYCLOAK_CLIENT_ID || 'amdox-erp-web';
    if (payload.azp !== expectedClient && payload.aud !== expectedClient) {
      AmdoxLogger.warn('Invalid client audience', `azp=${payload.azp}  aud=${payload.aud}`);
      throw new UnauthorizedException('Invalid client audience');
    }

    // 1. Check if the token has been blacklisted (logged out)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
      if (isBlacklisted) {
        AmdoxLogger.critical('Blacklisted token used — access denied');
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // 2. Fetch the user ALONG WITH their assigned roles and tenant
    AmdoxLogger.debug('DB lookup for ssoSubject', payload.sub);
    // tenant-scope-ok: this IS the lookup that determines which tenant the caller
    // belongs to — ssoSubject is globally unique across all tenants (Keycloak's
    // subject ID), so it can't be pre-filtered by a tenantId we don't know yet.
    const user = await prisma.user.findFirst({
      where: { ssoSubject: payload.sub },
      include: {
        tenant: true,
        userRoles: {
          include: { role: true }, // This is exactly what RolesGuard needs!
        },
      },
    });

    if (!user) {
      AmdoxLogger.critical('ssoSubject not found in DB', payload.sub);
      throw new UnauthorizedException('User not found in database');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    (user as any).roles = roles;

    AmdoxLogger.success(
      `Authenticated  ${user.email}`,
      `tenant=${user.tenant.name}  roles=[${roles.join(', ')}]`,
    );
    return user;
  }
}
