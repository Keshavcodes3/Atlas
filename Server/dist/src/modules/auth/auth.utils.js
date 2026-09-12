import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
export class AuthUtils {
    // The secret is read lazily (not in the constructor) so that
    // importing the auth module never crashes the process at boot
    // time. Misconfiguration surfaces as a 500 with a clear message
    // on the first sign/verify call instead.
    get jwtSecret() {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not defined");
        }
        return secret;
    }
    async hashPassword(password) {
        return bcrypt.hash(password, 12);
    }
    async comparePassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }
    generateToken(userId) {
        return jwt.sign({ userId }, this.jwtSecret, {
            expiresIn: "7d",
        });
    }
    verifyToken(token) {
        return jwt.verify(token, this.jwtSecret);
    }
}
