import mongoose from "mongoose";

const recipientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    targetType: {
      type: String,
      enum: ["users", "role"],
      required: true,
    },
    targetUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    targetRoles: {
      type: [String],
      enum: ["user", "admin"],
      default: [],
    },
    recipients: {
      type: [recipientSchema],
      default: [],
    },
    createdBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      role: {
        type: String,
        enum: ["admin"],
        required: true,
      },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ "recipients.userId": 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
