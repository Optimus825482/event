"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Check,
  Loader2,
  Info,
  Layout,
  Clock,
  Mail,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { eventsApi, venuesApi, staffApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// Etkinlik türleri
const EVENT_TYPES = [
  { value: "wedding", label: "Düğün" },
  { value: "corporate", label: "Kurumsal Etkinlik" },
  { value: "concert", label: "Konser" },
  { value: "conference", label: "Konferans" },
  { value: "gala", label: "Gala" },
  { value: "party", label: "Parti" },
  { value: "other", label: "Diğer" },
];

// Stepper adımları
const STEPS = [
  {
    id: 1,
    title: "Temel Bilgiler",
    description: "Etkinlik adı, tarih ve tür",
    icon: Calendar,
  },
  {
    id: 2,
    title: "Alan Şablonu",
    description: "Mekan yerleşim planı",
    icon: Layout,
  },
  {
    id: 3,
    title: "Ekip Ataması",
    description: "Servis ekibi organizasyonu",
    icon: Users,
  },
  {
    id: 4,
    title: "E-Davetiye",
    description: "Davetiye tasarımı",
    icon: Mail,
  },
];

interface VenueTemplate {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  capacity?: number;
  thumbnail?: string;
}

interface EventShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}

// Varsayılan vardiya renkleri
const SHIFT_COLORS = [
  "#3b82f6", // Mavi
  "#10b981", // Yeşil
  "#f59e0b", // Turuncu
  "#8b5cf6", // Mor
  "#ef4444", // Kırmızı
  "#ec4899", // Pembe
];

