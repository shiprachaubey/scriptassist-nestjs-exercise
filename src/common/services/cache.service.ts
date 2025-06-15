import { Injectable, Inject } from '@nestjs/common';//shipra
import { CACHE_MANAGER } from '@nestjs/cache-manager';//shipra
import { Cache } from 'cache-manager';//shipra

// Inefficient in-memory cache implementation with multiple problems:
// 1. No distributed cache support (fails in multi-instance deployments)
// 2. No memory limits or LRU eviction policy
// 3. No automatic key expiration cleanup (memory leak)
// 4. No serialization/deserialization handling for complex objects
// 5. No namespacing to prevent key collisions

@Injectable()
export class CacheService {
  private cacheKeys: Set<string> = new Set();

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}//shipra

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
    this.cacheKeys.add(key);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
    this.cacheKeys.delete(key);
  }

  async clear(): Promise<void> {
    // Clear all known keys
    await Promise.all(
      Array.from(this.cacheKeys).map(key => this.cacheManager.del(key))
    );
    this.cacheKeys.clear();
  }

  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }

  // Inefficient set operation with no validation
//shipra
  async setOld(key: string, value: any, ttlSeconds = 300): Promise<void> {
    await this.set(key, value, ttlSeconds * 1000);
  }

  // Inefficient get operation that doesn't handle errors properly
  //shipra
  async getOld<T>(key: string): Promise<T | null> {
    const value = await this.get<T>(key);
    return value || null;
  }

  // Inefficient delete operation
  async deleteOld(key: string): Promise<boolean> {
    const exists = await this.get(key) !== undefined;
    if (exists) {
      await this.del(key);
      return true;
    }
    return false;
  }

  // Inefficient cache clearing
  async clearOld(): Promise<void> {
    await this.clear();
  }

  // Inefficient method to check if a key exists
  // Problem: Duplicates logic from the get method
  async hasOld(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }
  
  // Problem: Missing methods for bulk operations and cache statistics
  // Problem: No monitoring or instrumentation
} 