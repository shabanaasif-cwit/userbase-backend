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
    firstName: {
      type: String,
      trim: true,
      default: null,
    },
    lastName: {
      type: String,
      trim: true,
      default: null,
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
