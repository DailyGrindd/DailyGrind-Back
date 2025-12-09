import { Request, Response } from "express";
import DailyQuest from "../models/dailyQuest";
import Challenge from "../models/challenge";
import User from "../models/user";
import { calculateUserLevelInfo, updateUserLevelIfNeeded, calculateBonusPointsFromChallenge } from "../utils/levelSystem";

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
        // Solo asignar desafíos sin prerequisitos (los que tienen prerequisito se desbloquean al completar)
        const globalChallenges = await Challenge.aggregate([
            { 
                $match: { 
                    type: "global",
                    isActive: true,
                    'rules.minUserLevel': { $lte: user.level },
                    $or: [
                        { 'requirements.preRequisiteChallenge': { $exists: false } },
                        { 'requirements.preRequisiteChallenge': null }
                    ]
                } 
            },
            { $sample: { size: 3 } }
        ]);

        // Crear exactamente 3 slots (1, 2, 3) aunque no haya suficientes desafíos
        const missions: any[] = [];

        for (let slot = 1; slot <= 3; slot++) {
            const challenge = globalChallenges[slot - 1]; // undefined si no hay suficientes
            
            if (challenge) {
                missions.push({
                    slot,
                    challengeId: challenge._id,
                    type: "global" as "global",
                    status: "pending" as "pending",
                    completedAt: null,
                    pointsAwarded: 0
                });
                
                // Incrementar estadística del desafío
                await Challenge.findByIdAndUpdate(
                    challenge._id,
                    { $inc: { 'stats.timesAssigned': 1 } }
                );
            }
            // Si no hay challenge, el slot queda vacío (no agregamos nada al array)
        }

        dailyQuest = await DailyQuest.create({
            userId: user._id,
            date: today,
            missions,
            rerollCount: 0
        });

        await dailyQuest.populate('missions.challengeId');

        res.status(201).json({
            message: "DailyQuest generado exitosamente",
            dailyQuest
        });

    } catch (error: any) {
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
        }).populate('missions.challengeId');

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
        
        // Marcar como modificado para asegurar que Mongoose detecte el cambio
        dailyQuest.markModified('missions');
        await dailyQuest.save();

        res.status(200).json({
            message: "Desafío personal desasignado exitosamente",
            dailyQuest
        });

    } catch (error: any) {
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
        // Solo desafíos sin prerequisitos (los que tienen se desbloquean al completar el previo)
        const newChallenges = await Challenge.aggregate([
            { 
                $match: { 
                    type: "global",
                    isActive: true,
                    'rules.minUserLevel': { $lte: user.level },
                    _id: { $nin: assignedChallengeIds.map(id => new (require('mongoose').Types.ObjectId)(id)) },
                    $or: [
                        { 'requirements.preRequisiteChallenge': { $exists: false } },
                        { 'requirements.preRequisiteChallenge': null }
                    ]
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

        // Calcular puntos totales incluyendo bonus por dificultad
        const basePoints = challenge.points;
        const bonusPoints = calculateBonusPointsFromChallenge(basePoints, challenge.difficulty);
        const totalPointsEarned = basePoints + bonusPoints;

        // ✅ MANTENER la misión como completada (NO reemplazar)
        mission.status = "completed";
        mission.completedAt = new Date();
        mission.pointsAwarded = totalPointsEarned;

        // Calcular información de nivel antes de actualizar
        const levelInfoBefore = calculateUserLevelInfo(user.level, user.stats?.totalPoints || 0);

        // Actualizar estadísticas del usuario (sumar puntos)
        user.stats = user.stats || { totalPoints: 0, weeklyPoints: 0, totalCompleted: 0, currentStreak: 0 };
        user.stats.totalPoints += totalPointsEarned;
        user.stats.weeklyPoints += totalPointsEarned;
        user.stats.totalCompleted += 1;
        
        // Actualizar streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const yesterdayQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: yesterday, $lt: today }
        });
        
        const hasCompletedYesterday = yesterdayQuest && yesterdayQuest.missions.some(m => m.status === "completed");
        
        if (hasCompletedYesterday || user.stats.currentStreak === 0) {
            user.stats.currentStreak += 1;
        } else {
            user.stats.currentStreak = 1;
        }
        
        user.lastActive = new Date();
        
        // Calcular información de nivel después de actualizar puntos
        const levelInfoAfter = calculateUserLevelInfo(user.level, user.stats.totalPoints);
        
        // Verificar si hay subida de nivel
        const hasLeveledUp = await updateUserLevelIfNeeded(user);
        
        if (!hasLeveledUp) {
            await user.save();
        }

        // Actualizar estadísticas del desafío
        if (challenge.stats) {
            challenge.stats.timesCompleted += 1;
            if (challenge.stats.timesAssigned > 0) {
                challenge.stats.completionRate = 
                    (challenge.stats.timesCompleted / challenge.stats.timesAssigned) * 100;
            }
        }
        await challenge.save();

        // 🔑 Verificar si este desafío desbloquea otro en la cadena
        const nextChallenge = await Challenge.findOne({
            type: "global",
            isActive: true,
            'requirements.preRequisiteChallenge': challenge._id,
            'rules.minUserLevel': { $lte: user.level }
        });

        let unlockedChallenge = null;
        let assignedToSlot = null;

        if (nextChallenge) {
            // ✅ Verificar si el desafío desbloqueado ya existe O ya fue completado antes en el día
            const alreadyExists = dailyQuest.missions.some(m => 
                m.challengeId.toString() === nextChallenge._id.toString()
            );

            if (!alreadyExists) {
                // 🎯 Verificar si el prerequisito completado ya había desbloqueado este desafío antes
                // Buscar si existe otra misión con el mismo challengeId del prerequisito que ya está completada
                const prerequisiteCompletedBefore = dailyQuest.missions.some(m => 
                    m.challengeId.toString() === challenge._id.toString() && 
                    m.slot !== slotNumber &&
                    m.status === "completed"
                );

                if (!prerequisiteCompletedBefore) {
                    // 🎯 Los desafíos desbloqueados SIEMPRE se asignan a partir del slot 6
                    // (slots 1-3 son para misiones iniciales, 4-5 para personales)
                    const usedSlots = dailyQuest.missions.map(m => m.slot).sort((a, b) => a - b);
                    
                    // Buscar el primer slot disponible comenzando desde 6
                    let availableSlot = 6;
                    while (usedSlots.includes(availableSlot)) {
                        availableSlot++;
                    }

                    // Agregar nueva misión en slot disponible
                    dailyQuest.missions.push({
                        slot: availableSlot,
                        challengeId: nextChallenge._id,
                        type: "global",
                        status: "pending",
                        completedAt: null as any,
                        pointsAwarded: 0
                    } as any);

                    assignedToSlot = availableSlot;
                    
                    await Challenge.findByIdAndUpdate(
                        nextChallenge._id,
                        { $inc: { 'stats.timesAssigned': 1 } }
                    );
                    
                    unlockedChallenge = {
                        id: nextChallenge._id,
                        title: nextChallenge.title,
                        description: nextChallenge.description,
                        category: nextChallenge.category,
                        points: nextChallenge.points,
                        difficulty: nextChallenge.difficulty,
                        slot: assignedToSlot,
                        message: "¡Nuevo desafío desbloqueado!"
                    };
                }
            }
        }

        // Guardar el dailyQuest con la misión marcada como completada
        await dailyQuest.save();
        await dailyQuest.populate('missions.challengeId');

        // Preparar respuesta
        const finalLevelInfo = calculateUserLevelInfo(user.level, user.stats.totalPoints);
        
        const responseData: any = {
            message: unlockedChallenge 
                ? "¡Misión completada! Has desbloqueado un nuevo desafío" 
                : "¡Misión completada!",
            pointsEarned: basePoints,
            bonusPoints: bonusPoints,
            totalPointsAwarded: totalPointsEarned,
            dailyQuest,
            userStats: user.stats,
            levelInfo: {
                currentLevel: finalLevelInfo.currentLevel,
                totalPoints: finalLevelInfo.totalPoints,
                currentLevelPoints: finalLevelInfo.currentLevelPoints,
                pointsToNextLevel: finalLevelInfo.pointsToNextLevel,
                pointsRequiredForNextLevel: finalLevelInfo.pointsRequiredForNextLevel,
                progressPercent: finalLevelInfo.progressPercent
            }
        };

        // Si se desbloqueó un nuevo desafío, incluir la información
        if (unlockedChallenge) {
            responseData.unlockedChallenge = unlockedChallenge;
        }

        // ✅ Si hubo level up, incluir información
        if (hasLeveledUp) {
            responseData.levelUp = {
                message: `¡Felicitaciones! Has subido al nivel ${finalLevelInfo.currentLevel}!`,
                previousLevel: levelInfoBefore.currentLevel,
                newLevel: finalLevelInfo.currentLevel,
                pointsUsed: finalLevelInfo.totalPoints
            };
        }

        res.status(200).json(responseData);

    } catch (error: any) {
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
            return res.status(400).json({ error: "No puedes skipear una misión completada" });
        }

        mission.status = "skipped";
        await dailyQuest.save();

        res.status(200).json({
            message: "Misión skipeada",
            dailyQuest
        });

    } catch (error: any) {
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
        res.status(500).json({ 
            error: "Error al obtener historial",
            details: error.message 
        });
    }
};

