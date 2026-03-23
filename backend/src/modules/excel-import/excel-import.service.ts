import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as XLSX from "xlsx";
import * as fs from "fs";
import { Staff } from "../../entities/staff.entity";
import { Event } from "../../entities/event.entity";
import { TableGroup } from "../../entities/table-group.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";
import { AIExcelParseResult } from "./ai-excel-parser.service";
import { ExcelParserService } from "./excel-parser.service";
import { ExcelResultMergerService } from "./excel-result-merger.service";
import { AnalysisResult } from "./excel-import.types";

// Re-export types for backward compatibility (controller imports)
export {
  AnalysisResult,
  ParsedStaffAssignment,
  ParsedGroup,
  ParsedServicePoint,
  ParsedServicePointAssignment,
  ParsedExtraPersonnel,
  ParsedSupportTeamMember,
  ParsedSupportTeam,
  ParsedCaptain,
  ParsedSupervisor,
  ParsedLocaCaptain,
} from "./excel-import.types";

@Injectable()
export class ExcelImportService {
  private readonly logger = new Logger(ExcelImportService.name);

  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(TableGroup)
    private tableGroupRepository: Repository<TableGroup>,
    @InjectRepository(EventStaffAssignment)
    private assignmentRepository: Repository<EventStaffAssignment>,
    private excelParser: ExcelParserService,
    private resultMerger: ExcelResultMergerService,
  ) {}

  /**
   * Excel dosyasini analiz et ve onizleme dondur
   */
  async analyzeExcelFile(
    eventId: string,
    filePath: string,
    useAI: boolean = false,
  ): Promise<AnalysisResult> {
    this.logger.log(
      `Excel analizi baslatiliyor: eventId=${eventId}, filePath=${filePath}, useAI=${useAI}`,
    );

    try {
      // Event'i kontrol et
      const event = await this.eventRepository.findOne({
        where: { id: eventId },
      });
      if (!event) {
        this.logger.warn(`Etkinlik bulunamadi: ${eventId}`);
        throw new BadRequestException("Etkinlik bulunamadi");
      }
      this.logger.log(`Etkinlik bulundu: ${event.name}`);

      // AI DEVRE DISI - Kendi satir-sutun parser'imizi kullaniyoruz
      const aiResult: AIExcelParseResult | null = null;

      // Excel dosyasini oku
      this.logger.log(`Excel dosyasi okunuyor: ${filePath}`);
      const workbook = XLSX.readFile(filePath, {
        cellDates: true,
        cellNF: true,
        cellText: true,
      });
      const sheetName = workbook.SheetNames[0];
      this.logger.log(`Sheet adi: ${sheetName}`);

      const worksheet = workbook.Sheets[sheetName];

      // Iki farkli format ile oku - hem 2D array hem de object format
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });

      // excel-viewer-pro formati: __EMPTY_X seklinde sutun isimleri
      const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(
        worksheet,
        {
          raw: false,
          defval: "",
          dateNF: "yyyy-mm-dd",
        },
      );

      this.logger.log(
        `Excel satir sayisi: ${rawData.length}, JSON satir sayisi: ${jsonData.length}`,
      );

      // Tum aktif personelleri getir
      const allStaff = await this.staffRepository.find({
        where: { isActive: true },
        select: ["id", "fullName", "position", "color"],
      });
      this.logger.log(`Aktif personel sayisi: ${allStaff.length}`);

      // Excel'i parse et - hem klasik hem de excel-viewer-pro yontemi
      const classicResult = this.excelParser.parseExcelData(rawData, allStaff);

      // excel-viewer-pro formati ile ek parsing (daha guvenilir)
      const viewerProResult = this.excelParser.parseExcelViewerProFormat(
        jsonData,
        allStaff,
      );

      // Sonuclari birlestir - viewer-pro sonuclarini oncelikli kullan
      const mergedClassicResult = this.resultMerger.mergeViewerProResults(
        classicResult,
        viewerProResult,
      );

      // AI sonuclarini klasik sonuclarla birlestir
      const mergedResult = this.resultMerger.mergeAIResults(
        mergedClassicResult,
        aiResult,
        allStaff,
      );

      const {
        groups,
        servicePoints,
        extraPersonnel,
        supportTeams,
        captains,
        supervisors,
        locaCaptains,
        unmatchedStaff,
        warnings,
      } = mergedResult;

      // Dosyayi temizle
      fs.unlinkSync(filePath);

      // Toplam destek ekibi uyesi sayisi
      const totalSupportTeamMembers = supportTeams.reduce(
        (sum, team) => sum + team.members.length,
        0,
      );

      // Sonucu dondur
      const result: AnalysisResult = {
        eventId,
        eventName: event.name,
        totalGroups: groups.length,
        totalAssignments:
          groups.reduce((sum, g) => sum + g.assignments.length, 0) +
          servicePoints.reduce((sum, sp) => sum + sp.assignments.length, 0) +
          extraPersonnel.length +
          totalSupportTeamMembers +
          captains.length +
          supervisors.length +
          locaCaptains.length,
        groups,
        servicePoints,
        extraPersonnel,
        supportTeams,
        captains,
        supervisors,
        locaCaptains,
        unmatchedStaff,
        warnings,
        aiParsed: aiResult !== null,
        summary: {
          tableGroups: groups.filter((g) => g.groupType === "standard").length,
          locaGroups: groups.filter((g) => g.groupType === "loca").length,
          servicePoints: servicePoints.length,
          extraPersonnel: extraPersonnel.length,
          supportTeamMembers: totalSupportTeamMembers,
          captains: captains.length,
          supervisors: supervisors.length,
          locaCaptains: locaCaptains.length,
          matchedStaff:
            groups.reduce(
              (sum, g) => sum + g.assignments.filter((a) => a.staffId).length,
              0,
            ) +
            servicePoints.reduce(
              (sum, sp) => sum + sp.assignments.filter((a) => a.staffId).length,
              0,
            ) +
            captains.filter((c) => c.staffId).length +
            supervisors.filter((s) => s.staffId).length +
            locaCaptains.filter((lc) => lc.staffId).length,
          unmatchedStaff: unmatchedStaff.length,
        },
      };

      this.logger.log(
        `Excel analizi tamamlandi: ${result.totalGroups} grup, ${servicePoints.length} hizmet noktasi, ${extraPersonnel.length} extra personel, ${supportTeams.length} destek ekibi (${totalSupportTeamMembers} uye), ${captains.length} kaptan, ${supervisors.length} supervizor, ${locaCaptains.length} loca kaptani, ${result.totalAssignments} atama, AI: ${result.aiParsed}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Excel analiz hatasi: ${error.message}`, error.stack);
      // Dosyayi temizle
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw new BadRequestException(`Excel analiz hatasi: ${error.message}`);
    }
  }

  /**
   * Analiz sonucunu onayla ve veritabanina kaydet
   */
  async confirmAndSaveImport(
    eventId: string,
    analysisResult: AnalysisResult,
    options?: { clearExisting?: boolean },
  ): Promise<{
    success: boolean;
    savedGroups: number;
    savedAssignments: number;
  }> {
    try {
      // Mevcut verileri temizle (opsiyonel)
      if (options?.clearExisting) {
        await this.assignmentRepository.delete({ eventId });
        await this.tableGroupRepository.delete({ eventId });
      }

      let savedGroups = 0;
      let savedAssignments = 0;

      // Gruplari kaydet
      for (const group of analysisResult.groups) {
        const tableGroup = this.tableGroupRepository.create({
          eventId,
          name: group.name,
          color: group.color,
          tableIds: group.tableIds,
          groupType: group.groupType,
          sortOrder: savedGroups,
        });
        await this.tableGroupRepository.save(tableGroup);
        savedGroups++;

        // Atamalari kaydet
        for (const assignment of group.assignments) {
          if (!assignment.staffId) continue;

          const staffAssignment = this.assignmentRepository.create({
            eventId,
            staffId: assignment.staffId,
            tableIds: assignment.tableIds,
            assignmentType: assignment.assignmentType,
            color: group.color,
            isActive: true,
            notes: `Vardiya: ${assignment.shiftStart} - ${assignment.shiftEnd}`,
          });
          await this.assignmentRepository.save(staffAssignment);
          savedAssignments++;
        }
      }

      this.logger.log(
        `Import tamamlandi: ${savedGroups} grup, ${savedAssignments} atama`,
      );

      return {
        success: true,
        savedGroups,
        savedAssignments,
      };
    } catch (error) {
      this.logger.error("Import kaydetme hatasi:", error);
      throw new BadRequestException(`Import hatasi: ${error.message}`);
    }
  }
}
