"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  User,
  Phone,
  Mail,
  MapPin,
  Download,
  Share2,
  Ticket,
  Check,
  FileText,
  History,
  Box,
} from "lucide-react";
import dynamic from "next/dynamic";
import { eventsApi, reservationsApi, customersApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Event, Customer, GuestNote } from "@/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/ui/PageContainer";

// Canvas bileşenini client-side only olarak yükle
const TableSelectionCanvas = dynamic(
  () =>
    import("@/components/reservations/TableSelectionCanvas").then(
      (mod) => mod.TableSelectionCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] bg-slate-800 rounded-lg animate-pulse" />
    ),
  }
);

type Step = "guest" | "table" | "preview" | "complete";

interface GuestInfo {
  fullName: string;
  phone: string;
  email: string;
  customerId?: string;
}

export default function NewReservationPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [currentStep, setCurrentStep] = useState<Step>("guest");
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [reservedTables, setReservedTables] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdReservation, setCreatedReservation] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Form state
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    fullName: "",
    phone: "",
    email: "",
    customerId: undefined,
  });
  const [selectedTableId, setSelectedTableId] = useState("");
  const [guestCount, setGuestCount] = useState(1);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerNotes, setCustomerNotes] = useState<GuestNote[]>([]);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [canvasViewMode, setCanvasViewMode] = useState<"2d" | "3d">("2d");

  // Etkinlik ve rezervasyonları yükle
  useEffect(() => {
    if (!eventId) {
      router.push("/reservations");
      return;
    }

    const loadData = async () => {
      try {
        const eventRes = await eventsApi.getOne(eventId);
        setEvent(eventRes.data);

        const reservationsRes = await reservationsApi.getAll({ eventId });
        const reserved = reservationsRes.data
          .filter((r: any) => r.status !== "cancelled")
          .map((r: any) => r.tableId);
        setReservedTables(reserved);
      } catch (err) {
        console.error("Veri yüklenemedi:", err);
        router.push("/reservations");
      } finally {
        setEventLoading(false);
      }
    };

    loadData();
  }, [eventId, router]);

  // Misafir arama (debounced)
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearchingCustomers(true);
    try {
      const response = await customersApi.searchAutocomplete(query, 5);
      setSuggestions(response.data);
      setShowSuggestions(response.data.length > 0);
    } catch (err) {
      console.error("Müşteri arama hatası:", err);
    } finally {
      setSearchingCustomers(false);
    }
  }, []);

  // Ad değiştiğinde arama yap
  useEffect(() => {
    const timer = setTimeout(() => {
      if (guestInfo.fullName && !selectedCustomer) {
        searchCustomers(guestInfo.fullName);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [guestInfo.fullName, selectedCustomer, searchCustomers]);

  // Müşteri seç
  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setGuestInfo({
      fullName: customer.fullName,
      phone: customer.phone || "",
      email: customer.email || "",
      customerId: customer.id,
    });
    setShowSuggestions(false);
    setSuggestions([]);

    try {
      const response = await customersApi.getWithNotes(customer.id);
      setCustomerNotes(response.data.notes || []);
    } catch (err) {
      console.error("Notlar yüklenemedi:", err);
    }
  };

  // Müşteri seçimini temizle
  const clearCustomerSelection = () => {
    setSelectedCustomer(null);
    setGuestInfo({ fullName: "", phone: "", email: "", customerId: undefined });
    setCustomerNotes([]);
  };

  // Seçili masa bilgisi
  const selectedTable = useMemo(() => {
    const tables =
      event?.venueLayout?.tables || (event?.venueLayout as any)?.placedTables;
    if (!tables || !selectedTableId) return null;
    const table = tables.find((t: any) => t.id === selectedTableId);
    if (!table) return null;

    // Label oluştur: tableNumber varsa kullan, yoksa ID'den çıkar
    let displayLabel = table.label;
    if (!displayLabel && table.tableNumber) {
      displayLabel = `Masa ${table.tableNumber}`;
    }
    if (!displayLabel) {
      // ID'den okunabilir format: "back-row3-122" -> "122"
      const idParts = table.id.split("-");
      const lastPart = idParts[idParts.length - 1];
      displayLabel = `Masa ${lastPart}`;
    }

    return { ...table, displayLabel };
  }, [event, selectedTableId]);

  // Validasyonlar
  const validateGuestInfo = (): boolean => {
    if (!guestInfo.fullName.trim()) {
      setError("Ad soyad zorunludur");
      return false;
    }
    // Telefon ve email artık zorunlu değil
    setError("");
    return true;
  };

  const validateTableSelection = (): boolean => {
    if (!selectedTableId) {
      setError("Lütfen bir masa seçin");
      return false;
    }
    setError("");
    return true;
  };

  // Navigasyon
  const handleNext = () => {
    if (currentStep === "guest" && validateGuestInfo()) {
      setCurrentStep("table");
    } else if (currentStep === "table" && validateTableSelection()) {
      setCurrentStep("preview");
    }
  };

  const handleBack = () => {
    if (currentStep === "table") setCurrentStep("guest");
    else if (currentStep === "preview") setCurrentStep("table");
  };

  // Rezervasyonu onayla
  const handleConfirm = async () => {
    if (!eventId || !selectedTableId) return;

    setSubmitting(true);
    setError("");

    try {
      // customerId boş string ise gönderme (UUID validasyonu için)
      const reservationData: any = {
        eventId,
        tableId: selectedTableId,
        guestCount,
        guestName: guestInfo.fullName,
      };

      // Sadece değer varsa ekle
      if (guestInfo.customerId) {
        reservationData.customerId = guestInfo.customerId;
      }
      if (guestInfo.phone?.trim()) {
        reservationData.guestPhone = guestInfo.phone;
      }
      if (guestInfo.email?.trim()) {
        reservationData.guestEmail = guestInfo.email;
      }

      const response = await reservationsApi.create(reservationData);

      setCreatedReservation(response.data);

      try {
        const qrRes = await reservationsApi.generateQRCode(response.data.id);
        setQrCodeUrl(qrRes.data.qrCodeDataUrl);
      } catch (qrErr) {
        console.error("QR kod alınamadı:", qrErr);
      }

      setCurrentStep("complete");
    } catch (err: any) {
      setError(err.response?.data?.message || "Rezervasyon oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  // QR kod indir
  const handleDownloadTicket = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `bilet-${createdReservation?.id || "rezervasyon"}.png`;
    link.click();
  };

  // WhatsApp ile paylaş
  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      `🎫 Rezervasyon Bileti\n\n` +
        `Etkinlik: ${event?.name}\n` +
        `Tarih: ${event ? formatDate(event.eventDate) : ""}\n` +
        `Masa: ${selectedTable?.label || selectedTableId}\n` +
        `Kişi: ${guestCount}\n\n` +
        `Misafir: ${guestInfo.fullName}`
    );
    window.open(
      `https://wa.me/${guestInfo.phone.replace(/\D/g, "")}?text=${message}`,
      "_blank"
    );
  };

  // E-posta ile bilet gönder
  const handleSendEmail = async () => {
    if (!createdReservation?.id || !guestInfo.email) return;
    setSendingEmail(true);
    try {
      const { invitationsApi } = await import("@/lib/api");
      await invitationsApi.sendInvitationEmail(createdReservation.id);
      alert("E-posta başarıyla gönderildi!");
    } catch (err: any) {
      console.error("Mail gönderme hatası:", err);
      alert(err.response?.data?.message || "E-posta gönderilemedi");
    } finally {
      setSendingEmail(false);
    }
  };

  // Yeni rezervasyon başlat
  const resetForm = () => {
    setCurrentStep("guest");
    setGuestInfo({ fullName: "", phone: "", email: "", customerId: undefined });
    setSelectedTableId("");
    setGuestCount(1);
    setCreatedReservation(null);
    setQrCodeUrl("");
    setSelectedCustomer(null);
    setCustomerNotes([]);
  };

  if (eventLoading) {
    return (
      <PageContainer maxWidth="4xl">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </PageContainer>
    );
  }

  if (!event) return null;

  return (
    <PageContainer maxWidth="4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/reservations/${eventId}`}
            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Yeni Rezervasyon</h1>
            <p className="text-slate-400 text-sm">
              {event.name} - {formatDate(event.eventDate)}
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        {currentStep !== "complete" && (
          <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto">
            {[
              { key: "guest", label: "Misafir" },
              { key: "table", label: "Masa" },
              { key: "preview", label: "Onay" },
            ].map((step, index) => (
              <div key={step.key} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step.key
                      ? "bg-purple-600 text-white"
                      : ["guest"].includes(currentStep) && index > 0
                      ? "bg-slate-700 text-slate-400"
                      : ["table"].includes(currentStep) && index > 1
                      ? "bg-slate-700 text-slate-400"
                      : "bg-green-600 text-white"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`ml-2 text-sm hidden sm:inline ${
                    currentStep === step.key ? "text-white" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                {index < 2 && (
                  <div className="w-4 sm:w-8 h-px bg-slate-700 mx-2 sm:mx-4" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert
            variant="destructive"
            className="mb-6 bg-red-900/50 border-red-700"
          >
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Misafir Bilgileri */}
        {currentStep === "guest" && (
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              Misafir Bilgileri
            </h2>

            {/* Seçili müşteri */}
            {selectedCustomer && (
              <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600/30 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedCustomer.fullName}</p>
                      <p className="text-xs text-slate-400">
                        {selectedCustomer.totalAttendedEvents || 0} etkinliğe
                        katıldı
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customerNotes.length > 0 && (
                      <button
                        onClick={() => setShowNotesModal(true)}
                        className="p-2 bg-yellow-600/20 rounded-lg text-yellow-400"
                        title="Notları Görüntüle"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={clearCustomerSelection}
                      className="text-xs text-slate-400 px-2 py-1 bg-slate-700 rounded"
                    >
                      Temizle
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm text-slate-400 mb-2">
                  Ad Soyad *
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={guestInfo.fullName}
                    onChange={(e) => {
                      if (selectedCustomer) clearCustomerSelection();
                      setGuestInfo({ ...guestInfo, fullName: e.target.value });
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500"
                    placeholder="Misafirin adı soyadı"
                  />
                  {searchingCustomers && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Autocomplete */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <div className="p-2 text-xs text-slate-400 border-b border-slate-600">
                      <History className="w-3 h-3 inline mr-1" />
                      Önceki misafirler
                    </div>
                    {suggestions.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full p-3 text-left flex items-center gap-3 hover:bg-slate-600 border-b border-slate-600/50 last:border-0"
                      >
                        <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {customer.fullName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {customer.phone || "Telefon yok"}
                          </p>
                        </div>
                        {customer.totalAttendedEvents > 0 && (
                          <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded">
                            {customer.totalAttendedEvents}x
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Telefon (Opsiyonel)
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="tel"
                    value={guestInfo.phone}
                    onChange={(e) =>
                      setGuestInfo({ ...guestInfo, phone: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500"
                    placeholder="05XX XXX XX XX"
                    disabled={!!selectedCustomer}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  E-posta (Opsiyonel)
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={guestInfo.email}
                    onChange={(e) =>
                      setGuestInfo({ ...guestInfo, email: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500"
                    placeholder="ornek@email.com"
                    disabled={!!selectedCustomer}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Kişi Sayısı
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={handleNext}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Devam Et <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Masa Seçimi */}
        {currentStep === "table" && (
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-400" />
                Masa Seçimi
              </h2>
              {/* 3D Toggle Button */}
              <Button
                size="sm"
                variant={canvasViewMode === "3d" ? "secondary" : "outline"}
                onClick={() =>
                  setCanvasViewMode(canvasViewMode === "2d" ? "3d" : "2d")
                }
                className={
                  canvasViewMode === "3d"
                    ? "bg-cyan-600 text-white hover:bg-cyan-700 px-4"
                    : "border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 px-4"
                }
              >
                <Box className="w-4 h-4 mr-1.5" />
                {canvasViewMode === "2d" ? "3D Görünüm" : "2D Görünüm"}
              </Button>
            </div>

            {/* Lejant */}
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-green-500 bg-green-500/20" />
                <span className="text-slate-400">Müsait</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold">
                  R
                </div>
                <span className="text-slate-400">Rezerveli</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-purple-500 bg-purple-500" />
                <span className="text-slate-400">Seçili</span>
              </div>
            </div>

            {/* Canvas */}
            {event.venueLayout?.tables ||
            (event.venueLayout as any)?.placedTables ? (
              <TableSelectionCanvas
                event={event}
                reservedTableIds={reservedTables}
                selectedTableId={selectedTableId}
                onSelectTable={(tableId, capacity) => {
                  setSelectedTableId(tableId);
                  if (guestCount > capacity) setGuestCount(capacity);
                }}
                guestInfo={{
                  fullName: guestInfo.fullName,
                  phone: guestInfo.phone,
                  email: guestInfo.email,
                  guestCount: guestCount,
                }}
                viewMode={canvasViewMode}
              />
            ) : (
              <div className="w-full h-[400px] bg-slate-900 rounded-lg flex items-center justify-center text-slate-400">
                Bu etkinlik için yerleşim planı bulunamadı
              </div>
            )}

            {/* Seçili masa */}
            {selectedTable && (
              <div className="mt-4 p-4 bg-purple-600/20 rounded-lg border border-purple-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-lg">
                      Seçilen Masa: {selectedTable.displayLabel}
                    </p>
                    <p className="text-sm text-slate-400">
                      Kapasite: {selectedTable.capacity} kişi
                    </p>
                  </div>
                  <CheckCircle className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-slate-600"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Geri
              </Button>
              <Button
                onClick={handleNext}
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!selectedTableId}
              >
                Devam Et <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Önizleme */}
        {currentStep === "preview" && (
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Rezervasyon Özeti
            </h2>

            <div className="space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm text-slate-400 mb-2">Etkinlik</h3>
                <p className="font-medium">{event.name}</p>
                <p className="text-sm text-slate-400">
                  {formatDate(event.eventDate)}
                </p>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm text-slate-400 mb-2">
                  Misafir Bilgileri
                </h3>
                <p className="font-medium">{guestInfo.fullName}</p>
                <p className="text-sm text-slate-400">{guestInfo.phone}</p>
                {guestInfo.email && (
                  <p className="text-sm text-slate-400">{guestInfo.email}</p>
                )}
                <p className="text-sm text-slate-400">{guestCount} kişi</p>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-sm text-slate-400 mb-2">Masa</h3>
                <p className="font-medium text-xl">
                  {selectedTable?.displayLabel || selectedTableId}
                </p>
                <p className="text-sm text-slate-400">
                  Kapasite: {selectedTable?.capacity} kişi
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-slate-600"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Geri
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                    Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" /> Rezervasyonu Onayla
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Tamamlandı */}
        {currentStep === "complete" && (
          <div className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Rezervasyon Tamamlandı!</h2>
            <p className="text-slate-400 mb-6">
              {guestInfo.fullName} için{" "}
              {selectedTable?.displayLabel || selectedTableId} rezerve edildi.
            </p>

            {/* E-Bilet */}
            {qrCodeUrl && (
              <div className="bg-slate-700/50 rounded-xl p-6 mb-6">
                <h3 className="font-medium mb-4 flex items-center justify-center gap-2">
                  <Ticket className="w-5 h-5 text-purple-400" /> Elektronik
                  Bilet
                </h3>
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                  <img src={qrCodeUrl} alt="QR Kod" className="w-48 h-48" />
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleDownloadTicket}
                    className="border-slate-600"
                  >
                    <Download className="w-4 h-4 mr-2" /> İndir
                  </Button>
                  {guestInfo.email && (
                    <Button
                      variant="outline"
                      onClick={handleSendEmail}
                      disabled={sendingEmail}
                      className="border-purple-600 text-purple-400"
                    >
                      {sendingEmail ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4 mr-2" />
                      )}
                      Mail Gönder
                    </Button>
                  )}
                  {guestInfo.phone && (
                    <Button
                      variant="outline"
                      onClick={handleShareWhatsApp}
                      className="border-green-600 text-green-400"
                    >
                      <Share2 className="w-4 h-4 mr-2" /> WhatsApp
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Link href={`/reservations/${eventId}`}>
                <Button variant="outline" className="border-slate-600">
                  Dashboard'a Dön
                </Button>
              </Link>
              <Button
                onClick={resetForm}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Yeni Rezervasyon
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Müşteri Notları Modal */}
      <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-yellow-400" />
              Misafir Notları - {selectedCustomer?.fullName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {customerNotes.length === 0 ? (
              <p className="text-slate-400 text-center py-4">
                Bu misafir için not bulunmuyor.
              </p>
            ) : (
              customerNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        note.noteType === "pre_event"
                          ? "bg-blue-600/20 text-blue-400"
                          : note.noteType === "during_event"
                          ? "bg-green-600/20 text-green-400"
                          : note.noteType === "post_event"
                          ? "bg-purple-600/20 text-purple-400"
                          : "bg-slate-600/20 text-slate-400"
                      }`}
                    >
                      {note.noteType === "pre_event"
                        ? "Etkinlik Öncesi"
                        : note.noteType === "during_event"
                        ? "Etkinlik Sırası"
                        : note.noteType === "post_event"
                        ? "Etkinlik Sonrası"
                        : "Genel"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                  {note.event && (
                    <p className="text-xs text-slate-400 mb-1">
                      📅 {note.event.name}
                    </p>
                  )}
                  <p className="text-sm">{note.content}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
