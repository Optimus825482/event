import { Injectable, Logger } from "@nestjs/common";
import { Staff } from "../../entities/staff.entity";
import { StaffMatcherService } from "./staff-matcher.service";
import {
  ParsedGroup,
  ParsedServicePoint,
  ParsedExtraPersonnel,
  ParsedSupportTeam,
  ParsedCaptain,
  ParsedSupervisor,
  ParsedLocaCaptain,
  ParseResult,
  ViewerProParseResult,
} from "./excel-import.types";
import { AIExcelParseResult } from "./ai-excel-parser.service";

@Injectable()
export class ExcelResultMergerService {
  private readonly logger = new Logger(ExcelResultMergerService.name);

  constructor(private readonly staffMatcher: StaffMatcherService) {}

  /**
   * AI sonuclarini klasik parse sonuclariyla birlestir
   * AI sonuclari oncelikli
   */
  mergeAIResults(
    classicResult: ParseResult,
    aiResult: AIExcelParseResult | null,
    allStaff: Staff[],
  ): ParseResult {
    if (!aiResult) {
      return classicResult;
    }

    const staffNameMap = this.staffMatcher.buildStaffNameMap(allStaff);

    const warnings = [...classicResult.warnings];
    const unmatchedStaff = [...classicResult.unmatchedStaff];

    // AI'dan gelen kaptanlari isle
    const captains: ParsedCaptain[] = [];
    const captainNames = new Set<string>();

    for (const aiCaptain of aiResult.captains || []) {
      const matchResult = this.staffMatcher.matchStaff(
        aiCaptain.name,
        staffNameMap,
        allStaff,
      );
      const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(
        aiCaptain.shift,
      );

      captains.push({
        staffName: aiCaptain.name,
        staffId: matchResult.staff?.id,
        position: aiCaptain.position,
        shiftStart,
        shiftEnd,
        area: aiCaptain.area,
        matchConfidence: matchResult.confidence,
        matchedStaff: matchResult.staff
          ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
          : undefined,
      });
      captainNames.add(this.staffMatcher.normalizeStaffName(aiCaptain.name));

      if (!matchResult.staff && !unmatchedStaff.includes(aiCaptain.name)) {
        unmatchedStaff.push(aiCaptain.name);
      }
    }

    for (const captain of classicResult.captains) {
      if (
        !captainNames.has(
          this.staffMatcher.normalizeStaffName(captain.staffName),
        )
      ) {
        captains.push(captain);
      }
    }

    // AI'dan gelen supervizorleri isle
    const supervisors: ParsedSupervisor[] = [];
    const supervisorNames = new Set<string>();

    for (const aiSupervisor of aiResult.supervisors || []) {
      const matchResult = this.staffMatcher.matchStaff(
        aiSupervisor.name,
        staffNameMap,
        allStaff,
      );
      const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(
        aiSupervisor.shift,
      );

      supervisors.push({
        staffName: aiSupervisor.name,
        staffId: matchResult.staff?.id,
        position: "SPVR",
        shiftStart,
        shiftEnd,
        area: aiSupervisor.area,
        matchConfidence: matchResult.confidence,
        matchedStaff: matchResult.staff
          ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
          : undefined,
      });
      supervisorNames.add(
        this.staffMatcher.normalizeStaffName(aiSupervisor.name),
      );

      if (!matchResult.staff && !unmatchedStaff.includes(aiSupervisor.name)) {
        unmatchedStaff.push(aiSupervisor.name);
      }
    }

    for (const supervisor of classicResult.supervisors) {
      if (
        !supervisorNames.has(
          this.staffMatcher.normalizeStaffName(supervisor.staffName),
        )
      ) {
        supervisors.push(supervisor);
      }
    }

    // AI'dan gelen loca kaptanlarini isle
    const locaCaptains: ParsedLocaCaptain[] = [];
    const locaCaptainNames = new Set<string>();

    for (const aiLocaCaptain of aiResult.locaCaptains || []) {
      const matchResult = this.staffMatcher.matchStaff(
        aiLocaCaptain.name,
        staffNameMap,
        allStaff,
      );
      const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(
        aiLocaCaptain.shift,
      );

      locaCaptains.push({
        staffName: aiLocaCaptain.name,
        staffId: matchResult.staff?.id,
        shiftStart,
        shiftEnd,
        area: aiLocaCaptain.area,
        matchConfidence: matchResult.confidence,
        matchedStaff: matchResult.staff
          ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
          : undefined,
      });
      locaCaptainNames.add(
        this.staffMatcher.normalizeStaffName(aiLocaCaptain.name),
      );

      if (!matchResult.staff && !unmatchedStaff.includes(aiLocaCaptain.name)) {
        unmatchedStaff.push(aiLocaCaptain.name);
      }
    }

    for (const locaCaptain of classicResult.locaCaptains) {
      if (
        !locaCaptainNames.has(
          this.staffMatcher.normalizeStaffName(locaCaptain.staffName),
        )
      ) {
        locaCaptains.push(locaCaptain);
      }
    }

    // AI'dan gelen extra personeli isle
    const extraPersonnel: ParsedExtraPersonnel[] = [];
    const extraNames = new Set<string>();

    for (const aiExtra of aiResult.extraPersonnel || []) {
      if (aiExtra.isBackground) continue;

      const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(
        aiExtra.shift,
      );
      const tableIds = this.staffMatcher.parseTableIds(aiExtra.tables);

      extraPersonnel.push({
        staffName: aiExtra.name,
        tableIds,
        shiftStart,
        shiftEnd,
        isBackground: false,
      });
      extraNames.add(this.staffMatcher.normalizeStaffName(aiExtra.name));
    }

    for (const extra of classicResult.extraPersonnel) {
      if (
        !extraNames.has(this.staffMatcher.normalizeStaffName(extra.staffName))
      ) {
        extraPersonnel.push(extra);
      }
    }

    // AI'dan gelen destek ekibi uyelerini isle
    const supportTeams: ParsedSupportTeam[] = [];
    const supportTeamMap = new Map<string, ParsedSupportTeam>();

    for (const aiMember of aiResult.supportTeamMembers || []) {
      if (aiMember.isNotComing) continue;

      const teamName = aiMember.teamName || "CRYSTAL DESTEK EKiBi";
      let team = supportTeamMap.get(teamName);

      if (!team) {
        team = {
          name: teamName,
          color: "#22c55e",
          members: [],
        };
        supportTeamMap.set(teamName, team);
      }

      const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(
        aiMember.shift,
      );
      const tableIds = this.staffMatcher.parseTableIds(aiMember.assignment);

      team.members.push({
        staffName: aiMember.name,
        position: aiMember.position,
        assignment: aiMember.assignment,
        tableIds,
        shiftStart,
        shiftEnd,
        isNotComing: false,
      });
    }

    supportTeamMap.forEach((team) => supportTeams.push(team));

    for (const classicTeam of classicResult.supportTeams) {
      if (!supportTeamMap.has(classicTeam.name)) {
        supportTeams.push(classicTeam);
      }
    }

    const servicePoints = classicResult.servicePoints;
    const groups = classicResult.groups;

    this.logger.log(
      `AI merge sonucu: ${captains.length} kaptan (AI: ${
        aiResult.captains?.length || 0
      }), ` +
        `${supervisors.length} supervizor (AI: ${
          aiResult.supervisors?.length || 0
        }), ` +
        `${locaCaptains.length} loca kaptani (AI: ${
          aiResult.locaCaptains?.length || 0
        }), ` +
        `${extraPersonnel.length} extra (AI: ${
          aiResult.extraPersonnel?.length || 0
        }), ` +
        `${supportTeams.reduce(
          (s, t) => s + t.members.length,
          0,
        )} destek uyesi (AI: ${aiResult.supportTeamMembers?.length || 0})`,
    );

    return {
      groups,
      servicePoints,
      extraPersonnel,
      supportTeams,
      captains,
      supervisors,
      locaCaptains,
      unmatchedStaff: [...new Set(unmatchedStaff)],
      warnings,
    };
  }

