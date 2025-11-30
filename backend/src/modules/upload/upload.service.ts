import { Injectable, BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Desteklenen dosya türleri
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Avatar boyutları
const AVATAR_SIZES = {
  small: 64,
  medium: 128,
  large: 256,
};

@Injectable()
export class UploadService {
  private readonly uploadDir: string;

  constructor() {
    // Uploads dizinini oluştur
    this.uploadDir = path.join(process.cwd(), "uploads");
    this.ensureUploadDir();
  }

  // Uploads dizinini kontrol et ve oluştur
  private ensureUploadDir(): void {
    const dirs = [
      this.uploadDir,
      path.join(this.uploadDir, "avatars"),
      path.join(this.uploadDir, "avatars", "small"),
      path.join(this.uploadDir, "avatars", "medium"),
      path.join(this.uploadDir, "avatars", "large"),
    ];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Dosya validasyonu
  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException("Dosya yüklenmedi");
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Sadece JPG ve PNG dosyaları kabul edilir");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException("Dosya boyutu 5MB'dan küçük olmalıdır");
    }
  }

  // Avatar yükle ve optimize et
  async uploadAvatar(file: Express.Multer.File): Promise<{
    filename: string;
    urls: {
      small: string;
      medium: string;
      large: string;
      original: string;
    };
  }> {
    this.validateFile(file);

    const filename = `${uuidv4()}${path
      .extname(file.originalname)
      .toLowerCase()}`;
    const baseUrl = "/uploads/avatars";

    try {
      // Orijinal resmi oku
      const imageBuffer = file.buffer;

      // Her boyut için optimize edilmiş versiyon oluştur
      const sizes = Object.entries(AVATAR_SIZES);

      for (const [sizeName, dimension] of sizes) {
        const outputPath = path.join(
          this.uploadDir,
          "avatars",
          sizeName,
          filename.replace(/\.(jpg|jpeg|png)$/i, ".webp")
        );

        await sharp(imageBuffer)
          .resize(dimension, dimension, {
            fit: "cover",
            position: "center",
          })
          .webp({ quality: 85 })
          .toFile(outputPath);
      }

      // Orijinal boyutta da kaydet (max 512px, kalite korunarak)
      const originalPath = path.join(
        this.uploadDir,
        "avatars",
        filename.replace(/\.(jpg|jpeg|png)$/i, ".webp")
      );

      await sharp(imageBuffer)
        .resize(512, 512, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 90 })
        .toFile(originalPath);

      const webpFilename = filename.replace(/\.(jpg|jpeg|png)$/i, ".webp");

      return {
        filename: webpFilename,
        urls: {
          small: `${baseUrl}/small/${webpFilename}`,
          medium: `${baseUrl}/medium/${webpFilename}`,
          large: `${baseUrl}/large/${webpFilename}`,
          original: `${baseUrl}/${webpFilename}`,
        },
      };
    } catch (error) {
      console.error("Resim işleme hatası:", error);
      throw new BadRequestException("Resim işlenirken bir hata oluştu");
    }
  }

  // Avatar sil
  async deleteAvatar(filename: string): Promise<void> {
    if (!filename) return;

    try {
      const paths = [
        path.join(this.uploadDir, "avatars", filename),
        path.join(this.uploadDir, "avatars", "small", filename),
        path.join(this.uploadDir, "avatars", "medium", filename),
        path.join(this.uploadDir, "avatars", "large", filename),
      ];

      for (const filePath of paths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error("Dosya silme hatası:", error);
    }
  }

  // Genel resim yükleme (etkinlik görselleri vb. için)
  async uploadImage(
    file: Express.Multer.File,
    folder: string = "images",
    maxWidth: number = 1920
  ): Promise<{ filename: string; url: string }> {
    this.validateFile(file);

    const targetDir = path.join(this.uploadDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `${uuidv4()}.webp`;
    const outputPath = path.join(targetDir, filename);

    try {
      await sharp(file.buffer)
        .resize(maxWidth, null, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(outputPath);

      return {
        filename,
        url: `/uploads/${folder}/${filename}`,
      };
    } catch (error) {
      console.error("Resim işleme hatası:", error);
      throw new BadRequestException("Resim işlenirken bir hata oluştu");
    }
  }
}
