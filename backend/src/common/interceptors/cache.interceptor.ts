import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";

interface CacheEntry {
  data: any;
  timestamp: number;
}

/**
 * In-Memory Cache Interceptor
 * - GET istekleri için response caching
 * - TTL bazlı cache invalidation
 * - Route bazlı cache key
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 30000; // 30 saniye

  // Route bazlı TTL ayarları (ms)
  private readonly routeTTL: Record<string, number> = {
    "/api/staff/personnel/stats": 120000, // 2 dakika - istatistikler
    "/api/staff/personnel/summary": 120000, // 2 dakika - özet
    "/api/staff/personnel": 60000, // 1 dakika - personel listesi
    "/api/staff/roles": 300000, // 5 dakika - roller nadiren değişir
    "/api/staff/shifts": 300000, // 5 dakika - vardiyalar
    "/api/staff/teams": 120000, // 2 dakika - ekipler
    "/api/events": 60000, // 1 dakika - etkinlikler
    "/api/tables/types": 300000, // 5 dakika - masa tipleri
    "/api/venues": 300000, // 5 dakika - mekanlar
  };

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Sadece GET isteklerini cache'le
    if (method !== "GET") {
      // POST/PUT/DELETE işlemlerinde ilgili cache'i temizle
      this.invalidateRelatedCache(url);
      return next.handle();
    }

    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    const ttl = this.getTTL(url);

    // Cache hit - geçerli mi kontrol et
    if (cached && Date.now() - cached.timestamp < ttl) {
      return of(cached.data);
    }

    // Cache miss - isteği yap ve cache'le
    return next.handle().pipe(
      tap((data) => {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });

        // Cache boyutunu kontrol et (max 1000 entry)
        if (this.cache.size > 1000) {
          this.cleanOldEntries();
        }
      })
    );
  }

  private getCacheKey(request: any): string {
    const { url, query } = request;
    const queryString = JSON.stringify(query || {});
    return `${url}:${queryString}`;
  }

  private getTTL(url: string): number {
    // Route bazlı TTL bul
    for (const [route, ttl] of Object.entries(this.routeTTL)) {
      if (url.startsWith(route)) {
        return ttl;
      }
    }
    return this.DEFAULT_TTL;
  }

  private invalidateRelatedCache(url: string): void {
    // URL'den base path'i çıkar
    const basePath = url.split("/").slice(0, 4).join("/");

    // İlgili cache entry'lerini sil
    for (const key of this.cache.keys()) {
      if (key.startsWith(basePath)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanOldEntries(): void {
    const now = Date.now();
    const maxAge = 600000; // 10 dakika

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  // Manuel cache temizleme
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}