export default function NewEventPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [venues, setVenues] = useState<VenueTemplate[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(false);

  // Hata modal state'leri
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  // Vardiya state'leri
  const [eventShifts, setEventShifts] = useState<EventShift[]>([]);
  const [newShift, setNewShift] = useState({
    name: "",
    startTime: "",
    endTime: "",
    color: SHIFT_COLORS[0],
  });

  // Form verileri
  const [formData, setFormData] = useState({
    name: "",
    eventDate: "",
    eventTime: "",
    eventType: "",
    description: "",
    venueTemplateId: "",
  });

  // Mekan şablonlarını yükle
  useEffect(() => {
    const loadVenues = async () => {
      setLoadingVenues(true);
      try {
        const response = await venuesApi.getAll();
        setVenues(response.data || []);
      } catch (error) {
        console.error("Mekan şablonları yüklenemedi:", error);
        // Mock data
        setVenues([
          {
            id: "1",
            name: "Standart Düğün Salonu",
            description: "300 kişilik klasik düğün salonu düzeni",
            isPublic: true,
            capacity: 300,
          },
          {
            id: "2",
            name: "Konferans Salonu",
            description: "Tiyatro düzeni konferans salonu",
            isPublic: true,
            capacity: 500,
          },
          {
            id: "3",
            name: "Gala Düzeni",
            description: "Yuvarlak masalı gala düzeni",
            isPublic: true,
            capacity: 400,
          },
        ]);
      } finally {
        setLoadingVenues(false);
      }
    };

    if (currentStep === 2) {
      loadVenues();
    }
  }, [currentStep]);

  // Adım 1: Temel bilgileri kaydet
  const handleStep1Submit = async () => {
    if (!formData.name || !formData.eventDate) {
      setErrorMessages(["Lütfen etkinlik adı ve tarih giriniz"]);
      setErrorModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      // Tarih ve saati birleştir
      const dateTime = formData.eventTime
        ? `${formData.eventDate}T${formData.eventTime}`
        : `${formData.eventDate}T00:00`;

      const response = await eventsApi.create({
        name: formData.name,
        eventDate: new Date(dateTime).toISOString(),
        description: formData.description || undefined,
      });

      const eventId = response.data.id;
      setCreatedEventId(eventId);

      // Vardiyaları kaydet (varsa)
      if (eventShifts.length > 0) {
        try {
          await staffApi.createBulkShifts(
            eventId,
            eventShifts.map((s) => ({
              name: s.name,
              startTime: s.startTime,
              endTime: s.endTime,
              color: s.color,
            }))
          );
        } catch (shiftError) {
          console.error("Vardiya kaydetme hatası:", shiftError);
          // Vardiya hatası etkinlik oluşturmayı engellemez
        }
      }

      setCurrentStep(2);
    } catch (error: any) {
      console.error("Etkinlik oluşturma hatası:", error);

      // Backend'den gelen hata mesajlarını parse et
      const messages: string[] = [];

      if (error.response?.data?.message) {
        const backendMessage = error.response.data.message;

        // Array ise her birini ekle
        if (Array.isArray(backendMessage)) {
          messages.push(...backendMessage);
        } else {
          messages.push(backendMessage);
        }
      } else if (error.response?.status === 400) {
        // Genel 400 hatası için olası nedenleri göster
        messages.push("Etkinlik oluşturulamadı. Olası nedenler:");
        messages.push("• Etkinlik tarihi geçmiş bir tarih olamaz");
        messages.push("• Etkinlik adı en fazla 200 karakter olabilir");
        messages.push("• Açıklama en fazla 2000 karakter olabilir");
      } else {
        messages.push("Etkinlik oluşturulurken beklenmeyen bir hata oluştu");
      }

      setErrorMessages(messages);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Vardiya ekleme
  const addShift = () => {
    if (!newShift.name || !newShift.startTime || !newShift.endTime) {
      alert("Lütfen vardiya bilgilerini doldurun");
      return;
    }

    const shift: EventShift = {
      id: `temp-${Date.now()}`,
      name: newShift.name,
      startTime: newShift.startTime,
      endTime: newShift.endTime,
      color: newShift.color,
    };

    setEventShifts([...eventShifts, shift]);
    setNewShift({
      name: "",
      startTime: "",
      endTime: "",
      color: SHIFT_COLORS[(eventShifts.length + 1) % SHIFT_COLORS.length],
    });
  };

  // Vardiya silme
  const removeShift = (id: string) => {
    setEventShifts(eventShifts.filter((s) => s.id !== id));
  };

  // Adım 2: Şablon seç ve devam et
  const handleStep2Submit = async () => {
    if (!createdEventId) return;

    setLoading(true);
    try {
      if (formData.venueTemplateId) {
        await eventsApi.update(createdEventId, {
          venueTemplateId: formData.venueTemplateId,
        });
      }
      setCurrentStep(3);
    } catch (error) {
      console.error("Şablon kaydetme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  // Adım 3: Tamamla ve yönlendir
  const handleComplete = () => {
    if (createdEventId) {
      router.push(`/events/${createdEventId}`);
    }
  };

  // Stepper bileşeni
  const Stepper = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, index) => {
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const StepIcon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {/* Adım */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                  isCompleted
                    ? "bg-green-600 border-green-600"
                    : isActive
                    ? "bg-blue-600 border-blue-600"
                    : "bg-slate-800 border-slate-600"
                )}
              >
                {isCompleted ? (
                  <Check className="w-6 h-6 text-white" />
                ) : (
                  <StepIcon
                    className={cn(
                      "w-5 h-5",
                      isActive ? "text-white" : "text-slate-400"
                    )}
                  />
                )}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-white" : "text-slate-400"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>

            {/* Bağlantı çizgisi */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-16 sm:w-24 h-0.5 mx-2 sm:mx-4",
                  currentStep > step.id ? "bg-green-600" : "bg-slate-700"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Geri Butonu */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="border-slate-700 bg-slate-800"
          >
            <Link href="/events">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Yeni Etkinlik Oluştur
            </h1>
            <p className="text-slate-400">Adım adım etkinliğinizi planlayın</p>
          </div>
        </div>

        {/* Stepper */}
        <Stepper />

        {/* Adım İçerikleri */}
        <Card className="bg-slate-800 border-slate-700">
          {/* ADIM 1: Temel Bilgiler */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Temel Bilgiler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Etkinlik Adı */}
                <div className="space-y-2">
                  <Label>Etkinlik Adı *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Örn: Yılbaşı Galası 2025"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>

                {/* Tarih ve Saat */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Tarih *
                    </Label>
                    <Input
                      type="date"
                      value={formData.eventDate}
                      onChange={(e) =>
                        setFormData({ ...formData, eventDate: e.target.value })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Saat
                    </Label>
                    <Input
                      type="time"
                      value={formData.eventTime}
                      onChange={(e) =>
                        setFormData({ ...formData, eventTime: e.target.value })
                      }
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>

                {/* Etkinlik Türü */}
                <div className="space-y-2">
                  <Label>Etkinlik Türü</Label>
                  <Select
                    value={formData.eventType}
                    onValueChange={(v) =>
                      setFormData({ ...formData, eventType: v })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue placeholder="Tür seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Açıklama */}
                <div className="space-y-2">
                  <Label>Açıklama (Opsiyonel)</Label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Etkinlik hakkında kısa bir açıklama..."
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Vardiyalar (Shifts) */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    Vardiyalar (Opsiyonel)
                  </Label>

                  {/* Mevcut Vardiyalar */}
                  {eventShifts.length > 0 && (
                    <div className="space-y-2">
                      {eventShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 border border-slate-600"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: shift.color }}
                            />
                            <span className="font-medium text-white">
                              {shift.name}
                            </span>
                            <span className="text-sm text-slate-400">
                              {shift.startTime} - {shift.endTime}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeShift(shift.id)}
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Yeni Vardiya Ekleme Formu */}
                  <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-1">
                        <Input
                          value={newShift.name}
                          onChange={(e) =>
                            setNewShift({ ...newShift, name: e.target.value })
                          }
                          placeholder="Vardiya adı"
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div>
                        <Input
                          type="time"
                          value={newShift.startTime}
                          onChange={(e) =>
                            setNewShift({
                              ...newShift,
                              startTime: e.target.value,
                            })
                          }
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div>
                        <Input
                          type="time"
                          value={newShift.endTime}
                          onChange={(e) =>
                            setNewShift({
                              ...newShift,
                              endTime: e.target.value,
                            })
                          }
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {SHIFT_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() =>
                                setNewShift({ ...newShift, color })
                              }
                              className={cn(
                                "w-6 h-6 rounded-full transition-all",
                                newShift.color === color
                                  ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                                  : "hover:scale-110"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addShift}
                          disabled={
                            !newShift.name ||
                            !newShift.startTime ||
                            !newShift.endTime
                          }
                          className="bg-blue-600 hover:bg-blue-700 ml-auto"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Örn: Sabah Vardiyası (08:00-16:00), Akşam Vardiyası
                      (16:00-00:00)
                    </p>
                  </div>
                </div>

                {/* Bilgi Notu */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-900/20 border border-blue-700/50">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-200">
                    Etkinlik oluşturulduktan sonra yerleşim planını
                    düzenleyebilir, masa ekleyebilir ve personel
                    atayabilirsiniz.
                  </p>
                </div>

                <Separator className="bg-slate-700" />

                {/* Butonlar */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    asChild
                    className="border-slate-600"
                  >
                    <Link href="/events">İptal</Link>
                  </Button>
                  <Button
                    onClick={handleStep1Submit}
                    disabled={loading || !formData.name || !formData.eventDate}
                    className="bg-blue-600"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Kaydediliyor...
                      </>
                    ) : (
                      <>
                        İleri
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* ADIM 2: Alan Şablonu */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Layout className="w-5 h-5 text-purple-400" />
                  Alan Şablonu Seçimi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-slate-400">
                  Hazır bir şablon seçin veya boş bir plan ile başlayın.
                </p>

                {/* Şablon Seçenekleri */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Boş Plan */}
                  <div
                    onClick={() =>
                      setFormData({ ...formData, venueTemplateId: "" })
                    }
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all",
                      !formData.venueTemplateId
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-600 bg-slate-700/50"
                    )}
                  >
                    <div className="h-24 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                      <MapPin className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="font-medium text-white">Boş Plan</h3>
                    <p className="text-sm text-slate-400">
                      Sıfırdan yerleşim oluştur
                    </p>
                  </div>

                  {/* Şablonlar */}
                  {loadingVenues ? (
                    <div className="p-4 rounded-lg border border-slate-600 bg-slate-700/50">
                      <div className="h-24 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                      </div>
                      <p className="text-slate-400">Yükleniyor...</p>
                    </div>
                  ) : (
                    venues.map((venue) => (
                      <div
                        key={venue.id}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            venueTemplateId: venue.id,
                          })
                        }
                        className={cn(
                          "p-4 rounded-lg border-2 cursor-pointer transition-all",
                          formData.venueTemplateId === venue.id
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-slate-600 bg-slate-700/50"
                        )}
                      >
                        <div className="h-24 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                          <Layout className="w-8 h-8 text-slate-400" />
                        </div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-white">
                              {venue.name}
                            </h3>
                            <p className="text-sm text-slate-400">
                              {venue.description}
                            </p>
                          </div>
                          {venue.isPublic && (
                            <Badge
                              variant="outline"
                              className="bg-green-500/10 text-green-400 border-green-500/30"
                            >
                              Public
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Separator className="bg-slate-700" />

                {/* Butonlar */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="border-slate-600"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Geri
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleComplete}
                      className="border-slate-600"
                    >
                      Atla
                    </Button>
                    <Button
                      onClick={handleStep2Submit}
                      disabled={loading}
                      className="bg-blue-600"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          İleri
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* ADIM 3: Ekip Ataması */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  Ekip Organizasyonu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-slate-400">
                  Servis ekibini şimdi atayabilir veya daha sonra etkinlik
                  detaylarından düzenleyebilirsiniz.
                </p>

                {/* Bilgi Kartı */}
                <div className="p-6 rounded-lg bg-slate-700/50 border border-slate-600 text-center">
                  <Users className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Ekip Ataması
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Etkinlik oluşturulduktan sonra detay sayfasından personel
                    atayabilir ve masa bazlı görevlendirme yapabilirsiniz.
                  </p>
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 text-blue-400 border-blue-500/30"
                  >
                    Etkinlik detaylarından düzenlenebilir
                  </Badge>
                </div>

                <Separator className="bg-slate-700" />

                {/* Butonlar */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    className="border-slate-600"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Geri
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleComplete}
                      className="border-slate-600"
                    >
                      Atla
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(4)}
                      className="bg-blue-600"
                    >
                      İleri
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* ADIM 4: E-Davetiye Tasarımı */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-400" />
                  E-Davetiye Tasarımı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-slate-400">
                  Misafirlere gönderilecek elektronik davetiyeyi tasarlayın.
                  Varsayılan şablonu kullanabilir veya özelleştirebilirsiniz.
                </p>

                {/* Seçenekler */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Varsayılan Şablon */}
                  <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-500/10 cursor-pointer">
                    <div className="h-32 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                      <Mail className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="font-medium text-white">
                      Varsayılan Şablon
                    </h3>
                    <p className="text-sm text-slate-400">
                      Profesyonel A5 davetiye şablonu
                    </p>
                  </div>

                  {/* Özelleştir */}
                  <div
                    onClick={() => {
                      if (createdEventId) {
                        router.push(`/events/${createdEventId}/invitation`);
                      }
                    }}
                    className="p-4 rounded-lg border-2 border-slate-600 bg-slate-700/50 cursor-pointer"
                  >
                    <div className="h-32 bg-slate-600 rounded-lg flex items-center justify-center mb-3">
                      <Layout className="w-10 h-10 text-purple-400" />
                    </div>
                    <h3 className="font-medium text-white">Özelleştir</h3>
                    <p className="text-sm text-slate-400">
                      Sürükle-bırak editörü ile tasarla
                    </p>
                  </div>
                </div>

                {/* Bilgi */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-900/20 border border-purple-700/50">
                  <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-purple-200">
                    Davetiye tasarımını daha sonra etkinlik detaylarından da
                    düzenleyebilirsiniz. Rezervasyon yapıldığında misafirlere
                    otomatik olarak e-posta ile gönderilecektir.
                  </p>
                </div>

                <Separator className="bg-slate-700" />

                {/* Butonlar */}
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(3)}
                    className="border-slate-600"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Geri
                  </Button>
                  <Button onClick={handleComplete} className="bg-green-600">
                    <Check className="w-4 h-4 mr-2" />
                    Tamamla ve Planlamaya Git
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Hata Modal */}
      <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Etkinlik Oluşturulamadı
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-slate-400">
                  Etkinlik oluşturulurken aşağıdaki hatalar tespit edildi:
                </p>
                <div className="p-4 rounded-lg bg-red-900/20 border border-red-700/50">
                  <ul className="space-y-2">
                    {errorMessages.map((msg, idx) => (
                      <li
                        key={idx}
                        className="text-red-300 text-sm flex items-start gap-2"
                      >
                        {msg.startsWith("•") ? (
                          <span>{msg}</span>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{msg}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-slate-500 text-sm">
                  Lütfen bilgileri kontrol edip tekrar deneyin.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setErrorModalOpen(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Anladım
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
