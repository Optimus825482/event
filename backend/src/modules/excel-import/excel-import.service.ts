import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as XLSX from "xlsx";
import * as fs from "fs";
import { Staff } from "../../entities/staff.entity";
import { Event } from "../../entities/event.entity";
import { TableGroup } from "../../entities/table-group.entity";
import { EventStaffAssignment } from "../../entities/event-staff-assignment.entity";
import {
  AIExcelParserService,
  AIExcelParseResult,
} from "./ai-excel-parser.service";

// Analiz sonucu tipleri - Export edildi
export interface ParsedStaffAssignment {
  staffName: string;
  staffId?: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  groupName: string;
  groupColor: string;
  assignmentType: "table" | "loca" | "bar" | "special";
  position?: string;
  matchConfidence: number; // 0-100 arası eşleşme güveni
  matchedStaff?: { id: string; fullName: string };
  warnings?: string[];
}

export interface ParsedGroup {
  name: string;
  color: string;
  tableIds: string[];
  groupType: "standard" | "loca";
  assignments: ParsedStaffAssignment[];
}

// Hizmet Noktası Personel Ataması
export interface ParsedServicePointAssignment {
  staffName: string;
  staffId?: string;
  shiftStart: string;
  shiftEnd: string;
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

// Hizmet Noktası (Bar, Depo, vb.)
export interface ParsedServicePoint {
  name: string;
  pointType: "bar" | "depo" | "fuaye" | "casino" | "other";
  color: string;
  assignments: ParsedServicePointAssignment[];
}

// Extra Personel (Event'e özel, staff tablosunda olmayan)
export interface ParsedExtraPersonnel {
  staffName: string;
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isBackground?: boolean; // BACKROUND olarak işaretlenenler
}

// Destek Ekibi Personeli (Dışarıdan gelen destek - CRYSTAL, vb.)
export interface ParsedSupportTeamMember {
  staffName: string;
  position: string; // SPVR, CAPTAIN, PERSONEL
  assignment: string; // POSTA 3, 16-17-26-27, BAR, GENEL ALAN KONTROL
  tableIds: string[];
  shiftStart: string;
  shiftEnd: string;
  isNotComing?: boolean; // GELMEYECEK olarak işaretlenenler
}

// Destek Ekibi (CRYSTAL DESTEK EKİBİ, vb.)
export interface ParsedSupportTeam {
  name: string; // CRYSTAL DESTEK EKİBİ
  color: string;
  members: ParsedSupportTeamMember[];
}

// Kaptan (Takım kaptanları - gruplar birleştirildiğinde atanacak)
export interface ParsedCaptain {
  staffName: string;
  staffId?: string;
  position: "CAPTAIN" | "J. CAPTAIN" | "INCHARGE"; // Kaptan türü
  shiftStart: string;
  shiftEnd: string;
  area?: string; // SALON, LOCA gibi sorumluluk alanı
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

// Süpervizör (1'den fazla takıma atanabilir)
export interface ParsedSupervisor {
  staffName: string;
  staffId?: string;
  position: "SPVR";
  shiftStart: string;
  shiftEnd: string;
  area?: string; // LOCA, SALON gibi sorumluluk alanı
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

// Loca Kaptanı (Loca takımlarının kaptanları)
export interface ParsedLocaCaptain {
  staffName: string;
  staffId?: string;
  shiftStart: string;
  shiftEnd: string;
  area?: string; // SALON notu varsa
  matchConfidence: number;
  matchedStaff?: { id: string; fullName: string };
}

export interface AnalysisResult {
  eventId: string;
  eventName?: string;
  totalGroups: number;
  totalAssignments: number;
  groups: ParsedGroup[];
  servicePoints: ParsedServicePoint[]; // Hizmet noktaları
  extraPersonnel: ParsedExtraPersonnel[]; // Extra personeller
  supportTeams: ParsedSupportTeam[]; // Destek ekipleri
  captains: ParsedCaptain[]; // Takım kaptanları
  supervisors: ParsedSupervisor[]; // Süpervizörler
  locaCaptains: ParsedLocaCaptain[]; // Loca kaptanları
  unmatchedStaff: string[];
  warnings: string[];
  aiParsed?: boolean; // AI ile parse edildi mi?
  aiResult?: AIExcelParseResult; // AI sonuçları (debug için)
  summary: {
    tableGroups: number;
    locaGroups: number;
    servicePoints: number;
    extraPersonnel: number;
    supportTeamMembers: number;
    captains: number;
    supervisors: number;
    locaCaptains: number;
    matchedStaff: number;
    unmatchedStaff: number;
  };
}

@Injectable()
export class ExcelImportService {
  private readonly logger = new Logger(ExcelImportService.name);

  // Grup renkleri paleti
  private readonly GROUP_COLORS = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
    "#F8B500",
    "#E74C3C",
    "#1ABC9C",
    "#9B59B6",
    "#3498DB",
    "#E67E22",
    "#2ECC71",
    "#F39C12",
    "#8E44AD",
    "#16A085",
    "#D35400",
    "#27AE60",
    "#2980B9",
    "#C0392B",
    "#7D3C98",
    "#148F77",
    "#D68910",
    "#1F618D",
    "#922B21",
    "#76448A",
    "#117A65",
    "#B9770E",
    "#1A5276",
    "#7B241C",
    "#5B2C6F",
    "#0E6655",
  ];

  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(TableGroup)
    private tableGroupRepository: Repository<TableGroup>,
    @InjectRepository(EventStaffAssignment)
    private assignmentRepository: Repository<EventStaffAssignment>,
    private aiParser: AIExcelParserService
  ) {}

  /**
   * Excel dosyasını analiz et ve önizleme döndür
   */
  async analyzeExcelFile(
    eventId: string,
    filePath: string,
    useAI: boolean = false // AI devre dışı - kendi parser'ımızı kullanıyoruz
  ): Promise<AnalysisResult> {
    this.logger.log(
      `Excel analizi başlatılıyor: eventId=${eventId}, filePath=${filePath}, useAI=${useAI}`
    );

    try {
      // Event'i kontrol et
      const event = await this.eventRepository.findOne({
        where: { id: eventId },
      });
      if (!event) {
        this.logger.warn(`Etkinlik bulunamadı: ${eventId}`);
        throw new BadRequestException("Etkinlik bulunamadı");
      }
      this.logger.log(`Etkinlik bulundu: ${event.name}`);

      // AI DEVRE DIŞI - Kendi satır-sütun parser'ımızı kullanıyoruz
      const aiResult: AIExcelParseResult | null = null;

      // Excel dosyasını oku - excel-viewer-pro yaklaşımı ile
      this.logger.log(`Excel dosyası okunuyor: ${filePath}`);
      const workbook = XLSX.readFile(filePath, {
        cellDates: true,
        cellNF: true,
        cellText: true,
      });
      const sheetName = workbook.SheetNames[0];
      this.logger.log(`Sheet adı: ${sheetName}`);

      const worksheet = workbook.Sheets[sheetName];

      // İki farklı format ile oku - hem 2D array hem de object format
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      });

      // excel-viewer-pro formatı: __EMPTY_X şeklinde sütun isimleri
      const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(
        worksheet,
        {
          raw: false,
          defval: "",
          dateNF: "yyyy-mm-dd",
        }
      );

      this.logger.log(
        `Excel satır sayısı: ${rawData.length}, JSON satır sayısı: ${jsonData.length}`
      );

      // Tüm aktif personelleri getir
      const allStaff = await this.staffRepository.find({
        where: { isActive: true },
        select: ["id", "fullName", "position", "color"],
      });
      this.logger.log(`Aktif personel sayısı: ${allStaff.length}`);

      // Excel'i parse et - hem klasik hem de excel-viewer-pro yöntemi
      const classicResult = this.parseExcelData(rawData, allStaff);

      // excel-viewer-pro formatı ile ek parsing (daha güvenilir)
      const viewerProResult = this.parseExcelViewerProFormat(
        jsonData,
        allStaff
      );

      // Sonuçları birleştir - viewer-pro sonuçlarını öncelikli kullan
      const mergedClassicResult = this.mergeViewerProResults(
        classicResult,
        viewerProResult
      );

