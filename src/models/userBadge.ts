import mongoose from "mongoose";

const userBadgeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    badgeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Badge"
    },
    earnedAt: {
        type: Date,
        default: Date.now
    }
})

export default mongoose.model("UserBadge", userBadgeSchema);