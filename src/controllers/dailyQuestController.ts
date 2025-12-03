import { Request, Response } from "express";
import DailyQuest from "../models/dailyQuest";
import Challenge from "../models/challenge";
import User from "../models/user";

// Generar/Obtener el DailyQuest de hoy (auto-genera misiones globales si no existen)
export const initializeDailyQuest = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user?.email;

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        let dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: today, $lt: tomorrow }
        }).populate('missions.challengeId');

        // Si ya existe, devolverlo
        if (dailyQuest) {
            return res.status(200).json(dailyQuest);
        }

        // Generar desafíos globales aleatorios (hasta 3, o los que haya disponibles)
        const globalChallenges = await Challenge.aggregate([
            { 
                $match: { 
                    type: "global",
                    isActive: true,
                    'rules.minUserLevel': { $lte: user.level }
                } 
            },
            { $sample: { size: 3 } }
        ]);

        // Crear misiones solo con los desafíos disponibles (puede ser 0, 1, 2 o 3)
        const missions = globalChallenges.map((challenge, index) => ({
            slot: index + 1, // Slots 1, 2, 3
            challengeId: challenge._id,
            type: "global" as "global",
            status: "pending" as "pending",
            completedAt: null,
            pointsAwarded: 0
        }));

        dailyQuest = await DailyQuest.create({
            userId: user._id,
            date: today,
            missions,
            rerollCount: 0
        });

        // Incrementar estadísticas de los desafíos asignados
        for (const challenge of globalChallenges) {
            await Challenge.findByIdAndUpdate(
                challenge._id,
                { $inc: { 'stats.timesAssigned': 1 } }
            );
        }

        await dailyQuest.populate('missions.challengeId');

        res.status(201).json({
            message: "DailyQuest generado exitosamente",
            dailyQuest
        });

    } catch (error: any) {
        console.error("Error al inicializar DailyQuest:", error);
        res.status(500).json({ 
            error: "Error al inicializar DailyQuest",
            details: error.message 
        });
    }
};

// Asignar un desafío PERSONAL manualmente (slots 4 y 5)
export const assignPersonalChallenge = async (req: Request, res: Response) => {
    try {
        const { challengeId, slot } = req.body;
        const userEmail = req.user?.email;

        // Validar que sea slot 4 o 5
        if (slot < 4 || slot > 5) {
            return res.status(400).json({ 
                error: "Solo puedes asignar desafíos personales en los slots 4 y 5" 
            });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Verificar que el desafío existe y está activo
        const challenge = await Challenge.findById(challengeId);
        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        if (!challenge.isActive) {
            return res.status(400).json({ error: "Este desafío no está activo" });
        }

        // Validar que sea un desafío personal (puede ser de cualquier usuario)
        if (challenge.type !== "personal") {
            return res.status(400).json({ 
                error: "Solo puedes asignar desafíos personales manualmente en los slots 4 y 5" 
            });
        }

        // Verificar nivel mínimo requerido
        if (challenge.rules?.minUserLevel && user.level < challenge.rules.minUserLevel) {
            return res.status(403).json({ 
                error: `Necesitas nivel ${challenge.rules.minUserLevel} para este desafío. Tu nivel actual es ${user.level}` 
            });
        }

        // Obtener el DailyQuest de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        let dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: today, $lt: tomorrow }
        });

        // Si no existe DailyQuest, debe inicializarlo primero
        if (!dailyQuest) {
            return res.status(400).json({ 
                error: "Debes inicializar tu DailyQuest primero",
                hint: "Llama a GET /api/daily-quests/initialize" 
            });
        }

        // Verificar si el slot ya está ocupado
        const existingMission = dailyQuest.missions.find(m => m.slot === slot);
        if (existingMission) {
            return res.status(400).json({ 
                error: `El slot ${slot} ya tiene un desafío asignado`,
                currentChallenge: existingMission.challengeId 
            });
        }

        // Verificar si el usuario ya tiene este desafío asignado hoy
        const alreadyAssigned = dailyQuest.missions.find(
            m => m.challengeId.toString() === challengeId
        );
        if (alreadyAssigned) {
            return res.status(400).json({ 
                error: "Ya tienes este desafío asignado hoy",
                slot: alreadyAssigned.slot
            });
        }

        // Agregar la misión al DailyQuest
        dailyQuest.missions.push({
            slot,
            challengeId: challenge._id,
            type: "personal",
            status: "pending",
            completedAt: null,
            pointsAwarded: 0
        });

        await dailyQuest.save();

        // Incrementar estadística del desafío
        if (challenge.stats) {
            challenge.stats.timesAssigned += 1;
        } else {
            challenge.stats = {
                timesAssigned: 1,
                timesCompleted: 0,
                completionRate: 0
            };
        }
        await challenge.save();

        // Populate para devolver información completa
        await dailyQuest.populate('missions.challengeId');

        res.status(200).json({
            message: "Desafío personal asignado exitosamente",
            dailyQuest,
            assignedMission: dailyQuest.missions.find(m => m.slot === slot)
        });

    } catch (error: any) {
        console.error("Error al asignar desafío personal:", error);
        res.status(500).json({ 
            error: "Error al asignar desafío personal",
            details: error.message 
        });
    }
};

