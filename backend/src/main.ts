import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get("NODE_ENV") === "production";

  // CORS ayarları - Coolify reverse proxy arkasında tüm origin'lere izin ver
  app.enableCors({
    origin: true, // Tüm origin'lere izin ver (Coolify proxy arkasında güvenli)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // API prefix
  app.setGlobalPrefix("api");

  // Swagger API Documentation - her zaman aktif
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
      `
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
      "JWT-auth"
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
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "none",
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: "EventFlow PRO API Docs",
  });

  const port = configService.get("PORT") || 4000;
  await app.listen(port);

  const nodeEnv = configService.get("NODE_ENV") || "development";
  console.log(`🚀 EventFlow PRO Backend running on http://localhost:${port}`);
  console.log(`� Envnironment: ${nodeEnv}`);
  console.log(`� Snwagger Docs: http://localhost:${port}/api/docs`);
  console.log(`🌐 CORS: Open (all origins allowed)`);
}
bootstrap();
