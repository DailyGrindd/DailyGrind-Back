import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre del badge es obligatorio']
    },
    description: {
        type: String,
        required: [true, 'La descripción del badge es obligatoria']
    },
    iconUrl: {
        type: String,
        required: [true, 'La URL del icono del badge es obligatoria']
    },
    difficulty: {
        type: Number,
        default: 1,
        required: [true, 'La dificultad del desafío es obligatoria']
    },
    conditions: {
        type: {
            type: String,
            required: [true, 'El tipo de condición es obligatorio']
        },
        category: {
            type: String,
            required: [true, 'La categoría de la condición es obligatoria']
        },
        thresHold: {
            type: Number,
            required: [true, 'El umbral de la condición es obligatorio']
        }
    }
})

export default mongoose.model("Badge", badgeSchema);