// Obtener DailyQuest del usuario autenticado (hoy)
export const getMyDailyQuest = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user?.email;

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Obtener el DailyQuest de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        let dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: today, $lt: tomorrow }
        }).populate('missions.challengeId');

        // Si no existe, devolver estructura vacía
        if (!dailyQuest) {
            return res.status(200).json({
                userId: user._id,
                date: today,
                missions: [],
                rerollCount: 0,
                message: "No tienes misiones asignadas para hoy"
            });
        }

        res.status(200).json(dailyQuest);

    } catch (error: any) {
        console.error("Error al obtener DailyQuest:", error);
        res.status(500).json({ 
            error: "Error al obtener DailyQuest",
            details: error.message 
        });
    }
};

// Desasignar un desafío PERSONAL (solo slots 4 y 5)
export const unassignPersonalChallenge = async (req: Request, res: Response) => {
    try {
        const { slot } = req.params;
        const userEmail = req.user?.email;
        const slotNumber = Number(slot);

        // Validar que sea slot 4 o 5
        if (slotNumber < 4 || slotNumber > 5) {
            return res.status(400).json({ 
                error: "Solo puedes desasignar desafíos personales (slots 4 y 5)" 
            });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: today, $lt: tomorrow }
        });

        if (!dailyQuest) {
            return res.status(404).json({ error: "No tienes misiones para hoy" });
        }

        const missionIndex = dailyQuest.missions.findIndex(m => m.slot === slotNumber);

        if (missionIndex === -1) {
            return res.status(404).json({ error: `No hay desafío en el slot ${slot}` });
        }

        // No permitir desasignar si ya está completado
        if (dailyQuest.missions[missionIndex].status === "completed") {
            return res.status(400).json({ 
                error: "No puedes desasignar un desafío que ya completaste" 
            });
        }

        // Remover la misión
        dailyQuest.missions.splice(missionIndex, 1);
        await dailyQuest.save();

        res.status(200).json({
            message: "Desafío personal desasignado exitosamente",
            dailyQuest
        });

    } catch (error: any) {
        console.error("Error al desasignar desafío personal:", error);
        res.status(500).json({ 
            error: "Error al desasignar desafío personal",
            details: error.message 
        });
    }
};

// Reroll de UNA misión global específica (slot 1, 2, o 3)
export const rerollGlobalMission = async (req: Request, res: Response) => {
    try {
        const { slot } = req.params;
        const userEmail = req.user?.email;
        const slotNumber = Number(slot);

        // Validar que sea slot 1, 2 o 3
        if (slotNumber < 1 || slotNumber > 3) {
            return res.status(400).json({ 
                error: "Solo puedes hacer reroll de misiones globales (slots 1, 2, 3)" 
            });
        }

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: today, $lt: tomorrow }
        });

        if (!dailyQuest) {
            return res.status(404).json({ error: "No tienes misiones para hoy" });
        }

        // Verificar límite de rerolls (máximo 3 por día)
        if (dailyQuest.rerollCount >= 3) {
            return res.status(400).json({ 
                error: "Has alcanzado el límite de rerolls diarios (3)",
                rerollsUsed: dailyQuest.rerollCount
            });
        }

        const missionIndex = dailyQuest.missions.findIndex(m => m.slot === slotNumber);

        if (missionIndex === -1) {
            return res.status(404).json({ error: `No hay misión en el slot ${slot}` });
        }

        const currentMission = dailyQuest.missions[missionIndex];

        // No permitir reroll de misiones completadas
        if (currentMission.status === "completed") {
            return res.status(400).json({ 
                error: "No puedes hacer reroll de una misión completada" 
            });
        }

        // Obtener IDs de desafíos ya asignados hoy
        const assignedChallengeIds = dailyQuest.missions.map(m => m.challengeId.toString());

        // Buscar un nuevo desafío global (excluyendo los ya asignados)
        const newChallenges = await Challenge.aggregate([
            { 
                $match: { 
                    type: "global",
                    isActive: true,
                    'rules.minUserLevel': { $lte: user.level },
                    _id: { $nin: assignedChallengeIds.map(id => new (require('mongoose').Types.ObjectId)(id)) }
                } 
            },
            { $sample: { size: 1 } }
        ]);

        if (newChallenges.length === 0) {
            return res.status(400).json({ 
                error: "No hay más desafíos globales disponibles para reroll" 
            });
        }

        // Reemplazar el desafío (modificar propiedades del subdocumento)
        dailyQuest.missions[missionIndex].challengeId = newChallenges[0]._id;
        dailyQuest.missions[missionIndex].status = "pending";
        dailyQuest.missions[missionIndex].completedAt = null as any;
        dailyQuest.missions[missionIndex].pointsAwarded = 0;

        dailyQuest.rerollCount += 1;
        await dailyQuest.save();

        // Incrementar estadística del nuevo desafío
        await Challenge.findByIdAndUpdate(
            newChallenges[0]._id,
            { $inc: { 'stats.timesAssigned': 1 } }
        );

        await dailyQuest.populate('missions.challengeId');

        res.status(200).json({
            message: "Reroll exitoso",
            dailyQuest,
            rerollsRemaining: 3 - dailyQuest.rerollCount,
            newMission: dailyQuest.missions[missionIndex]
        });

    } catch (error: any) {
        console.error("Error al hacer reroll:", error);
        res.status(500).json({ 
            error: "Error al hacer reroll",
            details: error.message 
        });
    }
};

