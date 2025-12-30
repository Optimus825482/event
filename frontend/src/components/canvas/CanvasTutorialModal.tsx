"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MousePointer2,
  Hand,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Save,
  Trash2,
  Copy,
  Keyboard,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  CheckCircle2,
  Box,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TUTORIAL_STORAGE_KEY = "eventflow_canvas_tutorial_shown";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
  highlight?: boolean;
  showToolbarHint?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "🎉 Hoş Geldiniz!",
    description: "EventFlow Canvas ile yerleşim planınızı kolayca oluşturun",
    icon: <Sparkles className="w-8 h-8 text-amber-400" />,
    tips: [
      "2D Canvas ile masaları yerleştirin ve düzenleyin",
      "🆕 3D Önizleme ile mekanınızı gerçekçi görün!",
    ],
    highlight: true,
    showToolbarHint: true,
  },
  {
    id: "basics",
    title: "Temel Kullanım",
    description: "Canvas üzerinde masaları yerleştirme ve düzenleme",
    icon: <MousePointer2 className="w-8 h-8 text-blue-400" />,
    tips: [
      "Sol panelden masa tipine tıklayarak seçin",
      "Canvas üzerine tıklayarak masa yerleştirin",
      "Masaya tek tıklayarak seçin",
      "Seçili masayı sürükleyerek taşıyın",
    ],
  },
  {
    id: "selection",
    title: "Çoklu Seçim",
    description: "Birden fazla masa seçme yöntemleri",
    icon: <Copy className="w-8 h-8 text-purple-400" />,
    tips: [
      "Ctrl + Tıklama: Seçime masa ekle/çıkar",
      "Shift + Tıklama: Mevcut seçime ekle",
      "Lasso (Kement): Boş alana tıklayıp sürükleyerek alan seçimi",
      "Ctrl + A: Tüm masaları seç",
    ],
  },
  {
    id: "navigation",
    title: "Gezinme ve Yakınlaştırma",
    description: "Canvas üzerinde hareket etme",
    icon: <Hand className="w-8 h-8 text-green-400" />,
    tips: [
      "Mouse tekerleği: Yakınlaştır/Uzaklaştır",
      "Space basılı tutup sürükle: Canvas'ı kaydır",
      "H tuşu: El aracına geç (pan modu)",
      "Sağ üstteki + / - butonları: Zoom kontrolü",
    ],
  },
  {
    id: "editing",
    title: "Düzenleme İşlemleri",
    description: "Masa düzenleme ve silme",
    icon: <RotateCcw className="w-8 h-8 text-amber-400" />,
    tips: [
      "Sağ tıklama: Bağlam menüsü (düzenle, sil, kopyala)",
      "Delete tuşu: Seçili masaları sil",
      "Çift tıklama: Masa özelliklerini düzenle",
      "Ctrl + Z: Geri al, Ctrl + Y: Yinele",
    ],
  },
  {
    id: "tools",
    title: "Araç Çubuğu",
    description: "Toolbar butonlarının işlevleri",
    icon: <Grid3X3 className="w-8 h-8 text-cyan-400" />,
    tips: [
      "Seçim Aracı (V): Masaları seç ve taşı",
      "El Aracı (H): Canvas'ı kaydır",
      "Grid Snap: Masaları ızgaraya hizala",
      "Çöp Kutusu: Seçili masaları sil",
    ],
  },
  {
    id: "shortcuts",
    title: "Klavye Kısayolları",
    description: "Hızlı işlemler için kısayollar",
    icon: <Keyboard className="w-8 h-8 text-pink-400" />,
    tips: [
      "V: Seçim aracı",
      "H: El aracı (pan)",
      "Space (basılı tut): Geçici pan modu",
      "Ctrl + A: Tüm masaları seç",
      "Delete: Seçili masaları sil",
      "Ctrl + Z / Y: Geri al / Yinele",
      "Escape: Seçimi temizle",
      "1/2/3/4: Hızlı tip seçimi (VIP/Premium/Standart/Loca)",
    ],
  },
  {
    id: "3d-preview",
    title: "3D Önizleme",
    description: "Mekanınızı 3 boyutlu olarak görüntüleyin",
    icon: <Box className="w-8 h-8 text-cyan-400" />,
    tips: [
      "Toolbar'daki 3D butonuna tıklayarak 3D görünüme geçin",
      "Sol tık + sürükle: Kamerayı döndür",
      "Mouse tekerleği: Yakınlaştır/Uzaklaştır",
      "Masaya tıkla: Masa bilgisini görüntüle",
      "3D modda sadece görüntüleme yapılabilir",
      "Düzenleme için 2D moduna geri dönün",
    ],
    highlight: true,
  },
];

