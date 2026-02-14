"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/ui/PageContainer";
import { Tabs, TabsContent } from "@/components/ui/tabs";

// Modüler imports
import { usePersonnel, useStaffData } from "./hooks";
import {
  StaffHeader,
  DepartmentList,
  PersonnelToolbar,
  ModuleCards,
  PersonnelFormModal,
  PersonnelViewModal,
  CSVImportModal,
  EventAssignmentModule,
  ReviewsModule,
} from "./components";
import type { Personnel } from "./types";

export default function StaffManagementPage() {
  const router = useRouter();

  // Custom hooks
  const personnelHook = usePersonnel();
  const staffData = useStaffData();

  // Aktif modül state'i
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Modal state'leri
  const [viewingPersonnel, setViewingPersonnel] = useState<Personnel | null>(
    null,
  );
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(
    null,
  );
  const [deletePersonnelConfirm, setDeletePersonnelConfirm] =
    useState<Personnel | null>(null);
  const [showPersonnelFormModal, setShowPersonnelFormModal] = useState(false);
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);

  // İlk yükleme
  useEffect(() => {
    staffData.loadAllData();
  }, []);

  // Personnel modülü açıldığında verileri yükle
  useEffect(() => {
    if (activeModule === "personnel") {
      if (personnelHook.hasActiveFilters) {
        personnelHook.loadPersonnel();
      } else {
        personnelHook.loadDepartmentSummary();
      }
    }
  }, [activeModule, personnelHook.hasActiveFilters]);

  // Filtre değiştiğinde yeniden yükle
  useEffect(() => {
    if (activeModule === "personnel" && personnelHook.hasActiveFilters) {
      personnelHook.loadPersonnel();
    }
  }, [personnelHook.personnelFilters, personnelHook.personnelSearch]);

  // Personnel kaydetme handler
  const handleSavePersonnel = useCallback(
    async (data: Partial<Personnel>, avatarFile?: File | null) => {
      await personnelHook.handleSavePersonnel(
        data,
        editingPersonnel,
        () => {
          setShowPersonnelFormModal(false);
          setEditingPersonnel(null);
        },
        avatarFile,
      );
    },
    [editingPersonnel, personnelHook],
  );

  // Personnel silme handler
  const handleDeletePersonnel = useCallback(async () => {
    if (!deletePersonnelConfirm) return;
    const success = await personnelHook.handleDeletePersonnel(
      deletePersonnelConfirm,
    );
    if (success) {
      setDeletePersonnelConfirm(null);
    }
  }, [deletePersonnelConfirm, personnelHook]);

  // CSV import handler
  const handleImportCSV = useCallback(
    async (data: Array<Record<string, string>>) => {
      const success = await personnelHook.handleImportCSV(data);
      if (success) {
        setShowCSVImportModal(false);
      }
      return success;
    },
    [personnelHook],
  );

  // Modül geri dönüş
  const handleBack = useCallback(() => {
    setActiveModule(null);
  }, []);

  // Unique values for filters
  const uniqueValues = personnelHook.getUniqueValues();

  return (
    <PageContainer>
      <div className="space-y-4">
        {/* Header */}
        <StaffHeader
          activeModule={activeModule}
          personnelStats={personnelHook.personnelStats}
          onBack={handleBack}
        />

        {/* Giriş Ekranı - 3 Modül Kartı */}
        {!activeModule && (
          <ModuleCards
            personnelStats={personnelHook.personnelStats}
            personnelCount={personnelHook.departmentSummary.reduce(
              (sum, d) => sum + d.count,
              0,
            )}
            events={staffData.events}
            onSelectModule={setActiveModule}
          />
        )}

        {/* Modül İçerikleri */}
        {activeModule && (
          <Tabs value={activeModule} className="w-full">
            {/* TAB 1: Personel İşlemleri (HR Staff) - LAZY LOADING */}
            <TabsContent value="personnel" className="mt-0 space-y-4">
              {/* Toolbar */}
              <PersonnelToolbar
                search={personnelHook.personnelSearch}
                onSearchChange={personnelHook.setPersonnelSearch}
                filters={personnelHook.personnelFilters}
                onFiltersChange={personnelHook.setPersonnelFilters}
                showFilters={personnelHook.showPersonnelFilters}
                onToggleFilters={() =>
                  personnelHook.setShowPersonnelFilters(
                    !personnelHook.showPersonnelFilters,
                  )
                }
                loading={
                  personnelHook.personnelLoading ||
                  personnelHook.departmentSummaryLoading
                }
                onRefresh={() => {
                  personnelHook.clearPersonnelCache();
                  personnelHook.loadDepartmentSummary();
                }}
                onNewPersonnel={() => {
                  setEditingPersonnel(null);
                  setShowPersonnelFormModal(true);
                }}
                onImportCSV={() => setShowCSVImportModal(true)}
                onExportCSV={personnelHook.handleExportCSV}
                uniqueValues={uniqueValues}
              />

              {/* Filtre aktifse filtrelenmiş liste, değilse lazy loading departman kartları */}
              {personnelHook.hasActiveFilters ? (
                // Filtrelenmiş görünüm
                personnelHook.personnelLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-64 w-full bg-slate-700" />
                    ))}
                  </div>
                ) : personnelHook.getFilteredPersonnel().length === 0 ? (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="py-12 text-center">
                      <Users className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                      <p className="text-slate-400 mb-2">
                        Arama kriterlerine uygun personel bulunamadı
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Filtrelenmiş personel listesi - pozisyona göre gruplu */}
                    {Object.entries(personnelHook.getPersonnelByPosition()).map(
                      ([position, posPersonnel]) => (
                        <Card
                          key={position}
                          className="bg-slate-800 border-slate-700 overflow-hidden"
                        >
                          <div className="h-1.5 bg-purple-500" />
                          <div className="p-3 border-b border-slate-700">
                            <span className="font-semibold text-white text-sm">
                              {position} ({posPersonnel.length})
                            </span>
                          </div>
                          <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                            {posPersonnel.map((person) => (
                              <div
                                key={person.id}
                                className="p-2.5 hover:bg-slate-700/30 transition-colors border-b border-slate-700/50 last:border-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {person.fullName}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {person.sicilNo}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingPersonnel(person)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    Detay
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                )
              ) : (
                // LAZY LOADING - Tek sütun accordion departman listesi
                <DepartmentList
                  departments={personnelHook.departmentSummary}
                  expandedDepartments={personnelHook.expandedDepartments}
                  loadingDepartments={personnelHook.loadingDepartments}
                  personnelByDepartmentCache={
                    personnelHook.personnelByDepartmentCache
                  }
                  loading={personnelHook.departmentSummaryLoading}
                  onToggle={(dept) => personnelHook.toggleDepartmentCard(dept)}
                  onView={setViewingPersonnel}
                  onEdit={(person) => {
                    setEditingPersonnel(person);
                    setShowPersonnelFormModal(true);
                  }}
                  onDelete={setDeletePersonnelConfirm}
                  onAddFirst={() => {
                    setEditingPersonnel(null);
                    setShowPersonnelFormModal(true);
                  }}
                />
              )}
            </TabsContent>

            {/* TAB 2: Etkinlik Ekip Organizasyonu */}
            <TabsContent value="event-assignment" className="mt-0">
              <EventAssignmentModule
                events={staffData.events}
                loading={staffData.eventsLoading}
                onSelectEvent={(eventId, hasTeamAssignment) => {
                  if (hasTeamAssignment) {
                    // Ekip organizasyonu YAPILMIŞ - Step 3'e git (özet görüntüleme)
                    router.push(
                      `/events/${eventId}/team-organization?step=summary`,
                    );
                  } else {
                    // Ekip organizasyonu YAPILMAMIŞ - Step 1'e git (yeni başlangıç)
                    router.push(
                      `/events/${eventId}/team-organization?step=team-assignment`,
                    );
                  }
                }}
              />
            </TabsContent>

            {/* TAB 3: Personel Değerlendirmeleri */}
            <TabsContent value="reviews" className="mt-0">
              <ReviewsModule personnelStats={personnelHook.personnelStats} />
            </TabsContent>
          </Tabs>
        )}

        {/* ==================== MODALS ==================== */}

        {/* Personnel Detay Modal */}
        <PersonnelViewModal
          personnel={viewingPersonnel}
          onClose={() => setViewingPersonnel(null)}
          onEdit={() => {
            setEditingPersonnel(viewingPersonnel);
            setViewingPersonnel(null);
            setShowPersonnelFormModal(true);
          }}
        />

        {/* Personnel Form Modal */}
        <PersonnelFormModal
          open={showPersonnelFormModal}
          onClose={() => {
            setShowPersonnelFormModal(false);
            setEditingPersonnel(null);
          }}
          personnel={editingPersonnel}
          onSave={handleSavePersonnel}
          departments={staffData.departmentsList}
          locations={staffData.workLocationsList}
          positions={staffData.positionsList}
        />

        {/* CSV Import Modal */}
        <CSVImportModal
          open={showCSVImportModal}
          onClose={() => setShowCSVImportModal(false)}
          onImport={handleImportCSV}
        />

        {/* Delete Confirmation Modal */}
        <Dialog
          open={!!deletePersonnelConfirm}
          onOpenChange={() => setDeletePersonnelConfirm(null)}
        >
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <Trash2 className="w-5 h-5" />
                Personel Sil
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                <strong className="text-white">
                  {deletePersonnelConfirm?.fullName}
                </strong>{" "}
                adlı personeli silmek istediğinize emin misiniz? Bu işlem geri
                alınamaz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletePersonnelConfirm(null)}
                className="border-slate-600"
              >
                İptal
              </Button>
              <Button
                onClick={handleDeletePersonnel}
                className="bg-red-600 hover:bg-red-700"
              >
                Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
