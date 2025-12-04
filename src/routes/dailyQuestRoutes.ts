import express from "express";
import { 
    initializeDailyQuest,
    getMyDailyQuest,
    assignPersonalChallenge,
    unassignPersonalChallenge,
    rerollGlobalMission,
    completeMission,
    skipMission,
    getMyHistory,
    getAverageStatus,
    getMissionTypeStats
} from "../controllers/dailyQuestController";
import { AssignChallengeDto } from "../dto/dailyQuestDto";
import validationMiddleware from "../middlewares/middleware";
import { requireRole, verifyToken } from "../middlewares/auth";

const router = express.Router();

// Inicializar/Obtener DailyQuest de hoy (auto-genera 3 misiones globales si no existe)
router.get("/initialize", verifyToken, initializeDailyQuest);

// Obtener mis misiones de hoy
router.get("/my-daily", verifyToken, getMyDailyQuest);

// Obtener historial (últimos 30 días por defecto)
router.get("/history", verifyToken, getMyHistory);

// Obtener cantidad promedio de missions skippeadas, pendientes y completadas (ultimos 15 dias)
router.get("/mission-state", verifyToken, requireRole('Administrador'), getAverageStatus);

// Obtener estadísticas de misiones por tipo (global y personal)
router.get("/mission-typestats", verifyToken, requireRole('Administrador'), getMissionTypeStats);

// Asignar desafío PERSONAL manualmente (slots 4 y 5)
router.post("/assign-personal", verifyToken, validationMiddleware(AssignChallengeDto), assignPersonalChallenge);

// Desasignar desafío PERSONAL (slots 4 y 5)
router.delete("/unassign-personal/:slot", verifyToken, unassignPersonalChallenge);

// Reroll de una misión GLOBAL específica (slots 1, 2, 3) - máximo 3 rerolls por día
router.patch("/reroll/:slot", verifyToken, rerollGlobalMission);

// Completar una misión (cualquier slot)
router.patch("/complete/:slot", verifyToken, completeMission);

// Skipear una misión (cualquier slot)
router.patch("/skip/:slot", verifyToken, skipMission);

export default router;
