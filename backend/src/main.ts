import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import compression from "compression";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseTimeInterceptor } from "./common/interceptors/response-time.interceptor";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get("NODE_ENV") === "production";

  // ==================== PERFORMANCE ====================

  // Response compression - gzip/deflate
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // Balanced compression level
      threshold: 1024, // 1KB'dan büyük response'ları sıkıştır
    }),
  );

  // Response time tracking
  app.useGlobalInterceptors(new ResponseTimeInterceptor());

  // ==================== GÜVENLİK ====================

  // Helmet - HTTP güvenlik başlıkları
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // Dev'de CSP kapalı
      crossOriginEmbedderPolicy: false, // WebSocket için gerekli
      crossOriginResourcePolicy: { policy: "cross-origin" }, // Static dosyalar için CORS
    }),
  );

  // CORS ayarları
  const corsOrigins = configService.get<string>("CORS_ORIGINS");
  const allowedOrigins = corsOrigins
    ? corsOrigins.split(",").map((origin) => origin.trim())
    : ["http://localhost:3000", "http://localhost:3001"];

  app.enableCors({
    origin: isProduction ? allowedOrigins : true, // Development'ta tüm origin'lere izin ver
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Request-ID"],
  });

  // ==================== VALIDATION ====================

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ==================== API ====================

  // API prefix - Production'da Coolify/Traefik /api path'ini strip ettiği için prefix eklenmez
  if (!isProduction) {
    app.setGlobalPrefix("api");
  }

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("EventFlow PRO API")
    .setDescription(
      `
## EventFlow PRO - Etkinlik Yönetim Sistemi API

### Modüller:
- **Auth**: Kimlik doğrulama ve yetkilendirme
- **Events**: Etkinlik yönetimi
- **Reservations**: Rezervasyon işlemleri
- **Customers**: Müşteri yönetimi (CRM)
- **Staff**: Personel ve ekip yönetimi
- **Venues**: Mekan şablonları
- **Invitations**: Davetiye sistemi
- **Health**: Sistem sağlık kontrolleri

### Authentication:
Tüm korumalı endpoint'ler için \`Authorization: Bearer <token>\` header'ı gereklidir.

### Rate Limiting:
- Genel: 100 istek / 60 saniye
- Auth: 10 istek / 60 saniye

### Error Response Format:
\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasyon hatası",
    "details": [{"field": "email", "message": "Geçersiz email formatı"}],
    "timestamp": "2025-12-26T12:00:00.000Z",
    "path": "/api/auth/login"
  }
}
\`\`\`
      `,
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "JWT token giriniz",
        in: "header",
      },
      "JWT-auth",
    )
    .addTag("Auth", "Kimlik doğrulama işlemleri")
    .addTag("Events", "Etkinlik yönetimi")
    .addTag("Reservations", "Rezervasyon işlemleri")
    .addTag("Customers", "Müşteri yönetimi")
    .addTag("Staff", "Personel yönetimi")
    .addTag("Venues", "Mekan şablonları")
    .addTag("Health", "Sistem sağlık kontrolleri")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerPath = isProduction ? "docs" : "api/docs";
  SwaggerModule.setup(swaggerPath, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "none",
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: "EventFlow PRO API Docs",
  });

  // ==================== START ====================

  const port = configService.get("PORT") || 4000;
  await app.listen(port);

  const nodeEnv = configService.get("NODE_ENV") || "development";
  logger.log(`🚀 EventFlow PRO Backend running on http://localhost:${port}`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`📚 Swagger Docs: http://localhost:${port}/api/docs`);
  logger.log(`🔒 Helmet: Enabled`);
  logger.log(`⚡ Rate Limiting: Enabled (100 req/60s)`);
  logger.log(`📦 Compression: Enabled (gzip)`);
  logger.log(`⏱️ Response Time Tracking: Enabled`);
  logger.log(
    `🌐 CORS: ${
      isProduction ? allowedOrigins.join(", ") : "Open (development)"
    }`,
  );
}
bootstrap();
