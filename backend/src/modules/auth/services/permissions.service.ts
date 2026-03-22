import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  UserPermission,
  ModulePermission,
} from "../../../entities/user-permission.entity";
import { PermissionAction } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(UserPermission)
    private userPermissionRepository: Repository<UserPermission>,
  ) {}

  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return this.userPermissionRepository.find({
      where: { userId },
      order: { module: "ASC" },
    });
  }

  async hasPermission(
    userId: string,
    module: ModulePermission,
    action: PermissionAction,
  ): Promise<boolean> {
    const permission = await this.userPermissionRepository.findOne({
      where: { userId, module },
    });

    if (!permission) {
      return false;
    }

    switch (action) {
      case "view":
        return permission.canView;
      case "create":
        return permission.canCreate;
      case "edit":
        return permission.canEdit;
      case "delete":
        return permission.canDelete;
      default:
        return false;
    }
  }

  async assignPermission(
    userId: string,
    module: ModulePermission,
    actions: {
      canView?: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
    },
  ): Promise<UserPermission> {
    const existingPermission = await this.userPermissionRepository.findOne({
      where: { userId, module },
    });

    if (existingPermission) {
      Object.assign(existingPermission, actions);
      return this.userPermissionRepository.save(existingPermission);
    }

    const permission = this.userPermissionRepository.create({
      userId,
      module,
      canView: actions.canView ?? true,
      canCreate: actions.canCreate ?? false,
      canEdit: actions.canEdit ?? false,
      canDelete: actions.canDelete ?? false,
    });

    return this.userPermissionRepository.save(permission);
  }

  async updatePermission(
    permissionId: string,
    actions: {
      canView?: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
    },
  ): Promise<UserPermission> {
    const permission = await this.userPermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException("İzin kaydı bulunamadı");
    }

    Object.assign(permission, actions);
    return this.userPermissionRepository.save(permission);
  }

  async removePermission(permissionId: string): Promise<void> {
    const permission = await this.userPermissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException("İzin kaydı bulunamadı");
    }

    await this.userPermissionRepository.remove(permission);
  }
}
