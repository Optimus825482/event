import { Injectable, Logger } from "@nestjs/common";
import { Staff } from "../../entities/staff.entity";
import { StaffMatcherService } from "./staff-matcher.service";
import {
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
  ParseResult,
  ViewerProParseResult,
  GROUP_COLORS,
  SERVICE_POINT_COLORS,
} from "./excel-import.types";

@Injectable()
export class ExcelParserService {
  private readonly logger = new Logger(ExcelParserService.name);

  constructor(private readonly staffMatcher: StaffMatcherService) {}

  /**
   * Excel verisini parse et (rawData - 2D array format)
   *
   * SÜTUN YAPISI (SABİT):
   * - Grup 1: B=1 (İsim), D=3 (Masa), E=4 (Saat)
   * - Grup 2: F=5 (İsim), I=8 (Masa), J=9 (Saat)
   * - Grup 3 (Extra): S=17 (İsim), U=20 (Masa), V=21 (Saat)
   */
  parseExcelData(rawData: any[][], allStaff: Staff[]): ParseResult {
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
    let groupCounter = 1;

    // Destek ekibi renkleri
    const SUPPORT_TEAM_COLORS = ["#22c55e", "#10b981", "#14b8a6", "#0d9488"];

    // Personel isimlerini normalize et
    const staffNameMap = this.staffMatcher.buildStaffNameMap(allStaff);

    // ============================================================
    // SABİT SÜTUN YAPISI İLE PARSE
    // ============================================================
    const COLUMN_SETS = [
      {
        name: "PERSONEL_1",
        nameCol: 1,
        tableCol: 3,
        shiftCol: 4,
        isExtra: false,
      },
      {
        name: "PERSONEL_2",
        nameCol: 5,
        tableCol: 8,
        shiftCol: 9,
        isExtra: false,
      },
      {
        name: "EXTRA_PERSONEL",
        nameCol: 17,
        tableCol: 20,
        shiftCol: 21,
        isExtra: true,
      },
    ];

    // Başlık satırını bul
    let headerRowIndex = -1;
    for (
      let rowIndex = 0;
      rowIndex < Math.min(rawData.length, 20);
      rowIndex++
    ) {
      const row = rawData[rowIndex];
      if (!row) continue;

      const cellC = this.staffMatcher.cleanCellValue(row[2])?.toUpperCase();
      const cellG = this.staffMatcher.cleanCellValue(row[6])?.toUpperCase();

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

      for (const colSet of COLUMN_SETS) {
        const staffName = this.staffMatcher.cleanCellValue(row[colSet.nameCol]);
        const tableIdsRaw = this.staffMatcher.cleanCellValue(
          row[colSet.tableCol],
        );
        const shiftRaw = this.staffMatcher.cleanCellValue(row[colSet.shiftCol]);

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

        if (!this.staffMatcher.looksLikeStaffName(staffName)) continue;
        if (!tableIdsRaw) continue;

        const tableIds = this.staffMatcher.parseTableIds(tableIdsRaw);
        if (tableIds.length === 0) continue;

        const isLoca =
          tableIds.some((t) => t.toUpperCase().includes("LOCA")) ||
          staffName.toUpperCase().includes("LOCA");

        if (!isLoca && tableIds.length < 3) {
          this.logger.debug(
            `[parseExcelData] Standart grup için yetersiz masa sayısı (${
              tableIds.length
            }), atlanıyor: ${staffName} -> ${tableIds.join(",")}`,
          );
          continue;
        }

        const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);

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
              `Extra personel eklendi: ${staffName} -> ${tableIds.join(",")}`,
            );
          }
          continue;
        }

        // Normal personel - Grup oluştur
        const sortedTables = [...tableIds].sort(
          (a, b) => parseInt(a) - parseInt(b),
        );
        const groupKey = sortedTables.join("-");

        const matchResult = this.staffMatcher.matchStaff(
          staffName,
          staffNameMap,
          allStaff,
        );

        let group = groupMap.get(groupKey);
        if (!group) {
          const groupName = isLoca
            ? `LOCA ${groupCounter}`
            : `GRUP ${groupCounter}`;
          group = {
            name: groupName,
            color: GROUP_COLORS[colorIndex % GROUP_COLORS.length],
            tableIds: [],
            groupType: isLoca ? "loca" : "standard",
            assignments: [],
          };
          groupMap.set(groupKey, group);
          colorIndex++;
          groupCounter++;
        }

        tableIds.forEach((tid) => {
          if (!group!.tableIds.includes(tid)) {
            group!.tableIds.push(tid);
          }
        });

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
          })`,
        );

        if (!matchResult.staff && !unmatchedStaff.includes(staffName)) {
          unmatchedStaff.push(staffName);
        }

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
      `Sabit sütun parsing tamamlandı: ${groups.length} grup, ${extraPersonnel.length} extra personel`,
    );

    // ============================================================
    // DİNAMİK PARSING (Kaptan, Süpervizör, Hizmet Noktaları için)
    // ============================================================

    let currentServicePoint: ParsedServicePoint | null = null;
    let currentSupportTeam: ParsedSupportTeam | null = null;
    let isExtraPersonelSection = false;
    let isSupportTeamSection = false;
    let isCaptainSection = false;
    let isSupervisorSection = false;
    let isLocaCaptainSection = false;
    let isTableAssignmentSection = false;

    for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
      const row = rawData[rowIndex];
      if (!row || row.length === 0) continue;

      const firstCell = this.staffMatcher.cleanCellValue(row[0]);
      const allCellsText = row
        .map((c) => this.staffMatcher.cleanCellValue(c))
        .join(" ");
      const allCellsUpper = allCellsText.toUpperCase();

      // "DESTEK EKİBİ" başlığını tespit et
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

        for (let i = 0; i < row.length; i++) {
          const cellValue = this.staffMatcher.cleanCellValue(row[i]);
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

      // "EXTRA PERSONEL" başlığını tespit et
      if (
        allCellsUpper.includes("EXTRA") &&
        allCellsUpper.includes("PERSONEL") &&
        !isExtraPersonelSection
      ) {
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

      // Masa Atamaları bölümü başlığı
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

      // LOCA başlığını tespit et
      let locaHeaderFound = false;
      if (
        !allCellsUpper.includes("POZİSYON") &&
        !allCellsUpper.includes("POSTA") &&
        !allCellsUpper.includes("SAAT")
      ) {
        for (let i = 0; i < row.length; i++) {
          const cellValue = this.staffMatcher.cleanCellValue(row[i]);
          const cellUpper = cellValue.toUpperCase();
          if (
            (cellUpper === "LOCA" ||
              (cellUpper.startsWith("LOCA") &&
                cellUpper.length <= 6 &&
                !cellUpper.match(/LOCA\s*\d/))) &&
            row.filter((c) => this.staffMatcher.cleanCellValue(c)).length <= 3
          ) {
            isLocaCaptainSection = true;
            isCaptainSection = false;
            isSupervisorSection = false;
            isExtraPersonelSection = false;
            isSupportTeamSection = false;
            currentServicePoint = null;
            currentSupportTeam = null;
            this.logger.log(
              `Loca Kaptanları bölümü bulundu: satır ${rowIndex}, hücre ${i}`,
            );
            locaHeaderFound = true;
            break;
          }
        }
      }
      if (locaHeaderFound) continue;

      if (isLocaCaptainSection && rowIndex > 0) {
        const locaCaptain = this.parseLocaCaptainRow(
          row,
          staffNameMap,
          allStaff,
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

      // "GENEL ALAN KONTROL" gibi özel görevler
      if (
        allCellsUpper.includes("GENEL ALAN") ||
        (allCellsUpper.includes("KONTROL") && allCellsUpper.includes("BACK"))
      ) {
        continue;
      }

      // Hizmet noktası başlığı kontrolü
      let servicePointFound = false;
      for (let i = 0; i < row.length && !servicePointFound; i++) {
        const cellValue = this.staffMatcher.cleanCellValue(row[i]);
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
            `Hizmet noktası bulundu: ${servicePointMatch} (${pointType}) - hücre ${i}`,
          );
          servicePointFound = true;
        }
      }
      if (servicePointFound) continue;

      // Destek Ekibi bölümündeyiz
      if (isSupportTeamSection && currentSupportTeam) {
        const member = this.parseSupportTeamRow(row);
        if (member) {
          if (!member.isNotComing) {
            currentSupportTeam.members.push(member);
            this.logger.log(
              `Destek ekibi üyesi eklendi: ${member.staffName} (${member.position})`,
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
          if (!extraPerson.isBackground) {
            extraPersonnel.push(extraPerson);
            this.logger.log(`Extra personel eklendi: ${extraPerson.staffName}`);
          } else {
            this.logger.log(
              `Background personel atlandı: ${extraPerson.staffName}`,
            );
          }
        }
        continue;
      }

      // Masa Atamaları bölümündeyiz
      if (isTableAssignmentSection) {
        const tableAssignment = this.parseTableAssignmentRow(
          row,
          staffNameMap,
          allStaff,
          groupMap,
          colorIndex,
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
            } -> ${assignment.tableIds.join(",")} (${group.name})`,
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

      // Aktif hizmet noktası varsa
      if (currentServicePoint) {
        const staffAssignment = this.parseServicePointStaffRow(
          row,
          staffNameMap,
          allStaff,
        );
        if (staffAssignment) {
          currentServicePoint.assignments.push(staffAssignment);

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
          allStaff,
        );
        if (locaCaptain) {
          locaCaptains.push(locaCaptain);
          this.logger.log(
            `Loca kaptanı eklendi: ${locaCaptain.staffName} (${
              locaCaptain.area || "LOCA"
            })`,
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

      // Hiçbir bölümde değilsek - Kaptan ve Süpervizör tespiti
      if (
        !isExtraPersonelSection &&
        !isSupportTeamSection &&
        !currentServicePoint
      ) {
        const captainMatch = this.detectCaptainRow(row);
        if (captainMatch) {
          const captain = this.parseCaptainRow(row, staffNameMap, allStaff);
          if (captain) {
            captains.push(captain);
            this.logger.log(
              `Kaptan eklendi: ${captain.staffName} (${captain.position})`,
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

        const supervisorMatch = this.detectSupervisorRow(row);
        if (supervisorMatch) {
          const supervisor = this.parseSupervisorRow(
            row,
            staffNameMap,
            allStaff,
          );
          if (supervisor) {
            supervisors.push(supervisor);
            this.logger.log(
              `Süpervizör eklendi: ${supervisor.staffName} (${
                supervisor.area || "GENEL"
              })`,
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
    }

    // Map'i array'e çevir
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
   * Excel Viewer Pro formatı ile parse et (jsonData - __EMPTY_X sütun mapping)
   */
  parseExcelViewerProFormat(
    jsonData: any[],
    allStaff: Staff[],
  ): ViewerProParseResult {
    const groups: ParsedGroup[] = [];
    const groupMap = new Map<string, ParsedGroup>();
    const servicePoints: ParsedServicePoint[] = [];
    const servicePointMap = new Map<string, ParsedServicePoint>();
    const extraPersonnel: ParsedExtraPersonnel[] = [];
    const unmatchedStaff: string[] = [];
    const warnings: string[] = [];
    let colorIndex = 0;
    let groupCounter = 1;

    const staffNameMap = this.staffMatcher.buildStaffNameMap(allStaff);

    const isValidMasaGrubu = (masa: string): boolean => {
      if (!masa || masa.trim() === "") return false;
      return /^[0-9\-\s]+$/.test(masa.trim());
    };

    // 1. EXTRA PERSONEL satırını bul
    let personelBasladi = false;
    let ekstraPersonelBaslangicIndex = -1;

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

    // 2. EXTRA PERSONEL alt satırları oku
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

          const { shiftStart, shiftEnd } =
            this.staffMatcher.parseShift(formattedSaat);

          extraPersonnel.push({
            staffName: extraName,
            tableIds: this.staffMatcher.parseTableIds(extraMasalar),
            shiftStart,
            shiftEnd,
            isBackground:
              extraName.toUpperCase().includes("BACKROUND") ||
              extraName.toUpperCase().includes("BACKGROUND"),
          });

          this.logger.log(
            `[ViewerPro] Extra personel: ${extraName} -> ${extraMasalar}`,
          );
        }
      }
    }

    // 3. NORMAL PERSONEL İŞLEMLERİ
    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      if (!row) continue;

      if (row.__EMPTY_1?.toString().toUpperCase().includes("PERSONEL")) {
        personelBasladi = true;
        continue;
      }

      if (row.__EMPTY_6?.toString().toUpperCase().includes("PERSONEL")) {
        personelBasladi = true;
        continue;
      }

      if (personelBasladi && index > 0) {
        // SOL TARAF
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
            groupCounter,
          );
          if (
            !groupMap.has(
              this.staffMatcher
                .parseTableIds(leftMasalar)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .join("-"),
            )
          ) {
            colorIndex++;
            groupCounter++;
          }
        }

        // SAĞ TARAF
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
            groupCounter,
          );
          if (
            !groupMap.has(
              this.staffMatcher
                .parseTableIds(rightMasalar)
                .sort((a, b) => parseInt(a) - parseInt(b))
                .join("-"),
            )
          ) {
            colorIndex++;
            groupCounter++;
          }
        }
      }
    }

    // 4. HİZMET NOKTALARI
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

      for (const key of Object.keys(row)) {
        const cellValue = row[key]?.toString().trim();
        if (!cellValue) continue;

        const upperCell = cellValue.toUpperCase();

        const isServicePointHeader = servicePointKeywords.some((kw) =>
          upperCell.includes(kw),
        );

        if (isServicePointHeader) {
          const hasShiftInfo = Object.values(row).some((cell: any) => {
            const cellStr = cell?.toString() || "";
            return /\d{1,2}[:.]\d{2}/.test(cellStr);
          });

          const filledCells = Object.values(row).filter((c: any) =>
            c?.toString().trim(),
          ).length;

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
                `[ViewerPro] Hizmet noktası bulundu: ${cellValue} (${pointType})`,
              );
            } else {
              currentServicePoint = servicePointMap.get(cellValue)!;
            }
            break;
          }
        }
      }

      // Aktif hizmet noktası - personel satırlarını parse et
      if (currentServicePoint) {
        const firstKey = Object.keys(row).find((k) =>
          row[k]?.toString().trim(),
        );
        if (!firstKey) continue;

        const staffName = row[firstKey]?.toString().trim();
        if (!staffName) continue;

        const upperName = staffName.toUpperCase();

        if (servicePointKeywords.some((kw) => upperName.includes(kw))) continue;

        let shiftRaw = "";
        for (const key of Object.keys(row)) {
          const cellValue = row[key]?.toString().trim();
          if (cellValue && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
            shiftRaw = cellValue;
            break;
          }
        }

        if (this.staffMatcher.looksLikeStaffName(staffName)) {
          const { shiftStart, shiftEnd } =
            this.staffMatcher.parseShift(shiftRaw);
          const matchResult = this.staffMatcher.matchStaff(
            staffName,
            staffNameMap,
            allStaff,
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
            `[ViewerPro] Hizmet noktası personeli: ${staffName} -> ${currentServicePoint.name}`,
          );
        }
      }
    }

    // Map'leri array'e çevir
    groupMap.forEach((group) => groups.push(group));
    servicePointMap.forEach((sp) => servicePoints.push(sp));

    groups.sort((a, b) => {
      const aNum = parseInt(a.name.replace(/\D/g, "")) || 999;
      const bNum = parseInt(b.name.replace(/\D/g, "")) || 999;
      return aNum - bNum;
    });

    this.logger.log(
      `[ViewerPro] Parse tamamlandı: ${groups.length} grup, ${servicePoints.length} hizmet noktası, ${extraPersonnel.length} extra personel`,
    );

    return { groups, servicePoints, extraPersonnel, unmatchedStaff, warnings };
  }

  // ============================================================
  // PRIVATE ROW PARSERS
  // ============================================================

  private parseSupportTeamRow(row: any[]): ParsedSupportTeamMember | null {
    let staffName = "";
    let position = "";
    let assignment = "";
    let shiftRaw = "";

    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

      if (
        upperCell === "POZİSYON" ||
        upperCell === "POSTA" ||
        upperCell === "SAAT" ||
        upperCell.includes("DESTEK") ||
        upperCell.includes("EKİBİ")
      ) {
        return null;
      }

      if (
        !position &&
        (upperCell === "SPVR" ||
          upperCell === "CAPTAIN" ||
          upperCell === "PERSONEL")
      ) {
        position = upperCell;
        continue;
      }

      if (upperCell.includes("GELMEYECEK")) {
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

      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      if (staffName && !assignment) {
        if (upperCell.includes("POSTA")) {
          assignment = cellValue;
          continue;
        }
        if (/^\d+[-\d]*$/.test(cellValue.replace(/\s/g, ""))) {
          assignment = cellValue;
          continue;
        }
        if (
          upperCell.includes("BAR") ||
          upperCell.includes("GENEL") ||
          upperCell.includes("KONTROL")
        ) {
          assignment = cellValue;
          continue;
        }
      }

      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const tableIds = this.staffMatcher.parseTableIds(assignment);
    const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);

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

  private detectCaptainRow(row: any[]): boolean {
    for (let i = 6; i <= 9 && i < row.length; i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]).toUpperCase();
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

  private detectSupervisorRow(row: any[]): boolean {
    for (let i = 0; i <= 5 && i < row.length; i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]).toUpperCase();
      if (cellValue === "SPVR") {
        return true;
      }
    }
    return false;
  }

  private parseCaptainRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
  ): ParsedCaptain | null {
    let staffName = "";
    let position: "CAPTAIN" | "J. CAPTAIN" | "INCHARGE" = "CAPTAIN";
    let shiftRaw = "";
    let area = "";

    for (let i = 6; i <= 9 && i < row.length; i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

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

      if (upperCell.includes("SALON") || upperCell.includes("LOCA")) {
        area = upperCell.includes("SALON") ? "SALON" : "LOCA";
        continue;
      }

      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü.\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);
    const matchResult = this.staffMatcher.matchStaff(
      staffName,
      staffNameMap,
      allStaff,
    );

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

  private parseSupervisorRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
  ): ParsedSupervisor | null {
    let staffName = "";
    let shiftRaw = "";
    let area = "";

    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

      if (upperCell === "SPVR") continue;

      if (upperCell.includes("LOCA")) {
        area = "LOCA";
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

      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);
    const matchResult = this.staffMatcher.matchStaff(
      staffName,
      staffNameMap,
      allStaff,
    );

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

  private parseLocaCaptainRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
  ): ParsedLocaCaptain | null {
    let staffName = "";
    let shiftRaw = "";
    let area = "";

    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]);
      if (!cellValue) continue;

      const upperCell = cellValue.toUpperCase();

      if (upperCell === "LOCA") continue;

      if (upperCell.includes("SALON")) {
        area = "SALON";
        const timeMatch = cellValue.match(/(\d{1,2}[:.]\d{2})/);
        if (timeMatch && !shiftRaw) {
          shiftRaw = cellValue;
        }
        continue;
      }

      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.length > 2
      ) {
        staffName = cellValue;
        continue;
      }

      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);
    const matchResult = this.staffMatcher.matchStaff(
      staffName,
      staffNameMap,
      allStaff,
    );

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

  private detectServicePointHeader(
    firstCell: string,
    row: any[],
  ): string | null {
    if (!firstCell) return null;

    const upperCell = firstCell.toUpperCase();
    const keywords = ["BAR", "DEPO", "FUAYE", "CASINO", "LOUNGE", "VIP"];

    const hasKeyword = keywords.some((kw) => upperCell.includes(kw));

    if (hasKeyword) {
      const hasShiftInfo = row.some((cell) => {
        const cellStr = this.staffMatcher.cleanCellValue(cell);
        return cellStr && /\d{1,2}[:.]\d{2}/.test(cellStr);
      });

      const filledCells = row.filter((c) =>
        this.staffMatcher.cleanCellValue(c),
      ).length;

      if (filledCells <= 2 || !hasShiftInfo) {
        return firstCell.trim();
      }
    }

    return null;
  }

  private determineServicePointType(
    name: string,
  ): "bar" | "depo" | "fuaye" | "casino" | "other" {
    const upperName = name.toUpperCase();

    if (upperName.includes("DEPO")) return "depo";
    if (upperName.includes("CASINO")) return "casino";
    if (upperName.includes("FUAYE") || upperName.includes("LOUNGE"))
      return "fuaye";
    if (upperName.includes("BAR")) return "bar";

    return "other";
  }

  private parseServicePointStaffRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
  ): ParsedServicePointAssignment | null {
    const staffName = this.staffMatcher.cleanCellValue(row[0]);
    if (!staffName) return null;

    const upperName = staffName.toUpperCase();
    const isHeader = ["BAR", "DEPO", "FUAYE", "CASINO", "LOUNGE", "VIP"].some(
      (kw) => upperName.includes(kw),
    );
    if (isHeader) return null;

    let shiftRaw = "";
    for (let i = 1; i < row.length; i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]);
      if (cellValue && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        break;
      }
    }

    const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);
    const matchResult = this.staffMatcher.matchStaff(
      staffName,
      staffNameMap,
      allStaff,
    );

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

  private parseExtraPersonnelRow(row: any[]): ParsedExtraPersonnel | null {
    let staffName = "";
    let tableIdsRaw = "";
    let shiftRaw = "";

    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]);
      if (!cellValue) continue;

      if (
        !staffName &&
        /^[A-ZÇĞİÖŞÜa-zçğıöşü\s]+$/.test(cellValue) &&
        cellValue.includes(" ")
      ) {
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

      if (
        staffName &&
        !tableIdsRaw &&
        /^\d+[-\d]*$/.test(cellValue.replace(/\s/g, ""))
      ) {
        tableIdsRaw = cellValue;
        continue;
      }

      if (staffName && cellValue.toUpperCase().includes("BACKROUND")) {
        return {
          staffName,
          tableIds: [],
          shiftStart: "17:00",
          shiftEnd: "04:00",
          isBackground: true,
        };
      }

      if (staffName && !shiftRaw && /\d{1,2}[:.]\d{2}/.test(cellValue)) {
        shiftRaw = cellValue;
        continue;
      }
    }

    if (!staffName) return null;

    const tableIds = this.staffMatcher.parseTableIds(tableIdsRaw);
    const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);

    return {
      staffName,
      tableIds,
      shiftStart,
      shiftEnd,
      isBackground: false,
    };
  }

  private parseLocaRow(
    row: any[],
    groupMap: Map<string, ParsedGroup>,
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
    unmatchedStaff: string[],
    warnings: string[],
    colorIndex: number,
  ): void {
    const locaPatterns = [
      /LOCA\s*(\d+)\s*[-–]\s*(\d+)/i,
      /LOCA\s*(\d+[AB]?)\s*[-–]\s*(\d+[AB]?)/i,
    ];

    for (let i = 0; i < row.length; i++) {
      const cellValue = this.staffMatcher.cleanCellValue(row[i]);
      if (!cellValue) continue;

      for (const pattern of locaPatterns) {
        const match = cellValue.match(pattern);
        if (match) {
          const locaName = `LOCA-${match[1]}-${match[2]}`;
          const locaIds = [`LOCA-${match[1]}`, `LOCA-${match[2]}`];

          const staffName =
            this.staffMatcher.cleanCellValue(row[i + 1]) ||
            this.staffMatcher.cleanCellValue(row[i - 1]);
          const shiftRaw =
            this.staffMatcher.cleanCellValue(row[i + 2]) ||
            this.staffMatcher.cleanCellValue(row[i + 1]);

          if (staffName && !staffName.includes("LOCA")) {
            const { shiftStart, shiftEnd } =
              this.staffMatcher.parseShift(shiftRaw);
            const matchResult = this.staffMatcher.matchStaff(
              staffName,
              staffNameMap,
              allStaff,
            );

            let group = groupMap.get(locaName);
            if (!group) {
              group = {
                name: locaName,
                color:
                  GROUP_COLORS[
                    (colorIndex + groupMap.size) % GROUP_COLORS.length
                  ],
                tableIds: locaIds,
                groupType: "loca",
                assignments: [],
              };
              groupMap.set(locaName, group);
            }

            const alreadyAdded = group.assignments.some(
              (a) => a.staffName.toLowerCase() === staffName.toLowerCase(),
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

  private parseTableAssignmentRow(
    row: any[],
    staffNameMap: Map<string, Staff>,
    allStaff: Staff[],
    groupMap: Map<string, ParsedGroup>,
    colorIndex: number,
  ): {
    group: ParsedGroup;
    assignment: ParsedStaffAssignment;
    newColorIndex: number;
  } | null {
    const cells = row.map((c) => this.staffMatcher.cleanCellValue(c));

    const nonEmptyCells = cells.filter((c) => c);
    if (nonEmptyCells.length < 2) return null;

    this.logger.debug(
      `[parseTableAssignmentRow] Cells: ${cells
        .map((c, i) => `[${i}]${c}`)
        .filter((c) => !c.endsWith("]"))
        .join(" | ")}`,
    );

    let staffName = "";
    let position = "";
    let tableIdsRaw = "";
    let shiftRaw = "";

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;

      const upperCell = cell.toUpperCase();

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

      if (
        upperCell === "POZİSYON" ||
        upperCell === "POSTA" ||
        upperCell === "SAAT"
      ) {
        continue;
      }

      const cleanedCell = cell.replace(/\s/g, "");
      if (!tableIdsRaw && /^\d+(-\d+)*$/.test(cleanedCell)) {
        tableIdsRaw = cell;
        continue;
      }

      if (!shiftRaw && (/\d{1,2}[:.]\d{2}/.test(cell) || upperCell === "K")) {
        shiftRaw = cell;
        continue;
      }

      if (!staffName && this.staffMatcher.looksLikeStaffName(cell)) {
        staffName = cell;
        continue;
      }
    }

    if (!staffName) {
      this.logger.debug(`[parseTableAssignmentRow] İsim bulunamadı, atlanıyor`);
      return null;
    }

    const tableIds = this.staffMatcher.parseTableIds(tableIdsRaw);
    if (tableIds.length === 0) {
      this.logger.debug(
        `[parseTableAssignmentRow] Masa numarası bulunamadı: ${staffName}`,
      );
      return null;
    }

    const isLoca =
      tableIds.some((t) => t.toUpperCase().includes("LOCA")) ||
      staffName.toUpperCase().includes("LOCA") ||
      (position && position.toUpperCase().includes("LOCA"));

    if (!isLoca && tableIds.length < 3) {
      this.logger.debug(
        `[parseTableAssignmentRow] Standart grup için yetersiz masa sayısı (${tableIds.length}), atlanıyor: ${staffName}`,
      );
      return null;
    }

    const { shiftStart, shiftEnd } = this.staffMatcher.parseShift(shiftRaw);

    const sortedTables = [...tableIds].sort(
      (a, b) => parseInt(a) - parseInt(b),
    );
    const groupKey = sortedTables.join("-");

    const matchResult = this.staffMatcher.matchStaff(
      staffName,
      staffNameMap,
      allStaff,
    );

    let group = groupMap.get(groupKey);
    let newColorIndex = colorIndex;

    if (!group) {
      const groupNumber = groupMap.size + 1;
      const groupName = isLoca ? `LOCA ${groupNumber}` : `GRUP ${groupNumber}`;
      group = {
        name: groupName,
        color: GROUP_COLORS[colorIndex % GROUP_COLORS.length],
        tableIds: [],
        groupType: isLoca ? "loca" : "standard",
        assignments: [],
      };
      groupMap.set(groupKey, group);
      newColorIndex = colorIndex + 1;
    }

    tableIds.forEach((tid) => {
      if (!group!.tableIds.includes(tid)) {
        group!.tableIds.push(tid);
      }
    });

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
        ",",
      )} (${group.name})`,
    );

    return { group, assignment, newColorIndex };
  }

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
    groupCounter: number,
  ): void {
    const tableIds = this.staffMatcher.parseTableIds(masalar);
    if (tableIds.length === 0) return;

    let formattedSaat = saat;
    if (saat.includes("-K") || saat.includes("--K")) {
      const baslangic = saat.split("-")[0];
      formattedSaat = `${baslangic}-06:00`;
    }

    const { shiftStart, shiftEnd } =
      this.staffMatcher.parseShift(formattedSaat);

    const sortedTables = [...tableIds].sort(
      (a, b) => parseInt(a) - parseInt(b),
    );
    const groupKey = sortedTables.join("-");

    const isLoca =
      tableIds.some((t) => t.toUpperCase().includes("LOCA")) ||
      staffName.toUpperCase().includes("LOCA");

    const matchResult = this.staffMatcher.matchStaff(
      staffName,
      staffNameMap,
      allStaff,
    );

    let group = groupMap.get(groupKey);
    if (!group) {
      const groupName = isLoca
        ? `LOCA ${groupCounter}`
        : `GRUP ${groupCounter}`;
      group = {
        name: groupName,
        color: GROUP_COLORS[colorIndex % GROUP_COLORS.length],
        tableIds: [],
        groupType: isLoca ? "loca" : "standard",
        assignments: [],
      };
      groupMap.set(groupKey, group);
    }

    tableIds.forEach((tid) => {
      if (!group!.tableIds.includes(tid)) {
        group!.tableIds.push(tid);
      }
    });

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

    if (!matchResult.staff && !unmatchedStaff.includes(staffName)) {
      unmatchedStaff.push(staffName);
    }

    this.logger.debug(
      `[ViewerPro] ${section}: ${staffName} -> ${tableIds.join(",")} (${
        group.name
      })`,
    );
  }
}
