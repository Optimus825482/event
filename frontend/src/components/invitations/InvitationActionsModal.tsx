"use client";

import { useState, useEffect, useRef } from "react";
import {
  Eye,
  Mail,
  Download,
  MessageCircle,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { invitationsApi } from "@/lib/api";
import type { Reservation } from "@/types";

interface InvitationActionsModalProps {
  reservation: Reservation | null;
  isOpen: boolean;
  onClose: () => void;
}

// Davetiye render verisi tipi
interface InvitationRenderData {
  elements: any[];
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

export function InvitationActionsModal({
  reservation,
  isOpen,
  onClose,
}: InvitationActionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [renderData, setRenderData] = useState<InvitationRenderData | null>(
    null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [actionStatus, setActionStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Davetiye verilerini yükle
  useEffect(() => {
    if (isOpen && reservation?.id) {
      loadRenderData();
    }
  }, [isOpen, reservation?.id]);

  const loadRenderData = async () => {
    if (!reservation?.id) return;

    setLoading(true);
    try {
      const res = await invitationsApi.getInvitationRenderData(reservation.id);
      setRenderData(res.data);
    } catch (error) {
      console.error("Davetiye verileri yüklenemedi:", error);
      setActionStatus({
        type: "error",
        message: "Davetiye verileri yüklenemedi",
      });
    } finally {
      setLoading(false);
    }
  };

  // Davetiyeyi görüntüle
  const handlePreview = () => {
    setShowPreview(true);
  };

  // E-posta ile gönder
  const handleSendEmail = async () => {
    if (!reservation?.id) return;

    setLoading(true);
    setActionStatus({ type: null, message: "" });

    try {
      const res = await invitationsApi.sendInvitationEmail(reservation.id);
      if (res.data.success) {
        setActionStatus({ type: "success", message: res.data.message });
      } else {
        setActionStatus({ type: "error", message: res.data.message });
      }
    } catch (error: any) {
      setActionStatus({
        type: "error",
        message: error.response?.data?.message || "E-posta gönderilemedi",
      });
    } finally {
      setLoading(false);
    }
  };

  // WhatsApp ile gönder
  const handleWhatsApp = async () => {
    if (!reservation?.id) return;

    setLoading(true);
    try {
      const res = await invitationsApi.getWhatsAppShareLink(reservation.id);
      if (res.data.success && res.data.link) {
        window.open(res.data.link, "_blank");
      } else {
        setActionStatus({
          type: "error",
          message: res.data.message || "WhatsApp linki oluşturulamadı",
        });
      }
    } catch (error) {
      setActionStatus({
        type: "error",
        message: "WhatsApp linki oluşturulamadı",
      });
    } finally {
      setLoading(false);
    }
  };

  // Davetiyeyi indir (PNG)
  const handleDownload = async () => {
    if (!renderData || !canvasRef.current) {
      setActionStatus({
        type: "error",
        message: "Önce davetiyeyi görüntüleyin",
      });
      return;
    }

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Canvas boyutunu ayarla
      canvas.width = renderData.width;
      canvas.height = renderData.height;

      // Arka plan rengi
      ctx.fillStyle = renderData.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Arka plan görseli varsa çiz
      if (renderData.backgroundImage) {
        await new Promise<void>((resolve) => {
          const bgImg = new Image();
          bgImg.crossOrigin = "anonymous";
          bgImg.onload = () => {
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
            resolve();
          };
          bgImg.onerror = () => resolve();
          bgImg.src = renderData.backgroundImage!;
        });
      }

      // Gradient arka plan varsa çiz
      if (renderData.backgroundGradient) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        // Basit gradient parsing (linear-gradient formatı)
        const colors = renderData.backgroundGradient.match(/#[a-fA-F0-9]{6}/g);
        if (colors && colors.length >= 2) {
          gradient.addColorStop(0, colors[0]);
          gradient.addColorStop(1, colors[1]);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      // Elementleri çiz
      for (const element of renderData.elements.sort(
        (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
      )) {
        await drawElement(ctx, element, renderData);
      }

      // İndir
      const link = document.createElement("a");
      link.download = `davetiye-${reservation?.guestName || "misafir"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      setActionStatus({ type: "success", message: "Davetiye indirildi" });
    } catch (error) {
      console.error("İndirme hatası:", error);
      setActionStatus({ type: "error", message: "Davetiye indirilemedi" });
    }
  };

  // Element çizme fonksiyonu
  const drawElement = async (
    ctx: CanvasRenderingContext2D,
    element: any,
    data: InvitationRenderData
  ) => {
    const { type, x, y, width, height } = element;

    // Dinamik içerik değiştirme
    let content = element.content || "";
    content = content
      .replace(/\{\{guestName\}\}/g, data.guestName)
      .replace(/\{\{eventName\}\}/g, data.eventName)
      .replace(/\{\{eventDate\}\}/g, data.eventDate)
      .replace(/\{\{eventTime\}\}/g, data.eventTime)
      .replace(/\{\{eventLocation\}\}/g, data.eventLocation || "")
      .replace(/\{\{eventDescription\}\}/g, data.eventDescription || "")
      .replace(/\{\{tableLabel\}\}/g, data.tableLabel);

    // Arka plan rengi
    if (element.backgroundColor) {
      ctx.fillStyle = element.backgroundColor;
      ctx.fillRect(x, y, width, height);
    }

    // QR Kod
    if (type === "qrcode" && data.qrCodeDataUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          // QR kod için beyaz arka plan
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x - 4, y - 4, width + 8, height + 8);
          ctx.drawImage(img, x, y, width, height);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = data.qrCodeDataUrl;
      });
      return;
    }

    // Logo - element.imageUrl veya data.companyLogo kullan
    if (type === "logo") {
      const logoSrc = element.imageUrl || data.companyLogo;
      if (!logoSrc) return;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.drawImage(img, x, y, width, height);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = logoSrc;
      });
      return;
    }

    // Görsel elementi (image veya eventImage)
    if ((type === "image" || type === "eventImage") && element.imageUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.drawImage(img, x, y, width, height);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = element.imageUrl;
      });
      return;
    }

    // Metin elementleri (companyName dahil)
    if (
      type === "text" ||
      type === "guestName" ||
      type === "eventName" ||
      type === "eventDate" ||
      type === "eventTime" ||
      type === "eventLocation" ||
      type === "eventDescription" ||
      type === "companyName"
    ) {
      if (!content) return;

      ctx.fillStyle = element.color || "#000000";
      ctx.font = `${element.fontWeight || "normal"} ${
        element.fontSize || 14
      }px ${element.fontFamily || "Arial"}`;
      ctx.textAlign = (element.textAlign as CanvasTextAlign) || "left";
      ctx.textBaseline = "top";

      // Metin hizalama için x pozisyonunu ayarla
      let textX = x;
      if (element.textAlign === "center") {
        textX = x + width / 2;
      } else if (element.textAlign === "right") {
        textX = x + width;
      }

      ctx.fillText(content, textX, y);
    }
  };

  if (!reservation) return null;

  const guestName =
    reservation.customer?.fullName || reservation.guestName || "Misafir";
  const hasEmail = !!(reservation.customer?.email || reservation.guestEmail);

  return (
    <>
      <Dialog open={isOpen && !showPreview} onOpenChange={onClose}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-pink-400" />
              E-Davetiye İşlemleri
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* Misafir Bilgisi */}
            <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-400">Misafir</p>
              <p className="font-medium text-lg">{guestName}</p>
              {renderData && (
                <p className="text-sm text-slate-400 mt-1">
                  Masa: {renderData.tableLabel}
                </p>
              )}
            </div>

            {/* Durum Mesajı */}
            {actionStatus.type && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                  actionStatus.type === "success"
                    ? "bg-green-600/20 text-green-400"
                    : "bg-red-600/20 text-red-400"
                }`}
              >
                {actionStatus.type === "success" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span className="text-sm">{actionStatus.message}</span>
              </div>
            )}

            {/* Aksiyonlar */}
            <div className="space-y-3">
              {/* Görüntüle */}
              <Button
                onClick={handlePreview}
                disabled={loading || !renderData}
                className="w-full bg-blue-600 justify-start gap-3"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Davetiyeyi Görüntüle
              </Button>

              {/* E-posta Gönder */}
              <Button
                onClick={handleSendEmail}
                disabled={loading || !hasEmail}
                className="w-full bg-pink-600 justify-start gap-3"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                E-posta ile Gönder
                {!hasEmail && (
                  <span className="text-xs text-pink-300 ml-auto">
                    (E-posta yok)
                  </span>
                )}
              </Button>

              {/* WhatsApp */}
              <Button
                onClick={handleWhatsApp}
                disabled={loading}
                className="w-full bg-green-600 justify-start gap-3"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                WhatsApp ile Gönder
              </Button>

              {/* İndir */}
              <Button
                onClick={handleDownload}
                disabled={loading || !renderData}
                className="w-full bg-purple-600 justify-start gap-3"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                PNG Olarak İndir
              </Button>
            </div>
          </div>

          {/* Gizli canvas - indirme için */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </DialogContent>
      </Dialog>

      {/* Önizleme Modal */}
      {showPreview && renderData && (
        <InvitationPreviewModal
          renderData={renderData}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

// Önizleme Modal Bileşeni
function InvitationPreviewModal({
  renderData,
  onClose,
}: {
  renderData: InvitationRenderData;
  onClose: () => void;
}) {
  // Dinamik içerik değiştirme
  const replaceVariables = (content: string): string => {
    return content
      .replace(/\{\{guestName\}\}/g, renderData.guestName)
      .replace(/\{\{eventName\}\}/g, renderData.eventName)
      .replace(/\{\{eventDate\}\}/g, renderData.eventDate)
      .replace(/\{\{eventTime\}\}/g, renderData.eventTime)
      .replace(/\{\{eventLocation\}\}/g, renderData.eventLocation || "")
      .replace(/\{\{eventDescription\}\}/g, renderData.eventDescription || "")
      .replace(/\{\{tableLabel\}\}/g, renderData.tableLabel);
  };

  // Ölçekleme hesapla
  const maxWidth = Math.min(
    typeof window !== "undefined" ? window.innerWidth - 100 : 400,
    450
  );
  const maxHeight =
    typeof window !== "undefined" ? window.innerHeight - 250 : 600;
  const scale = Math.min(
    maxWidth / renderData.width,
    maxHeight / renderData.height,
    0.7
  );

  // Element render
  const renderElement = (element: any) => {
    const baseStyle: React.CSSProperties = {
      position: "absolute",
      left: element.x * scale,
      top: element.y * scale,
      width: element.width * scale,
      height: element.height * scale,
      fontSize: (element.fontSize || 14) * scale,
      fontFamily: element.fontFamily || "Inter, sans-serif",
      fontWeight: element.fontWeight || "normal",
      color: element.color || "#000000",
      backgroundColor: element.backgroundColor,
      borderRadius: element.borderRadius
        ? element.borderRadius * scale
        : undefined,
      opacity: element.opacity,
      zIndex: element.zIndex || 0,
      display: "flex",
      alignItems: "center",
      justifyContent:
        element.textAlign === "center"
          ? "center"
          : element.textAlign === "right"
          ? "flex-end"
          : "flex-start",
      overflow: "hidden",
      lineHeight: 1.2,
      padding:
        element.type !== "qrcode" &&
        element.type !== "image" &&
        element.type !== "logo"
          ? `${2 * scale}px`
          : 0,
      boxSizing: "border-box",
    };

    // QR Kod
    if (element.type === "qrcode") {
      return (
        <div
          key={element.id}
          style={{
            ...baseStyle,
            backgroundColor: "#ffffff",
            padding: 4 * scale,
            borderRadius: 4 * scale,
          }}
        >
          <img
            src={renderData.qrCodeDataUrl}
            alt="QR Kod"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      );
    }

    // Logo - element.imageUrl veya renderData.companyLogo kullan
    if (element.type === "logo") {
      const logoSrc = element.imageUrl || renderData.companyLogo;
      if (!logoSrc) return null;
      return (
        <div key={element.id} style={baseStyle}>
          <img
            src={logoSrc}
            alt="Logo"
            style={{
              width: "100%",
              height: "100%",
              objectFit: element.objectFit || "contain",
            }}
          />
        </div>
      );
    }

    // Görsel (image veya eventImage)
    if (
      (element.type === "image" || element.type === "eventImage") &&
      element.imageUrl
    ) {
      return (
        <div key={element.id} style={baseStyle}>
          <img
            src={element.imageUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: element.objectFit || "cover",
            }}
          />
        </div>
      );
    }

    // companyName tipi - metin olarak render et
    if (element.type === "companyName") {
      const content = element.content || "";
      return (
        <div key={element.id} style={baseStyle}>
          <span
            style={{ width: "100%", textAlign: element.textAlign || "left" }}
          >
            {content}
          </span>
        </div>
      );
    }

    // Metin elementleri
    const content = replaceVariables(element.content || "");

    // Sadece arka plan rengi olan boş elementler (ayırıcı çizgiler vb.)
    if (!content && element.backgroundColor) {
      return <div key={element.id} style={baseStyle} />;
    }

    if (!content) return null;

    return (
      <div key={element.id} style={baseStyle}>
        <span style={{ width: "100%", textAlign: element.textAlign || "left" }}>
          {content}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl overflow-hidden max-w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Davetiye Önizleme</h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 rounded-lg text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Davetiye */}
        <div className="p-4 sm:p-6 flex justify-center overflow-auto bg-slate-900">
          <div
            style={{
              width: renderData.width * scale,
              height: renderData.height * scale,
              position: "relative",
              // Öncelik: backgroundImage > backgroundGradient > backgroundColor
              backgroundColor: renderData.backgroundColor || "#ffffff",
              backgroundImage: renderData.backgroundImage
                ? `url(${renderData.backgroundImage})`
                : renderData.backgroundGradient
                ? renderData.backgroundGradient
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              borderRadius: 8,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            {renderData.elements
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map(renderElement)}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-center gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-slate-600"
          >
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
