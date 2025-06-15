import { Controller, Post, UseGuards, Req, Get } from '@nestjs/common'; //security controller
import { AuthGuard } from '@nestjs/passport';
import { SecurityService } from './security.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class SecurityController {
  constructor(private securityService: SecurityService) {}

  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  async refreshTokens(@Req() req: any) {
    return this.securityService.refreshTokens(req.headers.authorization.split(' ')[1]);
  }
} 