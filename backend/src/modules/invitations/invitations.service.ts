import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  InvitationTemplate,
  EventInvitation,
  InvitationElement,
  INVITATION_SIZES,
} from "../../entities/invitation-template.entity";
import { Reservation } from "../../entities/reservation.entity";
import { Event } from "../../entities/event.entity";
import { SystemSettings } from "../../entities/settings.entity";
import { MailService } from "../mail/mail.service";
import * as QRCode from "qrcode";

// Davetiye render verisi
export interface InvitationRenderData {
  elements: InvitationElement[];
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundGradient?: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string;
  eventDescription?: string;
  tableLabel: string;
  qrCodeDataUrl: string;
  companyLogo?: string;
}

@Injectable()
export class InvitationsService implements OnModuleInit {
  constructor(
    @InjectRepository(InvitationTemplate)
    private templateRepo: Repository<InvitationTemplate>,
    @InjectRepository(EventInvitation)
    private eventInvitationRepo: Repository<EventInvitation>,
    @InjectRepository(Reservation)
    private reservationRepo: Repository<Reservation>,
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(SystemSettings)
    private settingsRepo: Repository<SystemSettings>,
    private mailService: MailService
  ) {}

  // Uygulama başladığında varsayılan şablonu oluştur
  async onModuleInit() {
    await this.ensureDefaultTemplate();
  }

  // ============ ŞABLON YÖNETİMİ ============

  // Tüm şablonları getir
  async getTemplates(): Promise<InvitationTemplate[]> {
    return this.templateRepo.find({
      where: { isActive: true },
      order: { isDefault: "DESC", createdAt: "DESC" },
    });
  }

