"use client";

/**
 * Walk-in Registration Panel - Kapıda misafir kaydı
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { useState, useEffect } from "react";
import {
  UserPlus,
  Users,
  Phone,
  MapPin,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCheckInStore } from "@/store/check-in-store";
import { checkInApi } from "@/lib/api";
import { playSound } from "@/lib/sound-feedback";
import type {
  CheckInResult,
  CheckInError,
  WalkInData,
} from "@/store/check-in-store";

interface AvailableTable {
  id: string;
  label: string;
  capacity: number;
}

interface WalkInRegistrationPanelProps {
  eventId: string;
  onSuccess?: (result: CheckInResult) => void;
  onError?: (error: CheckInError) => void;
}

export function WalkInRegistrationPanel({
  eventId,
  onSuccess,
  onError,
}: WalkInRegistrationPanelProps) {
  const [guestName, setGuestName] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [phone, setPhone] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<CheckInResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const { registerWalkIn, soundEnabled } = useCheckInStore();

  // Load available tables
  useEffect(() => {
    loadAvailableTables();
  }, [eventId]);

  const loadAvailableTables = async () => {
    setIsLoadingTables(true);
    try {
      const response = await checkInApi.getAvailableTables(eventId);
      setAvailableTables(response.data || []);
    } catch (err) {
      console.error("[WalkIn] Load tables error:", err);
      setAvailableTables([]);
    } finally {
      setIsLoadingTables(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!guestName.trim()) {
      setError("Misafir adı zorunludur");
      return;
    }
    if (guestCount < 1) {
      setError("Kişi sayısı en az 1 olmalıdır");
      return;
    }
    if (!selectedTableId) {
      setError("Lütfen bir masa seçin");
      return;
    }

    setIsSubmitting(true);

    try {
      const data: WalkInData = {
        guestName: guestName.trim(),
        guestCount,
        tableId: selectedTableId,
        phone: phone.trim() || undefined,
      };

      const result = await registerWalkIn(data);

      if ("code" in result) {
        const errorResult = result as CheckInError;
        setError(errorResult.message);
        if (soundEnabled) playSound("error");
        onError?.(errorResult);
        return;
      }

      const successRes = result as CheckInResult;
      setSuccessResult(successRes);
      if (soundEnabled) playSound("success");
      onSuccess?.(successRes);

      // Reset form after 3 seconds
      setTimeout(() => {
        resetForm();
      }, 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Kayıt başarısız";
      setError(errorMsg);
      if (soundEnabled) playSound("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setGuestName("");
    setGuestCount(1);
    setPhone("");
    setSelectedTableId("");
    setSuccessResult(null);
    setError(null);
    loadAvailableTables();
  };

  // Success state
  if (successResult) {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Kayıt Başarılı!
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          {successResult.reservation.guestName || guestName} kaydedildi
        </p>
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 text-center">
          <div className="text-2xl font-bold text-white mb-1">
            Masa {successResult.tableLocation?.label}
          </div>
          {successResult.tableLocation?.directionText && (
            <div className="text-sm text-slate-400">
              {successResult.tableLocation.directionText}
            </div>
          )}
        </div>
        <Button
          onClick={resetForm}
          variant="outline"
          className="mt-4 border-slate-600"
        >
          Yeni Kayıt
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <UserPlus className="w-5 h-5" />
        <span className="text-sm">Kapıda Misafir Kaydı</span>
      </div>

      {/* Guest Name */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">
          Misafir Adı <span className="text-red-400">*</span>
        </label>
        <Input
          type="text"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Ad Soyad"
          className="bg-slate-800 border-slate-700 text-white"
          required
        />
      </div>

      {/* Guest Count */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">
          Kişi Sayısı <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-400" />
          <Input
            type="number"
            min={1}
            max={20}
            value={guestCount}
            onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
            className="bg-slate-800 border-slate-700 text-white w-24"
            required
          />
          <span className="text-slate-400 text-sm">kişi</span>
        </div>
      </div>

      {/* Phone (Optional) */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">
          Telefon <span className="text-slate-500">(Opsiyonel)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05XX XXX XX XX"
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
      </div>

      {/* Table Selection */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">
          Masa Seçimi <span className="text-red-400">*</span>
        </label>
        {isLoadingTables ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="ml-2 text-slate-400 text-sm">
              Masalar yükleniyor...
            </span>
          </div>
        ) : availableTables.length === 0 ? (
          <div className="p-4 bg-slate-900 rounded-lg text-center">
            <MapPin className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Müsait masa bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
            {availableTables.map((table) => {
              const isSelected = table.id === selectedTableId;
              const hasCapacity = table.capacity >= guestCount;

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTableId(table.id)}
                  disabled={!hasCapacity}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    isSelected
                      ? "bg-blue-600/20 border-blue-500 text-white"
                      : hasCapacity
                      ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                      : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                  }`}
                >
                  <div className="font-medium">{table.label}</div>
                  <div className="text-xs text-slate-400">
                    {table.capacity} kişilik
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting || !guestName.trim() || !selectedTableId}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Kaydediliyor...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Kaydet ve Giriş Yap
          </span>
        )}
      </Button>
    </form>
  );
}
