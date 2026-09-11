import { User, IUser } from "./auth.model.js";

export class AuthRepository {
  async findByEmail(
    email: string,
  ): Promise<IUser | null> {
    return User.findOne({ email })
      .select("+password")
      .exec();
  }

  async findById(
    userId: string,
  ): Promise<IUser | null> {
    return User.findById(userId).exec();
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<IUser> {
    return User.create(data);
  }
}
