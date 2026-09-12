import ImageKit from "imagekit";
import multer from "multer";

import { AppError } from "../lib/errors.js";


function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not defined`);
  }

  return value;
}

// Singleton so importing this file never crashes boot.
// Misconfiguration surfaces on first use (same pattern as AuthUtils).
let cached: ImageKit | null = null;

export function getImageKit(): ImageKit {
  if (cached) return cached;

  cached = new ImageKit({
    publicKey: requiredEnv("IMAGEKIT_PUBLIC_KEY"),
    privateKey: requiredEnv("IMAGEKIT_PRIVATE_KEY"),
    urlEndpoint: requiredEnv("IMAGEKIT_URL_ENDPOINT"),
  });

  return cached;
}

/** Direct SDK access: `imagekit.upload(...)`, `imagekit.deleteFile(...)`, ... */
export const imagekit: ImageKit = new Proxy({} as ImageKit, {
  get(_target, prop) {
    const value = (getImageKit() as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    // Methods need their receiver: without bind, `imagekit.upload(...)`
    // loses `this` and fails inside the SDK. Props pass through as-is.
    return typeof value === "function"
      ? (value as (...args: never[]) => unknown).bind(getImageKit())
      : value;
  },
});

// ---------------------------------------------------------------------------
// Multer (memory storage — file.buffer goes straight to ImageKit, no disk)
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIMES = new Set([
  // docs (Atlas knowledge sources — must match
  // DocumentService.resolveSourceType, which also accepts docx)
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(
      AppError.badRequest(
        `Unsupported file type: ${file.mimetype}. Allowed: pdf, txt, md, csv, docx`,
      ),
    );
  },
});

/** Single file: `router.post("/", uploadSingle("file"), handler)` */
export const uploadSingle = (field = "file") => upload.single(field);

/** Multiple files: `req.files as Express.Multer.File[]` */
export const uploadMultiple = (field = "files", maxCount = 5) =>
  upload.array(field, maxCount);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface ImageKitUploadOptions {
  folder?: string;
  fileName?: string;
  useUniqueFileName?: boolean;
  tags?: string[];
  isPrivateFile?: boolean;
}

export interface UploadedFile {
  url: string;
  fileId: string;
  filePath: string;
  fileName: string;
  thumbnailUrl?: string;
}

/**
 * Upload a multer file buffer to ImageKit.
 *
 *   import { uploadSingle, uploadToImageKit } from "../../config/upload.js";
 *
 *   router.post("/avatar", uploadSingle("file"), async (req, res, next) => {
 *     try {
 *       if (!req.file) throw AppError.badRequest("No file uploaded");
 *       const result = await uploadToImageKit(req.file, { folder: "/avatars" });
 *       res.json(result); // { url, fileId, ... }
 *     } catch (err) { next(err); }
 *   });
 */
export async function uploadToImageKit(
  file: Express.Multer.File,
  options: ImageKitUploadOptions = {},
): Promise<UploadedFile> {
  const result = await getImageKit().upload({
    file: file.buffer,
    fileName: options.fileName ?? `${Date.now()}-${file.originalname}`,
    folder: options.folder ?? "/uploads",
    useUniqueFileName: options.useUniqueFileName ?? true,
    ...(options.tags ? { tags: options.tags.join(",") } : {}),
    ...(options.isPrivateFile !== undefined
      ? { isPrivateFile: options.isPrivateFile }
      : {}),
  });

  return {
    url: result.url,
    fileId: result.fileId,
    filePath: result.filePath,
    fileName: result.name,
    ...(result.thumbnailUrl
      ? { thumbnailUrl: result.thumbnailUrl }
      : {}),
  };
}

export async function deleteFromImageKit(
  fileId: string,
): Promise<void> {
  await getImageKit().deleteFile(fileId);
}

/** For frontend direct-to-ImageKit uploads (signed auth params). */
export function getImageKitAuthParams(
  token?: string,
  expire?: number,
) {
  return getImageKit().getAuthenticationParameters(token, expire);
}
