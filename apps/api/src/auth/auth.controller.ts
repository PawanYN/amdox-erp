import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../common/redis/redis.service';
import { AccessService } from './access.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly redisService: RedisService,
    private readonly accessService: AccessService,
  ) {}

  @UseGuards(AuthGuard('keycloak'))
  @Get('me')
  async me(@Req() req: any) {
    const user = req.user;
    const access = await this.accessService.resolveForUser(user);
    return {
      email: user?.email,
      fullName: user?.fullName,
      tenantId: user?.tenantId,
      roles: access.roles,
      modules: access.modules,
      department: access.department,
    };
  }

  @UseGuards(AuthGuard('keycloak'))
  @Post('logout')
  async logout(@Req() req: any) {
    // 1. Get the raw token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return { status: 'logged_out' };

    try {
      // 2. Decode the JWT to find its natural expiration time
      const payloadBase64 = token.split('.')[1];
      const payloadString = Buffer.from(payloadBase64, 'base64').toString();
      const payload = JSON.parse(payloadString);

      // 3. Calculate how many seconds until the token naturally expires
      const currentSeconds = Math.floor(Date.now() / 1000);
      const timeToLive = payload.exp - currentSeconds;

      // 4. Save to Redis Blacklist ONLY for the remaining lifetime of the token
      if (timeToLive > 0) {
        await this.redisService.setex(`blacklist:${token}`, timeToLive, 'true');
      }

      return { status: 'success', message: 'Logged out securely. Token revoked.' };
    } catch (_e) {
      return { status: 'error', message: 'Failed to revoke token' };
    }
  }
}