      // AI sonuçlarını klasik sonuçlarla birleştir
      const mergedResult = this.mergeAIResults(
        mergedClassicResult,
        aiResult,
        allStaff
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

      // Dosyayı temizle
      fs.unlinkSync(filePath);

      // Toplam destek ekibi üyesi sayısı
      const totalSupportTeamMembers = supportTeams.reduce(
        (sum, team) => sum + team.members.length,
        0
      );

      // Sonucu döndür
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
              0
            ) +
            servicePoints.reduce(
              (sum, sp) => sum + sp.assignments.filter((a) => a.staffId).length,
              0
            ) +
            captains.filter((c) => c.staffId).length +
            supervisors.filter((s) => s.staffId).length +
            locaCaptains.filter((lc) => lc.staffId).length,
          unmatchedStaff: unmatchedStaff.length,
        },
      };

      this.logger.log(
        `Excel analizi tamamlandı: ${result.totalGroups} grup, ${servicePoints.length} hizmet noktası, ${extraPersonnel.length} extra personel, ${supportTeams.length} destek ekibi (${totalSupportTeamMembers} üye), ${captains.length} kaptan, ${supervisors.length} süpervizör, ${locaCaptains.length} loca kaptanı, ${result.totalAssignments} atama, AI: ${result.aiParsed}`
      );
      return result;
    } catch (error) {
      this.logger.error(`Excel analiz hatası: ${error.message}`, error.stack);
      // Dosyayı temizle
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw new BadRequestException(`Excel analiz hatası: ${error.message}`);
    }
  }

  /**
   * Excel verisini parse et
   *
   * SÜTUN YAPISI (SABİT):
   * - Grup 1: C(2)=Personel Adı, E(4)=Masa Grubu, F(5)=Çalışma Saati
   * - Grup 2: G(6)=Personel Adı, I(8)=Masa Grubu, J(9)=Çalışma Saati
   * - Grup 3 (Extra): S(18)=Personel Adı, T(19)=Masa Grubu, U(20)=Çalışma Saati
   */
  private parseExcelData(
    rawData: any[][],
    allStaff: Staff[]
  ): {
    groups: ParsedGroup[];
    servicePoints: ParsedServicePoint[];
    extraPersonnel: ParsedExtraPersonnel[];
    supportTeams: ParsedSupportTeam[];
    captains: ParsedCaptain[];
    supervisors: ParsedSupervisor[];
    locaCaptains: ParsedLocaCaptain[];
    unmatchedStaff: string[];
    warnings: string[];
  } {
    const groups: ParsedGroup[] = [];
    const groupMap = new Map<string, ParsedGroup>();
    const servicePoints: ParsedServicePoint[] = [];
    const servicePointMap = new Map<string, ParsedServicePoint>();
    const extraPersonnel: ParsedExtraPersonnel[] = [];
    const supportTeams: ParsedSupportTeam[] = [];
    const supportTeamMap = new Map<string, ParsedSupportTeam>();
    const captains: ParsedCaptain[] = [];
    const supervisors: ParsedSupervisor[] = [];
    const locaCaptains: ParsedLocaCaptain[] = [];
    const unmatchedStaff: string[] = [];
    const warnings: string[] = [];
    let colorIndex = 0;
    let groupCounter = 1; // GRUP numaralama için sayaç

    // Destek ekibi renkleri
    const SUPPORT_TEAM_COLORS = ["#22c55e", "#10b981", "#14b8a6", "#0d9488"];

    // Hizmet noktası renkleri
    const SERVICE_POINT_COLORS: Record<string, string> = {
      bar: "#06b6d4", // Cyan
      depo: "#8b5cf6", // Purple
      fuaye: "#f59e0b", // Amber
      casino: "#ef4444", // Red
      other: "#64748b", // Slate
    };

    // Personel isimlerini normalize et
    const staffNameMap = new Map<string, Staff>();
    allStaff.forEach((staff) => {
      const normalizedName = this.normalizeStaffName(staff.fullName);
      staffNameMap.set(normalizedName, staff);
    });

    // ============================================================
    // YENİ SABİT SÜTUN YAPISI İLE PARSE
    // ============================================================
    // Log'dan tespit edilen gerçek sütun indeksleri (0-based):
    // [1]TULGA TOPKAÇ | [3]34-35-48-49 | [4]20:00--00:00 | [5]KEREM ERTÜRK | [8]38-39-52-53 | [9]19:00-K
    // Grup 1: B=1 (İsim), D=3 (Masa), E=4 (Saat)
    // Grup 2: F=5 (İsim), I=8 (Masa), J=9 (Saat)
    // Extra Personel: R=17 (İsim), U=20 (Masa), V=21 (Saat)

    const COLUMN_SETS = [
      {
        name: "PERSONEL_1",
        nameCol: 1, // B sütunu (index 1)
        tableCol: 3, // D sütunu (POSTA)
        shiftCol: 4, // E sütunu (SAAT)
        isExtra: false,
      },
      {
        name: "PERSONEL_2",
        nameCol: 5, // F sütunu (index 5)
        tableCol: 8, // I sütunu (POSTA)
        shiftCol: 9, // J sütunu (SAAT)
        isExtra: false,
      },
      {
        name: "EXTRA_PERSONEL",
        nameCol: 17, // R sütunu (index 17)
        tableCol: 20, // U sütunu (Masa)
        shiftCol: 21, // V sütunu (Saat)
        isExtra: true,
      },
    ];

    // Başlık satırını bul (PERSONEL başlığı olan satır)
    let headerRowIndex = -1;
    for (
      let rowIndex = 0;
      rowIndex < Math.min(rawData.length, 20);
      rowIndex++
    ) {
      const row = rawData[rowIndex];
      if (!row) continue;

      const cellC = this.cleanCellValue(row[2])?.toUpperCase();
      const cellG = this.cleanCellValue(row[6])?.toUpperCase();

      if (cellC === "PERSONEL" || cellG === "PERSONEL") {
        headerRowIndex = rowIndex;
        this.logger.log(`Başlık satırı bulundu: ${rowIndex}`);
        break;
      }
    }

    if (headerRowIndex === -1) {
      this.logger.warn("Başlık satırı bulunamadı, tüm satırlar taranacak");
      headerRowIndex = 0;
    }

    // Başlık satırından sonraki satırları işle
    for (
      let rowIndex = headerRowIndex + 1;
      rowIndex < rawData.length;
      rowIndex++
    ) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      // Her sütun seti için personel bilgilerini çıkar
      for (const colSet of COLUMN_SETS) {
        const staffName = this.cleanCellValue(row[colSet.nameCol]);
        const tableIdsRaw = this.cleanCellValue(row[colSet.tableCol]);
        const shiftRaw = this.cleanCellValue(row[colSet.shiftCol]);

        // Boş veya başlık satırını atla
        if (!staffName) continue;
        const upperName = staffName.toUpperCase();
        if (
          upperName === "PERSONEL" ||
          upperName === "POZİSYON" ||
          upperName === "EXTRA PERSONEL" ||
          upperName === "POSTA" ||
          upperName === "SAAT"
        )
          continue;

        // İsim gibi görünmüyorsa atla
        if (!this.looksLikeStaffName(staffName)) continue;

        // Masa grubu yoksa atla
        if (!tableIdsRaw) continue;

        // Masa numaralarını parse et
        const tableIds = this.parseTableIds(tableIdsRaw);
        if (tableIds.length === 0) continue;

        // TEK MASADAN GRUP OLMAZ - Erkan'ın isteği: En az 3 masa olmalı
        // Loca değilse ve masa sayısı 3'ten azsa bu muhtemelen bir id veya yanlış veridir, atla.
        const isLoca =
          tableIds.some((t) => t.toUpperCase().includes("LOCA")) ||
          staffName.toUpperCase().includes("LOCA");

        if (!isLoca && tableIds.length < 3) {
          this.logger.debug(
            `[parseExcelData] Standart grup için yetersiz masa sayısı (${
              tableIds.length
            }), atlanıyor: ${staffName} -> ${tableIds.join(",")}`
          );
          continue;
        }

        // Vardiya saatlerini parse et
        const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);

        // Extra personel mi?
        if (colSet.isExtra) {
          const extraPerson: ParsedExtraPersonnel = {
            staffName,
            tableIds,
            shiftStart,
            shiftEnd,
            isBackground:
              upperName.includes("BACKROUND") ||
              upperName.includes("BACKGROUND"),
          };

          if (!extraPerson.isBackground) {
            extraPersonnel.push(extraPerson);
            this.logger.log(
              `Extra personel eklendi: ${staffName} -> ${tableIds.join(",")}`
            );
          }
          continue;
        }

        // Normal personel - Grup oluştur
        const sortedTables = [...tableIds].sort(
          (a, b) => parseInt(a) - parseInt(b)
        );
        // Benzersiz key için masa numaralarını kullan, ama gösterim için GRUP X
        const groupKey = sortedTables.join("-");

        // Personeli eşleştir
        const matchResult = this.matchStaff(staffName, staffNameMap, allStaff);

        // Grubu bul veya oluştur
        let group = groupMap.get(groupKey);
        if (!group) {
          const groupName = isLoca
            ? `LOCA ${groupCounter}`
            : `GRUP ${groupCounter}`;
          group = {
            name: groupName,
            color: this.GROUP_COLORS[colorIndex % this.GROUP_COLORS.length],
            tableIds: [],
            groupType: isLoca ? "loca" : "standard",
            assignments: [],
          };
          groupMap.set(groupKey, group);
          colorIndex++;
          groupCounter++;
        }

        // Masa ID'lerini gruba ekle
        tableIds.forEach((tid) => {
          if (!group!.tableIds.includes(tid)) {
            group!.tableIds.push(tid);
          }
        });

        // Atamayı oluştur
        const assignment: ParsedStaffAssignment = {
          staffName,
          staffId: matchResult.staff?.id,
          tableIds,
          shiftStart,
          shiftEnd,
          groupName: group.name,
          groupColor: group.color,
          assignmentType: isLoca ? "loca" : "table",
          matchConfidence: matchResult.confidence,
          matchedStaff: matchResult.staff
            ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
            : undefined,
          warnings: matchResult.warnings,
        };

        group.assignments.push(assignment);
        this.logger.log(
          `Personel eklendi: ${staffName} -> ${tableIds.join(",")} (${
            group.name
          })`
        );

        // Eşleşmeyen personeli kaydet
        if (!matchResult.staff && !unmatchedStaff.includes(staffName)) {
          unmatchedStaff.push(staffName);
        }

        // Uyarıları ekle
        if (matchResult.warnings) {
          warnings.push(...matchResult.warnings);
        }
      }
    }

    // Map'i array'e çevir
    groupMap.forEach((group) => groups.push(group));

    // Grupları sırala
    groups.sort((a, b) => {
      const aNum = parseInt(a.name.replace(/\D/g, "")) || 999;
      const bNum = parseInt(b.name.replace(/\D/g, "")) || 999;
      return aNum - bNum;
    });

    this.logger.log(
      `Sabit sütun parsing tamamlandı: ${groups.length} grup, ${extraPersonnel.length} extra personel`
    );

    // ============================================================
    // ESKİ DİNAMİK PARSING (Kaptan, Süpervizör, Hizmet Noktaları için)
    // ============================================================

    // Hizmet Noktası, Extra Personel ve Destek Ekibi başlıklarını tespit et
    let currentServicePoint: ParsedServicePoint | null = null;
    let currentSupportTeam: ParsedSupportTeam | null = null;
    let isExtraPersonelSection = false;
    let isSupportTeamSection = false;
    let isCaptainSection = false;
    let isSupervisorSection = false;
    let isLocaCaptainSection = false;
    let isTableAssignmentSection = false; // POSTA başlığı altındaki masa atamaları

    // Her satırı işle
    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      const firstCell = this.cleanCellValue(row[0]);
      const upperFirstCell = firstCell.toUpperCase();

      // TÜM HÜCRELERİ BİRLEŞTİR - Bölüm başlıkları herhangi bir hücrede olabilir
      const allCellsText = row.map((c) => this.cleanCellValue(c)).join(" ");
      const allCellsUpper = allCellsText.toUpperCase();

      // "DESTEK EKİBİ" başlığını tespit et - HERHANGİ BİR HÜCREDE OLABİLİR
      if (
        allCellsUpper.includes("DESTEK") &&
        allCellsUpper.includes("EKİBİ") &&
        !isSupportTeamSection
      ) {
        isSupportTeamSection = true;
        isExtraPersonelSection = false;
        isCaptainSection = false;
        isSupervisorSection = false;
        isLocaCaptainSection = false;
        currentServicePoint = null;

        // Destek ekibi adını bul - herhangi bir hücrede olabilir
        for (let i = 0; i < row.length; i++) {
          const cellValue = this.cleanCellValue(row[i]);
          const cellUpper = cellValue.toUpperCase();
          if (cellUpper.includes("DESTEK") && cellUpper.includes("EKİBİ")) {
            const teamName = cellValue.trim();
            if (!supportTeamMap.has(teamName)) {
              currentSupportTeam = {
                name: teamName,
                color:
                  SUPPORT_TEAM_COLORS[
                    supportTeamMap.size % SUPPORT_TEAM_COLORS.length
                  ],
                members: [],
              };
              supportTeamMap.set(teamName, currentSupportTeam);
              this.logger.log(`Destek ekibi bulundu: ${teamName} (hücre ${i})`);
            } else {
              currentSupportTeam = supportTeamMap.get(teamName)!;
            }
            break;
          }
        }
        continue;
      }

      // "EXTRA PERSONEL" başlığını tespit et - HERHANGİ BİR HÜCREDE OLABİLİR
      if (
        allCellsUpper.includes("EXTRA") &&
        allCellsUpper.includes("PERSONEL") &&
        !isExtraPersonelSection
      ) {
        // Başlık satırı mı kontrol et (POSTA, SAAT kelimeleri varsa başlık)
        if (allCellsUpper.includes("POSTA") || allCellsUpper.includes("SAAT")) {
          isExtraPersonelSection = true;
          isSupportTeamSection = false;
          isCaptainSection = false;
          isSupervisorSection = false;
          isLocaCaptainSection = false;
          isTableAssignmentSection = false;
          currentServicePoint = null;
          currentSupportTeam = null;
          this.logger.log(`Extra Personel bölümü bulundu: satır ${rowIndex}`);
          continue;
        }
      }

      // "PERSONEL | POZİSYON | POSTA | SAAT" başlık satırını tespit et - MASA ATAMALARI BÖLÜMÜ
      // Bu başlık satırı EXTRA PERSONEL veya DESTEK EKİBİ değilse, masa atamaları bölümüdür
      if (
        allCellsUpper.includes("POSTA") &&
        allCellsUpper.includes("SAAT") &&
        (allCellsUpper.includes("PERSONEL") ||
          allCellsUpper.includes("POZİSYON")) &&
        !allCellsUpper.includes("EXTRA") &&
        !allCellsUpper.includes("DESTEK") &&
        !allCellsUpper.includes("EKİBİ")
      ) {
        isTableAssignmentSection = true;
        isLocaCaptainSection = false;
        isExtraPersonelSection = false;
        isSupportTeamSection = false;
        isCaptainSection = false;
        isSupervisorSection = false;
        currentServicePoint = null;
        currentSupportTeam = null;
        this.logger.log(`Masa Atamaları bölümü bulundu: satır ${rowIndex}`);
        continue;
      }

      // LOCA başlığını tespit et (Loca kaptanları bölümü - yeşil başlık) - HERHANGİ BİR HÜCREDE
      // NOT: Başlık satırlarını (PERSONEL, POZİSYON, POSTA, SAAT içeren) loca bölümü olarak algılama!
      let locaHeaderFound = false;
      if (
        !allCellsUpper.includes("POZİSYON") &&
        !allCellsUpper.includes("POSTA") &&
        !allCellsUpper.includes("SAAT")
      ) {
        for (let i = 0; i < row.length; i++) {
          const cellValue = this.cleanCellValue(row[i]);
          const cellUpper = cellValue.toUpperCase();
          // Sadece "LOCA" yazıyorsa (LOCA 1-2 gibi değil) ve tek başına bir hücredeyse
          if (
            (cellUpper === "LOCA" ||
              (cellUpper.startsWith("LOCA") &&
                cellUpper.length <= 6 &&
                !cellUpper.match(/LOCA\s*\d/))) &&
            row.filter((c) => this.cleanCellValue(c)).length <= 3 // Satırda az hücre varsa başlık
          ) {
            isLocaCaptainSection = true;
            isCaptainSection = false;
            isSupervisorSection = false;
            isExtraPersonelSection = false;
            isSupportTeamSection = false;
            currentServicePoint = null;
            currentSupportTeam = null;
            this.logger.log(
              `Loca Kaptanları bölümü bulundu: satır ${rowIndex}, hücre ${i}`
            );
            locaHeaderFound = true;
            break;
          }
        }
      }
      if (locaHeaderFound) continue;

      if (isLocaCaptainSection && rowIndex > 0) {
        // Loca kaptanı satırını parse et
        const locaCaptain = this.parseLocaCaptainRow(
          row,
          staffNameMap,
          allStaff
        );
        if (locaCaptain) {
          locaCaptains.push(locaCaptain);
          this.logger.log(`Loca kaptanı eklendi: ${locaCaptain.staffName}`);
          if (
            !locaCaptain.staffId &&
            !unmatchedStaff.includes(locaCaptain.staffName)
          ) {
            unmatchedStaff.push(locaCaptain.staffName);
          }
          continue;
        }
      }

      // "GENEL ALAN KONTROL" gibi özel görevleri tespit et - HERHANGİ BİR HÜCREDE
      if (
        allCellsUpper.includes("GENEL ALAN") ||
        (allCellsUpper.includes("KONTROL") && allCellsUpper.includes("BACK"))
      ) {
        // Bu bir başlık satırı, sonraki satırda personel bilgisi olacak
        continue;
      }

      // Hizmet noktası başlığı kontrolü - TÜM HÜCRELERDE ARA (BAR, DEPO, FUAYE içeren)
      let servicePointFound = false;
      for (let i = 0; i < row.length && !servicePointFound; i++) {
        const cellValue = this.cleanCellValue(row[i]);
        const servicePointMatch = this.detectServicePointHeader(cellValue, row);
        if (servicePointMatch) {
          isExtraPersonelSection = false;
          isSupportTeamSection = false;
          isCaptainSection = false;
          isSupervisorSection = false;
          isLocaCaptainSection = false;
          currentSupportTeam = null;
          const pointType = this.determineServicePointType(servicePointMatch);
          currentServicePoint = {
            name: servicePointMatch,
            pointType,
            color:
              SERVICE_POINT_COLORS[pointType] || SERVICE_POINT_COLORS.other,
            assignments: [],
          };
          servicePointMap.set(servicePointMatch, currentServicePoint);
          this.logger.log(
            `Hizmet noktası bulundu: ${servicePointMatch} (${pointType}) - hücre ${i}`
          );
          servicePointFound = true;
        }
      }
      if (servicePointFound) continue;

      // Destek Ekibi bölümündeyiz
      if (isSupportTeamSection && currentSupportTeam) {
        const member = this.parseSupportTeamRow(row);
        if (member) {
          // GELMEYECEK olanları atla
          if (!member.isNotComing) {
            currentSupportTeam.members.push(member);
            this.logger.log(
              `Destek ekibi üyesi eklendi: ${member.staffName} (${member.position})`
            );
          } else {
            this.logger.log(`Gelmeyecek personel atlandı: ${member.staffName}`);
          }
        }
        continue;
      }

      // Extra Personel bölümündeyiz
      if (isExtraPersonelSection) {
        const extraPerson = this.parseExtraPersonnelRow(row);
        if (extraPerson) {
          // BACKROUND olanları atla
          if (!extraPerson.isBackground) {
            extraPersonnel.push(extraPerson);
            this.logger.log(`Extra personel eklendi: ${extraPerson.staffName}`);
          } else {
            this.logger.log(
              `Background personel atlandı: ${extraPerson.staffName}`
            );
          }
        }
        continue;
      }

      // Masa Atamaları bölümündeyiz - POSTA başlığının altındaki satırlar
      if (isTableAssignmentSection) {
        const tableAssignment = this.parseTableAssignmentRow(
          row,
          staffNameMap,
          allStaff,
          groupMap,
          colorIndex
        );
        if (tableAssignment) {
          const { group, assignment, newColorIndex } = tableAssignment;
          colorIndex = newColorIndex;

          if (!groupMap.has(group.name)) {
            groupMap.set(group.name, group);
          }

          this.logger.log(
            `Masa ataması eklendi: ${
              assignment.staffName
            } -> ${assignment.tableIds.join(",")} (${group.name})`
          );

          if (
            !assignment.staffId &&
            !unmatchedStaff.includes(assignment.staffName)
          ) {
            unmatchedStaff.push(assignment.staffName);
          }
        }
        continue;
      }

      // Eğer aktif bir hizmet noktası varsa ve satırda personel bilgisi varsa
      if (currentServicePoint) {
        const staffAssignment = this.parseServicePointStaffRow(
          row,
          staffNameMap,
          allStaff
        );
        if (staffAssignment) {
          currentServicePoint.assignments.push(staffAssignment);

          // Eşleşmeyen personeli kaydet
          if (
            !staffAssignment.staffId &&
            !unmatchedStaff.includes(staffAssignment.staffName)
          ) {
            unmatchedStaff.push(staffAssignment.staffName);
          }
          continue;
        }
      }

      // Loca Kaptanları bölümündeyiz
      if (isLocaCaptainSection) {
        const locaCaptain = this.parseLocaCaptainRow(
          row,
          staffNameMap,
          allStaff
        );
        if (locaCaptain) {
          locaCaptains.push(locaCaptain);
          this.logger.log(
            `Loca kaptanı eklendi: ${locaCaptain.staffName} (${
              locaCaptain.area || "LOCA"
            })`
          );
          if (
            !locaCaptain.staffId &&
            !unmatchedStaff.includes(locaCaptain.staffName)
          ) {
            unmatchedStaff.push(locaCaptain.staffName);
          }
        }
        continue;
      }

      // Hiçbir özel bölümde değilsek - Kaptan ve Süpervizör tespiti yap
      if (
        !isExtraPersonelSection &&
        !isSupportTeamSection &&
        !currentServicePoint
      ) {
        // Kaptan satırlarını tespit et (yeşil satırlar - CAPTAIN, J. CAPTAIN, INCHARGE)
        const captainMatch = this.detectCaptainRow(row);
        if (captainMatch) {
          const captain = this.parseCaptainRow(row, staffNameMap, allStaff);
          if (captain) {
            captains.push(captain);
            this.logger.log(
              `Kaptan eklendi: ${captain.staffName} (${captain.position})`
            );
            if (
              !captain.staffId &&
              !unmatchedStaff.includes(captain.staffName)
            ) {
              unmatchedStaff.push(captain.staffName);
            }
          }
          continue;
        }

        // Süpervizör satırlarını tespit et (turuncu satırlar - SPVR)
        const supervisorMatch = this.detectSupervisorRow(row);
        if (supervisorMatch) {
          const supervisor = this.parseSupervisorRow(
            row,
            staffNameMap,
            allStaff
          );
          if (supervisor) {
            supervisors.push(supervisor);
            this.logger.log(
              `Süpervizör eklendi: ${supervisor.staffName} (${
                supervisor.area || "GENEL"
              })`
            );
            if (
              !supervisor.staffId &&
              !unmatchedStaff.includes(supervisor.staffName)
            ) {
              unmatchedStaff.push(supervisor.staffName);
            }
          }
          continue;
        }
      }

      // NOT: Masa grupları artık sabit sütun yapısı ile yukarıda parse ediliyor
      // Bu döngü sadece Kaptan, Süpervizör, Hizmet Noktaları için kullanılıyor
    }

    // Map'i array'e çevir (sadece hizmet noktaları ve destek ekipleri için)
    servicePointMap.forEach((sp) => servicePoints.push(sp));
    supportTeamMap.forEach((team) => supportTeams.push(team));

    return {
      groups,
      servicePoints,
      extraPersonnel,
      supportTeams,
      captains,
      supervisors,
      locaCaptains,
      unmatchedStaff,
      warnings,
    };
  }

  /**
   * Destek ekibi satırını parse et
   * Format: İSİM | POZİSYON | POSTA/MASA | SAAT
   * Örnek: Sabri Ölmez | SPVR | POSTA 3 | 17:00-04:00
   */
  private parseSupportTeamRow(row: any[]): ParsedSupportTeamMember | null {
    // Satırdaki tüm hücreleri kontrol et
    let staffName = "";
    let position = "";
    let assignment = "";
    let shiftRaw = "";

    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

      // Başlık satırlarını atla
      if (
        upperCell === "POZİSYON" ||
        upperCell === "POSTA" ||
        upperCell === "SAAT" ||
        upperCell.includes("DESTEK") ||
        upperCell.includes("EKİBİ")
      ) {
        return null;
      }

      // Pozisyon tespiti (SPVR, CAPTAIN, PERSONEL)
      if (
        !position &&
        (upperCell === "SPVR" ||
          upperCell === "CAPTAIN" ||
          upperCell === "PERSONEL")
      ) {
        position = upperCell;
        continue;
      }

      // GELMEYECEK tespiti
      if (upperCell.includes("GELMEYECEK")) {
        // İsim zaten alınmış olmalı
        if (staffName) {
          return {
            staffName,
            position: position || "PERSONEL",
            assignment: "GELMEYECEK",
            tableIds: [],
            shiftStart: "17:00",
            shiftEnd: "04:00",
            isNotComing: true,
          };
        }
        continue;
      }

      // İsim tespiti (sayı içermeyen, en az 2 karakter)
      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      // Posta veya masa numaraları tespiti
      if (staffName && !assignment) {
        // POSTA X formatı
        if (upperCell.includes("POSTA")) {
          assignment = cellValue;
          continue;
        }
        // Masa numaraları (16-17-26-27)
        if (/^\d+[-\d]*$/.test(cellValue.replace(/\s/g, ""))) {
          assignment = cellValue;
          continue;
        }
        // BAR, GENEL ALAN KONTROL gibi özel görevler
        if (
          upperCell.includes("BAR") ||
          upperCell.includes("GENEL") ||
          upperCell.includes("KONTROL")
        ) {
          assignment = cellValue;
          continue;
        }
      }

      // Vardiya tespiti (saat formatı)
      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    // İsim yoksa geçersiz satır
    if (!staffName) return null;

    // Masa numaralarını parse et
    const tableIds = this.parseTableIds(assignment);

    // Vardiya saatlerini parse et
    const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);

    return {
      staffName,
      position: position || "PERSONEL",
      assignment: assignment || "-",
      tableIds,
      shiftStart,
      shiftEnd,
      isNotComing: false,
    };
  }

  /**
   * Kaptan satırını tespit et (CAPTAIN, J. CAPTAIN, INCHARGE)
   * Excel yapısı: Sütun 6-9'da kaptanlar bulunur
   * Sütun 1-5'teki SPVR'ler süpervizördür, kaptan değil!
   */
  private detectCaptainRow(row: any[]): boolean {
    // Sütun 6-9 arasında CAPTAIN, J. CAPTAIN, INCHARGE ara
    // Bu sütunlar gerçek kaptanların bulunduğu bölüm
    for (let i = 6; i <= 9 && i < row.length; i++) {
      const cellValue = this.cleanCellValue(row[i]).toUpperCase();
      if (
        cellValue === "CAPTAIN" ||
        cellValue === "J. CAPTAIN" ||
        cellValue.includes("J.CAPTAIN") ||
        cellValue === "INCHARGE"
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Süpervizör satırını tespit et (SPVR)
   * Excel yapısı: Sütun 1-5'te süpervizörler bulunur (SPVR pozisyonlu)
   * ASST. FB MNG gibi pozisyonlar yönetici, süpervizör değil
   */
  private detectSupervisorRow(row: any[]): boolean {
    // Sütun 1-5 arasında SPVR ara (sadece SPVR, ASST. FB MNG değil)
    for (let i = 0; i <= 5 && i < row.length; i++) {
      const cellValue = this.cleanCellValue(row[i]).toUpperCase();
      if (cellValue === "SPVR") {
        return true;
      }
    }
    return false;
  }

  /**
   * Kaptan satırını parse et (Sütun 6-9)
   * Format: [6]:İSİM | [7]:CAPTAIN/J. CAPTAIN/INCHARGE | [8]:ALAN | [9]:SAAT
   */
  private parseCaptainRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[]
  ): ParsedCaptain | null {
    let staffName = "";
    let position: "CAPTAIN" | "J. CAPTAIN" | "INCHARGE" = "CAPTAIN";
    let shiftRaw = "";
    let area = "";

    // Sütun 6-9 arasında parse et (gerçek kaptan bölümü)
    for (let i = 6; i <= 9 && i < row.length; i++) {
      const cellValue = this.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

      // Pozisyon tespiti
      if (
        upperCell === "CAPTAIN" ||
        upperCell === "J. CAPTAIN" ||
        upperCell.includes("J.CAPTAIN") ||
        upperCell === "INCHARGE"
      ) {
        if (upperCell.includes("J.CAPTAIN") || upperCell === "J. CAPTAIN") {
          position = "J. CAPTAIN";
        } else if (upperCell === "INCHARGE") {
          position = "INCHARGE";
        } else {
          position = "CAPTAIN";
        }
        continue;
      }

      // Alan tespiti (SALON, LOCA)
      if (upperCell.includes("SALON") || upperCell.includes("LOCA")) {
        area = upperCell.includes("SALON") ? "SALON" : "LOCA";
        continue;
      }

      // İsim tespiti (sayı içermeyen, en az 2 karakter)
      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü.\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      // Vardiya tespiti
      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);
    const matchResult = this.matchStaff(staffName, staffNameMap, allStaff);

    return {
      staffName,
      staffId: matchResult.staff?.id,
      position,
      shiftStart,
      shiftEnd,
      area: area || undefined,
      matchConfidence: matchResult.confidence,
      matchedStaff: matchResult.staff
        ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
        : undefined,
    };
  }

  /**
   * Süpervizör satırını parse et
   * Format: İSİM | SPVR | SAAT | (LOCA)
   */
  private parseSupervisorRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[]
  ): ParsedSupervisor | null {
    let staffName = "";
    let shiftRaw = "";
    let area = "";

    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

      // SPVR'ı atla
      if (upperCell === "SPVR") continue;

      // Alan tespiti (LOCA, SALON)
      if (upperCell.includes("LOCA")) {
        area = "LOCA";
        // Vardiya bilgisi de aynı hücrede olabilir (16:00--K (LOCA))
        const timeMatch = cellValue.match(/(\d{1,2}[:.]\d{2})/);
        if (timeMatch && !shiftRaw) {
          shiftRaw = cellValue;
        }
        continue;
      }

      if (upperCell.includes("SALON")) {
        area = "SALON";
        continue;
      }

      // İsim tespiti
      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      // Vardiya tespiti
      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);
    const matchResult = this.matchStaff(staffName, staffNameMap, allStaff);

    return {
      staffName,
      staffId: matchResult.staff?.id,
      position: "SPVR",
      shiftStart,
      shiftEnd,
      area: area || undefined,
      matchConfidence: matchResult.confidence,
      matchedStaff: matchResult.staff
        ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
        : undefined,
    };
  }

  /**
   * Loca kaptanı satırını parse et
   * Format: İSİM | SAAT | (SALON)
   */
  private parseLocaCaptainRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[]
  ): ParsedLocaCaptain | null {
    let staffName = "";
    let shiftRaw = "";
    let area = "";

    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

      // LOCA başlığını atla
      if (upperCell === "LOCA") continue;

      // Alan tespiti (SALON)
      if (upperCell.includes("SALON")) {
        area = "SALON";
        // Vardiya bilgisi de aynı hücrede olabilir
        const timeMatch = cellValue.match(/(\d{1,2}[:.]\d{2})/);
        if (timeMatch && !shiftRaw) {
          shiftRaw = cellValue;
        }
        continue;
      }

      // İsim tespiti
      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      // Vardiya tespiti
      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);
    const matchResult = this.matchStaff(staffName, staffNameMap, allStaff);

    return {
      staffName,
      staffId: matchResult.staff?.id,
      shiftStart,
      shiftEnd,
      area: area || undefined,
      matchConfidence: matchResult.confidence,
      matchedStaff: matchResult.staff
        ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
        : undefined,
    };
  }

  /**
   * Hizmet noktası başlığını tespit et
   * BAR, DEPO, FUAYE, CASINO içeren satırları tespit eder
   */
  private detectServicePointHeader(
    firstCell: string,
    row: any[]
  ): string | null {
    if (!firstCell) return null;

    const upperCell = firstCell.toUpperCase();

    // Hizmet noktası anahtar kelimeleri
    const keywords = ["BAR", "DEPO", "FUAYE", "CASINO", "LOUNGE", "VIP"];

    // Satırda sadece başlık varsa (personel bilgisi yoksa)
    const hasKeyword = keywords.some((kw) => upperCell.includes(kw));

    if (hasKeyword) {
      // Satırın geri kalanında vardiya bilgisi var mı kontrol et
      // Eğer yoksa bu bir başlık satırıdır
      const hasShiftInfo = row.some((cell) => {
        const cellStr = this.cleanCellValue(cell);
        return cellStr && /\d{1,2}[:.]\d{2}/.test(cellStr);
      });

      // Başlık satırı: Sadece isim var, vardiya yok veya çok az hücre dolu
      const filledCells = row.filter((c) => this.cleanCellValue(c)).length;

      if (filledCells <= 2 || !hasShiftInfo) {
        return firstCell.trim();
      }
    }

    return null;
  }

  /**
   * Hizmet noktası tipini belirle
   */
  private determineServicePointType(
    name: string
  ): "bar" | "depo" | "fuaye" | "casino" | "other" {
    const upperName = name.toUpperCase();

    if (upperName.includes("DEPO")) return "depo";
    if (upperName.includes("CASINO")) return "casino";
    if (upperName.includes("FUAYE") || upperName.includes("LOUNGE"))
      return "fuaye";
    if (upperName.includes("BAR")) return "bar";

    return "other";
  }

  /**
   * Hizmet noktası personel satırını parse et
   */
  private parseServicePointStaffRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[]
  ): ParsedServicePointAssignment | null {
    // İlk hücrede personel adı olmalı
    const staffName = this.cleanCellValue(row[0]);
    if (!staffName) return null;

    // Hizmet noktası başlığı değilse (BAR, DEPO vb. içermiyorsa)
    const upperName = staffName.toUpperCase();
    const isHeader = ["BAR", "DEPO", "FUAYE", "CASINO", "LOUNGE", "VIP"].some(
      (kw) => upperName.includes(kw)
    );
    if (isHeader) return null;

    // Vardiya bilgisini bul (satırdaki herhangi bir hücrede olabilir)
    let shiftRaw = "";
    for (let i = 1; i < row.length; i++) {
      const cellValue = this.cleanCellValue(row[i]);
      if (cellValue && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        break;
      }
    }

    // Vardiya yoksa bile personeli ekle (default vardiya ile)
    const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);

    // Personeli eşleştir
    const matchResult = this.matchStaff(staffName, staffNameMap, allStaff);

    return {
      staffName,
      staffId: matchResult.staff?.id,
      shiftStart,
      shiftEnd,
      matchConfidence: matchResult.confidence,
      matchedStaff: matchResult.staff
        ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
        : undefined,
    };
  }

  /**
   * Extra Personel satırını parse et
   * Format: İSİM SOYAD | MASA NUMARALARI | VARDİYA
   * Örnek: MERYEM ZAMANI | 99-100-114-115 | 17:00-04:00
   * BACKROUND olanları işaretle (atlanacak)
   */
  private parseExtraPersonnelRow(row: any[]): ParsedExtraPersonnel | null {
    // Satırdaki tüm hücreleri kontrol et
    let staffName = "";
    let tableIdsRaw = "";
    let shiftRaw = "";

    // Farklı sütun yapılarını dene
    // Format 1: [İsim, Posta/Masa, Saat]
    // Format 2: [İsim, , Posta/Masa, Saat]
    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.cleanCellValue(row[i]);
      if (!cellValue) continue;

      // İsim tespiti (sayı içermeyen, en az 2 kelime)
      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.includes(" ")
      ) {
        // Başlık satırlarını atla
        const upperCell = cellValue.toUpperCase();
        if (
          upperCell.includes("EXTRA") ||
          upperCell.includes("PERSONEL") ||
          upperCell.includes("POSTA") ||
          upperCell.includes("SAAT")
        ) {
          return null;
        }
        staffName = cellValue;
        continue;
      }

      // Masa numaraları tespiti (sayı ve tire içeren)
      if (
        staffName &&
        !tableIdsRaw &&
        /^\d+[-\d]*$/.test(cellValue.replace(/\s/g, ""))
      ) {
        tableIdsRaw = cellValue;
        continue;
      }

      // BACKROUND tespiti
      if (staffName && cellValue.toUpperCase().includes("BACKROUND")) {
        return {
          staffName,
          tableIds: [],
          shiftStart: "17:00",
          shiftEnd: "04:00",
          isBackground: true,
        };
      }

      // Vardiya tespiti (saat formatı)
      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    // İsim yoksa geçersiz satır
    if (!staffName) return null;

    // Masa numaralarını parse et
    const tableIds = this.parseTableIds(tableIdsRaw);

    // Vardiya saatlerini parse et
    const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);

    return {
      staffName,
      tableIds,
      shiftStart,
      shiftEnd,
      isBackground: false,
    };
  }

  /**
   * LOCA satırlarını parse et
   */
  private parseLocaRow(
    row: any[],
    groupMap: Map<string, ParsedGroup>,
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
    unmatchedStaff: string[],
    warnings: string[],
    colorIndex: number
  ): void {
    // LOCA pattern'lerini ara
    const locaPatterns = [
      /LOCA\s*(\d+)\s*[-–]\s*(\d+)/i,
      /LOCA\s*(\d+[AB]?)\s*[-–]\s*(\d+[AB]?)/i,
    ];

    for (let i = 0; i < row.length; i++) {
      const cellValue = this.cleanCellValue(row[i]);
      if (!cellValue) continue;

      for (const pattern of locaPatterns) {
        const match = cellValue.match(pattern);
        if (match) {
          const locaName = `LOCA-${match[1]}-${match[2]}`;
          const locaIds = [`LOCA-${match[1]}`, `LOCA-${match[2]}`];

          // Sonraki hücrelerde personel ve vardiya bilgisi ara
          const staffName =
            this.cleanCellValue(row[i + 1]) || this.cleanCellValue(row[i - 1]);
          const shiftRaw =
            this.cleanCellValue(row[i + 2]) || this.cleanCellValue(row[i + 1]);

          if (staffName && !staffName.includes("LOCA")) {
            const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);
            const matchResult = this.matchStaff(
              staffName,
              staffNameMap,
              allStaff
            );

            let group = groupMap.get(locaName);
            if (!group) {
              group = {
                name: locaName,
                color:
                  this.GROUP_COLORS[
                    (colorIndex + groupMap.size) % this.GROUP_COLORS.length
                  ],
                tableIds: locaIds,
                groupType: "loca",
                assignments: [],
              };
              groupMap.set(locaName, group);
            }

            // Aynı personel zaten eklenmemişse ekle
            const alreadyAdded = group.assignments.some(
              (a) => a.staffName.toLowerCase() === staffName.toLowerCase()
            );

            if (!alreadyAdded) {
              group.assignments.push({
                staffName,
                staffId: matchResult.staff?.id,
                tableIds: locaIds,
                shiftStart,
                shiftEnd,
                groupName: locaName,
                groupColor: group.color,
                assignmentType: "loca",
                matchConfidence: matchResult.confidence,
                matchedStaff: matchResult.staff
                  ? {
                      id: matchResult.staff.id,
                      fullName: matchResult.staff.fullName,
                    }
                  : undefined,
              });

              if (!matchResult.staff && !unmatchedStaff.includes(staffName)) {
                unmatchedStaff.push(staffName);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Personel adını normalize et
   */
  private normalizeStaffName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");
  }

  /**
   * Personeli eşleştir
   */
  private matchStaff(
    searchName: string,
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[]
  ): { staff: Staff | null; confidence: number; warnings?: string[] } {
    const normalizedSearch = this.normalizeStaffName(searchName);
    const warnings: string[] = [];

    // Tam eşleşme
    const exactMatch = staffNameMap.get(normalizedSearch);
    if (exactMatch) {
      return { staff: exactMatch, confidence: 100 };
    }

    // Kısmi eşleşme (isim veya soyisim)
    let bestMatch: Staff | null = null;
    let bestScore = 0;

    for (const staff of allStaff) {
      const normalizedStaff = this.normalizeStaffName(staff.fullName);
      const score = this.calculateSimilarity(normalizedSearch, normalizedStaff);

      if (score > bestScore && score >= 60) {
        bestScore = score;
        bestMatch = staff;
      }
    }

    if (bestMatch) {
      if (bestScore < 90) {
        warnings.push(
          `"${searchName}" → "${bestMatch.fullName}" olarak eşleştirildi (%${bestScore})`
        );
      }
      return { staff: bestMatch, confidence: bestScore, warnings };
    }

    warnings.push(`"${searchName}" için eşleşme bulunamadı`);
    return { staff: null, confidence: 0, warnings };
  }

  /**
   * İki string arasındaki benzerliği hesapla (Levenshtein tabanlı)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Kelime bazlı karşılaştırma
    const words1 = str1.split(" ").filter((w) => w.length > 1);
    const words2 = str2.split(" ").filter((w) => w.length > 1);

    let matchedWords = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
          matchedWords++;
          break;
        }
      }
    }

    const maxWords = Math.max(words1.length, words2.length);
    if (maxWords === 0) return 0;

    return Math.round((matchedWords / maxWords) * 100);
  }

  /**
   * Hücre değerini temizle
   */
  private cleanCellValue(value: any): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  /**
   * Masa numaralarını parse et
   */
  private parseTableIds(raw: string): string[] {
    if (!raw) return [];

    // "11-12-21-22-23" veya "116-117-132-133" formatını parse et
    const ids = raw
      .split(/[-–,\s]+/)
      .map((id) => id.trim())
      .filter((id) => id && /^\d+$/.test(id));

    return ids;
  }

  /**
   * Vardiya saatlerini parse et
   * "19:00-K" = 19:00-06:00 (K = Kapanış)
   * "12:00-K" = 12:00-06:00
   * "17:00-04:00" = normal format
   */
  private parseShift(raw: string): { shiftStart: string; shiftEnd: string } {
    if (!raw) return { shiftStart: "18:00", shiftEnd: "06:00" };

    // "19:00--00:00", "17:00-04:00", "16:00-K", "12:00--K" formatlarını parse et
    const cleanRaw = raw.replace(/\s+/g, "").replace(/--/g, "-").toUpperCase();

    // K = Kapanış (06:00 olarak varsay - gece kapanış saati)
    if (cleanRaw.includes("-K") || cleanRaw.endsWith("K")) {
      const startMatch = cleanRaw.match(/(\d{1,2}:\d{2})/);
      return {
        shiftStart: startMatch ? this.normalizeTime(startMatch[1]) : "18:00",
        shiftEnd: "06:00", // Kapanış saati
      };
    }

    // Normal format: "19:00-00:00" veya "19:00-02:00"
    const timeMatch = cleanRaw.match(/(\d{1,2}:\d{2})[^\d]*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      return {
        shiftStart: this.normalizeTime(timeMatch[1]),
        shiftEnd: this.normalizeTime(timeMatch[2]),
      };
    }

    // Sadece başlangıç saati varsa
    const singleMatch = cleanRaw.match(/(\d{1,2}:\d{2})/);
    if (singleMatch) {
      return {
        shiftStart: this.normalizeTime(singleMatch[1]),
        shiftEnd: "06:00", // Default kapanış
      };
    }

    return { shiftStart: "18:00", shiftEnd: "06:00" };
  }

  /**
   * Saat formatını normalize et (9:00 -> 09:00)
   */
  private normalizeTime(time: string): string {
    const parts = time.split(":");
    if (parts.length !== 2) return time;

    const hours = parts[0].padStart(2, "0");
    const minutes = parts[1].padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  /**
   * Grup adını belirle - Her POSTA satırı ayrı bir grup
   */
  private determineGroupName(
    tableIds: string[],
    row: any[],
    rowIndex?: number
  ): string {
    // Eğer rowIndex verilmişse, her satır ayrı bir POSTA (grup)
    if (rowIndex !== undefined) {
      return `POSTA-${rowIndex}`;
    }

    // Masa numaralarına göre benzersiz grup adı oluştur
    // Masaları sıralayıp birleştirerek benzersiz bir isim oluştur
    const sortedTables = [...tableIds].sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
    const firstTable = sortedTables[0];
    const lastTable = sortedTables[sortedTables.length - 1];

    // POSTA-İLKMASA-SONMASA formatı (örn: POSTA-11-23, POSTA-34-49)
    return `POSTA-${firstTable}-${lastTable}`;
  }

  /**
   * AI sonuçlarını klasik parsing sonuçlarıyla birleştir
   * AI sonuçları öncelikli, eksik olanlar klasik sonuçlardan tamamlanır
   */
  private mergeAIResults(
    classicResult: {
      groups: ParsedGroup[];
      servicePoints: ParsedServicePoint[];
      extraPersonnel: ParsedExtraPersonnel[];
      supportTeams: ParsedSupportTeam[];
      captains: ParsedCaptain[];
      supervisors: ParsedSupervisor[];
      locaCaptains: ParsedLocaCaptain[];
      unmatchedStaff: string[];
      warnings: string[];
    },
    aiResult: AIExcelParseResult | null,
    allStaff: Staff[]
  ): typeof classicResult {
    if (!aiResult) {
      return classicResult;
    }

    // Staff name map oluştur
    const staffNameMap = new Map<string, Staff>();
    allStaff.forEach((staff) => {
      const normalizedName = this.normalizeStaffName(staff.fullName);
      staffNameMap.set(normalizedName, staff);
    });

    const warnings = [...classicResult.warnings];
    const unmatchedStaff = [...classicResult.unmatchedStaff];

    // AI'dan gelen kaptanları işle
    const captains: ParsedCaptain[] = [];
    const captainNames = new Set<string>();

    // Önce AI kaptanlarını ekle
    for (const aiCaptain of aiResult.captains || []) {
      const matchResult = this.matchStaff(
        aiCaptain.name,
        staffNameMap,
        allStaff
      );
      const { shiftStart, shiftEnd } = this.parseShift(aiCaptain.shift);

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
      captainNames.add(this.normalizeStaffName(aiCaptain.name));

      if (!matchResult.staff && !unmatchedStaff.includes(aiCaptain.name)) {
        unmatchedStaff.push(aiCaptain.name);
      }
    }

    // Klasik sonuçlardan eksik kaptanları ekle
    for (const captain of classicResult.captains) {
      if (!captainNames.has(this.normalizeStaffName(captain.staffName))) {
        captains.push(captain);
      }
    }

    // AI'dan gelen süpervizörleri işle
    const supervisors: ParsedSupervisor[] = [];
    const supervisorNames = new Set<string>();

    for (const aiSupervisor of aiResult.supervisors || []) {
      const matchResult = this.matchStaff(
        aiSupervisor.name,
        staffNameMap,
        allStaff
      );
      const { shiftStart, shiftEnd } = this.parseShift(aiSupervisor.shift);

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
      supervisorNames.add(this.normalizeStaffName(aiSupervisor.name));

      if (!matchResult.staff && !unmatchedStaff.includes(aiSupervisor.name)) {
        unmatchedStaff.push(aiSupervisor.name);
      }
    }

    for (const supervisor of classicResult.supervisors) {
      if (!supervisorNames.has(this.normalizeStaffName(supervisor.staffName))) {
        supervisors.push(supervisor);
      }
    }

    // AI'dan gelen loca kaptanlarını işle
    const locaCaptains: ParsedLocaCaptain[] = [];
    const locaCaptainNames = new Set<string>();

    for (const aiLocaCaptain of aiResult.locaCaptains || []) {
      const matchResult = this.matchStaff(
        aiLocaCaptain.name,
        staffNameMap,
        allStaff
      );
      const { shiftStart, shiftEnd } = this.parseShift(aiLocaCaptain.shift);

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
      locaCaptainNames.add(this.normalizeStaffName(aiLocaCaptain.name));

      if (!matchResult.staff && !unmatchedStaff.includes(aiLocaCaptain.name)) {
        unmatchedStaff.push(aiLocaCaptain.name);
      }
    }

    for (const locaCaptain of classicResult.locaCaptains) {
      if (
        !locaCaptainNames.has(this.normalizeStaffName(locaCaptain.staffName))
      ) {
        locaCaptains.push(locaCaptain);
      }
    }

    // AI'dan gelen extra personeli işle
    const extraPersonnel: ParsedExtraPersonnel[] = [];
    const extraNames = new Set<string>();

    for (const aiExtra of aiResult.extraPersonnel || []) {
      if (aiExtra.isBackground) continue; // Background olanları atla

      const { shiftStart, shiftEnd } = this.parseShift(aiExtra.shift);
      const tableIds = this.parseTableIds(aiExtra.tables);

      extraPersonnel.push({
        staffName: aiExtra.name,
        tableIds,
        shiftStart,
        shiftEnd,
        isBackground: false,
      });
      extraNames.add(this.normalizeStaffName(aiExtra.name));
    }

    for (const extra of classicResult.extraPersonnel) {
      if (!extraNames.has(this.normalizeStaffName(extra.staffName))) {
        extraPersonnel.push(extra);
      }
    }

    // AI'dan gelen destek ekibi üyelerini işle
    const supportTeams: ParsedSupportTeam[] = [];
    const supportTeamMap = new Map<string, ParsedSupportTeam>();

    for (const aiMember of aiResult.supportTeamMembers || []) {
      if (aiMember.isNotComing) continue; // Gelmeyecek olanları atla

      const teamName = aiMember.teamName || "CRYSTAL DESTEK EKİBİ";
      let team = supportTeamMap.get(teamName);

      if (!team) {
        team = {
          name: teamName,
          color: "#22c55e",
          members: [],
        };
        supportTeamMap.set(teamName, team);
      }

      const { shiftStart, shiftEnd } = this.parseShift(aiMember.shift);
      const tableIds = this.parseTableIds(aiMember.assignment);

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

    // Klasik sonuçlardan eksik destek ekiplerini ekle
    for (const classicTeam of classicResult.supportTeams) {
      if (!supportTeamMap.has(classicTeam.name)) {
        supportTeams.push(classicTeam);
      }
    }

    // Service points ve groups için klasik sonuçları kullan (AI henüz bunları iyi parse etmiyor)
    const servicePoints = classicResult.servicePoints;
    const groups = classicResult.groups;

    this.logger.log(
      `AI merge sonucu: ${captains.length} kaptan (AI: ${
        aiResult.captains?.length || 0
      }), ` +
        `${supervisors.length} süpervizör (AI: ${
          aiResult.supervisors?.length || 0
        }), ` +
        `${locaCaptains.length} loca kaptanı (AI: ${
          aiResult.locaCaptains?.length || 0
        }), ` +
        `${extraPersonnel.length} extra (AI: ${
          aiResult.extraPersonnel?.length || 0
        }), ` +
        `${supportTeams.reduce(
          (s, t) => s + t.members.length,
          0
        )} destek üyesi (AI: ${aiResult.supportTeamMembers?.length || 0})`
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
   * Masa ataması satırını parse et (POSTA başlığı altındaki satırlar)
   * Excel Yapısı (Erkan'ın açıklaması):
   * - Sütun yapısı: İSİM | POZİSYON | POSTA (masa numaraları) | SAAT
   * - POZİSYON: PERSONEL, CAPTAIN, SPVR
   * - Eğer POZİSYON hücresinde bu değerler yoksa, o hücre de isim olabilir (Extra personel)
   * - POSTA: Tire ile ayrılmış masa numaraları (34-35-48-49)
   * - SAAT: Vardiya (17:00-04:00 veya 19:00--K, K=Kapanış=06:00)
   */
  private parseTableAssignmentRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
    groupMap: Map<string, ParsedGroup>,
    colorIndex: number
  ): {
    group: ParsedGroup;
    assignment: ParsedStaffAssignment;
    newColorIndex: number;
  } | null {
    // Satırdaki tüm hücreleri temizle
    const cells = row.map((c) => this.cleanCellValue(c));

    // Boş satırları atla
    const nonEmptyCells = cells.filter((c) => c);
    if (nonEmptyCells.length < 2) return null;

    // DEBUG: Satırı logla
    this.logger.debug(
      `[parseTableAssignmentRow] Cells: ${cells
        .map((c, i) => `[${i}]${c}`)
        .filter((c) => !c.endsWith("]"))
        .join(" | ")}`
    );

    // Sütun bazlı parsing - Excel yapısına göre
    let staffName = "";
    let position = "";
    let tableIdsRaw = "";
    let shiftRaw = "";

    // Her hücreyi sırayla kontrol et
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;

      const upperCell = cell.toUpperCase();

      // Başlık satırını atla - Sadece SATIRDA birden fazla başlık kelimesi varsa
      // Tek başına PERSONEL varsa bu pozisyon, başlık değil
      // Başlık satırı: PERSONEL | POZİSYON | POSTA | SAAT şeklinde olur
      // NOT: Burada return null yapmıyoruz çünkü "Masa Atamaları bölümü" tespiti zaten yapıldı
      // ve bu fonksiyon sadece veri satırları için çağrılıyor

      // Pozisyon tespiti (PERSONEL, CAPTAIN, SPVR) - ÖNCELİKLİ kontrol
      if (
        !position &&
        (upperCell === "PERSONEL" ||
          upperCell === "CAPTAIN" ||
          upperCell === "SPVR" ||
          upperCell === "J. CAPTAIN" ||
          upperCell.includes("J.CAPTAIN"))
      ) {
        position = upperCell;
        continue;
      }

      // POZİSYON, POSTA, SAAT başlık kelimeleri varsa atla (pozisyon hariç, yukarıda işlendi)
      if (
        upperCell === "POZİSYON" ||
        upperCell === "POSTA" ||
        upperCell === "SAAT"
      ) {
        continue; // return null yerine continue - sadece bu hücreyi atla
      }

      // Masa numaraları tespiti: Tire ile ayrılmış sayılar (34-35-48-49)
      // Sadece sayı ve tire içeren hücreler
      const cleanedCell = cell.replace(/\s/g, "");
      if (!tableIdsRaw && /^\d+(-\d+)*$/.test(cleanedCell)) {
        tableIdsRaw = cell;
        continue;
      }

      // Saat tespiti: XX:XX formatı veya K (Kapanış)
      if (!shiftRaw && (/\d{1,2}[:.]\d{2}/.test(cell) || upperCell === "K")) {
        shiftRaw = cell;
        continue;
      }

      // İsim tespiti: Sayı içermeyen, pozisyon olmayan
      if (!staffName && this.looksLikeStaffName(cell)) {
        staffName = cell;
        continue;
      }
    }

    // Gerekli bilgiler yoksa atla
    if (!staffName) {
      this.logger.debug(`[parseTableAssignmentRow] İsim bulunamadı, atlanıyor`);
      return null;
    }

    // Masa numaralarını parse et
    const tableIds = this.parseTableIds(tableIdsRaw);
    if (tableIds.length === 0) {
      this.logger.debug(
        `[parseTableAssignmentRow] Masa numarası bulunamadı: ${staffName}`
      );
      return null;
    }

    // TEK MASADAN GRUP OLMAZ - Erkan'ın isteği: En az 3 masa olmalı
    const isLoca =
      tableIds.some((t) => t.toUpperCase().includes("LOCA")) ||
      staffName.toUpperCase().includes("LOCA") ||
      (position && position.toUpperCase().includes("LOCA"));

    if (!isLoca && tableIds.length < 3) {
      this.logger.debug(
        `[parseTableAssignmentRow] Standart grup için yetersiz masa sayısı (${tableIds.length}), atlanıyor: ${staffName}`
      );
      return null;
    }

    // Vardiya saatlerini parse et
    const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);

    // Grup adını belirle - Benzersiz key için masa numaralarını kullan
    const sortedTables = [...tableIds].sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
    const groupKey = sortedTables.join("-");

    // Personeli eşleştir
    const matchResult = this.matchStaff(staffName, staffNameMap, allStaff);

    // Grubu bul veya oluştur
    let group = groupMap.get(groupKey);
    let newColorIndex = colorIndex;

    if (!group) {
      // Yeni grup numarası = mevcut grup sayısı + 1
      const groupNumber = groupMap.size + 1;
      const groupName = isLoca ? `LOCA ${groupNumber}` : `GRUP ${groupNumber}`;
      group = {
        name: groupName,
        color: this.GROUP_COLORS[colorIndex % this.GROUP_COLORS.length],
        tableIds: [],
        groupType: isLoca ? "loca" : "standard",
        assignments: [],
      };
      groupMap.set(groupKey, group);
      newColorIndex = colorIndex + 1;
    }

    // Masa ID'lerini gruba ekle
    tableIds.forEach((tid) => {
      if (!group!.tableIds.includes(tid)) {
        group!.tableIds.push(tid);
      }
    });

    // Atamayı oluştur
    const assignment: ParsedStaffAssignment = {
      staffName,
      staffId: matchResult.staff?.id,
      tableIds,
      shiftStart,
      shiftEnd,
      groupName: group.name,
      groupColor: group.color,
      assignmentType: isLoca ? "loca" : "table",
      position: position || undefined,
      matchConfidence: matchResult.confidence,
      matchedStaff: matchResult.staff
        ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
        : undefined,
      warnings: matchResult.warnings,
    };

    group.assignments.push(assignment);

    this.logger.debug(
      `[parseTableAssignmentRow] Atama: ${staffName} -> ${tableIds.join(
        ","
      )} (${group.name})`
    );

    return { group, assignment, newColorIndex };
  }

  /**
   * Değer bir personel ismi gibi görünüyor mu?
   */
  private looksLikeStaffName(value: string): boolean {
    if (!value || value.length < 2) return false;

    // Sayı içeriyorsa isim değil
    if (/\d/.test(value)) return false;

    // Bilinen başlıkları hariç tut
    const excludeWords = [
      "PERSONEL",
      "POZİSYON",
      "POSTA",
      "SAAT",
      "MASA",
      "LOCA",
      "BAR",
      "DEPO",
      "EXTRA",
      "DESTEK",
      "EKİBİ",
      "CAPTAIN",
      "SPVR",
      "INCHARGE",
      "ASST",
      "MNG",
      "FB",
    ];

    const upperValue = value.toUpperCase();
    for (const word of excludeWords) {
      if (
        upperValue === word ||
        upperValue.includes(word + " ") ||
        upperValue.includes(" " + word)
      ) {
        return false;
      }
    }

    // En az bir harf içermeli
    return /[A-ZÇĞİÖŞÜa-zçğıöşü]/.test(value);
  }

  /**
   * Excel Viewer Pro formatı ile parse et
   * Erkan'ın çalışan kodundaki sütun mapping'i:
   *
   * SOL TARAF:
   * - __EMPTY_1 → Ad Soyad (C sütunu)
   * - __EMPTY_2 → Pozisyon (D sütunu)
   * - __EMPTY_3 → Masa Grubu (E sütunu)
   * - __EMPTY_4 → Saat (F sütunu)
   *
   * SAĞ TARAF:
   * - __EMPTY_5 → Ad Soyad (G sütunu)
   * - __EMPTY_7 → Pozisyon (I sütunu)
   * - __EMPTY_8 → Masa Grubu (J sütunu)
   * - __EMPTY_9 → Saat (K sütunu)
   *
   * EXTRA PERSONEL:
   * - __EMPTY_17 → Ad Soyad (S sütunu)
   * - __EMPTY_20 → Masa Grubu (V sütunu)
   * - __EMPTY_21 → Saat (W sütunu)
   */
  private parseExcelViewerProFormat(
    jsonData: any[],
    allStaff: Staff[]
  ): {
    groups: ParsedGroup[];
    servicePoints: ParsedServicePoint[];
    extraPersonnel: ParsedExtraPersonnel[];
    unmatchedStaff: string[];
    warnings: string[];
  } {
    const groups: ParsedGroup[] = [];
    const groupMap = new Map<string, ParsedGroup>();
    const servicePoints: ParsedServicePoint[] = [];
    const servicePointMap = new Map<string, ParsedServicePoint>();
    const extraPersonnel: ParsedExtraPersonnel[] = [];
    const unmatchedStaff: string[] = [];
    const warnings: string[] = [];
    let colorIndex = 0;
    let groupCounter = 1;

    // Hizmet noktası renkleri
    const SERVICE_POINT_COLORS: Record<string, string> = {
      bar: "#06b6d4", // Cyan
      depo: "#8b5cf6", // Purple
      fuaye: "#f59e0b", // Amber
      casino: "#ef4444", // Red
      other: "#64748b", // Slate
    };

    // Staff name map oluştur
    const staffNameMap = new Map<string, Staff>();
    allStaff.forEach((staff) => {
      const normalizedName = this.normalizeStaffName(staff.fullName);
      staffNameMap.set(normalizedName, staff);
    });

    // Masa numarasını kontrol eden fonksiyon (sadece rakamlar ve "-" olmalı)
    const isValidMasaGrubu = (masa: string): boolean => {
      if (!masa || masa.trim() === "") return false;
      return /^[0-9\-\s]+$/.test(masa.trim());
    };

    // PERSONEL başlığını bul
    let personelBasladi = false;
    let ekstraPersonelBaslangicIndex = -1;

    // 1️⃣ İLK "EXTRA PERSONEL" SATIRINI BUL
    for (let i = 1; i < jsonData.length; i++) {
      const cellValue = jsonData[i]?.__EMPTY_17;
      if (
        cellValue &&
        cellValue.toString().toUpperCase().includes("EXTRA PERSONEL")
      ) {
        ekstraPersonelBaslangicIndex = i + 1;
        this.logger.log(`[ViewerPro] EXTRA PERSONEL bulundu: satır ${i}`);
        break;
      }
    }

    // 2️⃣ EXTRA PERSONEL ALT SATIRLARI OKU
    if (ekstraPersonelBaslangicIndex !== -1) {
      for (let i = ekstraPersonelBaslangicIndex; i < jsonData.length; i++) {
        const adSoyad = jsonData[i]?.__EMPTY_17;
        const masaGrubu = jsonData[i]?.__EMPTY_20;
        const vardiya = jsonData[i]?.__EMPTY_21;

        if (!adSoyad) break;

        const extraName = adSoyad.toString().trim();
        const extraMasalar = masaGrubu ? masaGrubu.toString().trim() : "";
        const extraSaat = vardiya ? vardiya.toString().trim() : "";

        if (extraMasalar && extraSaat && isValidMasaGrubu(extraMasalar)) {
          let formattedSaat = extraSaat;
          if (extraSaat.includes("-K") || extraSaat.includes("--K")) {
            const baslangic = extraSaat.split("-")[0];
            formattedSaat = `${baslangic}-06:00`;
          }

          const { shiftStart, shiftEnd } = this.parseShift(formattedSaat);

          extraPersonnel.push({
            staffName: extraName,
            tableIds: this.parseTableIds(extraMasalar),
            shiftStart,
            shiftEnd,
            isBackground:
              extraName.toUpperCase().includes("BACKROUND") ||
              extraName.toUpperCase().includes("BACKGROUND"),
          });

          this.logger.log(
            `[ViewerPro] Extra personel: ${extraName} -> ${extraMasalar}`
          );
        }
      }
    }

    // 3️⃣ NORMAL PERSONEL İŞLEMLERİ
    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      if (!row) continue;

      // Sol taraf (C sütunu - __EMPTY_1) kontrolü
      if (row.__EMPTY_1?.toString().toUpperCase().includes("PERSONEL")) {
        personelBasladi = true;
        continue;
      }

      // Sağ taraf (G sütunu - __EMPTY_6) kontrolü
      if (row.__EMPTY_6?.toString().toUpperCase().includes("PERSONEL")) {
        personelBasladi = true;
        continue;
      }

      if (personelBasladi && index > 0) {
        // SOL TARAF personel verileri
        const leftName = row.__EMPTY_1?.toString().trim();
        const leftPozisyon = row.__EMPTY_2?.toString().trim();
        const leftMasalar = row.__EMPTY_3?.toString().trim();
        const leftSaat = row.__EMPTY_4?.toString().trim();

        if (
          leftName &&
          leftName !== "" &&
          leftMasalar &&
          leftSaat &&
          isValidMasaGrubu(leftMasalar)
        ) {
          this.processPersonelRow(
            leftName,
            leftPozisyon,
            leftMasalar,
            leftSaat,
            "left",
            groupMap,
            staffNameMap,
            allStaff,
            unmatchedStaff,
            colorIndex,
            groupCounter
          );
          if (
            !groupMap.has(
              this.parseTableIds(leftMasalar)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .join("-")
            )
          ) {
            colorIndex++;
            groupCounter++;
          }
        }

        // SAĞ TARAF personel verileri
        const rightName = row.__EMPTY_5?.toString().trim();
        const rightPozisyon = row.__EMPTY_7?.toString().trim();
        const rightMasalar = row.__EMPTY_8?.toString().trim();
        const rightSaat = row.__EMPTY_9?.toString().trim();

        if (
          rightName &&
          rightName !== "" &&
          rightMasalar &&
          rightSaat &&
          isValidMasaGrubu(rightMasalar)
        ) {
          this.processPersonelRow(
            rightName,
            rightPozisyon,
            rightMasalar,
            rightSaat,
            "right",
            groupMap,
            staffNameMap,
            allStaff,
            unmatchedStaff,
            colorIndex,
            groupCounter
          );
          if (
            !groupMap.has(
              this.parseTableIds(rightMasalar)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .join("-")
            )
          ) {
            colorIndex++;
            groupCounter++;
          }
        }
      }
    }

    // 4️⃣ HİZMET NOKTALARI (BAR, DEPO, FUAYE, CASINO) PARSE ET
    let currentServicePoint: ParsedServicePoint | null = null;
    const servicePointKeywords = [
      "BAR",
      "DEPO",
      "FUAYE",
      "CASINO",
      "LOUNGE",
      "VIP",
    ];

    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      if (!row) continue;

      // Tüm hücreleri kontrol et - hizmet noktası başlığı ara
      for (const key of Object.keys(row)) {
        const cellValue = row[key]?.toString().trim();
        if (!cellValue) continue;

        const upperCell = cellValue.toUpperCase();

        // Hizmet noktası başlığı mı?
        const isServicePointHeader = servicePointKeywords.some((kw) =>
          upperCell.includes(kw)
        );

        if (isServicePointHeader) {
          // Satırda vardiya bilgisi var mı kontrol et
          const hasShiftInfo = Object.values(row).some((cell: any) => {
            const cellStr = cell?.toString() || "";
            return /\d{1,2}[:.]\d{2}/.test(cellStr);
          });

          // Dolu hücre sayısı
          const filledCells = Object.values(row).filter((c: any) =>
            c?.toString().trim()
          ).length;

          // Başlık satırı: Sadece isim var, vardiya yok veya çok az hücre dolu
          if (filledCells <= 3 || !hasShiftInfo) {
            const pointType = this.determineServicePointType(cellValue);

            if (!servicePointMap.has(cellValue)) {
              currentServicePoint = {
                name: cellValue,
                pointType,
                color:
                  SERVICE_POINT_COLORS[pointType] || SERVICE_POINT_COLORS.other,
                assignments: [],
              };
              servicePointMap.set(cellValue, currentServicePoint);
              this.logger.log(
                `[ViewerPro] Hizmet noktası bulundu: ${cellValue} (${pointType})`
              );
            } else {
              currentServicePoint = servicePointMap.get(cellValue)!;
            }
            break;
          }
        }
      }

      // Aktif hizmet noktası varsa, personel satırlarını parse et
      if (currentServicePoint) {
        // İlk hücrede personel adı olmalı
        const firstKey = Object.keys(row).find((k) =>
          row[k]?.toString().trim()
        );
        if (!firstKey) continue;

        const staffName = row[firstKey]?.toString().trim();
        if (!staffName) continue;

        const upperName = staffName.toUpperCase();

        // Başlık satırını atla
        if (servicePointKeywords.some((kw) => upperName.includes(kw))) continue;

        // Vardiya bilgisini bul
        let shiftRaw = "";
        for (const key of Object.keys(row)) {
          const cellValue = row[key]?.toString().trim();
          if (cellValue && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
            shiftRaw = cellValue;
            break;
          }
        }

        // Personel gibi görünüyorsa ekle
        if (this.looksLikeStaffName(staffName)) {
          const { shiftStart, shiftEnd } = this.parseShift(shiftRaw);
          const matchResult = this.matchStaff(
            staffName,
            staffNameMap,
            allStaff
          );

          currentServicePoint.assignments.push({
            staffName,
            staffId: matchResult.staff?.id,
            shiftStart,
            shiftEnd,
            matchConfidence: matchResult.confidence,
            matchedStaff: matchResult.staff
              ? {
                  id: matchResult.staff.id,
                  fullName: matchResult.staff.fullName,
                }
              : undefined,
          });

          if (!matchResult.staff && !unmatchedStaff.includes(staffName)) {
            unmatchedStaff.push(staffName);
          }

          this.logger.log(
            `[ViewerPro] Hizmet noktası personeli: ${staffName} -> ${currentServicePoint.name}`
          );
        }
      }
    }

    // Map'leri array'e çevir
    groupMap.forEach((group) => groups.push(group));
    servicePointMap.forEach((sp) => servicePoints.push(sp));

    // Grupları sırala
    groups.sort((a, b) => {
      const aNum = parseInt(a.name.replace(/\D/g, "")) || 999;
      const bNum = parseInt(b.name.replace(/\D/g, "")) || 999;
      return aNum - bNum;
    });

    this.logger.log(
      `[ViewerPro] Parse tamamlandı: ${groups.length} grup, ${servicePoints.length} hizmet noktası, ${extraPersonnel.length} extra personel`
    );

    return { groups, servicePoints, extraPersonnel, unmatchedStaff, warnings };
  }

  /**
   * Personel satırını işle ve gruba ekle
   */
  private processPersonelRow(
    staffName: string,
    pozisyon: string | undefined,
    masalar: string,
    saat: string,
    section: "left" | "right",
    groupMap: Map<string, ParsedGroup>,
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
    unmatchedStaff: string[],
    colorIndex: number,
    groupCounter: number
  ): void {
    const tableIds = this.parseTableIds(masalar);
    if (tableIds.length === 0) return;

    // Saat formatını düzelt
    let formattedSaat = saat;
    if (saat.includes("-K") || saat.includes("--K")) {
      const baslangic = saat.split("-")[0];
      formattedSaat = `${baslangic}-06:00`;
    }

    const { shiftStart, shiftEnd } = this.parseShift(formattedSaat);

    // Grup key'i oluştur
    const sortedTables = [...tableIds].sort(
      (a, b) => parseInt(a) - parseInt(b)
    );
    const groupKey = sortedTables.join("-");

    // Loca kontrolü
    const isLoca =
      tableIds.some((t) => t.toUpperCase().includes("LOCA")) ||
      staffName.toUpperCase().includes("LOCA");

    // Personeli eşleştir
    const matchResult = this.matchStaff(staffName, staffNameMap, allStaff);

    // Grubu bul veya oluştur
    let group = groupMap.get(groupKey);
    if (!group) {
      const groupName = isLoca
        ? `LOCA ${groupCounter}`
        : `GRUP ${groupCounter}`;
      group = {
        name: groupName,
        color: this.GROUP_COLORS[colorIndex % this.GROUP_COLORS.length],
        tableIds: [],
        groupType: isLoca ? "loca" : "standard",
        assignments: [],
      };
      groupMap.set(groupKey, group);
    }

    // Masa ID'lerini gruba ekle
    tableIds.forEach((tid) => {
      if (!group!.tableIds.includes(tid)) {
        group!.tableIds.push(tid);
      }
    });

    // Atamayı oluştur
    const assignment: ParsedStaffAssignment = {
      staffName,
      staffId: matchResult.staff?.id,
      tableIds,
      shiftStart,
      shiftEnd,
      groupName: group.name,
      groupColor: group.color,
      assignmentType: isLoca ? "loca" : "table",
      position: pozisyon || undefined,
      matchConfidence: matchResult.confidence,
      matchedStaff: matchResult.staff
        ? { id: matchResult.staff.id, fullName: matchResult.staff.fullName }
        : undefined,
      warnings: matchResult.warnings,
    };

    group.assignments.push(assignment);

    // Eşleşmeyen personeli kaydet
    if (!matchResult.staff && !unmatchedStaff.includes(staffName)) {
      unmatchedStaff.push(staffName);
    }

    this.logger.debug(
      `[ViewerPro] ${section}: ${staffName} -> ${tableIds.join(",")} (${
        group.name
      })`
    );
  }

  /**
   * ViewerPro sonuçlarını klasik sonuçlarla birleştir
   * ViewerPro sonuçları öncelikli
   */
  private mergeViewerProResults(
    classicResult: {
      groups: ParsedGroup[];
      servicePoints: ParsedServicePoint[];
      extraPersonnel: ParsedExtraPersonnel[];
      supportTeams: ParsedSupportTeam[];
      captains: ParsedCaptain[];
      supervisors: ParsedSupervisor[];
      locaCaptains: ParsedLocaCaptain[];
      unmatchedStaff: string[];
      warnings: string[];
    },
    viewerProResult: {
      groups: ParsedGroup[];
      servicePoints: ParsedServicePoint[];
      extraPersonnel: ParsedExtraPersonnel[];
      unmatchedStaff: string[];
      warnings: string[];
    }
  ): typeof classicResult {
    // ViewerPro grupları varsa onları kullan, yoksa klasik
    const groups =
      viewerProResult.groups.length > 0
        ? viewerProResult.groups
        : classicResult.groups;

    // Service points birleştir (ViewerPro öncelikli)
    const servicePointNames = new Set(
      viewerProResult.servicePoints.map((sp) => sp.name.toUpperCase())
    );

    const servicePoints = [
      ...viewerProResult.servicePoints,
      ...classicResult.servicePoints.filter(
        (sp) => !servicePointNames.has(sp.name.toUpperCase())
      ),
    ];

    // Extra personeli birleştir (ViewerPro öncelikli)
    const extraNames = new Set(
      viewerProResult.extraPersonnel.map((e) =>
        this.normalizeStaffName(e.staffName)
      )
    );

    const extraPersonnel = [
      ...viewerProResult.extraPersonnel,
      ...classicResult.extraPersonnel.filter(
        (e) => !extraNames.has(this.normalizeStaffName(e.staffName))
      ),
    ];

    // Unmatched staff birleştir
    const unmatchedStaff = [
      ...new Set([
        ...viewerProResult.unmatchedStaff,
        ...classicResult.unmatchedStaff,
      ]),
    ];

    // Warnings birleştir
    const warnings = [...viewerProResult.warnings, ...classicResult.warnings];

    this.logger.log(
      `[ViewerPro Merge] Gruplar: ${groups.length} (VP: ${viewerProResult.groups.length}, Classic: ${classicResult.groups.length}), ` +
        `ServicePoints: ${servicePoints.length} (VP: ${viewerProResult.servicePoints.length}, Classic: ${classicResult.servicePoints.length}), ` +
        `Extra: ${extraPersonnel.length}`
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

  /**
   * Analiz sonucunu onayla ve veritabanına kaydet
   */
  async confirmAndSaveImport(
    eventId: string,
    analysisResult: AnalysisResult,
    options?: { clearExisting?: boolean }
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

      // Grupları kaydet
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

        // Atamaları kaydet
        for (const assignment of group.assignments) {
          if (!assignment.staffId) continue; // Eşleşmeyen personelleri atla

          const staffAssignment = this.assignmentRepository.create({
            eventId,
            staffId: assignment.staffId,
            tableIds: assignment.tableIds,
            assignmentType: assignment.assignmentType,
            color: group.color,
            isActive: true,
            // Vardiya bilgisini notes alanına kaydet
            notes: `Vardiya: ${assignment.shiftStart} - ${assignment.shiftEnd}`,
          });
          await this.assignmentRepository.save(staffAssignment);
          savedAssignments++;
        }
      }

      this.logger.log(
        `Import tamamlandı: ${savedGroups} grup, ${savedAssignments} atama`
      );

      return {
        success: true,
        savedGroups,
        savedAssignments,
      };
    } catch (error) {
      this.logger.error("Import kaydetme hatası:", error);
      throw new BadRequestException(`Import hatası: ${error.message}`);
    }
  }
}
