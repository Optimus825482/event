/**
 * Permission Guard Kullanım Örnekleri
 *
 * Bu dosya, permission sistemi için örnek kullanımları gösterir.
 * Gerçek controller'larınızda bu pattern'leri kullanabilirsiniz.
 */

import { Controller, Get, Post, Put, Delete, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../decorators/permissions.decorator";
import { ModulePermission } from "../../../entities/user-permission.entity";

@Controller("events")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EventsExampleController {
  // Sadece görüntüleme yetkisi gerekir
  @Get()
  @RequirePermission(ModulePermission.EVENTS, "view")
  findAll() {
    return { message: "Events listesi" };
  }

  // Oluşturma yetkisi gerekir
  @Post()
  @RequirePermission(ModulePermission.EVENTS, "create")
  create() {
    return { message: "Event oluşturuldu" };
  }

  // Düzenleme yetkisi gerekir
  @Put(":id")
  @RequirePermission(ModulePermission.EVENTS, "edit")
  update() {
    return { message: "Event güncellendi" };
  }

  // Silme yetkisi gerekir
  @Delete(":id")
  @RequirePermission(ModulePermission.EVENTS, "delete")
  remove() {
    return { message: "Event silindi" };
  }
}

@Controller("reservations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReservationsExampleController {
  @Get()
  @RequirePermission(ModulePermission.RESERVATIONS, "view")
  findAll() {
    return { message: "Rezervasyonlar listesi" };
  }

  @Post()
  @RequirePermission(ModulePermission.RESERVATIONS, "create")
  create() {
    return { message: "Rezervasyon oluşturuldu" };
  }
}

/**
 * Kullanım Notları:
 *
 * 1. Guard Sırası Önemli:
 *    @UseGuards(JwtAuthGuard, PermissionsGuard)
 *    Önce JWT auth, sonra permission kontrolü yapılır.
 *
 * 2. Admin Bypass:
 *    Admin role'üne sahip kullanıcılar tüm permission kontrollerini bypass eder.
 *
 * 3. Global Guard Kullanımı:
 *    app.module.ts'de global guard olarak da eklenebilir:
 *
 *    providers: [
 *      {
 *        provide: APP_GUARD,
 *        useClass: JwtAuthGuard,
 *      },
 *      {
 *        provide: APP_GUARD,
 *        useClass: PermissionsGuard,
 *      },
 *    ]
 *
 * 4. Permission Atama:
 *    PermissionsService kullanarak permission atayabilirsiniz:
 *
 *    await permissionsService.assignPermission(
 *      userId,
 *      ModulePermission.EVENTS,
 *      { canView: true, canCreate: true, canEdit: false, canDelete: false }
 *    );
 */
