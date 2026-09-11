import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
}

export class AuthUtils {
  private readonly jwtSecret: string;

  constructor() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not defined");
    }

    this.jwtSecret = secret;
  }

  async hashPassword(
    password: string,
  ): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(
      password,
      hashedPassword,
    );
  }

  generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.jwtSecret,
      {
        expiresIn: "7d",
      },
    );
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(
      token,
      this.jwtSecret,
    ) as JwtPayload;
  }
}
