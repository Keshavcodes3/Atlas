import { AppError } from "../../lib/errors.js";
export class AuthService {
    repository;
    utils;
    constructor(repository, utils) {
        this.repository = repository;
        this.utils = utils;
    }
    async register(input) {
        const email = normalizeEmail(input.email);
        const existingUser = await this.repository.findByEmail(email);
        if (existingUser) {
            throw AppError.conflict("User already exists");
        }
        const hashedPassword = await this.utils.hashPassword(input.password);
        let user;
        try {
            user = await this.repository.create({
                name: input.name.trim(),
                email,
                password: hashedPassword,
            });
        }
        catch (error) {
            // Race guard: two concurrent registers with the same email.
            if (isDuplicateKeyError(error)) {
                throw AppError.conflict("User already exists");
            }
            throw error;
        }
        const token = this.utils.generateToken(userIdOf(user));
        return {
            user: this.serializeUser(user),
            token,
        };
    }
    async login(input) {
        const user = await this.repository.findByEmail(normalizeEmail(input.email));
        if (!user) {
            throw AppError.unauthorized("Invalid email or password");
        }
        const validPassword = await this.utils.comparePassword(input.password, user.password);
        if (!validPassword) {
            throw AppError.unauthorized("Invalid email or password");
        }
        const token = this.utils.generateToken(userIdOf(user));
        return {
            user: this.serializeUser(user),
            token,
        };
    }
    async getUser(userId) {
        const user = await this.repository.findById(userId);
        if (!user) {
            throw AppError.notFound("User not found");
        }
        return this.serializeUser(user);
    }
    serializeUser(user) {
        return {
            id: userIdOf(user),
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
        };
    }
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function userIdOf(user) {
    return String(user._id);
}
function isDuplicateKeyError(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000);
}
