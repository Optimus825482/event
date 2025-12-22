"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Search, User, Phone, Users, QrCode, Loader2 } from "lucide-react";
import { TableInstance, Customer, Reservation } from "@/types";
import { formatPhone, generateId } from "@/lib/utils";
import { customersApi } from "@/lib/api";

interface ReservationPanelProps {
  table: TableInstance | null;
  onClose: () => void;
  onReservationCreate?: (reservation: Reservation) => void;
}

// Debounce hook - gereksiz API çağrılarını önler
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function ReservationPanel({
  table,
  onClose,
  onReservationCreate,
}: ReservationPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [guestCount, setGuestCount] = useState(2);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounced search query - 300ms bekle
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Abort controller ref - önceki istekleri iptal etmek için
  const abortControllerRef = useRef<AbortController | null>(null);

  if (!table) return null;

  // API ile misafir arama
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setSearchLoading(true);
    setSearchError(null);

    try {
      const response = await customersApi.searchAutocomplete(query, 10);

      // İstek iptal edilmediyse sonuçları güncelle
      if (response.data) {
        setSearchResults(response.data);
      }
    } catch (error: any) {
      // İptal edilen istekleri yoksay
      if (error?.name === "CanceledError" || error?.code === "ERR_CANCELED") {
        return;
      }

      console.error("Misafir arama hatası:", error);
      setSearchError("Arama yapılırken bir hata oluştu");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced query değiştiğinde arama yap
  useEffect(() => {
    searchCustomers(debouncedSearchQuery);

    // Cleanup: component unmount olduğunda isteği iptal et
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearchQuery, searchCustomers]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Debounce ile otomatik arama yapılacak
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleCreateReservation = async () => {
    if (!selectedCustomer) {
      alert("Lütfen misafir seçin");
      return;
    }

    if (guestCount > table.capacity) {
      alert(`Bu masa maksimum ${table.capacity} kişiliktir`);
      return;
    }

    setLoading(true);

    try {
      const reservation: Reservation = {
        id: generateId(),
        eventId: "", // Parent'tan gelecek
        tableId: table.id,
        customerId: selectedCustomer.id,
        customer: selectedCustomer,
        guestCount,
        qrCodeHash: generateId(), // Gerçekte backend üretecek
        status: "pending",
        specialRequests: notes,
        totalAmount: 0,
        isPaid: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onReservationCreate?.(reservation);
      onClose();
    } catch (error) {
      console.error("Rezervasyon hatası:", error);
      alert("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold">Rezervasyon Oluştur</h2>
            <p className="text-sm text-slate-400">
              {table.label} - {table.typeName} ({table.capacity} kişilik)
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Misafir Arama */}
          {!selectedCustomer ? (
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Misafir Ara
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="İsim veya telefon..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Arama Sonuçları */}
              {searchLoading && (
                <div className="mt-2 bg-slate-700 rounded-lg p-4 flex items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aranıyor...</span>
                </div>
              )}

              {searchError && (
                <div className="mt-2 bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-2 rounded text-sm">
                  {searchError}
                </div>
              )}

              {!searchLoading && !searchError && searchResults.length > 0 && (
                <div className="mt-2 bg-slate-700 rounded-lg overflow-hidden">
                  {searchResults.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full flex items-center gap-3 p-3 text-left border-b border-slate-600 last:border-0"
                    >
                      <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium">{customer.fullName}</p>
                        <p className="text-sm text-slate-400">
                          {formatPhone(customer.phone)}
                        </p>
                      </div>
                      {customer.vipScore >= 70 && (
                        <span className="ml-auto text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                          VIP
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!searchLoading &&
                !searchError &&
                searchQuery.length >= 2 &&
                searchResults.length === 0 && (
                  <div className="mt-2 bg-slate-700 rounded-lg p-4 text-center text-slate-400 text-sm">
                    Sonuç bulunamadı
                  </div>
                )}

              {/* Yeni Misafir */}
              <button className="w-full mt-3 p-3 border border-dashed border-slate-600 rounded-lg text-slate-400 text-sm">
                + Yeni Misafir Ekle
              </button>
            </div>
          ) : (
            /* Seçili Misafir */
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedCustomer.fullName}</p>
                    <p className="text-sm text-slate-400">
                      <Phone className="w-3 h-3 inline mr-1" />
                      {formatPhone(selectedCustomer.phone)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-sm text-blue-400"
                >
                  Değiştir
                </button>
              </div>

              {selectedCustomer.isBlacklisted && (
                <div className="mt-3 bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-2 rounded text-sm">
                  ⚠️ Bu misafir kara listede!
                </div>
              )}
            </div>
          )}

          {/* Kişi Sayısı */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Kişi Sayısı
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={table.capacity}
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-12 text-center font-medium bg-slate-700 px-3 py-2 rounded">
                {guestCount}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Maksimum: {table.capacity} kişi
            </p>
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Notlar (Opsiyonel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Özel istekler, alerjiler vb."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 rounded-lg"
          >
            İptal
          </button>
          <button
            onClick={handleCreateReservation}
            disabled={!selectedCustomer || loading}
            className="flex-1 py-3 bg-blue-600 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              "Kaydediliyor..."
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                Rezervasyon Oluştur
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
