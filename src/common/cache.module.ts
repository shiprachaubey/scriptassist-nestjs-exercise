
import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: 60 * 60 * 24, // 24 hours
        max: 100, // maximum number of items in cache
        store: 'redis',
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {} 