import express from "express";
import { 
    getAllChallenges, 
    getChallengeById, 
    createChallenge, 
    updateChallenge, 
    deleteChallenge,
    reactivateChallenge,
    getChallengesByCategory,
    getRandomChallenges,
    incrementAssigned,
    completeChallenge,
    getChallengeStats
} from "../controllers/challengeController";
import { CreateChallengeDto, UpdateChallengeDto } from "../dto/challengeDto";
import validationMiddleware from "../middlewares/middleware";
import { verifyToken, requireRole } from "../middlewares/auth";

const router = express.Router();

// Rutas públicas
router.get("/", getAllChallenges);
router.get("/stats", getChallengeStats);
router.get("/random", getRandomChallenges);
router.get("/category/:category", getChallengesByCategory);
router.get("/:id", getChallengeById);

// Crear desafío: Admin crea global, Usuario crea personal (validación en controller)
router.post("/", verifyToken, validationMiddleware(CreateChallengeDto), createChallenge);

// Actualizar: solo el owner o admin
router.put("/:id", verifyToken, validationMiddleware(UpdateChallengeDto), updateChallenge);

// Eliminar: solo el owner o admin (validación en controller)
router.delete("/:id", verifyToken, deleteChallenge);

// Reactivar: solo el owner o admin (validación en controller)
router.patch("/:id/reactivate", verifyToken, reactivateChallenge);

// Rutas para actualizar estadísticas (protegidas)
router.patch("/:id/assign", verifyToken, incrementAssigned);
router.patch("/:id/complete", verifyToken, completeChallenge);

export default router;
