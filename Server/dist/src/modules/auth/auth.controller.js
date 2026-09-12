import { loginSchema, registerSchema, } from "./auth.schema.js";
import { clearAuthCookie, setAuthCookie, } from "./auth.cookies.js";
export class AuthController {
    service;
    constructor(service) {
        this.service = service;
    }
    register = async (req, res, next) => {
        try {
            const input = registerSchema.parse(req.body);
            const result = await this.service.register(input);
            setAuthCookie(res, result.token);
            return res.status(201).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    login = async (req, res, next) => {
        try {
            const input = loginSchema.parse(req.body);
            const result = await this.service.login(input);
            setAuthCookie(res, result.token);
            return res.status(200).json(result);
        }
        catch (error) {
            next(error);
        }
    };
    me = async (req, res, next) => {
        try {
            if (!req.user) {
                return res
                    .status(401)
                    .json({
                    message: "Unauthorized",
                });
            }
            const user = await this.service.getUser(req.user.userId);
            return res.json({ user });
        }
        catch (error) {
            next(error);
        }
    };
    logout = async (_req, res, next) => {
        try {
            clearAuthCookie(res);
            return res.json({ message: "Logged out" });
        }
        catch (error) {
            next(error);
        }
    };
}