  /**
   * ViewerPro sonuclarini klasik sonuclarla birlestir
   * ViewerPro sonuclari oncelikli
   */
  mergeViewerProResults(
    classicResult: ParseResult,
    viewerProResult: ViewerProParseResult,
  ): ParseResult {
    const groups =
      viewerProResult.groups.length > 0
        ? viewerProResult.groups
        : classicResult.groups;

    const servicePointNames = new Set(
      viewerProResult.servicePoints.map((sp) => sp.name.toUpperCase()),
    );

    const servicePoints = [
      ...viewerProResult.servicePoints,
      ...classicResult.servicePoints.filter(
        (sp) => !servicePointNames.has(sp.name.toUpperCase()),
      ),
    ];

    const extraNames = new Set(
      viewerProResult.extraPersonnel.map((e) =>
        this.staffMatcher.normalizeStaffName(e.staffName),
      ),
    );

    const extraPersonnel = [
      ...viewerProResult.extraPersonnel,
      ...classicResult.extraPersonnel.filter(
        (e) =>
          !extraNames.has(this.staffMatcher.normalizeStaffName(e.staffName)),
      ),
    ];

    const unmatchedStaff = [
      ...new Set([
        ...viewerProResult.unmatchedStaff,
        ...classicResult.unmatchedStaff,
      ]),
    ];

    const warnings = [...viewerProResult.warnings, ...classicResult.warnings];

    this.logger.log(
      `[ViewerPro Merge] Gruplar: ${groups.length} (VP: ${viewerProResult.groups.length}, Classic: ${classicResult.groups.length}), ` +
        `ServicePoints: ${servicePoints.length} (VP: ${viewerProResult.servicePoints.length}, Classic: ${classicResult.servicePoints.length}), ` +
        `Extra: ${extraPersonnel.length}`,
    );

    return {
      groups,
      servicePoints,
      extraPersonnel,
      supportTeams: classicResult.supportTeams,
      captains: classicResult.captains,
      supervisors: classicResult.supervisors,
      locaCaptains: classicResult.locaCaptains,
      unmatchedStaff,
      warnings,
    };
  }
}
