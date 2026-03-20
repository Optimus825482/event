import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { TablesService } from "./tables.service";
import { CreateTableTypeDto, UpdateTableTypeDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../../entities/user.entity";

@UseGuards(JwtAuthGuard)
@Controller("tables")
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post("types")
  create(@Body() dto: CreateTableTypeDto) {
    return this.tablesService.create(dto);
  }

  @Get("types")
  findAll() {
    return this.tablesService.findAll();
  }

  @Get("types/:id")
  findOne(@Param("id") id: string) {
    return this.tablesService.findOne(id);
  }

  @Put("types/:id")
  update(@Param("id") id: string, @Body() dto: UpdateTableTypeDto) {
    return this.tablesService.update(id, dto);
  }

  @Delete("types/:id")
  remove(@Param("id") id: string) {
    return this.tablesService.remove(id);
  }

  @Post("seed")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  seed() {
    return this.tablesService.seedDefaults();
  }
}
