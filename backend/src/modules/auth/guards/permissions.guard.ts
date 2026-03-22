import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../../../entities/user.entity";
import {
  PERMISSIONS_KEY,
  RequiredPermission,
} from "../decorators/permissions.decorator";
import { PermissionsService } from "../services/permissions.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission =
      this.reflector.getAllAndOverride<RequiredPermission>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException("Kullanıcı bilgisi bulunamadı");
    }

    // Admin role bypass
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const hasPermission = await this.permissionsService.hasPermission(
      user.id,
      requiredPermission.module,
      requiredPermission.action,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Bu işlem için ${requiredPermission.module} modülünde ${requiredPermission.action} yetkisi gerekiyor`,
      );
    }

    return true;
  }
}