  // Tek şablon getir
  async getTemplate(id: string): Promise<InvitationTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException("Şablon bulunamadı");
    }
    return template;
  }

  // Varsayılan şablonu getir
  async getDefaultTemplate(): Promise<InvitationTemplate> {
    let template = await this.templateRepo.findOne({
      where: { isDefault: true, isActive: true },
    });
    if (!template) {
      template = await this.ensureDefaultTemplate();
    }
    return template;
  }

  // Yeni şablon oluştur
  async createTemplate(
    data: Partial<InvitationTemplate>
  ): Promise<InvitationTemplate> {
    const template = this.templateRepo.create({
      ...data,
      isSystemTemplate: false,
    });
    return this.templateRepo.save(template);
  }

  // Şablon güncelle
  async updateTemplate(
    id: string,
    data: Partial<InvitationTemplate>
  ): Promise<InvitationTemplate> {
    const template = await this.getTemplate(id);

    // Sistem şablonlarının bazı alanları değiştirilemez
    if (template.isSystemTemplate) {
      delete data.isSystemTemplate;
      delete data.isDefault;
    }

    Object.assign(template, data);
    return this.templateRepo.save(template);
  }

  // Şablon sil
  async deleteTemplate(id: string): Promise<void> {
    const template = await this.getTemplate(id);

    if (template.isSystemTemplate) {
      throw new Error("Sistem şablonları silinemez");
    }

    await this.templateRepo.update(id, { isActive: false });
  }

  // Şablonu varsayılan yap
  async setDefaultTemplate(id: string): Promise<InvitationTemplate> {
    // Önce tüm şablonların varsayılan durumunu kaldır
    await this.templateRepo.update({}, { isDefault: false });
    // Seçilen şablonu varsayılan yap
    await this.templateRepo.update(id, { isDefault: true });
    return this.getTemplate(id);
  }

  // ============ ETKİNLİK DAVETİYESİ ============

  // Etkinlik davetiyesini getir
  async getEventInvitation(eventId: string): Promise<EventInvitation | null> {
    return this.eventInvitationRepo.findOne({
      where: { eventId },
      relations: ["template"],
    });
  }

  // Etkinlik davetiyesi oluştur/güncelle
  async saveEventInvitation(
    eventId: string,
    data: Partial<EventInvitation>
  ): Promise<EventInvitation> {
    let invitation = await this.eventInvitationRepo.findOne({
      where: { eventId },
    });

    // Akıllı şablon düzeltme sistemi - elementleri kaydetmeden önce düzelt
    if (data.customElements && data.width && data.height) {
      data.customElements = this.smartFixElements(
        data.customElements,
        data.width,
        data.height
      );
    }

    if (invitation) {
      Object.assign(invitation, data);
    } else {
      invitation = this.eventInvitationRepo.create({
        eventId,
        ...data,
      });
    }

    return this.eventInvitationRepo.save(invitation);
  }

  // ============ AKILLI ŞABLON DÜZELTME SİSTEMİ ============

  /**
   * Elementleri akıllıca düzeltir:
   * - Canvas sınırları içinde tutma
   * - Font boyutu normalizasyonu
   * - Minimum boyut kontrolü
   * - Hizalama düzeltmeleri
   */
  private smartFixElements(
    elements: InvitationElement[],
    canvasWidth: number,
    canvasHeight: number
  ): InvitationElement[] {
    const PADDING = 10; // Canvas kenarlarından minimum mesafe
    const MIN_ELEMENT_SIZE = 20; // Minimum element boyutu
    const MIN_FONT_SIZE = 8;
    const MAX_FONT_SIZE = 72;

    return elements.map((element) => {
      const fixed = { ...element };

      // 1. Minimum boyut kontrolü
      if (fixed.width < MIN_ELEMENT_SIZE) {
        fixed.width = MIN_ELEMENT_SIZE;
      }
      if (fixed.height < MIN_ELEMENT_SIZE) {
        fixed.height = MIN_ELEMENT_SIZE;
      }

      // 2. Canvas sınırları içinde tutma (x ekseni)
      if (fixed.x < 0) {
        fixed.x = PADDING;
      }
      if (fixed.x + fixed.width > canvasWidth) {
        // Önce x'i düzelt, sığmıyorsa width'i küçült
        if (fixed.width > canvasWidth - PADDING * 2) {
          fixed.width = canvasWidth - PADDING * 2;
          fixed.x = PADDING;
        } else {
          fixed.x = canvasWidth - fixed.width - PADDING;
        }
      }

      // 3. Canvas sınırları içinde tutma (y ekseni)
      if (fixed.y < 0) {
        fixed.y = PADDING;
      }
      if (fixed.y + fixed.height > canvasHeight) {
        // Önce y'yi düzelt, sığmıyorsa height'i küçült
        if (fixed.height > canvasHeight - PADDING * 2) {
          fixed.height = canvasHeight - PADDING * 2;
          fixed.y = PADDING;
        } else {
          fixed.y = canvasHeight - fixed.height - PADDING;
        }
      }

      // 4. Font boyutu normalizasyonu (metin elementleri için)
      if (fixed.fontSize !== undefined) {
        if (fixed.fontSize < MIN_FONT_SIZE) {
          fixed.fontSize = MIN_FONT_SIZE;
        }
        if (fixed.fontSize > MAX_FONT_SIZE) {
          fixed.fontSize = MAX_FONT_SIZE;
        }

        // Font boyutu element yüksekliğine göre ayarla
        const maxFontForHeight = Math.floor(fixed.height * 0.8);
        if (
          fixed.fontSize > maxFontForHeight &&
          maxFontForHeight >= MIN_FONT_SIZE
        ) {
          fixed.fontSize = maxFontForHeight;
        }
      }

      // 5. Geçerli fontWeight değerleri
      if (fixed.fontWeight) {
        const validWeights = [
          "normal",
          "bold",
          "100",
          "200",
          "300",
          "400",
          "500",
          "600",
          "700",
          "800",
          "900",
        ];
        if (!validWeights.includes(String(fixed.fontWeight))) {
          fixed.fontWeight = "normal";
        }
      }

      // 6. Geçerli textAlign değerleri
      if (fixed.textAlign) {
        const validAligns = ["left", "center", "right"];
        if (!validAligns.includes(fixed.textAlign)) {
          fixed.textAlign = "center";
        }
      }

      // 7. Opacity kontrolü
      if (fixed.opacity !== undefined) {
        if (fixed.opacity < 0) fixed.opacity = 0;
        if (fixed.opacity > 1) fixed.opacity = 1;
      }

      // 8. zIndex kontrolü
      if (fixed.zIndex === undefined || fixed.zIndex < 0) {
        fixed.zIndex = 0;
      }

      // 9. Ortalanmış elementler için x pozisyonunu düzelt
      if (
        fixed.textAlign === "center" &&
        fixed.width < canvasWidth - PADDING * 2
      ) {
        // Element genişliği canvas'tan küçükse ve ortalıysa, x'i merkeze al
        const centerX = (canvasWidth - fixed.width) / 2;
        // Eğer element merkeze yakınsa (±50px), tam merkeze al
        if (Math.abs(fixed.x - centerX) < 50) {
          fixed.x = centerX;
        }
      }

      return fixed;
    });
  }

  // Etkinlik için davetiye elementlerini getir (şablon + özelleştirme)
  async getEventInvitationElements(eventId: string): Promise<{
    elements: InvitationElement[];
    width: number;
    height: number;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundGradient?: string;
  }> {
    const invitation = await this.getEventInvitation(eventId);

    // Özel davetiye varsa onu kullan
    if (invitation?.customElements) {
      return {
        elements: invitation.customElements,
        width: invitation.width,
        height: invitation.height,
        backgroundColor: invitation.backgroundColor,
        backgroundImage: invitation.backgroundImage,
        backgroundGradient: invitation.backgroundGradient,
      };
    }

    // Şablon varsa şablonu kullan
    if (invitation?.template) {
      return {
        elements: invitation.template.elements,
        width: invitation.template.width,
        height: invitation.template.height,
        backgroundColor: invitation.template.backgroundColor,
        backgroundImage: invitation.template.backgroundImage,
        backgroundGradient: invitation.template.backgroundGradient,
      };
    }

    // Varsayılan şablonu kullan
    const defaultTemplate = await this.getDefaultTemplate();
    return {
      elements: defaultTemplate.elements,
      width: defaultTemplate.width,
      height: defaultTemplate.height,
      backgroundColor: defaultTemplate.backgroundColor,
      backgroundImage: defaultTemplate.backgroundImage,
      backgroundGradient: defaultTemplate.backgroundGradient,
    };
  }

  // Etkinliğe görsel ekle
  async addEventImage(
    eventId: string,
    imageUrl: string
  ): Promise<EventInvitation> {
    let invitation = await this.getEventInvitation(eventId);

    if (!invitation) {
      invitation = await this.saveEventInvitation(eventId, {
        eventImages: [imageUrl],
      });
    } else {
      invitation.eventImages = [...(invitation.eventImages || []), imageUrl];
      await this.eventInvitationRepo.save(invitation);
    }

    return invitation;
  }

  // Etkinlikten görsel sil
  async removeEventImage(
    eventId: string,
    imageUrl: string
  ): Promise<EventInvitation> {
    const invitation = await this.getEventInvitation(eventId);
    if (!invitation) {
      throw new NotFoundException("Etkinlik davetiyesi bulunamadı");
    }

    invitation.eventImages = (invitation.eventImages || []).filter(
      (img) => img !== imageUrl
    );
    return this.eventInvitationRepo.save(invitation);
  }

  // ============ VARSAYILAN ŞABLON ============

  private async ensureDefaultTemplate(): Promise<InvitationTemplate> {
    const existing = await this.templateRepo.findOne({
      where: { isSystemTemplate: true, name: "Standart Davetiye" },
    });

    if (existing) return existing;

    // Standart A5 davetiye şablonu
    const defaultElements: InvitationElement[] = [
      // Üst dekoratif çizgi
      {
        id: "decoration-top",
        type: "text",
        x: 80,
        y: 40,
        width: 399,
        height: 4,
        backgroundColor: "#3B82F6",
        content: "",
        zIndex: 1,
      },
      // Firma logosu alanı
      {
        id: "logo",
        type: "logo",
        x: 229,
        y: 60,
        width: 100,
        height: 100,
        objectFit: "contain",
        zIndex: 2,
      },
      // Etkinlik adı
      {
        id: "event-name",
        type: "eventName",
        x: 40,
        y: 180,
        width: 479,
        height: 60,
        fontSize: 32,
        fontFamily: "Inter",
        fontWeight: "bold",
        color: "#1F2937",
        textAlign: "center",
        content: "{{eventName}}",
        zIndex: 3,
      },
      // Etkinlik açıklaması
      {
        id: "event-description",
        type: "eventDescription",
        x: 60,
        y: 250,
        width: 439,
        height: 80,
        fontSize: 14,
        fontFamily: "Inter",
        fontWeight: "normal",
        color: "#6B7280",
        textAlign: "center",
        content: "{{eventDescription}}",
        zIndex: 4,
      },
      // Tarih ikonu ve bilgisi
      {
        id: "event-date",
        type: "eventDate",
        x: 80,
        y: 360,
        width: 399,
        height: 40,
        fontSize: 18,
        fontFamily: "Inter",
        fontWeight: "600",
        color: "#374151",
        textAlign: "center",
        content: "📅 {{eventDate}}",
        zIndex: 5,
      },
      // Saat bilgisi
      {
        id: "event-time",
        type: "eventTime",
        x: 80,
        y: 410,
        width: 399,
        height: 30,
        fontSize: 16,
        fontFamily: "Inter",
        fontWeight: "normal",
        color: "#6B7280",
        textAlign: "center",
        content: "🕐 {{eventTime}}",
        zIndex: 6,
      },
      // Konum bilgisi
      {
        id: "event-location",
        type: "eventLocation",
        x: 80,
        y: 450,
        width: 399,
        height: 30,
        fontSize: 14,
        fontFamily: "Inter",
        fontWeight: "normal",
        color: "#6B7280",
        textAlign: "center",
        content: "📍 {{eventLocation}}",
        zIndex: 7,
      },
      // Ayırıcı çizgi
      {
        id: "divider",
        type: "text",
        x: 180,
        y: 500,
        width: 199,
        height: 2,
        backgroundColor: "#E5E7EB",
        content: "",
        zIndex: 8,
      },
      // Misafir adı
      {
        id: "guest-name",
        type: "guestName",
        x: 40,
        y: 520,
        width: 479,
        height: 40,
        fontSize: 20,
        fontFamily: "Inter",
        fontWeight: "600",
        color: "#1F2937",
        textAlign: "center",
        content: "{{guestName}}",
        zIndex: 9,
      },
      // Masa bilgisi
      {
        id: "table-info",
        type: "text",
        x: 40,
        y: 565,
        width: 479,
        height: 30,
        fontSize: 16,
        fontFamily: "Inter",
        fontWeight: "normal",
        color: "#3B82F6",
        textAlign: "center",
        content: "Masa: {{tableLabel}}",
        zIndex: 10,
      },
      // QR Kod
      {
        id: "qrcode",
        type: "qrcode",
        x: 204,
        y: 610,
        width: 150,
        height: 150,
        zIndex: 11,
      },
      // Alt bilgi
      {
        id: "footer",
        type: "text",
        x: 40,
        y: 770,
        width: 479,
        height: 20,
        fontSize: 10,
        fontFamily: "Inter",
        fontWeight: "normal",
        color: "#9CA3AF",
        textAlign: "center",
        content: "Bu davetiyeyi giriş için gösteriniz",
        zIndex: 12,
      },
    ];

    const template = this.templateRepo.create({
      name: "Standart Davetiye",
      description: "Varsayılan A5 boyutunda profesyonel davetiye şablonu",
      isDefault: true,
      isSystemTemplate: true,
      size: "A5",
      width: INVITATION_SIZES.A5.width,
      height: INVITATION_SIZES.A5.height,
      backgroundColor: "#FFFFFF",
      elements: defaultElements,
    });

    return this.templateRepo.save(template);
  }

  // ============ DAVETİYE RENDER VE GÖNDERME ============

  // Rezervasyon için davetiye verilerini hazırla
  async getInvitationRenderData(
    reservationId: string
  ): Promise<InvitationRenderData> {
    // Rezervasyonu getir
    const reservation = await this.reservationRepo.findOne({
      where: { id: reservationId },
      relations: ["event", "customer"],
    });

    if (!reservation) {
      throw new NotFoundException("Rezervasyon bulunamadı");
    }

    // Etkinlik davetiye elementlerini getir
    const invitationData = await this.getEventInvitationElements(
      reservation.eventId
    );

    // Ayarları getir (logo için)
    const settings = await this.settingsRepo.findOne({ where: {} });

    // QR kod oluştur
    const qrContent = JSON.stringify({
      reservationId: reservation.id,
      eventId: reservation.eventId,
      qrCodeHash: reservation.qrCodeHash,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });

    // Masa etiketini bul
    let tableLabel = reservation.tableId;
    if (reservation.event?.venueLayout?.tables) {
      const table = reservation.event.venueLayout.tables.find(
        (t) => t.id === reservation.tableId
      );
      if (table?.label) tableLabel = table.label;
    }

    // Tarih ve saat formatla
    const eventDate = reservation.event?.eventDate
      ? new Date(reservation.event.eventDate)
      : new Date();
    const dateStr = eventDate.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = eventDate.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      ...invitationData,
      guestName:
        reservation.customer?.fullName || reservation.guestName || "Misafir",
      eventName: reservation.event?.name || "Etkinlik",
      eventDate: dateStr,
      eventTime: timeStr,
      eventDescription: reservation.event?.description || "",
      tableLabel,
      qrCodeDataUrl,
      companyLogo: settings?.logo || undefined,
    };
  }

  // Davetiyeyi e-posta ile gönder
  async sendInvitationEmail(
    reservationId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Rezervasyonu getir
      const reservation = await this.reservationRepo.findOne({
        where: { id: reservationId },
        relations: ["event", "customer"],
      });

      if (!reservation) {
        return { success: false, message: "Rezervasyon bulunamadı" };
      }

      const email =
        reservation.customer?.email || reservation.guestEmail || null;
      if (!email) {
        return { success: false, message: "Misafirin e-posta adresi yok" };
      }

      // Davetiye verilerini hazırla
      const renderData = await this.getInvitationRenderData(reservationId);

      // Ayarları getir
      const settings = await this.settingsRepo.findOne({ where: {} });
      const companyName = settings?.companyName || "EventFlow PRO";

      // HTML e-posta içeriği oluştur
      const html = this.generateInvitationEmailHtml(renderData, companyName);
      const text = this.generateInvitationEmailText(renderData, companyName);

      // QR kodu attachment olarak ekle
      const qrCodeBuffer = Buffer.from(
        renderData.qrCodeDataUrl.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );

      // E-posta gönder
      const result = await this.mailService.sendMail({
        to: email,
        subject: `🎫 Rezervasyon Biletiniz - ${renderData.eventName}`,
        html,
        text,
        attachments: [
          {
            filename: "davetiye-qr.png",
            content: qrCodeBuffer,
            cid: "qrcode",
          },
        ],
      });

      if (result.success) {
        return { success: true, message: "Davetiye e-posta ile gönderildi" };
      } else {
        return {
          success: false,
          message: result.error || "E-posta gönderilemedi",
        };
      }
    } catch (error: any) {
      return { success: false, message: error.message || "Bir hata oluştu" };
    }
  }

  // WhatsApp paylaşım linki oluştur
  async getWhatsAppShareLink(
    reservationId: string
  ): Promise<{ success: boolean; link?: string; message?: string }> {
    try {
      const reservation = await this.reservationRepo.findOne({
        where: { id: reservationId },
        relations: ["event", "customer"],
      });

      if (!reservation) {
        return { success: false, message: "Rezervasyon bulunamadı" };
      }

      const phone =
        reservation.customer?.phone || reservation.guestPhone || null;
      const guestName =
        reservation.customer?.fullName || reservation.guestName || "Misafir";

      // Masa etiketini bul
      let tableLabel = reservation.tableId;
      if (reservation.event?.venueLayout?.tables) {
        const table = reservation.event.venueLayout.tables.find(
          (t) => t.id === reservation.tableId
        );
        if (table?.label) tableLabel = table.label;
      }

      // Tarih formatla
      const eventDate = reservation.event?.eventDate
        ? new Date(reservation.event.eventDate)
        : new Date();
      const dateStr = eventDate.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const timeStr = eventDate.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // WhatsApp mesajı
      const message = `🎫 *REZERVASYON BİLETİNİZ*

Sayın *${guestName}*,

*${
        reservation.event?.name || "Etkinlik"
      }* etkinliği için rezervasyonunuz onaylandı!

📅 *Tarih:* ${dateStr}
🕐 *Saat:* ${timeStr}
🪑 *Masa:* ${tableLabel}
👥 *Kişi:* ${reservation.guestCount}

Rezervasyon No: ${reservationId.slice(0, 8).toUpperCase()}

📱 *QR Kod ile check-in yaparak yerinizi kolayca bulabilir ve servis hizmetlerinden yararlanabilirsiniz.*

_Bu mesajı giriş için gösteriniz._`;

      // Telefon numarasını formatla (sadece rakamlar)
      let formattedPhone = "";
      if (phone) {
        formattedPhone = phone.replace(/\D/g, "");
        // Türkiye için 0 ile başlıyorsa 90 ekle
        if (formattedPhone.startsWith("0")) {
          formattedPhone = "90" + formattedPhone.slice(1);
        } else if (!formattedPhone.startsWith("90")) {
          formattedPhone = "90" + formattedPhone;
        }
      }

      const encodedMessage = encodeURIComponent(message);
      const link = formattedPhone
        ? `https://wa.me/${formattedPhone}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;

      return { success: true, link };
    } catch (error: any) {
      return { success: false, message: error.message || "Bir hata oluştu" };
    }
  }

  // HTML e-posta şablonu
  private generateInvitationEmailHtml(
    data: InvitationRenderData,
    companyName: string
  ): string {
    return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rezervasyon Bileti</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎫 Rezervasyon Biletiniz</h1>
              <p style="color: #93c5fd; margin: 10px 0 0 0; font-size: 14px;">${companyName}</p>
            </td>
          </tr>

          <!-- Karşılama -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0;">
                Sayın <strong>${data.guestName}</strong>,
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 15px 0 0 0;">
                <strong>${
                  data.eventName
                }</strong> etkinliği için rezervasyon biletiniz aşağıdadır.
              </p>
            </td>
          </tr>

          <!-- Etkinlik Bilgileri -->
          <tr>
            <td style="padding: 0 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50%" style="padding: 10px 0;">
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">📅 Tarih</p>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 5px 0 0 0;">${
                            data.eventDate
                          }</p>
                        </td>
                        <td width="50%" style="padding: 10px 0;">
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">🕐 Saat</p>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 5px 0 0 0;">${
                            data.eventTime
                          }</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 10px 0;">
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">🪑 Masa / Yer</p>
                          <p style="color: #2563eb; font-size: 24px; font-weight: 700; margin: 5px 0 0 0;">${
                            data.tableLabel
                          }</p>
                        </td>
                        <td width="50%" style="padding: 10px 0;">
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">🎫 Etkinlik</p>
                          <p style="color: #1f2937; font-size: 14px; font-weight: 600; margin: 5px 0 0 0;">${
                            data.eventName
                          }</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Kod -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="color: #374151; font-size: 14px; margin: 0 0 5px 0;">
                <strong>🎫 Giriş QR Kodunuz</strong>
              </p>
              <div style="background-color: #ffffff; display: inline-block; padding: 15px; border-radius: 12px; border: 2px solid #e2e8f0;">
                <img src="cid:qrcode" alt="QR Kod" width="180" height="180" style="display: block;">
              </div>
            </td>
          </tr>

          <!-- QR Kod Açıklaması -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #2563eb;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="color: #1e40af; font-size: 13px; font-weight: 600; margin: 0 0 8px 0;">
                      📱 QR Kod Ne İşe Yarar?
                    </p>
                    <p style="color: #1e3a8a; font-size: 13px; margin: 0; line-height: 1.5;">
                      Etkinlik günü bu QR kodu görevlilere göstererek hızlıca check-in yapabilir, 
                      yerinizi kolayca bulabilir ve size özel servis hizmetlerinden yararlanabilirsiniz.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Uyarı -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="color: #92400e; font-size: 13px; margin: 0;">
                      <strong>⚠️ Önemli:</strong> Lütfen bu e-postayı saklayın veya QR kodu telefonunuza kaydedin.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Bu e-posta ${companyName} tarafından otomatik olarak gönderilmiştir.
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 10px 0 0 0;">
                © ${new Date().getFullYear()} ${companyName}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  // Plain text e-posta
  private generateInvitationEmailText(
    data: InvitationRenderData,
    companyName: string
  ): string {
    return `
REZERVASYON BİLETİNİZ - ${companyName}
======================================

Sayın ${data.guestName},

${data.eventName} etkinliği için rezervasyon biletiniz aşağıdadır.

REZERVASYON DETAYLARI
---------------------
Etkinlik: ${data.eventName}
Tarih: ${data.eventDate}
Saat: ${data.eventTime}
Masa / Yer: ${data.tableLabel}

QR KOD NE İŞE YARAR?
--------------------
Etkinlik günü bu QR kodu görevlilere göstererek:
• Hızlıca check-in yapabilirsiniz
• Yerinizi kolayca bulabilirsiniz
• Size özel servis hizmetlerinden yararlanabilirsiniz

ÖNEMLİ: Lütfen bu e-postayı saklayın veya QR kodu telefonunuza kaydedin.

---
Bu e-posta ${companyName} tarafından otomatik olarak gönderilmiştir.
© ${new Date().getFullYear()} ${companyName}
    `.trim();
  }
}
