import { Injectable, Logger } from "@nestjs/common";
import { Mistral } from "@mistralai/mistralai";
import {
  ExcelConverterService,
  ConvertedExcelData,
} from "./excel-converter.service";

// AI tarafından parse edilen veri yapıları
export interface AIExcelParseResult {
  captains: AIParsedCaptain[];
  supervisors: AIParsedSupervisor[];
  locaCaptains: AIParsedLocaCaptain[];
  extraPersonnel: AIParsedExtraPersonnel[];
  supportTeamMembers: AIParsedSupportTeamMember[];
  servicePoints: AIParsedServicePoint[];
  tableAssignments: AIParsedTableAssignment[];
  rawResponse?: string;
}

export interface AIParsedCaptain {
  name: string;
  position: "CAPTAIN" | "J. CAPTAIN" | "INCHARGE";
  shift: string;
  area?: string;
}

export interface AIParsedSupervisor {
  name: string;
  shift: string;
  area?: string;
}

export interface AIParsedLocaCaptain {
  name: string;
  shift: string;
  locaNumbers?: string;
  area?: string;
}

export interface AIParsedExtraPersonnel {
  name: string;
  tables: string;
  shift: string;
  isBackground?: boolean;
}

export interface AIParsedSupportTeamMember {
  name: string;
  position: string;
  assignment: string;
  shift: string;
  teamName: string;
  isNotComing?: boolean;
}

export interface AIParsedServicePoint {
  name: string;
  type: "bar" | "depo" | "fuaye" | "casino" | "other";
  staff: { name: string; shift: string }[];
}

export interface AIParsedTableAssignment {
  name: string;
  tables: string;
  shift: string;
  columnGroup: number;
}

@Injectable()
export class AIExcelParserService {
  private readonly logger = new Logger(AIExcelParserService.name);
  private mistral: Mistral | null = null;

