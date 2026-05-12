import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES  = ["application/pdf"];
const ALLOWED_EXTENSIONS  = [".pdf"];

export interface StoredFile {
  storageProvider: "local";
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

  constructor() {
    if (!existsSync(this.uploadDir)) mkdirSync(this.uploadDir, { recursive: true });
  }

  validate(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException("No file provided");
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype))
      throw new BadRequestException(`Invalid file type: ${file.mimetype}. Only PDF accepted.`);
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(`.${ext}`))
      throw new BadRequestException(`Invalid extension. Only .pdf accepted.`);
    if (file.size > MAX_FILE_SIZE_BYTES)
      throw new BadRequestException(`File exceeds 50 MB limit`);
  }

  resolveStoredFile(file: Express.Multer.File): StoredFile {
    const storagePath = join(this.uploadDir, file.filename);
    return {
      storageProvider: "local",
      storagePath,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      sha256Checksum: createHash("sha256").update(readFileSync(storagePath)).digest("hex"),
    };
  }
}
