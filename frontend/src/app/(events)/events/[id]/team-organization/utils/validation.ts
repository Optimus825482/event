/**
 * Wizard Step Validation Functions
 */

import { TableGroup, TeamDefinition, WizardStep } from "../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Step 1: Masa Gruplandırma validasyonu
 */
export function validateStep1(tableGroups: TableGroup[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (tableGroups.length === 0) {
    errors.push("En az bir masa grubu oluşturmalısınız");
  }

  // Boş grupları kontrol et
  const emptyGroups = tableGroups.filter((g) => g.tableIds.length === 0);
  if (emptyGroups.length > 0) {
    warnings.push(`${emptyGroups.length} grup boş (masa atanmamış)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Step 2: Takım Tanımlama validasyonu
 */
export function validateStep2(teams: TeamDefinition[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (teams.length === 0) {
    errors.push("En az bir takım tanımlamalısınız");
  }

  // Personel gereksinimi olmayan takımları kontrol et
  const teamsWithoutRequirements = teams.filter(
    (t) => t.requiredStaff.length === 0,
  );
  if (teamsWithoutRequirements.length > 0) {
    warnings.push(
      `${teamsWithoutRequirements.length} takımda personel gereksinimi tanımlanmamış`,
    );
  }

  // Aynı isimli takımları kontrol et
  const names = teams.map((t) => t.name.toLowerCase());
  const duplicates = names.filter(
    (name, index) => names.indexOf(name) !== index,
  );
  if (duplicates.length > 0) {
    errors.push("Aynı isimde birden fazla takım var");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Step 3: Grup-Takım Eşleştirme validasyonu
 */
export function validateStep3(
  tableGroups: TableGroup[],
  teams: TeamDefinition[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Atanmamış grupları kontrol et
  const unassignedGroups = tableGroups.filter((g) => !g.assignedTeamId);
  if (unassignedGroups.length > 0) {
    warnings.push(`${unassignedGroups.length} grup henüz takıma atanmamış`);
  }

  // Grup atanmamış takımları kontrol et
  const teamsWithoutGroups = teams.filter(
    (t) => t.assignedGroupIds.length === 0,
  );
  if (teamsWithoutGroups.length > 0) {
    warnings.push(`${teamsWithoutGroups.length} takıma grup atanmamış`);
  }

  // En az bir atama yapılmış mı?
  const hasAnyAssignment = teams.some((t) => t.assignedGroupIds.length > 0);
  if (!hasAnyAssignment) {
    errors.push("En az bir grubu bir takıma atamalısınız");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Step 4: Personel Atama validasyonu
 */
export function validateStep4(teams: TeamDefinition[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let totalRequired = 0;
  let totalAssigned = 0;

  teams.forEach((team) => {
    team.requiredStaff.forEach((req) => {
      totalRequired += req.count;
      totalAssigned += req.assignedStaffIds.length;

      if (req.assignedStaffIds.length < req.count) {
        warnings.push(
          `${team.name}: ${req.count - req.assignedStaffIds.length} ${
            req.role
          } eksik`,
        );
      }
    });
  });

  // En az bir personel atanmış mı?
  if (totalAssigned === 0 && totalRequired > 0) {
    errors.push("En az bir personel atamalısınız");
  }

  // Tamamlanma yüzdesi
  const completionPercent =
    totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100;

  if (completionPercent < 50) {
    warnings.push(`Personel ataması %${completionPercent} tamamlandı`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Tüm step'leri validate et
 */
export function validateAllSteps(
  tableGroups: TableGroup[],
  teams: TeamDefinition[],
): Record<WizardStep, ValidationResult> {
  return {
    "team-assignment": validateStep1(tableGroups),
    "staff-assignment": validateStep4(teams),
    summary: { isValid: true, errors: [], warnings: [] },
  };
}

/**
 * Belirli bir step'in tamamlanıp tamamlanmadığını kontrol et
 */
export function isStepComplete(
  step: WizardStep,
  tableGroups: TableGroup[],
  teams: TeamDefinition[],
): boolean {
  switch (step) {
    case "team-assignment":
      return tableGroups.some((g) => (g.staffAssignments?.length || 0) > 0);
    case "staff-assignment":
      return tableGroups.some((g) => (g.staffAssignments?.length || 0) > 0);
    case "summary":
      return true;
    default:
      return false;
  }
}

/**
 * Tamamlanan step'lerin listesini döndür
 */
export function getCompletedSteps(
  tableGroups: TableGroup[],
  teams: TeamDefinition[],
): WizardStep[] {
  const steps: WizardStep[] = [
    "team-assignment",
    "staff-assignment",
    "summary",
  ];

  return steps.filter((step) => isStepComplete(step, tableGroups, teams));
}
