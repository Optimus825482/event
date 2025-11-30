import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as nodemailer from "nodemailer";
import { SystemSettings } from "../../entities/settings.entity";

// Mail gönderim sonucu
export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Mail içeriği
export interface MailContent {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    encoding?: string;
    cid?: string;
  }>;
}

// Rezervasyon bileti için veri
export interface TicketEmailData {
  guestName: string;
  guestEmail: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  tableLabel: string;
  guestCount: number;
  qrCodeDataUrl: string;
  reservationId: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectRepository(SystemSettings)
    private settingsRepo: Repository<SystemSettings>
  ) {}

  /**
   * SMTP ayarlarını veritabanından al
   */
  private async getSettings(): Promise<SystemSettings | null> {
    try {
      return await this.settingsRepo.findOne({ where: {} });
    } catch (error) {
      this.logger.error("Ayarlar alınamadı:", error);
      return null;
    }
  }

  /**
   * Nodemailer transporter oluştur
   */
  private async createTransporter(): Promise<nodemailer.Transporter | null> {
    const settings = await this.getSettings();

    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
      this.logger.warn("SMTP ayarları eksik - mail gönderilemez");
      return null;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort || 587,
        secure: settings.smtpSecure || false, // true for 465, false for other ports
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPassword,
        },
        // Spam'a düşmemek için önemli ayarlar
        tls: {
          rejectUnauthorized: false, // Self-signed sertifikalar için
        },
        // Connection pool - performans için
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });

      return transporter;
    } catch (error) {
      this.logger.error("Transporter oluşturulamadı:", error);
      return null;
    }
  }

  /**
   * SMTP bağlantısını test et
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const transporter = await this.createTransporter();

    if (!transporter) {
      return { success: false, message: "SMTP ayarları eksik veya hatalı" };
    }

    try {
      await transporter.verify();
      return { success: true, message: "SMTP bağlantısı başarılı" };
    } catch (error: any) {
      return {
        success: false,
        message: `SMTP bağlantı hatası: ${error.message}`,
      };
    }
  }

  /**
   * Genel mail gönderimi
   */
  async sendMail(content: MailContent): Promise<MailResult> {
    const settings = await this.getSettings();
    const transporter = await this.createTransporter();

    if (!transporter || !settings) {
      return { success: false, error: "SMTP ayarları yapılandırılmamış" };
    }

    try {
      const info = await transporter.sendMail({
        from: `"${settings.smtpFromName || settings.companyName}" <${
          settings.smtpFromEmail || settings.smtpUser
        }>`,
        to: content.to,
        subject: content.subject,
        html: content.html,
        text: content.text,
        attachments: content.attachments,
        // Spam'a düşmemek için önemli header'lar
        headers: {
          "X-Priority": "3", // Normal priority
          "X-Mailer": "EventFlow PRO",
          "List-Unsubscribe": `<mailto:${
            settings.smtpFromEmail || settings.smtpUser
          }?subject=unsubscribe>`,
        },
      });

      this.logger.log(`Mail gönderildi: ${info.messageId} -> ${content.to}`);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      this.logger.error(`Mail gönderilemedi: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rezervasyon bileti maili gönder
   */
  async sendTicketEmail(data: TicketEmailData): Promise<MailResult> {
    const settings = await this.getSettings();

    if (!settings?.emailNotifications) {
      this.logger.log("E-posta bildirimleri kapalı");
      return { success: false, error: "E-posta bildirimleri kapalı" };
    }

    if (!data.guestEmail) {
      return { success: false, error: "Misafir e-posta adresi yok" };
    }

    const companyName = settings?.companyName || "EventFlow PRO";

    // HTML mail şablonu - profesyonel ve spam'a düşmeyecek şekilde
    const html = this.generateTicketEmailHtml(data, companyName);
    const text = this.generateTicketEmailText(data, companyName);

    // QR kodu attachment olarak ekle (inline image)
    const qrCodeBuffer = Buffer.from(
      data.qrCodeDataUrl.replace(/^data:image\/png;base64,/, ""),
      "base64"
    );

    return this.sendMail({
      to: data.guestEmail,
      subject: `🎫 Rezervasyon Onayı - ${data.eventName}`,
      html,
      text,
      attachments: [
        {
          filename: "qr-bilet.png",
          content: qrCodeBuffer,
          cid: "qrcode", // HTML'de src="cid:qrcode" olarak kullanılacak
        },
      ],
    });
  }

  /**
   * HTML mail şablonu oluştur
   */
  private generateTicketEmailHtml(
    data: TicketEmailData,
    companyName: string
  ): string {
    return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rezervasyon Onayı</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✅ Rezervasyonunuz Onaylandı</h1>
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
                }</strong> etkinliği için rezervasyonunuz başarıyla oluşturuldu. 
                Aşağıda rezervasyon detaylarınızı ve giriş QR kodunuzu bulabilirsiniz.
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
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Etkinlik</p>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 5px 0 0 0;">${
                            data.eventName
                          }</p>
                        </td>
                        <td width="50%" style="padding: 10px 0;">
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Tarih</p>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 5px 0 0 0;">${
                            data.eventDate
                          }</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 10px 0;">
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Masa / Yer</p>
                          <p style="color: #2563eb; font-size: 20px; font-weight: 700; margin: 5px 0 0 0;">${
                            data.tableLabel
                          }</p>
                        </td>
                        <td width="50%" style="padding: 10px 0;">
                          <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Kişi Sayısı</p>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 5px 0 0 0;">${
                            data.guestCount
                          } Kişi</p>
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
              <p style="color: #6b7280; font-size: 12px; margin: 0 0 15px 0;">
                Rezervasyon No: <strong>${data.reservationId
                  .slice(0, 8)
                  .toUpperCase()}</strong>
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
                      Etkinlik günü bu QR kodu görevlilere göstererek:
                    </p>
                    <ul style="color: #1e3a8a; font-size: 13px; margin: 8px 0 0 0; padding-left: 20px; line-height: 1.6;">
                      <li>Hızlıca check-in yapabilir ve yerinizi kolayca bulabilirsiniz</li>
                      <li>Organizasyon ekibi gelişinizden haberdar olur</li>
                      <li>Size özel servis hizmetleri sağlanır</li>
                    </ul>
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
                      Etkinlik girişinde bu kodu göstermeniz gerekmektedir.
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
                © ${new Date().getFullYear()} ${companyName}. Tüm hakları saklıdır.
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

  /**
   * Plain text mail içeriği (spam filtresi için önemli)
   */
  private generateTicketEmailText(
    data: TicketEmailData,
    companyName: string
  ): string {
    return `
REZERVASYONUNUZ ONAYLANDI - ${companyName}
==========================================

Sayın ${data.guestName},

${data.eventName} etkinliği için rezervasyonunuz başarıyla oluşturuldu.

REZERVASYON DETAYLARI
---------------------
Etkinlik: ${data.eventName}
Tarih: ${data.eventDate}
Masa / Yer: ${data.tableLabel}
Kişi Sayısı: ${data.guestCount}
Rezervasyon No: ${data.reservationId.slice(0, 8).toUpperCase()}

QR KOD NE İŞE YARAR?
--------------------
Etkinlik günü bu QR kodu görevlilere göstererek:
• Hızlıca check-in yapabilir ve yerinizi kolayca bulabilirsiniz
• Organizasyon ekibi gelişinizden haberdar olur
• Size özel servis hizmetleri sağlanır

ÖNEMLİ: Lütfen bu e-postayı saklayın veya QR kodu telefonunuza kaydedin.
Etkinlik girişinde bu kodu göstermeniz gerekmektedir.

---
Bu e-posta ${companyName} tarafından otomatik olarak gönderilmiştir.
© ${new Date().getFullYear()} ${companyName}
    `.trim();
  }
}
