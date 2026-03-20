import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ExcelImportService, AnalysisResult } from "./excel-import.service";
import {
  ReservationImportService,
  ParsedReservationEntry,
} from "./reservation-import.service";
import { diskStorage } from "multer";
import { extname } from "path";
import * as fs from "fs";

@Controller("excel-import")
export class ExcelImportController {
  constructor(
    private readonly excelImportService: ExcelImportService,
    private readonly reservationImportService: ReservationImportService,
  ) {}

  /**
   * Excel dosyasını analiz et ve önizleme döndür
   * POST /excel-import/analyze/:eventId
   */
  @Post("analyze/:eventId")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/excel-temp",
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return cb(
            new BadRequestException(
              "Sadece Excel dosyaları kabul edilir (.xlsx, .xls)",
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  async analyzeExcel(
    @Param("eventId") eventId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AnalysisResult> {
    if (!file) {
      throw new BadRequestException("Excel dosyası gerekli");
    }

    try {
      return await this.excelImportService.analyzeExcelFile(eventId, file.path);
    } finally {
      if (file?.path) {
        fs.unlink(file.path, () => {});
      }
    }
  }

  /**
   * Analiz sonucunu onayla ve veritabanına kaydet
   * POST /excel-import/confirm/:eventId
   */
  @Post("confirm/:eventId")
  @UseGuards(JwtAuthGuard)
  async confirmImport(
    @Param("eventId") eventId: string,
    @Body()
    body: { analysisResult: any; options?: { clearExisting?: boolean } },
  ) {
    return this.excelImportService.confirmAndSaveImport(
      eventId,
      body.analysisResult,
      body.options,
    );
  }

  /**
   * Rezervasyon Excel dosyasını analiz et ve önizleme döndür
   * POST /excel-import/analyze-reservations/:eventId
   */
  @Post("analyze-reservations/:eventId")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/excel-temp",
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, `res-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return cb(
            new BadRequestException(
              "Sadece Excel dosyaları kabul edilir (.xlsx, .xls)",
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async analyzeReservationExcel(
    @Param("eventId") eventId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Excel dosyası gerekli");
    }
    try {
      return await this.reservationImportService.analyzeReservationExcel(
        eventId,
        file.path,
      );
    } finally {
      if (file?.path) {
        fs.unlink(file.path, () => {});
      }
    }
  }

  /**
   * Rezervasyon import'unu onayla ve kaydet
   * POST /excel-import/confirm-reservations/:eventId
   */
  @Post("confirm-reservations/:eventId")
  @UseGuards(JwtAuthGuard)
  async confirmReservationImport(
    @Param("eventId") eventId: string,
    @Body()
    body: {
      entries: ParsedReservationEntry[];
      options?: { clearExisting?: boolean };
    },
  ) {
    return this.reservationImportService.confirmReservationImport(
      eventId,
      body.entries,
      body.options,
    );
  }
}
