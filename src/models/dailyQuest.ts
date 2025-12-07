import mongoose from "mongoose";

const dailyQuestSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        date: {
            type: Date,
            default: Date.now,
            required: true,
        },
        missions: [
            {
                slot: {
                    type: Number,
                    required: true,
                },
                challengeId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Challenge",
                    required: true,
                },
                type: {
                    type: String,
                    enum: ["global", "personal"],
                    required: true,
                },
                status: {
                    type: String,
                    enum: ["pending", "completed", "skipped"],
                    default: "pending",
                },
                completedAt: {
                    type: Date,
                    default: null,
                },
                pointsAwarded: {
                    type: Number,
                    default: 0,
                },
            },
        ],
        rerollCount: {
            type: Number,
            default: 0
        },
        pendingChainPoints: {
            type: Number,
            default: 0
        }
    }
);

export default mongoose.model('DailyQuest', dailyQuestSchema);