"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Star,
  AlertTriangle,
  MoreVertical,
  Edit,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { customersApi } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-notification";

interface Customer {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  vipScore?: number;
  tags?: string[];
  isBlacklisted?: boolean;
  totalEvents?: number;
  notes?: string;
  reservationCount?: number;
  totalSpent?: number;
}

interface CustomerFormData {
  fullName: string;
  phone: string;
  email: string;
  tags: string[];
  notes: string;
}

const tagLabels: Record<string, { label: string; color: string }> = {
  vip: { label: "VIP", color: "bg-yellow-600" },
  vegan: { label: "Vegan", color: "bg-green-600" },
  sahne_onu_sever: { label: "Sahne Önü", color: "bg-purple-600" },
  bahsis_birakir: { label: "Bahşiş", color: "bg-blue-600" },
  sorunlu: { label: "Dikkat", color: "bg-red-600" },
};

const availableTags = Object.keys(tagLabels);

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState<CustomerFormData>({
    fullName: "",
    phone: "",
    email: "",
    tags: [],
    notes: "",
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await customersApi.getAllWithStats(
        searchQuery || undefined
      );
      setCustomers(response.data || []);
    } catch (error) {
      console.error("Müşteriler yüklenemedi:", error);
      toast.error("Müşteriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetForm = () => {
    setFormData({ fullName: "", phone: "", email: "", tags: [], notes: "" });
    setEditingCustomer(null);
  };

  const handleCreate = async () => {
    if (!formData.fullName.trim()) {
      toast.error("İsim zorunludur");
      return;
    }
    setSaving(true);
    try {
      await customersApi.create({
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        tags: formData.tags,
        notes: formData.notes || undefined,
      });
      toast.success("Müşteri başarıyla oluşturuldu");
      setShowAddModal(false);
      resetForm();
      loadCustomers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Müşteri oluşturulamadı");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingCustomer || !formData.fullName.trim()) return;
    setSaving(true);
    try {
      await customersApi.update(editingCustomer.id, {
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        tags: formData.tags,
        notes: formData.notes || undefined,
      });
      toast.success("Müşteri başarıyla güncellendi");
      setShowAddModal(false);
      resetForm();
      loadCustomers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Müşteri güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      fullName: customer.fullName,
      phone: customer.phone || "",
      email: customer.email || "",
      tags: customer.tags || [],
      notes: customer.notes || "",
    });
    setShowAddModal(true);
  };

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Misafirler</h1>
            <p className="text-slate-400">CRM ve VIP analizi</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={loadCustomers}
              disabled={loading}
              className="border-slate-700"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg"
            >
              <Plus className="w-5 h-5" />
              Yeni Misafir
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İsim veya telefon ile ara..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        {loading && customers.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        <div className="space-y-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className={`bg-slate-800 rounded-xl p-6 border ${
                customer.isBlacklisted
                  ? "border-red-500/50"
                  : "border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      customer.isBlacklisted
                        ? "bg-red-600/20 text-red-400"
                        : "bg-blue-600/20 text-blue-400"
                    }`}
                  >
                    {customer.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">
                        {customer.fullName}
                      </h3>
                      {customer.isBlacklisted && (
                        <span className="flex items-center gap-1 text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Kara Liste
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {formatPhone(customer.phone)}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {customer.email}
                        </span>
                      )}
                    </div>
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        {customer.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-xs px-2 py-1 rounded ${
                              tagLabels[tag]?.color || "bg-slate-600"
                            }`}
                          >
                            {tagLabels[tag]?.label || tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {customer.notes && (
                      <p className="mt-2 text-sm text-slate-400 italic">
                        "{customer.notes}"
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {customer.vipScore !== undefined && (
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-medium">{customer.vipScore}</span>
                    </div>
                  )}
                  <p className="text-sm text-slate-400 mt-1">
                    {customer.reservationCount || customer.totalEvents || 0}{" "}
                    rezervasyon
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="mt-2 p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-slate-800 border-slate-700"
                    >
                      <DropdownMenuItem
                        onClick={() => handleEdit(customer)}
                        className="cursor-pointer"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Düzenle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && filteredCustomers.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Misafir bulunamadı
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
              <h2 className="text-xl font-bold mb-4">
                {editingCustomer ? "Misafir Düzenle" : "Yeni Misafir"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Ad Soyad *
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="Misafir adı"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="5XX XXX XX XX"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="ornek@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Etiketler
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-3 py-1.5 rounded transition-colors ${
                          formData.tags.includes(tag)
                            ? tagLabels[tag].color
                            : "bg-slate-700 hover:bg-slate-600"
                        }`}
                      >
                        {tagLabels[tag].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Notlar
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 resize-none"
                    rows={3}
                    placeholder="Misafir hakkında notlar..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                  disabled={saving}
                >
                  İptal
                </button>
                <button
                  onClick={editingCustomer ? handleUpdate : handleCreate}
                  disabled={saving || !formData.fullName.trim()}
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingCustomer ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
