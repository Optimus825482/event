import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { memoryStorage } from "multer";

// Multer config - memory storage kullanıyoruz çünkü sharp ile işleyeceğiz
const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    if (!file.mimetype.match(/^image\/(jpeg|jpg|png)$/)) {
      return cb(
        new BadRequestException("Sadece JPG ve PNG dosyaları kabul edilir"),
        false
      );
    }
    cb(null, true);
  },
};

@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  // Avatar yükle
  @Post("avatar")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Dosya yüklenmedi");
    }

    const result = await this.uploadService.uploadAvatar(file);

    return {
      success: true,
      message: "Avatar başarıyla yüklendi",
      data: result,
    };
  }

  // Avatar sil
  @Delete("avatar/:filename")
  async deleteAvatar(@Param("filename") filename: string) {
    await this.uploadService.deleteAvatar(filename);

    return {
      success: true,
      message: "Avatar silindi",
    };
  }

  // Genel resim yükle
  @Post("image")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Dosya yüklenmedi");
    }

    const result = await this.uploadService.uploadImage(file);

    return {
      success: true,
      message: "Resim başarıyla yüklendi",
      data: result,
    };
  }

  // Firma logosu yükle
  @Post("logo")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Dosya yüklenmedi");
    }

    const result = await this.uploadService.uploadImage(file, "logos", 500);

    return {
      success: true,
      message: "Logo başarıyla yüklendi",
      data: result,
    };
  }

  // Etkinlik görseli yükle
  @Post("event-image")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  async uploadEventImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Dosya yüklenmedi");
    }

    const result = await this.uploadService.uploadImage(
      file,
      "event-images",
      1200
    );

    return {
      success: true,
      message: "Etkinlik görseli başarıyla yüklendi",
      data: result,
    };
  }

  // Davetiye görseli yükle
  @Post("invitation-image")
  @UseInterceptors(FileInterceptor("file", multerOptions))
  async uploadInvitationImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Dosya yüklenmedi");
    }

    const result = await this.uploadService.uploadImage(
      file,
      "invitation-images",
      800
    );

    return {
      success: true,
      message: "Davetiye görseli başarıyla yüklendi",
      data: result,
    };
  }
}