// Completar una misión (marcar como completed y otorgar puntos)
export const completeMission = async (req: Request, res: Response) => {
    try {
        const { slot } = req.params;
        const userEmail = req.user?.email;
        const slotNumber = Number(slot);

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: today, $lt: tomorrow }
        }).populate('missions.challengeId');

        if (!dailyQuest) {
            return res.status(404).json({ error: "No tienes misiones para hoy" });
        }

        const missionIndex = dailyQuest.missions.findIndex(m => m.slot === slotNumber);

        if (missionIndex === -1) {
            return res.status(404).json({ error: `No hay misión en el slot ${slot}` });
        }

        const mission = dailyQuest.missions[missionIndex];

        if (mission.status === "completed") {
            return res.status(400).json({ error: "Esta misión ya fue completada" });
        }

        // Obtener el desafío para saber los puntos
        const challenge = await Challenge.findById(mission.challengeId);
        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        // Marcar como completada y asignar puntos
        mission.status = "completed";
        mission.completedAt = new Date();
        mission.pointsAwarded = challenge.points;

        await dailyQuest.save();

        // Actualizar estadísticas del usuario
        user.stats = user.stats || { totalPoints: 0, weeklyPoints: 0, totalCompleted: 0, currentStreak: 0 };
        user.stats.totalPoints += challenge.points;
        user.stats.weeklyPoints += challenge.points;
        user.stats.totalCompleted += 1;
        user.lastActive = new Date();
        await user.save();

        // Actualizar estadísticas del desafío
        if (challenge.stats) {
            challenge.stats.timesCompleted += 1;
            if (challenge.stats.timesAssigned > 0) {
                challenge.stats.completionRate = 
                    (challenge.stats.timesCompleted / challenge.stats.timesAssigned) * 100;
            }
        }
        await challenge.save();

        await dailyQuest.populate('missions.challengeId');

        res.status(200).json({
            message: "¡Misión completada!",
            pointsEarned: challenge.points,
            dailyQuest,
            userStats: user.stats
        });

    } catch (error: any) {
        console.error("Error al completar misión:", error);
        res.status(500).json({ 
            error: "Error al completar misión",
            details: error.message 
        });
    }
};

// Skipear una misión (marcar como skipped)
export const skipMission = async (req: Request, res: Response) => {
    try {
        const { slot } = req.params;
        const userEmail = req.user?.email;
        const slotNumber = Number(slot);

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: today, $lt: tomorrow }
        });

        if (!dailyQuest) {
            return res.status(404).json({ error: "No tienes misiones para hoy" });
        }

        const missionIndex = dailyQuest.missions.findIndex(m => m.slot === slotNumber);

        if (missionIndex === -1) {
            return res.status(404).json({ error: `No hay misión en el slot ${slot}` });
        }

        const mission = dailyQuest.missions[missionIndex];

        if (mission.status === "completed") {
            return res.status(400).json({ error: "No puedes skipear una misión completada" });
        }

        mission.status = "skipped";
        await dailyQuest.save();

        res.status(200).json({
            message: "Misión skipeada",
            dailyQuest
        });

    } catch (error: any) {
        console.error("Error al skipear misión:", error);
        res.status(500).json({ 
            error: "Error al skipear misión",
            details: error.message 
        });
    }
};

// Obtener historial de DailyQuests (últimos 30 días)
export const getMyHistory = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user?.email;
        const { days = 30 } = req.query;

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Number(days));
        startDate.setHours(0, 0, 0, 0);

        const history = await DailyQuest.find({
            userId: user._id,
            date: { $gte: startDate }
        })
        .populate('missions.challengeId')
        .sort({ date: -1 });

        // Calcular estadísticas del periodo
        let totalCompleted = 0;
        let totalPoints = 0;
        let totalSkipped = 0;

        history.forEach(quest => {
            quest.missions.forEach(mission => {
                if (mission.status === "completed") {
                    totalCompleted += 1;
                    totalPoints += mission.pointsAwarded;
                } else if (mission.status === "skipped") {
                    totalSkipped += 1;
                }
            });
        });

        res.status(200).json({
            history,
            stats: {
                days: history.length,
                totalCompleted,
                totalPoints,
                totalSkipped,
                averagePerDay: history.length > 0 ? (totalCompleted / history.length).toFixed(2) : 0
            }
        });

    } catch (error: any) {
        console.error("Error al obtener historial:", error);
        res.status(500).json({ 
            error: "Error al obtener historial",
            details: error.message 
        });
    }
};
