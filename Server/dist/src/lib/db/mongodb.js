import mongoose from "mongoose";
export class MongoDB {
    async connect() {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MONGODB_URI is not defined");
        }
        await mongoose.connect(uri);
        console.log("MongoDB connected");
    }
    async disconnect() {
        await mongoose.disconnect();
    }
}
export const mongoDB = new MongoDB();
