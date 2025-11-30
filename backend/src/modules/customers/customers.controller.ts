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
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GuestNoteType } from "../../entities/guest-note.entity";

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  findAll(@Query("search") search: string) {
    return this.customersService.findAll(search);
  }

  // Autocomplete arama - 4+ karakter
  @Get("search/autocomplete")
  searchAutocomplete(@Query("q") query: string, @Query("limit") limit: string) {
    return this.customersService.searchForAutocomplete(
      query,
      limit ? parseInt(limit) : 5
    );
  }

  // Detaylı liste (not sayısı ile)
  @Get("list/with-stats")
  findAllWithStats(@Query("search") search: string) {
    return this.customersService.findAllWithStats(search);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  // Misafir detayları + notlar
  @Get(":id/with-notes")
  getWithNotes(@Param("id") id: string) {
    return this.customersService.getCustomerWithNotes(id);
  }

  @Get("phone/:phone")
  findByPhone(@Param("phone") phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Post(":id/tags")
  addTag(@Param("id") id: string, @Body("tag") tag: string) {
    return this.customersService.addTag(id, tag);
  }

  @Delete(":id/tags/:tag")
  removeTag(@Param("id") id: string, @Param("tag") tag: string) {
    return this.customersService.removeTag(id, tag);
  }

  @Post(":id/blacklist")
  toggleBlacklist(@Param("id") id: string) {
    return this.customersService.toggleBlacklist(id);
  }

  @Get(":id/history")
  getHistory(@Param("id") id: string) {
    return this.customersService.getCustomerHistory(id);
  }

  // ========== NOT İŞLEMLERİ ==========

  // Not ekle
  @Post(":id/notes")
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
  getNotesForEvent(
    @Param("id") customerId: string,
    @Param("eventId") eventId: string
  ) {
    return this.customersService.getNotesForEvent(customerId, eventId);
  }

  // Not güncelle
  @Put("notes/:noteId")
  updateNote(
    @Param("noteId") noteId: string,
    @Body("content") content: string
  ) {
    return this.customersService.updateNote(noteId, content);
  }

  // Not sil
  @Delete("notes/:noteId")
  deleteNote(@Param("noteId") noteId: string) {
    return this.customersService.deleteNote(noteId);
  }

  // Bul veya oluştur
  @Post("find-or-create")
  findOrCreate(
    @Body() dto: { fullName: string; phone?: string; email?: string }
  ) {
    return this.customersService.findOrCreate(dto);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.customersService.delete(id);
  }
}
