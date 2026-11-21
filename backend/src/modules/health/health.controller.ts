import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { HealthService } from "./health.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private healthService: HealthService
  ) {}

  @Get()
  @ApiOperation({ summary: "Basit health check" })
  @ApiResponse({ status: 200, description: "Servis çalışıyor" })
  @HealthCheck()
  check() {
    return this.health.check([
      // Database bağlantısı
      () => this.db.pingCheck("database"),
    ]);
  }

  @Get("detailed")
  @ApiOperation({ summary: "Detaylı health check" })
  @ApiResponse({ status: 200, description: "Detaylı sistem durumu" })
  @HealthCheck()
  checkDetailed() {
    return this.health.check([
      // Database
      () => this.db.pingCheck("database"),
      // Memory - 500MB heap limit
      () => this.memory.checkHeap("memory_heap", 500 * 1024 * 1024),
      // RSS Memory - 1GB limit
      () => this.memory.checkRSS("memory_rss", 1024 * 1024 * 1024),
    ]);
  }

  @Get("ready")
  @ApiOperation({ summary: "Kubernetes readiness probe" })
  @ApiResponse({ status: 200, description: "Servis hazır" })
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.db.pingCheck("database")]);
  }

  @Get("live")
  @ApiOperation({ summary: "Kubernetes liveness probe" })
  @ApiResponse({ status: 200, description: "Servis canlı" })
  liveness() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("metrics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Sistem metrikleri" })
  @ApiResponse({ status: 200, description: "Sistem metrikleri" })
  async metrics() {
    return this.healthService.getMetrics();
  }
}
