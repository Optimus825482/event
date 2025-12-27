import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GuestNoteType } from "../../entities/guest-note.entity";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";

@ApiTags("Customers")
@ApiBearerAuth("JWT-auth")
@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: "Yeni müşteri oluştur" })
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Tüm müşterileri listele" })
  @ApiQuery({ name: "search", required: false, description: "Arama terimi" })
  findAll(@Query("search") search: string) {
    return this.customersService.findAll(search);
  }

  // Autocomplete arama - 4+ karakter
  @Get("search/autocomplete")
  @ApiOperation({ summary: "Müşteri autocomplete araması" })
  searchAutocomplete(@Query("q") query: string, @Query("limit") limit: string) {
    return this.customersService.searchForAutocomplete(
      query,
      limit ? parseInt(limit) : 5
    );
  }

  // Detaylı liste (not sayısı ile) - Pagination destekli
  @Get("list/with-stats")
  @ApiOperation({ summary: "Müşterileri istatistiklerle listele" })
  findAllWithStats(@Query() pagination: PaginationQueryDto) {
    return this.customersService.findAllWithStats(pagination.search);
  }

  @Get(":id")
  @ApiOperation({ summary: "Müşteri detayı getir" })
  findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  // Misafir detayları + notlar
  @Get(":id/with-notes")
  @ApiOperation({ summary: "Müşteri detayları ve notları" })
  getWithNotes(@Param("id") id: string) {
    return this.customersService.getCustomerWithNotes(id);
  }

  @Get("phone/:phone")
  @ApiOperation({ summary: "Telefon ile müşteri bul" })
  findByPhone(@Param("phone") phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Put(":id")
  @ApiOperation({ summary: "Müşteri güncelle" })
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Post(":id/tags")
  @ApiOperation({ summary: "Müşteriye etiket ekle" })
  addTag(@Param("id") id: string, @Body("tag") tag: string) {
    return this.customersService.addTag(id, tag);
  }

  @Delete(":id/tags/:tag")
  @ApiOperation({ summary: "Müşteriden etiket kaldır" })
  removeTag(@Param("id") id: string, @Param("tag") tag: string) {
    return this.customersService.removeTag(id, tag);
  }

  @Post(":id/blacklist")
  @ApiOperation({ summary: "Kara liste durumunu değiştir" })
  toggleBlacklist(@Param("id") id: string) {
    return this.customersService.toggleBlacklist(id);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Müşteri geçmişi" })
  getHistory(@Param("id") id: string) {
    return this.customersService.getCustomerHistory(id);
  }

  // ========== NOT İŞLEMLERİ ==========

  // Not ekle
  @Post(":id/notes")
  @ApiOperation({ summary: "Müşteriye not ekle" })
  addNote(
    @Param("id") customerId: string,
    @Body()
    dto: {
      content: string;
      noteType?: GuestNoteType;
      eventId?: string;
      reservationId?: string;
    }
  ) {
    return this.customersService.addNote({ customerId, ...dto });
  }

  // Etkinlik notlarını getir
  @Get(":id/notes/event/:eventId")
  @ApiOperation({ summary: "Etkinlik bazlı müşteri notları" })
  getNotesForEvent(
    @Param("id") customerId: string,
    @Param("eventId") eventId: string
  ) {
    return this.customersService.getNotesForEvent(customerId, eventId);
  }

  // Not güncelle
  @Put("notes/:noteId")
  @ApiOperation({ summary: "Not güncelle" })
  updateNote(
    @Param("noteId") noteId: string,
    @Body("content") content: string
  ) {
    return this.customersService.updateNote(noteId, content);
  }

  // Not sil
  @Delete("notes/:noteId")
  @ApiOperation({ summary: "Not sil" })
  deleteNote(@Param("noteId") noteId: string) {
    return this.customersService.deleteNote(noteId);
  }

  // Bul veya oluştur
  @Post("find-or-create")
  @ApiOperation({ summary: "Müşteri bul veya oluştur" })
  findOrCreate(
    @Body() dto: { fullName: string; phone?: string; email?: string }
  ) {
    return this.customersService.findOrCreate(dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Müşteri sil" })
  delete(@Param("id") id: string) {
    return this.customersService.delete(id);
  }
}