interface CanvasTutorialModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function CanvasTutorialModal({
  forceOpen,
  onClose,
}: CanvasTutorialModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // İlk açılışta kontrol et
  useEffect(() => {
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
      return;
    }

    // localStorage'dan kontrol et
    const hasShown = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!hasShown) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    setIsOpen(false);
    // İlk kez gösterildiğini kaydet
    if (forceOpen === undefined) {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    }
    onClose?.();
  };

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentTutorial = TUTORIAL_STEPS[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            Canvas Kullanım Rehberi
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Yerleşim planı düzenleme aracını nasıl kullanacağınızı öğrenin
          </DialogDescription>
        </DialogHeader>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 py-2">
          {TUTORIAL_STEPS.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all",
                index === currentStep
                  ? "bg-amber-500 w-6"
                  : index < currentStep
                  ? "bg-green-500"
                  : "bg-slate-600 hover:bg-slate-500"
              )}
            />
          ))}
        </div>

        {/* Current Step Content */}
        <div className="py-4">
          <div
            className={cn(
              "flex items-center gap-4 mb-4 p-3 rounded-xl",
              currentTutorial.highlight
                ? "bg-gradient-to-r from-amber-500/20 to-cyan-500/20 border border-amber-500/30"
                : ""
            )}
          >
            <div
              className={cn(
                "p-3 rounded-xl",
                currentTutorial.highlight
                  ? "bg-gradient-to-br from-amber-500/30 to-cyan-500/30"
                  : "bg-slate-700/50"
              )}
            >
              {currentTutorial.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {currentTutorial.title}
                {currentTutorial.highlight && (
                  <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">
                    YENİ
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-400">
                {currentTutorial.description}
              </p>
            </div>
          </div>

          <div className="space-y-2 bg-slate-700/30 rounded-lg p-4">
            {currentTutorial.tips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">{tip}</span>
              </div>
            ))}
          </div>

          {/* Toolbar 3D Button Hint */}
          {currentTutorial.showToolbarHint && (
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">
                3D butonu toolbar'da şurada:
              </p>
              <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-2 border border-slate-600">
                <div className="flex items-center gap-1 text-slate-500 text-xs">
                  <span>🔍</span>
                  <span>100%</span>
                  <span className="mx-1">|</span>
                  <span>🔄</span>
                  <span className="mx-1">|</span>
                  <span>↔️</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-cyan-600 rounded text-white text-xs font-medium animate-pulse">
                  <Box className="w-3 h-3" />
                  <span>3D</span>
                </div>
                <span className="text-cyan-400 text-xs">← Buraya tıkla!</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Önceki
          </Button>

          <span className="text-sm text-slate-500">
            {currentStep + 1} / {TUTORIAL_STEPS.length}
          </span>

          <Button
            onClick={handleNext}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? (
              "Başla"
            ) : (
              <>
                Sonraki
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>

        {/* Skip Button */}
        {currentStep < TUTORIAL_STEPS.length - 1 && (
          <div className="text-center">
            <button
              onClick={handleClose}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              Rehberi atla, bir daha gösterme
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Yardım butonu komponenti - toolbar'a eklenecek
export function CanvasHelpButton() {
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowTutorial(true)}
        className="h-8 w-8 p-0 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
        title="Kullanım Rehberi"
      >
        <Lightbulb className="w-4 h-4" />
      </Button>

      <CanvasTutorialModal
        forceOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </>
  );
}
