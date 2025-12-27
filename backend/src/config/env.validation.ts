import { plainToInstance } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MinLength,
  validateSync,
} from "class-validator";

enum Environment {
  Development = "development",
  Production = "production",
  Test = "test",
}

/**
 * Environment Variables Validation Schema
 * Uygulama başlangıcında tüm env değişkenlerini doğrular
 */
class EnvironmentVariables {
  // Database
  @IsString()
  DB_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(100)
  DB_POOL_MAX?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  DB_POOL_MIN?: number;

  // JWT - Production'da minimum 32 karakter
  @IsString()
  @MinLength(32, {
    message: "JWT_SECRET en az 32 karakter olmalıdır (güvenlik için)",
  })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  // Server
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV?: Environment;

  // CORS
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  // Slow Query
  @IsNumber()
  @IsOptional()
  @Min(100)
  SLOW_QUERY_THRESHOLD?: number;

  // Rate Limiting
  @IsNumber()
  @IsOptional()
  @Min(10)
  THROTTLE_TTL?: number;

  @IsNumber()
  @IsOptional()
  @Min(10)
  THROTTLE_LIMIT?: number;
}

/**
 * Environment validation function
 * ConfigModule.forRoot() içinde kullanılır
 */
export function validateEnv(config: Record<string, unknown>) {
  // String değerleri uygun tiplere dönüştür
  const transformedConfig = {
    ...config,
    DB_PORT: config.DB_PORT ? parseInt(config.DB_PORT as string, 10) : 5432,
    DB_POOL_MAX: config.DB_POOL_MAX
      ? parseInt(config.DB_POOL_MAX as string, 10)
      : 50,
    DB_POOL_MIN: config.DB_POOL_MIN
      ? parseInt(config.DB_POOL_MIN as string, 10)
      : 10,
    PORT: config.PORT ? parseInt(config.PORT as string, 10) : 4000,
    SLOW_QUERY_THRESHOLD: config.SLOW_QUERY_THRESHOLD
      ? parseInt(config.SLOW_QUERY_THRESHOLD as string, 10)
      : 500,
    THROTTLE_TTL: config.THROTTLE_TTL
      ? parseInt(config.THROTTLE_TTL as string, 10)
      : 60,
    THROTTLE_LIMIT: config.THROTTLE_LIMIT
      ? parseInt(config.THROTTLE_LIMIT as string, 10)
      : 100,
  };

  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    transformedConfig,
    {
      enableImplicitConversion: true,
    }
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(", ")
          : "Unknown error";
        return `${error.property}: ${constraints}`;
      })
      .join("\n");

    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return validatedConfig;
}
