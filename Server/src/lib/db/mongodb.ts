import mongoose from "mongoose";

import { logger } from "../logger.js";

export class MongoDB {
  async connect(): Promise<void> {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(uri);

    logger.info("MongoDB connected");
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
  }
}

export const mongoDB = new MongoDB();
