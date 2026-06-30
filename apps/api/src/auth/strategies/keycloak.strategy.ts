import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaClient } from '@amdox/db';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  private prisma = new PrismaClient();

  constructor(private redisService: RedisService) {
    super({
      secretOrKeyProvider: (req, rawJwtToken, done) => {
        try {
          console.log('[AuthStrategy] Processing token verification...');
          const payloadBase64 = rawJwtToken.split('.')[1];
          const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          const iss = payload.iss;
          console.log(`[AuthStrategy] Token Issuer: ${iss}`);

          const baseUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8180';
          if (!iss || !iss.startsWith(baseUrl)) {
            console.error(`[AuthStrategy] Invalid issuer. Expected base: ${baseUrl}`);
            return done(new Error('Invalid token issuer'));
          }

          const jwksUri = `${iss}/protocol/openid-connect/certs`;
          console.log(`[AuthStrategy] Fetching keys from JWKS: ${jwksUri}`);
          const secretProvider = passportJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri,
          });
          secretProvider(req, rawJwtToken, done);
        } catch (err) {
          console.error('[AuthStrategy] Error in secretOrKeyProvider:', err);
          done(err as Error);
        }
      },
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      passReqToCallback: true, // Needed to read the raw token
    });
  }

  async validate(req: any, payload: any) {
    console.log(`[AuthStrategy] Token signature verified successfully! Payload sub: ${payload.sub}`);

    // Verify client audience or authorized party
    const expectedClient = process.env.KEYCLOAK_CLIENT_ID || 'amdox-erp-web';
    if (payload.azp !== expectedClient && payload.aud !== expectedClient) {
      console.warn(`[AuthStrategy] Invalid audience/authorized party: azp=${payload.azp}, aud=${payload.aud}`);
      throw new UnauthorizedException('Invalid client audience');
    }

    // 1. Check if the token has been blacklisted (logged out)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
      if (isBlacklisted) {
        console.warn(`[AuthStrategy] Token is blacklisted!`);
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // 2. Fetch the user ALONG WITH their assigned roles and tenant
    console.log(`[AuthStrategy] Querying database for user with ssoSubject: ${payload.sub}`);
    const user = await this.prisma.user.findFirst({
      where: { ssoSubject: payload.sub },
      include: {
        tenant: true,
        userRoles: {
          include: { role: true }, // This is exactly what RolesGuard needs!
        },
      },
    });

    if (!user) {
      console.warn(`[AuthStrategy] User with ssoSubject ${payload.sub} NOT found in database!`);
      throw new UnauthorizedException('User not found in database');
    }

    console.log(`[AuthStrategy] User authenticated successfully: ${user.email} (Tenant: ${user.tenant.name})`);
    return user; 
  }
}
