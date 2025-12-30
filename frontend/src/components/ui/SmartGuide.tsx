"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Lightbulb,
  X,
  ChevronRight,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Circle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sayfa bazlı yönergeler ve sonraki adım önerileri
interface GuideStep {
  id: string;
  title: string;
  description: string;
  nextAction?: {
    label: string;
    href: string;
  };
  tips?: string[];
  isCompleted?: boolean;
}

interface PageGuide {
  path: string | RegExp;
  title: string;
  steps: GuideStep[];
  contextualTips?: (context: GuideContext) => string[];
  // Tab bazlı eşleşme için
  tab?: string;
}

interface GuideContext {
  previousPath: string | null;
  currentPath: string;
  currentTab?: string | null;
  hasVenueLayout?: boolean;
  hasTeamAssignment?: boolean;
  eventId?: string;
}

// Sistem iş akışı tanımları
const PAGE_GUIDES: PageGuide[] = [
  // ============ ETKİNLİK PLANLAMA MODÜLÜ ============
  {
    path: "/events",
    title: "Etkinlik Listesi",
    steps: [
      {
        id: "create-event",
        title: "Yeni Etkinlik Oluştur",
        description: "Yeni bir etkinlik oluşturarak başlayın",
        nextAction: { label: "Yeni Etkinlik", href: "/events/new" },
      },
      {
        id: "manage-events",
        title: "Etkinlikleri Yönet",
        description: "Mevcut etkinliklerinizi görüntüleyin ve düzenleyin",
      },
    ],
    contextualTips: (ctx) => {
      if (ctx.previousPath?.includes("/events/new")) {
        return [
          "Etkinlik oluşturuldu! Şimdi yerleşim planı oluşturabilirsiniz.",
        ];
      }
      return ["Etkinlik kartına tıklayarak detaylarını görüntüleyebilirsiniz."];
    },
  },
  {
    path: "/events/new",
    title: "Yeni Etkinlik Oluşturma",
    steps: [
      {
        id: "basic-info",
        title: "Temel Bilgiler",
        description: "Etkinlik adı, tarihi ve türünü girin",
      },
      {
        id: "save-event",
        title: "Etkinliği Kaydet",
        description: "Bilgileri tamamlayıp kaydedin",
      },
    ],
    contextualTips: () => [
      "Etkinlik türü seçimi, sonraki adımlarda size özel öneriler sunmamızı sağlar.",
      "Tarih ve saat Kıbrıs saat dilimine (UTC+2) göre kaydedilir.",
    ],
  },
  {
    path: /^\/events\/[^/]+$/,
    title: "Etkinlik Detayı",
    steps: [
      {
        id: "venue-layout",
        title: "Yerleşim Planı",
        description: "Masaları ve alanları yerleştirin",
        nextAction: { label: "Yerleşim Planı", href: "venue" },
      },
      {
        id: "team-org",
        title: "Ekip Organizasyonu",
        description: "Ekipleri oluşturun ve masalara atayın",
        nextAction: { label: "Ekip Organizasyonu", href: "team-organization" },
      },
      {
        id: "invitation",
        title: "E-Davetiye",
        description: "Davetiye tasarlayın ve gönderin",
        nextAction: { label: "E-Davetiye", href: "invitation" },
      },
    ],
    contextualTips: (ctx) => {
      const tips: string[] = [];
      if (!ctx.hasVenueLayout) {
        tips.push("⚠️ Önce yerleşim planı oluşturmalısınız.");
      } else if (!ctx.hasTeamAssignment) {
        tips.push(
          "✅ Yerleşim planı hazır! Şimdi ekip organizasyonu yapabilirsiniz."
        );
      } else {
        tips.push("🎉 Etkinlik hazır! Rezervasyon almaya başlayabilirsiniz.");
      }
      return tips;
    },
  },
  {
    path: /^\/events\/[^/]+\/venue$/,
    title: "Etkinlik Yerleşim Planı",
    steps: [
      {
        id: "table-plan",
        title: "1. Masa Planı",
        description: "Masa tiplerini, kapasitelerini ve adetlerini belirleyin",
      },
      {
        id: "stage-selection",
        title: "2. Sahne Seçimi",
        description: "Sahne konfigürasyonunu seçin",
      },
      {
        id: "layout-design",
        title: "3. Alan Düzenleme",
        description: "Masaları canvas üzerinde konumlandırın",
      },
    ],
    contextualTips: () => [
      "💡 Masa Planı: Hangi tipten kaç masa olacağını belirleyin.",
      "💡 Sahne Seçimi: Etkinlik alanının sahne düzenini seçin.",
      "💡 Alan Düzenleme: Masaları sürükleyip yerleştirin.",
      "📌 Her adımı sırayla tamamlayın, sonra kaydedin.",
    ],
  },
  {
    path: /^\/events\/[^/]+\/team-organization$/,
    title: "Ekip Organizasyonu",
    steps: [
      {
        id: "create-teams",
        title: "Ekip Oluştur",
        description: "Personel modülünden ekipler oluşturun",
      },
      {
        id: "assign-tables",
        title: "Masa Ata",
        description: "Masa gruplarını ekiplere atayın",
      },
      {
        id: "assign-staff",
        title: "Personel Ata",
        description: "Personelleri masalara atayın",
      },
    ],
    contextualTips: (ctx) => {
      if (!ctx.hasVenueLayout) {
        return ["⚠️ Önce yerleşim planı oluşturmalısınız!"];
      }
      return [
        "Masa grupları oluşturarak toplu atama yapabilirsiniz.",
        "Her ekibe farklı renk atayarak görsel ayrım sağlayın.",
      ];
    },
  },

  // ============ REZERVASYON MODÜLÜ ============
  {
    path: "/reservations",
    title: "Rezervasyon Yönetimi",
    steps: [
      {
        id: "select-event",
        title: "Etkinlik Seç",
        description: "Rezervasyon yapılacak etkinliği seçin",
      },
      {
        id: "manage-reservations",
        title: "Rezervasyonları Yönet",
        description: "Mevcut rezervasyonları görüntüleyin",
      },
    ],
    contextualTips: () => [
      "Sadece yerleşim planı tamamlanmış etkinliklere rezervasyon yapılabilir.",
      "Müşteri kartına tıklayarak geçmiş rezervasyonları görebilirsiniz.",
    ],
  },
  {
    path: /^\/reservations\/[^/]+$/,
    title: "Etkinlik Rezervasyonları",
    steps: [
      {
        id: "new-reservation",
        title: "Yeni Rezervasyon",
        description: "Yeni rezervasyon oluşturun",
        nextAction: { label: "Yeni Rezervasyon", href: "new" },
      },
      {
        id: "check-in",
        title: "Check-in",
        description: "Misafirlerin girişini yapın",
      },
    ],
    contextualTips: () => [
      "Masa üzerine tıklayarak hızlı rezervasyon yapabilirsiniz.",
      "QR kod ile hızlı check-in yapılabilir.",
    ],
  },

  // ============ PERSONEL MODÜLÜ ============
  {
    path: "/staff",
    title: "Personel Yönetimi",
    steps: [
      {
        id: "add-staff",
        title: "Personel Ekle",
        description: "Yeni personel kaydı oluşturun",
      },
      {
        id: "create-teams",
        title: "Ekip Oluştur",
        description: "Personelleri ekiplere ayırın",
      },
      {
        id: "event-assignment",
        title: "Etkinlik Ataması",
        description: "Personelleri etkinliklere atayın",
      },
    ],
    contextualTips: () => [
      "Personel renkleri, yerleşim planında görsel ayrım sağlar.",
      "Ekip lideri atayarak hiyerarşi oluşturabilirsiniz.",
    ],
  },

  // ============ ADMIN MODÜLÜ ============
  {
    path: "/admin",
    title: "Sistem Yönetimi",
    steps: [
      {
        id: "overview",
        title: "Genel Bakış",
        description: "Sistem istatistiklerini görüntüleyin",
      },
      {
        id: "users",
        title: "Kullanıcı Yönetimi",
        description: "Kullanıcıları yönetin",
        nextAction: { label: "Kullanıcılar", href: "/admin/users" },
      },
      {
        id: "settings",
        title: "Sistem Ayarları",
        description: "Genel ayarları yapılandırın",
        nextAction: { label: "Ayarlar", href: "/admin/settings" },
      },
    ],
  },

  // ============ EKİP LİDERİ MODÜLÜ ============
  {
    path: "/leader",
    title: "Ekip Lideri Paneli",
    steps: [
      {
        id: "overview",
        title: "Genel Bakış",
        description: "Ekibinizin durumunu görüntüleyin",
      },
      {
        id: "events",
        title: "Etkinlikler",
        description: "Atandığınız etkinlikleri görün",
        nextAction: { label: "Etkinlikler", href: "/leader/events" },
      },
      {
        id: "team",
        title: "Ekibim",
        description: "Ekip üyelerinizi yönetin",
        nextAction: { label: "Ekibim", href: "/leader/team" },
      },
    ],
  },
];

