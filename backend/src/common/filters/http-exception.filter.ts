import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Standardize Error Response Format
 * Tüm HTTP hatalarını tutarlı bir formatta döndürür
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Beklenmeyen bir hata oluştu";
    let details: Array<{ field?: string; message: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;

        // class-validator hataları için details oluştur
        if (Array.isArray(resp.message)) {
          details = resp.message.map((msg: string) => ({ message: msg }));
          message = "Validasyon hatası";
        }
      }

      // HTTP status koduna göre error code belirle
      code = this.getErrorCode(status);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack
      );
    }

    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.headers["x-request-id"] as string,
      },
    };

    // Production'da stack trace logla ama response'a ekleme
    if (process.env.NODE_ENV !== "production" && exception instanceof Error) {
      (errorResponse.error as any).stack = exception.stack;
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      405: "METHOD_NOT_ALLOWED",
      409: "CONFLICT",
      422: "VALIDATION_ERROR",
      429: "TOO_MANY_REQUESTS",
      500: "INTERNAL_ERROR",
      502: "BAD_GATEWAY",
      503: "SERVICE_UNAVAILABLE",
    };
    return codeMap[status] || "UNKNOWN_ERROR";
  }
}
