import { Module } from '@nestjs/common'; //created a security module
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityService } from './security.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { SecurityController } from './security.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 10,
    }]),
  ],
  providers: [
    SecurityService,
    JwtStrategy,
    RefreshTokenStrategy,
    RateLimitGuard,
  ],
  controllers: [SecurityController],
  exports: [SecurityService],
})
export class SecurityModule {} 