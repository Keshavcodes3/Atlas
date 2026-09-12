import ImageKit from "imagekit";
import multer from "multer";
import { AppError } from "../lib/errors.js";
function requiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is not defined`);
    }
    return value;
}
// Singleton so importing this file never crashes boot.
// Misconfiguration surfaces on first use (same pattern as AuthUtils).
let cached = null;
export function getImageKit() {
    if (cached)
        return cached;
    cached = new ImageKit({
        publicKey: requiredEnv("IMAGEKIT_PUBLIC_KEY"),
        privateKey: requiredEnv("IMAGEKIT_PRIVATE_KEY"),
        urlEndpoint: requiredEnv("IMAGEKIT_URL_ENDPOINT"),
    });
    return cached;
}
/** Direct SDK access: `imagekit.upload(...)`, `imagekit.deleteFile(...)`, ... */
export const imagekit = new Proxy({}, {
    get(_target, prop) {
        return getImageKit()[prop];
    },
});
// ---------------------------------------------------------------------------
// Multer (memory storage — file.buffer goes straight to ImageKit, no disk)
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = new Set([
    // images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    // docs (Atlas knowledge sources)
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
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
        cb(AppError.badRequest(`Unsupported file type: ${file.mimetype}. Allowed: images, pdf, txt, md, csv`));
    },
});
/** Single file: `router.post("/", uploadSingle("file"), handler)` */
export const uploadSingle = (field = "file") => upload.single(field);
/** Multiple files: `req.files as Express.Multer.File[]` */
export const uploadMultiple = (field = "files", maxCount = 5) => upload.array(field, maxCount);
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
export async function uploadToImageKit(file, options = {}) {
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
export async function deleteFromImageKit(fileId) {
    await getImageKit().deleteFile(fileId);
}
/** For frontend direct-to-ImageKit uploads (signed auth params). */
export function getImageKitAuthParams(token, expire) {
    return getImageKit().getAuthenticationParameters(token, expire);
}
