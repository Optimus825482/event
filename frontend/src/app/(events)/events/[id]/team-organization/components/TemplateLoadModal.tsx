"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { staffApi } from "@/lib/api";
import { toast } from "sonner";

interface OrganizationTemplate {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    tableGroups?: Array<{
        name: string;
        tableIds: string[];
        color: string;
    }>;
    staffAssignments?: Array<{
        staffName: string;
        tableIds: string[];
    }>;
}

interface TemplateLoadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventId: string;
    onTemplateApplied: () => void;
}

export function TemplateLoadModal({
    open,
    onOpenChange,
    eventId,
    onTemplateApplied,
}: TemplateLoadModalProps) {
    const [templates, setTemplates] = useState<OrganizationTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const res = await staffApi.getOrganizationTemplates();
            setTemplates(res.data || []);
        } catch {
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open, loadTemplates]);

    const handleApply = useCallback(
        async (templateId: string) => {
            setApplying(templateId);
            try {
                await staffApi.applyOrganizationTemplate(templateId, eventId);
                toast.success("Şablon başarıyla uygulandı");
                onOpenChange(false);
                onTemplateApplied();
            } catch (err) {
                console.error("Şablon uygulama hatası:", err);
                toast.error("Şablon uygulanırken hata oluştu");
            } finally {
                setApplying(null);
                setConfirmId(null);
            }
        },
        [eventId, onOpenChange, onTemplateApplied],
    );

    const handleDelete = useCallback(
        async (templateId: string) => {
            setDeleting(templateId);
            try {
                await staffApi.deleteOrganizationTemplate(templateId);
                setTemplates((prev) => prev.filter((t) => t.id !== templateId));
                toast.success("Şablon silindi");
            } catch (err) {
                console.error("Şablon silme hatası:", err);
                toast.error("Şablon silinirken hata oluştu");
            } finally {
                setDeleting(null);
            }
        },
        [],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-800 border-slate-700 max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-400" />
                        Şablondan Yükle
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">Kayıtlı şablon bulunamadı</p>
                            <p className="text-xs mt-1 text-slate-600">
                                Mevcut bir organizasyonu kaydederek şablon oluşturabilirsiniz
                            </p>
                        </div>
                    ) : (
                        templates.map((tpl) => (
                            <div
                                key={tpl.id}
                                className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"
                            >
                                {confirmId === tpl.id ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-amber-400">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="text-sm font-medium">
                                                Mevcut organizasyon silinecek
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Bu şablonu yüklemek mevcut tüm personel atamalarını ve
                                            grupları silecek. Devam etmek istiyor musunuz?
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => handleApply(tpl.id)}
                                                disabled={applying === tpl.id}
                                                className="bg-purple-600 hover:bg-purple-700 text-xs"
                                            >
                                                {applying === tpl.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                ) : null}
                                                Evet, Yükle
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setConfirmId(null)}
                                                className="text-xs text-slate-400"
                                            >
                                                İptal
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-white truncate">
                                                {tpl.name}
                                            </h4>
                                            {tpl.description && (
                                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                                    {tpl.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                <span>
                                                    {new Date(tpl.createdAt).toLocaleDateString("tr-TR")}
                                                </span>
                                                {tpl.tableGroups && (
                                                    <span>{tpl.tableGroups.length} grup</span>
                                                )}
                                                {tpl.staffAssignments && (
                                                    <span>{tpl.staffAssignments.length} personel</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-3">
                                            <Button
                                                size="sm"
                                                onClick={() => setConfirmId(tpl.id)}
                                                className="bg-purple-600 hover:bg-purple-700 text-xs h-7"
                                            >
                                                Yükle
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleDelete(tpl.id)}
                                                disabled={deleting === tpl.id}
                                                className="h-7 w-7 text-red-400 hover:text-red-300"
                                            >
                                                {deleting === tpl.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3 h-3" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-slate-400"
                    >
                        Kapat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
