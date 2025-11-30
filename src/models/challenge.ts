import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema({
    type: {
        type: String,
        required: [true, 'El tipo de desafio es obligatorio']
    },
    ownerUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    title: {
        type: String,
        required: [true, 'El título del desafío es obligatorio']
    },
    description: {
        type: String,
        required: [true, 'La descripción del desafío es obligatoria']
    },
    category: {
        type: String,
        required: [true, 'La categoría del desafío es obligatoria']
    },
    difficulty: {
        type: Number,
        default: 1,
        required: [true, 'La dificultad del desafío es obligatoria']
    },
    points: {
        type: Number,
        required: [true, 'Los puntos del desafío son obligatorios']
    },
    isActive: {
        type: Boolean
    },
    tags: {
        type: [String],
        required: false
    },
    requirements: {
        minLevel: {
            type: Number,
            default: 0
        },
        preRequisiteChallenge: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Challenge",
            required: false
        }
    },
    rules: {
        maxPerDay: {
            type: Number,
            default: 1
        },
        minUserLevel: {
            type: Number,
            default: 0
        }
    },
    stats: {
        timesAssigned: {
            type: Number,
            default: 0
        },
        timesCompleted: {
            type: Number,
            default: 0
        },
        completionRate: {
            type: Number,
            default: 0 
        }
    }
})

export default mongoose.model("Challenge", challengeSchema);