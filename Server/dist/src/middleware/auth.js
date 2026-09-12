import { AppError } from "../lib/errors.js";
import { AUTH_COOKIE_NAME, } from "../modules/auth/auth.cookies.js";
import { AuthUtils } from "../modules/auth/auth.utils.js";
const authUtils = new AuthUtils();
function extractCookieToken(req) {
    const cookies = req.cookies;
    const token = cookies?.[AUTH_COOKIE_NAME];
    return typeof token === "string" && token.length > 0
        ? token
        : null;
}
function extractBearerToken(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    const token = header.slice("Bearer ".length).trim();
    return token.length > 0 ? token : null;
}
// Verifies the JWT from the `token` httpOnly cookie
// (fallback: `Authorization: Bearer <token>` for API clients)
// and attaches the payload as `req.user`. Use on every route
// that requires a logged-in user (e.g. GET /v1/auth/me).
export function requireAuth(req, _res, next) {
    const token = extractCookieToken(req) ?? extractBearerToken(req);
    if (!token) {
        next(AppError.unauthorized("Missing auth token. Login first."));
        return;
    }
    try {
        req.user = authUtils.verifyToken(token);
        next();
    }
    catch {
        next(AppError.unauthorized("Invalid or expired token"));
    }
}
