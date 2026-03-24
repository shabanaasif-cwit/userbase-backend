import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
    },
    accountStatus: {
      type: String,
      enum: ["active", "deactivated"],
      default: "active",
    },
  },
  { timestamps: true }
);

export const AdminUser = mongoose.model("AdminUser", adminUserSchema);
