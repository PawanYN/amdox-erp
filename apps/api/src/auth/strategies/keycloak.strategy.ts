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
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${process.env.KEYCLOAK_ISSUER_URL}/protocol/openid-connect/certs`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: process.env.KEYCLOAK_CLIENT_ID || 'amdox-erp-web',
      issuer: process.env.KEYCLOAK_ISSUER_URL,
      algorithms: ['RS256'],
      passReqToCallback: true, // Needed to read the raw token
    });
  }

  async validate(req: any, payload: any) {
    // 1. Check if the token has been blacklisted (logged out)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // 2. Fetch the user ALONG WITH their assigned roles and tenant
    const user = await this.prisma.user.findUnique({
      where: { keycloakId: payload.sub },
      include: {
        tenant: true,
        userRoles: {
          include: { role: true }, // This is exactly what RolesGuard needs!
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found in database');
    }

    return user; 
  }
}