// Cantidad promedio de missions skippeadas, pendientes y completadas (ultimos 15 dias)
export const getAverageStatus = async (req: Request, res: Response) => {
    try {
        // Obtener todas las dailyQuests de los últimos 15 días
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        fifteenDaysAgo.setHours(0, 0, 0, 0);

        const dailyQuests = await DailyQuest.find({
            date: { $gte: fifteenDaysAgo }
        });

        if (dailyQuests.length === 0) {
            return res.status(200).json({
                message: "No hay datos de los últimos 15 días",
                totalSkipped: 0,
                totalPending: 0,
                totalCompleted: 0,
                averageSkipped: "0%",
                averagePending: "0%",
                averageCompleted: "0%",
                period: "Últimos 15 días"
            });
        }

        let totalSkipped = 0;
        let totalPending = 0;
        let totalCompleted = 0;
        let totalMissions = 0;

        dailyQuests.forEach(quest => {
            quest.missions.forEach(mission => {
                totalMissions += 1;
                if (mission.status === "skipped") {
                    totalSkipped += 1;
                } else if (mission.status === "pending") {
                    totalPending += 1;
                } else if (mission.status === "completed") {
                    totalCompleted += 1;
                }
            });
        });

        // Calcular promedios en porcentaje
        const averageSkipped = totalMissions > 0 ? ((totalSkipped / totalMissions) * 100).toFixed(1) : "0";
        const averagePending = totalMissions > 0 ? ((totalPending / totalMissions) * 100).toFixed(1) : "0";
        const averageCompleted = totalMissions > 0 ? ((totalCompleted / totalMissions) * 100).toFixed(1) : "0";

        res.status(200).json({
            totalSkipped,
            totalPending,
            totalCompleted,
            averageSkipped: `${averageSkipped}%`,
            averagePending: `${averagePending}%`,
            averageCompleted: `${averageCompleted}%`,
            period: "Últimos 15 días"
        });

    } catch (error: any) {
        res.status(500).json({ 
            error: "Error al obtener promedios de skip, pending, completed",
            details: error.message 
        });
    }
};

