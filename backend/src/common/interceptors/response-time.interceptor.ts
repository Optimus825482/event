import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

/**
 * Response Time Interceptor
 * - Her isteğin süresini loglar
 * - Yavaş istekleri uyarı olarak işaretler
 * - Performance monitoring için
 */
@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Performance");
  private readonly SLOW_THRESHOLD = 100; // 100ms üzeri yavaş sayılır

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        // Response header'a süreyi ekle
        const response = context.switchToHttp().getResponse();
        response.setHeader("X-Response-Time", `${duration}ms`);

        // Yavaş istekleri logla
        if (duration > this.SLOW_THRESHOLD) {
          this.logger.warn(`🐢 Slow request: ${method} ${url} - ${duration}ms`);
        }
      })
    );
  }
}
