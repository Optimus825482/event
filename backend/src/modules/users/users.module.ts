import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { User } from "../../entities/user.entity";
import { UserPermission } from "../../entities/user-permission.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, UserPermission])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
