import {
  LoginInput,
  RegisterInput,
} from "./auth.schema";
import { AuthRepository } from "./auth.repository";
import { AuthUtils } from "./auth.utils";

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly utils: AuthUtils,
  ) {}

  async register(input: RegisterInput) {
    const existingUser =
      await this.repository.findByEmail(
        input.email,
      );

    if (existingUser) {
      throw new Error("User already exists");
    }

    const hashedPassword =
      await this.utils.hashPassword(
        input.password,
      );

    const user = await this.repository.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
    });

    const token = this.utils.generateToken(
      user.id,
    );

    return {
      user: this.serializeUser(user),
      token,
    };
  }

  async login(input: LoginInput) {
    const user =
      await this.repository.findByEmail(
        input.email,
      );

    if (!user) {
      throw new Error(
        "Invalid email or password",
      );
    }

    const validPassword =
      await this.utils.comparePassword(
        input.password,
        user.password,
      );

    if (!validPassword) {
      throw new Error(
        "Invalid email or password",
      );
    }

    const token = this.utils.generateToken(
      user.id,
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
      throw new Error("User not found");
    }

    return this.serializeUser(user);
  }

  private serializeUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
