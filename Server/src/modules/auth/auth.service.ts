import {
  LoginInput,
  RegisterInput,
} from "./auth.schema.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthUtils } from "./auth.utils.js";
import { AppError } from "../../lib/errors.js";
import { IUser } from "./auth.model.js";

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly utils: AuthUtils,
  ) {}

  async register(input: RegisterInput) {
    const email = normalizeEmail(input.email);

    const existingUser =
      await this.repository.findByEmail(email);

    if (existingUser) {
      throw AppError.conflict("User already exists");
    }

    const hashedPassword =
      await this.utils.hashPassword(input.password);

    let user: IUser;

    try {
      user = await this.repository.create({
        name: input.name.trim(),
        email,
        password: hashedPassword,
      });
    } catch (error) {
      // Race guard: two concurrent registers with the same email.
      if (isDuplicateKeyError(error)) {
        throw AppError.conflict("User already exists");
      }
      throw error;
    }

    const token = this.utils.generateToken(
      userIdOf(user),
    );

    return {
      user: this.serializeUser(user),
      token,
    };
  }

  async login(input: LoginInput) {
    const user =
      await this.repository.findByEmail(
        normalizeEmail(input.email),
      );

    if (!user) {
      throw AppError.unauthorized(
        "Invalid email or password",
      );
    }

    const validPassword =
      await this.utils.comparePassword(
        input.password,
        user.password,
      );

    if (!validPassword) {
      throw AppError.unauthorized(
        "Invalid email or password",
      );
    }

    const token = this.utils.generateToken(
      userIdOf(user),
    );

    return {
      user: this.serializeUser(user),
      token,
    };
  }

  async getUser(userId: string) {
    const user =
      await this.repository.findById(userId);

    if (!user) {
      throw AppError.notFound("User not found");
    }

    return this.serializeUser(user);
  }

  private serializeUser(user: IUser) {
    return {
      id: userIdOf(user),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function userIdOf(user: IUser): string {
  return String(user._id);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