// Cantidad de missions personal y cantidad de missions global y % de completadas
export const getMissionTypeStats = async (req: Request, res: Response) => {
    try {
        const totalMissionsGlobal = await DailyQuest.aggregate([
            { $unwind: "$missions" },
            { $match: { "missions.type": "global" } },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]);

        const totalMissionsPersonal = await DailyQuest.aggregate([
            { $unwind: "$missions" },
            { $match: { "missions.type": "personal" } },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]);

        const completedMissionsGlobal = await DailyQuest.aggregate([
            { $unwind: "$missions" },
            { $match: { 
                "missions.type": "global",
                "missions.status": "completed"
            }},
            { $group: { _id: null, count: { $sum: 1 } } }
        ]);

        const completedMissionsPersonal = await DailyQuest.aggregate([
            { $unwind: "$missions" },
            { $match: { 
                "missions.type": "personal",
                "missions.status": "completed"
            }},
            { $group: { _id: null, count: { $sum: 1 } } }
        ]);

        const totalGlobal = totalMissionsGlobal[0]?.count || 0;
        const totalPersonal = totalMissionsPersonal[0]?.count || 0;
        const completedGlobal = completedMissionsGlobal[0]?.count || 0;
        const completedPersonal = completedMissionsPersonal[0]?.count || 0;

        // Calcular porcentajes
        const percentageGlobalCompleted = totalGlobal > 0 
            ? ((completedGlobal / totalGlobal) * 100).toFixed(1) 
            : 0;

        const percentagePersonalCompleted = totalPersonal > 0 
            ? ((completedPersonal / totalPersonal) * 100).toFixed(1) 
            : 0;

        res.status(200).json({
            global: {
                total: totalGlobal,
                completed: completedGlobal,
                percentageCompleted: `${percentageGlobalCompleted}%`
            },
            personal: {
                total: totalPersonal,
                completed: completedPersonal,
                percentageCompleted: `${percentagePersonalCompleted}%`
            }
        });

    } catch (error: any) {
        res.status(500).json({ 
            error: "Error al obtener estadísticas de misiones",
            details: error.message 
        });
    }
};

// Verificar y actualizar nivel del usuario basado en puntos totales
export const checkAndUpdateLevel = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user?.email;

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Calcular información de nivel antes de la actualización
        const levelInfoBefore = calculateUserLevelInfo(user.level, user.stats?.totalPoints || 0);
        
        // Verificar si necesita actualizar nivel
        const hasLeveledUp = await updateUserLevelIfNeeded(user);
        
        // Calcular información después de la actualización
        const levelInfoAfter = calculateUserLevelInfo(user.level, user.stats?.totalPoints || 0);

        const response: any = {
            message: hasLeveledUp ? "¡Nivel actualizado!" : "Tu nivel está actualizado",
            levelInfo: {
                currentLevel: levelInfoAfter.currentLevel,
                totalPoints: levelInfoAfter.totalPoints,
                currentLevelPoints: levelInfoAfter.currentLevelPoints,
                pointsToNextLevel: levelInfoAfter.pointsToNextLevel,
                progressPercent: levelInfoAfter.progressPercent
            },
            userStats: user.stats
        };

        res.status(200).json(response);

    } catch (error: any) {
        res.status(500).json({ 
            error: "Error al verificar nivel del usuario",
            details: error.message 
        });
    }
};