// Rehber durumunu localStorage'da sakla
const GUIDE_STORAGE_KEY = "eventflow_smart_guide";

interface GuideState {
  isEnabled: boolean;
  isMinimized: boolean;
  completedSteps: string[];
}

const getStoredState = (): GuideState => {
  if (typeof window === "undefined") {
    return { isEnabled: true, isMinimized: false, completedSteps: [] };
  }
  try {
    const stored = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { isEnabled: true, isMinimized: false, completedSteps: [] };
};

const saveState = (state: GuideState) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(state));
  }
};

export function SmartGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<GuideState>({
    isEnabled: true,
    isMinimized: false,
    completedSteps: [],
  });
  const [previousPath, setPreviousPath] = useState<string | null>(null);
  const [currentGuide, setCurrentGuide] = useState<PageGuide | null>(null);
  const [contextualTips, setContextualTips] = useState<string[]>([]);

  // Client-side mount - localStorage'dan state'i yükle
  useEffect(() => {
    setMounted(true);
    const stored = getStoredState();
    setState(stored);
  }, []);

  // Sayfa değişikliğini takip et
  useEffect(() => {
    setPreviousPath((prev) => {
      if (prev !== pathname) return prev;
      return null;
    });
  }, [pathname]);

  // Mevcut sayfa için rehberi bul
  useEffect(() => {
    const guide = PAGE_GUIDES.find((g) => {
      if (typeof g.path === "string") {
        return g.path === pathname;
      }
      return g.path.test(pathname);
    });

    setCurrentGuide(guide || null);

    if (guide?.contextualTips) {
      const context: GuideContext = {
        previousPath,
        currentPath: pathname,
        eventId: pathname.match(/\/events\/([^/]+)/)?.[1],
      };
      setContextualTips(guide.contextualTips(context));
    } else {
      setContextualTips([]);
    }
  }, [pathname, previousPath]);

  // State değişikliklerini kaydet
  useEffect(() => {
    saveState(state);
  }, [state]);

  const toggleEnabled = useCallback(() => {
    setState((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
  }, []);

  const toggleMinimized = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  const markStepCompleted = useCallback((stepId: string) => {
    setState((prev) => ({
      ...prev,
      completedSteps: [...new Set([...prev.completedSteps, stepId])],
    }));
  }, []);

  const handleNextAction = useCallback(
    (href: string) => {
      // Relative path ise current path'e ekle
      if (!href.startsWith("/")) {
        const basePath = pathname.replace(/\/$/, "");
        router.push(`${basePath}/${href}`);
      } else {
        router.push(href);
      }
    },
    [pathname, router]
  );

  // Hydration uyumu için mount olana kadar render etme
  if (!mounted) {
    return null;
  }

  // Rehber kapalıysa veya guide yoksa gösterme
  if (!state.isEnabled || !currentGuide) {
    // Sadece açma butonu göster
    if (!state.isEnabled) {
      return (
        <Button
          onClick={toggleEnabled}
          size="sm"
          variant="ghost"
          className="fixed bottom-4 right-4 z-50 bg-amber-600/90 hover:bg-amber-600 text-white rounded-full p-3 shadow-lg"
          title="Akıllı Rehberi Aç"
        >
          <Lightbulb className="w-5 h-5" />
        </Button>
      );
    }
    return null;
  }

  // Minimize edilmişse sadece küçük buton göster
  if (state.isMinimized) {
    return (
      <Button
        onClick={toggleMinimized}
        size="sm"
        className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">Rehber</span>
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-[70vh] overflow-hidden">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-slate-700 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 rounded-lg">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {currentGuide.title}
                </h3>
                <p className="text-xs text-slate-400">Akıllı Rehber</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={toggleMinimized}
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-400 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={toggleEnabled}
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"
                title="Rehberi Kapat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3 max-h-[50vh] overflow-y-auto">
          {/* Contextual Tips */}
          {contextualTips.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              {contextualTips.map((tip, i) => (
                <p
                  key={i}
                  className="text-xs text-amber-200 flex items-start gap-2"
                >
                  <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {tip}
                </p>
              ))}
            </div>
          )}

          {/* Steps */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Adımlar
            </p>
            {currentGuide.steps.map((step, index) => {
              const isCompleted = state.completedSteps.includes(step.id);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "p-2.5 rounded-lg border transition-all",
                    isCompleted
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        {index + 1}. {step.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {step.description}
                      </p>
                      {step.nextAction && !isCompleted && (
                        <Button
                          onClick={() =>
                            handleNextAction(step.nextAction!.href)
                          }
                          size="sm"
                          className="mt-2 h-7 text-xs bg-amber-600 hover:bg-amber-700"
                        >
                          {step.nextAction.label}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips */}
          {currentGuide.steps.some((s) => s.tips) && (
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                İpuçları
              </p>
              <div className="space-y-1.5">
                {currentGuide.steps
                  .flatMap((s) => s.tips || [])
                  .map((tip, i) => (
                    <p
                      key={i}
                      className="text-xs text-slate-300 flex items-start gap-2"
                    >
                      <HelpCircle className="w-3 h-3 mt-0.5 text-slate-500 flex-shrink-0" />
                      {tip}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-2 bg-slate-800/50">
          <p className="text-[10px] text-slate-500 text-center">
            Rehberi kapatmak için X butonuna tıklayın
          </p>
        </div>
      </div>
    </div>
  );
}
