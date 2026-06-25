import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { PrismaClient } from '@amdox/db';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak') {
  private prisma = new PrismaClient();

  constructor() {
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
    });
  }

  async validate(payload: any) {
    // The payload.sub is the unique Keycloak user ID
    const user = await this.prisma.user.findUnique({
      where: { keycloakId: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found in database');
    }

    return user; // This attaches the user object to the request
  }
}
