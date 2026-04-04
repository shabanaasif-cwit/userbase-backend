import mongoose from "mongoose";

const reminderRecipientSchema = new mongoose.Schema(
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

const reminderSchema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
      index: true,
    },
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
      enum: ["users", "user", "admin", "all"],
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
      type: [reminderRecipientSchema],
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

reminderSchema.index({ "recipients.userId": 1, createdAt: -1 });

export const Reminder = mongoose.model("Reminder", reminderSchema);

