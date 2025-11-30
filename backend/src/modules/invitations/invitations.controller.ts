import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { InvitationsService } from "./invitations.service";
import {
  InvitationTemplate,
  EventInvitation,
} from "../../entities/invitation-template.entity";

@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // ============ ŞABLON YÖNETİMİ ============

  // Tüm şablonları getir
  @Get("templates")
  async getTemplates(): Promise<InvitationTemplate[]> {
    return this.invitationsService.getTemplates();
  }

  // Varsayılan şablonu getir
  @Get("templates/default")
  async getDefaultTemplate(): Promise<InvitationTemplate> {
    return this.invitationsService.getDefaultTemplate();
  }

  // Tek şablon getir
  @Get("templates/:id")
  async getTemplate(@Param("id") id: string): Promise<InvitationTemplate> {
    return this.invitationsService.getTemplate(id);
  }

  // Yeni şablon oluştur
  @Post("templates")
  async createTemplate(
    @Body() data: Partial<InvitationTemplate>
  ): Promise<InvitationTemplate> {
    return this.invitationsService.createTemplate(data);
  }

  // Şablon güncelle
  @Put("templates/:id")
  async updateTemplate(
    @Param("id") id: string,
    @Body() data: Partial<InvitationTemplate>
  ): Promise<InvitationTemplate> {
    return this.invitationsService.updateTemplate(id, data);
  }

  // Şablon sil
  @Delete("templates/:id")
  async deleteTemplate(@Param("id") id: string): Promise<{ message: string }> {
    await this.invitationsService.deleteTemplate(id);
    return { message: "Şablon silindi" };
  }

  // Şablonu varsayılan yap
  @Post("templates/:id/set-default")
  async setDefaultTemplate(
    @Param("id") id: string
  ): Promise<InvitationTemplate> {
    return this.invitationsService.setDefaultTemplate(id);
  }

  // ============ ETKİNLİK DAVETİYESİ ============

  // Etkinlik davetiyesini getir
  @Get("event/:eventId")
  async getEventInvitation(
    @Param("eventId") eventId: string
  ): Promise<EventInvitation | null> {
    return this.invitationsService.getEventInvitation(eventId);
  }

  // Etkinlik davetiye elementlerini getir (render için)
  @Get("event/:eventId/elements")
  async getEventInvitationElements(@Param("eventId") eventId: string) {
    return this.invitationsService.getEventInvitationElements(eventId);
  }

  // Etkinlik davetiyesi kaydet
  @Post("event/:eventId")
  async saveEventInvitation(
    @Param("eventId") eventId: string,
    @Body() data: Partial<EventInvitation>
  ): Promise<EventInvitation> {
    return this.invitationsService.saveEventInvitation(eventId, data);
  }

  // Etkinliğe görsel ekle
  @Post("event/:eventId/images")
  async addEventImage(
    @Param("eventId") eventId: string,
    @Body() body: { imageUrl: string }
  ): Promise<EventInvitation> {
    return this.invitationsService.addEventImage(eventId, body.imageUrl);
  }

  // Etkinlikten görsel sil
  @Delete("event/:eventId/images")
  async removeEventImage(
    @Param("eventId") eventId: string,
    @Body() body: { imageUrl: string }
  ): Promise<EventInvitation> {
    return this.invitationsService.removeEventImage(eventId, body.imageUrl);
  }

  // ============ DAVETİYE RENDER VE GÖNDERME ============

  // Rezervasyon için davetiye verilerini getir
  @Get("reservation/:reservationId/render")
  async getInvitationRenderData(@Param("reservationId") reservationId: string) {
    return this.invitationsService.getInvitationRenderData(reservationId);
  }

  // Davetiyeyi e-posta ile gönder
  @Post("reservation/:reservationId/send-email")
  async sendInvitationEmail(
    @Param("reservationId") reservationId: string
  ): Promise<{ success: boolean; message: string }> {
    return this.invitationsService.sendInvitationEmail(reservationId);
  }

  // WhatsApp paylaşım linki oluştur
  @Get("reservation/:reservationId/whatsapp-link")
  async getWhatsAppShareLink(
    @Param("reservationId") reservationId: string
  ): Promise<{ success: boolean; link?: string; message?: string }> {
    return this.invitationsService.getWhatsAppShareLink(reservationId);
  }
}
