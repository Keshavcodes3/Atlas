import { User } from "./auth.model.js";
export class AuthRepository {
    async findByEmail(email) {
        return User.findOne({ email })
            .select("+password")
            .exec();
    }
    async findById(userId) {
        return User.findById(userId).exec();
    }
    async create(data) {
        return User.create(data);
    }
}
