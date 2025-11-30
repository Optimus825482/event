"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Search,
  Loader2,
  Calendar,
  FileText,
  Plus,
  X,
  Edit2,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { customersApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Customer, GuestNote, GuestNoteType } from "@/types";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const noteTypeLabels: Record<GuestNoteType, { label: string; color: string }> =
  {
    pre_event: {
      label: "Etkinlik Öncesi",
      color: "bg-blue-600/20 text-blue-400",
    },
    during_event: {
      label: "Etkinlik Sırası",
      color: "bg-green-600/20 text-green-400",
    },
    post_event: {
      label: "Etkinlik Sonrası",
      color: "bg-purple-600/20 text-purple-400",
    },
    general: { label: "Genel", color: "bg-slate-600/20 text-slate-400" },
  };

export default function GuestsPage() {
  const [customers, setCustomers] = useState<
    (Customer & { noteCount: number })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerNotes, setCustomerNotes] = useState<GuestNote[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNote, setNewNote] = useState({
    content: "",
    noteType: "general" as GuestNoteType,
  });
  const [savingNote, setSavingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<GuestNote | null>(null);

  // Misafirleri yükle
  const loadCustomers = async (search?: string) => {
    setLoading(true);
    try {
      const response = await customersApi.getAllWithStats(search);
      setCustomers(response.data);
    } catch (err) {
      console.error("Misafirler yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Arama
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(searchQuery || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Misafir detayını aç
  const openCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
    try {
      const response = await customersApi.getWithNotes(customer.id);
      setCustomerNotes(response.data.notes || []);
    } catch (err) {
      console.error("Notlar yüklenemedi:", err);
    }
  };

  // Not ekle
  const handleAddNote = async () => {
    if (!selectedCustomer || !newNote.content.trim()) return;
    setSavingNote(true);
    try {
      await customersApi.addNote(selectedCustomer.id, {
        content: newNote.content,
        noteType: newNote.noteType,
      });
      // Notları yeniden yükle
      const response = await customersApi.getWithNotes(selectedCustomer.id);
      setCustomerNotes(response.data.notes || []);
      setNewNote({ content: "", noteType: "general" });
      setShowAddNoteModal(false);
      loadCustomers(searchQuery || undefined);
    } catch (err) {
      console.error("Not eklenemedi:", err);
    } finally {
      setSavingNote(false);
    }
  };

  // Not güncelle
  const handleUpdateNote = async () => {
    if (!editingNote) return;
    setSavingNote(true);
    try {
      await customersApi.updateNote(editingNote.id, editingNote.content);
      const response = await customersApi.getWithNotes(selectedCustomer!.id);
      setCustomerNotes(response.data.notes || []);
      setEditingNote(null);
    } catch (err) {
      console.error("Not güncellenemedi:", err);
    } finally {
      setSavingNote(false);
    }
  };

  // Not sil
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Bu notu silmek istediğinize emin misiniz?")) return;
    try {
      await customersApi.deleteNote(noteId);
      setCustomerNotes((prev) => prev.filter((n) => n.id !== noteId));
      loadCustomers(searchQuery || undefined);
    } catch (err) {
      console.error("Not silinemedi:", err);
    }
  };

  return (
    <PageContainer maxWidth="6xl">
      <div className="space-y-6">
        <PageHeader
          title="Misafirler"
          description="Tüm misafirlerinizi görüntüleyin ve yönetin"
          icon={<Users className="w-6 h-6 text-blue-400" />}
        />

        {/* Arama */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Misafir adı, telefon veya e-posta ara..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Misafir bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => openCustomerDetail(customer)}
                className="w-full bg-slate-800 rounded-xl p-4 border border-slate-700 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium">{customer.fullName}</h3>
                      <p className="text-sm text-slate-400">
                        {customer.phone || "Telefon yok"}
                        {customer.email && ` • ${customer.email}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="text-purple-400 font-medium">
                          {customer.totalAttendedEvents || 0}
                        </span>{" "}
                        <span className="text-slate-400">etkinlik</span>
                      </p>
                      {customer.lastEventDate && (
                        <p className="text-xs text-slate-500">
                          Son: {formatDate(customer.lastEventDate)}
                        </p>
                      )}
                    </div>
                    {customer.noteCount > 0 && (
                      <div className="flex items-center gap-1 text-yellow-400">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">{customer.noteCount}</span>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detay Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              {selectedCustomer?.fullName}
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6 py-4">
              {/* Bilgiler */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Telefon</p>
                  <p className="font-medium">{selectedCustomer.phone || "-"}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">E-posta</p>
                  <p className="font-medium">{selectedCustomer.email || "-"}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">
                    Katıldığı Etkinlik
                  </p>
                  <p className="font-medium text-purple-400">
                    {selectedCustomer.totalAttendedEvents || 0}
                  </p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Son Katılım</p>
                  <p className="font-medium">
                    {selectedCustomer.lastEventDate
                      ? formatDate(selectedCustomer.lastEventDate)
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Notlar */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-yellow-400" />
                    Notlar
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => setShowAddNoteModal(true)}
                    className="bg-blue-600"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Yeni Not
                  </Button>
                </div>

                {customerNotes.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 bg-slate-700/30 rounded-lg">
                    Bu misafir için not bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {customerNotes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                      >
                        {editingNote?.id === note.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNote.content}
                              onChange={(e) =>
                                setEditingNote({
                                  ...editingNote,
                                  content: e.target.value,
                                })
                              }
                              className="w-full bg-slate-600 border border-slate-500 rounded p-2 text-sm"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleUpdateNote}
                                disabled={savingNote}
                                className="bg-green-600"
                              >
                                {savingNote ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  "Kaydet"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingNote(null)}
                                className="border-slate-500"
                              >
                                İptal
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  noteTypeLabels[note.noteType]?.color
                                }`}
                              >
                                {noteTypeLabels[note.noteType]?.label}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">
                                  {formatDate(note.createdAt)}
                                </span>
                                <button
                                  onClick={() => setEditingNote(note)}
                                  className="p-1 text-slate-400"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="p-1 text-red-400"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {note.event && (
                              <p className="text-xs text-slate-400 mb-1">
                                📅 {note.event.name}
                              </p>
                            )}
                            <p className="text-sm">{note.content}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Not Ekleme Modal */}
      <Dialog open={showAddNoteModal} onOpenChange={setShowAddNoteModal}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Yeni Not Ekle</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Not Tipi
              </label>
              <select
                value={newNote.noteType}
                onChange={(e) =>
                  setNewNote({
                    ...newNote,
                    noteType: e.target.value as GuestNoteType,
                  })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
              >
                <option value="general">Genel</option>
                <option value="pre_event">Etkinlik Öncesi</option>
                <option value="during_event">Etkinlik Sırası</option>
                <option value="post_event">Etkinlik Sonrası</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Not İçeriği
              </label>
              <textarea
                value={newNote.content}
                onChange={(e) =>
                  setNewNote({ ...newNote, content: e.target.value })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2"
                rows={4}
                placeholder="Not içeriğini yazın..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddNoteModal(false)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleAddNote}
                disabled={savingNote || !newNote.content.trim()}
                className="bg-blue-600"
              >
                {savingNote ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Ekle
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
