import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";

// Public decorator key - controller'da da aynı değer kullanılmalı
export const IS_PUBLIC_KEY = "isPublic";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Public decorator varsa auth bypass et
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: TUser, _info: any): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException("Oturum açmanız gerekiyor");
    }
    return user;
  }
}
