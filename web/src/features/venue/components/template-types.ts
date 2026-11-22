import type { TemplatePreviewModel } from "./template-preview-model";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  usageCount: number;
  tableCount: number;
  capacity: number;
  createdByName: string | null;
  canManage: boolean;
  /** ISO tarih (sunucudan istemciye serileştirilebilir). */
  createdAt: string;
  preview: TemplatePreviewModel;
};

export type TemplatePermissions = { canEdit: boolean; canDelete: boolean; canCreate: boolean };