  constructor(private readonly excelConverter: ExcelConverterService) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (apiKey) {
      this.mistral = new Mistral({ apiKey });
      this.logger.log("Mistral AI client initialized");
    } else {
      this.logger.warn(
        "MISTRAL_API_KEY not found - AI parsing will be disabled"
      );
    }
  }

  /**
   * AI kullanılabilir mi kontrol et
   */
  isAvailable(): boolean {
    return this.mistral !== null;
  }

  /**
   * Excel dosyasını AI ile analiz et
   */
  async parseExcelWithAI(filePath: string): Promise<AIExcelParseResult | null> {
    if (!this.mistral) {
      this.logger.warn("Mistral AI not available, skipping AI parsing");
      return null;
    }

    try {
      // Excel'i yapılandırılmış formata çevir
      const convertedData = this.excelConverter.convertExcel(filePath);

      this.logger.log(
        `Excel converted: ${convertedData.meta.nonEmptyRows} rows, ${convertedData.sections.length} sections`
      );

      // AI için optimize edilmiş text formatına çevir
      const excelText = this.excelConverter.convertToAIFormat(convertedData);

      this.logger.log(`Excel text length: ${excelText.length} characters`);

      // AI'ya gönder
      const result = await this.analyzeWithPixtral(excelText);

      return result;
    } catch (error) {
      this.logger.error(`AI parsing error: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Dönüştürülmüş Excel verisini döndür (debug/test için)
   */
  getConvertedData(filePath: string): ConvertedExcelData {
    return this.excelConverter.convertExcel(filePath);
  }

  /**
   * Pixtral modeli ile Excel verisini analiz et
   */
  private async analyzeWithPixtral(
    excelText: string
  ): Promise<AIExcelParseResult> {
    const systemPrompt = `Sen bir Excel veri analiz uzmanısın. Sana verilen Excel satırlarını analiz edip yapılandırılmış JSON formatında döndüreceksin.

Excel formatı: Her satır "ROW X: [kolon]:değer | [kolon]:değer" şeklinde.

Tespit etmen gereken kategoriler:

1. KAPTANLAR (captains): CAPTAIN, J. CAPTAIN, INCHARGE pozisyonundaki kişiler
2. SÜPERVİZÖRLER (supervisors): SPVR pozisyonundaki kişiler
3. LOCA KAPTANLARI (locaCaptains): LOCA bölümündeki kaptanlar
4. EXTRA PERSONEL (extraPersonnel): "EXTRA PERSONEL" başlığı altındaki kişiler ("BACKROUND" olanları isBackground: true)
5. DESTEK EKİBİ (supportTeamMembers): "DESTEK EKİBİ" başlığı altındaki kişiler ("GELMEYECEK" olanları isNotComing: true)
6. HİZMET NOKTALARI (servicePoints): BAR, DEPO, FUAYE, CASINO başlıkları altındaki personel

Vardiya: "16:00-K" = 16:00-06:00 (K = Kapanış)

SADECE JSON döndür, açıklama ekleme.`;

    const userPrompt = `Excel verisi:

${excelText.substring(0, 4000)}

JSON formatı:
{"captains":[{"name":"...","position":"CAPTAIN","shift":"..."}],"supervisors":[{"name":"...","shift":"..."}],"locaCaptains":[{"name":"...","shift":"..."}],"extraPersonnel":[{"name":"...","tables":"...","shift":"...","isBackground":false}],"supportTeamMembers":[{"name":"...","position":"...","assignment":"...","shift":"...","teamName":"CRYSTAL DESTEK EKİBİ","isNotComing":false}],"servicePoints":[],"tableAssignments":[]}`;

    try {
      this.logger.log("Sending request to Mistral API...");
      this.logger.log(`API Key exists: ${!!process.env.MISTRAL_API_KEY}`);
      this.logger.log(`Prompt length: ${userPrompt.length} chars`);

      const startTime = Date.now();

      // AbortController ile timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        this.logger.warn("Aborting Mistral API request after 60s timeout");
        controller.abort();
      }, 60000);

      try {
        const response = await this.mistral!.chat.complete({
          model: "mistral-small-latest",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          maxTokens: 3000,
        });

        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        this.logger.log(`Mistral API responded in ${elapsed}ms`);

        const content = response.choices?.[0]?.message?.content || "";

        // String olarak al
        const responseText =
          typeof content === "string" ? content : JSON.stringify(content);

        this.logger.log(`AI response received, length: ${responseText.length}`);

        // JSON'u parse et
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          this.logger.error("No JSON found in AI response");
          this.logger.debug(`Raw response: ${responseText.substring(0, 500)}`);
          return this.getEmptyResult(responseText);
        }

        // Bozuk JSON'u repair etmeye çalış
        let parsed: AIExcelParseResult;
        try {
          parsed = JSON.parse(jsonMatch[0]) as AIExcelParseResult;
        } catch (parseError) {
          this.logger.warn(
            `JSON parse failed, attempting repair: ${parseError.message}`
          );
          const repairedJson = this.repairJSON(jsonMatch[0]);
          try {
            parsed = JSON.parse(repairedJson) as AIExcelParseResult;
            this.logger.log("JSON repair successful");
          } catch (repairError) {
            this.logger.error(
              `JSON repair also failed: ${repairError.message}`
            );
            return this.getEmptyResult(responseText);
          }
        }
        parsed.rawResponse = responseText;

        this.logger.log(
          `AI parsed: ${parsed.captains?.length || 0} captains, ${
            parsed.supervisors?.length || 0
          } supervisors, ${parsed.locaCaptains?.length || 0} loca captains, ${
            parsed.extraPersonnel?.length || 0
          } extra, ${parsed.supportTeamMembers?.length || 0} support`
        );

        return parsed;
      } catch (apiError: any) {
        clearTimeout(timeoutId);
        if (apiError.name === "AbortError") {
          this.logger.error("Mistral API request timed out after 60s");
        } else {
          this.logger.error(`Mistral API call failed: ${apiError.message}`);
          this.logger.error(`Error details: ${JSON.stringify(apiError)}`);
        }
        throw apiError;
      }
    } catch (error: any) {
      this.logger.error(`Mistral API error: ${error.message}`);
      // Hata durumunda boş sonuç döndür, klasik parsing devam etsin
      return this.getEmptyResult();
    }
  }

  /**
   * Boş sonuç döndür
   */
  private getEmptyResult(rawResponse?: string): AIExcelParseResult {
    return {
      captains: [],
      supervisors: [],
      locaCaptains: [],
      extraPersonnel: [],
      supportTeamMembers: [],
      servicePoints: [],
      tableAssignments: [],
      rawResponse,
    };
  }

  /**
   * Bozuk JSON'u repair etmeye çalış
   */
  private repairJSON(json: string): string {
    let repaired = json;

    // Trailing comma'ları kaldır
    repaired = repaired.replace(/,\s*([}\]])/g, "$1");

    // Eksik kapanış bracket'larını ekle
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;

    // Eksik ] ekle
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repaired += "]";
    }

    // Eksik } ekle
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += "}";
    }

    // Kesilmiş string'leri kapat
    const lastQuoteIndex = repaired.lastIndexOf('"');
    if (lastQuoteIndex > 0) {
      const afterLastQuote = repaired.substring(lastQuoteIndex + 1);
      // Eğer son quote'dan sonra düzgün kapanış yoksa
      if (!afterLastQuote.match(/^\s*[,}\]]/)) {
        // Son incomplete entry'yi bul ve kaldır
        const lastCompleteEntry = repaired.lastIndexOf("},");
        if (lastCompleteEntry > 0) {
          repaired = repaired.substring(0, lastCompleteEntry + 1);
          // Eksik kapanışları tekrar ekle
          const ob = (repaired.match(/\[/g) || []).length;
          const cb = (repaired.match(/\]/g) || []).length;
          const obr = (repaired.match(/\{/g) || []).length;
          const cbr = (repaired.match(/\}/g) || []).length;
          for (let i = 0; i < ob - cb; i++) repaired += "]";
          for (let i = 0; i < obr - cbr; i++) repaired += "}";
        }
      }
    }

    return repaired;
  }
}
