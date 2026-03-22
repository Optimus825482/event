import { SetMetadata } from "@nestjs/common";
import { ModulePermission } from "../../../entities/user-permission.entity";

export const PERMISSIONS_KEY = "permissions";

export type PermissionAction = "view" | "create" | "edit" | "delete";

export interface RequiredPermission {
  module: ModulePermission;
  action: PermissionAction;
}

export const RequirePermission = (
  module: ModulePermission,
  action: PermissionAction,
) => SetMetadata(PERMISSIONS_KEY, { module, action } as RequiredPermission);
