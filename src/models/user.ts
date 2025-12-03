import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: [true, 'El nombre del usuario es obligatorio']
    },
    email: {
        type: String,
        lowercase: true,
        required: [true, 'El correo del usuario es obligatorio']
    },
    password: {
        type: String,
        required: [true, 'La contraseña del usuario es obligatoria']
    },
    role: {
        type: String,
        required: [true, 'El rol del usuario es obligatorio']
    },
    level: {
        type: Number,
        default: 1
    },
    isActive: {
        type: Boolean,
        default: true
    },
    profile: {
        displayName: {
            type: String,
            required: [true, 'El nombre de perfil es obligatorio']
        },
        avatarUrl: {
            type: String,
            required: false
        },
        isPublic: {
            type: Boolean,
            required: true
        },
        zone: {
            type: String,
            required: [true, 'La ubicacion es obligatoria']
        }
    },
    stats: {
        totalPoints: {
            type: Number,
            default: 0
        },
        weeklyPoints: {
            type: Number,
            default: 0
        },
        totalCompleted: {
            type: Number,
            default: 0
        },
        currentStreak: {
            type: Number,
            default: 0
        }
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
})

export default mongoose.model("User", userSchema);