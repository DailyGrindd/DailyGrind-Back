import { Request, Response } from "express";
import Challenge from "../models/challenge";
import User from "../models/user";

// Listar todos los desafíos con filtros opcionales
export const getAllChallenges = async (req: Request, res: Response) => {
    try {
        const { type, category, difficulty, isActive } = req.query;
        
        const filter: any = {};
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (difficulty) filter.difficulty = Number(difficulty);
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const challenges = await Challenge.find(filter)
            .populate('ownerUser', 'userName profile.displayName profile.isPublic')
            .sort({ createdAt: -1 });

        res.status(200).json(challenges);
    } catch (error: any) {
        console.error("Error al obtener desafíos:", error);
        res.status(500).json({ 
            error: "Error al obtener desafíos",
            details: error.message 
        });
    }
};

// Obtener un desafío por ID
export const getChallengeById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const challenge = await Challenge.findById(id)
            .populate('ownerUser', 'userName profile.displayName profile.isPublic')
            .populate('requirements.preRequisiteChallenge', 'title');

        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        res.status(200).json(challenge);
    } catch (error: any) {
        console.error("Error al obtener desafío:", error);
        res.status(500).json({ 
            error: "Error al obtener desafío",
            details: error.message 
        });
    }
};

// Crear un nuevo desafío
export const createChallenge = async (req: Request, res: Response) => {
    try {
        const { 
            type, ownerUser, title, description, category, difficulty, 
            points, isActive, tags, minLevel, preRequisiteChallenge, 
            maxPerDay, minUserLevel 
        } = req.body;

        const userRole = (req as any).user?.role;
        const userEmail = (req as any).user?.email;

        // Validar permisos según tipo de desafío
        if (type === "global" && userRole !== "Administrador") {
            return res.status(403).json({ 
                error: "Solo los administradores pueden crear desafíos globales" 
            });
        }

        if (type === "personal" && userRole === "Administrador") {
            return res.status(400).json({ 
                error: "Los administradores solo pueden crear desafíos globales" 
            });
        }

        // Si es personal, el ownerUser debe ser el usuario autenticado
        let finalOwnerUser = ownerUser;
        if (type === "personal") {
            const User = (await import("../models/user")).default;
            const currentUser = await User.findOne({ email: userEmail });
            if (!currentUser) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }
            finalOwnerUser = currentUser._id;
        }

        const challenge = await Challenge.create({
            type,
            ownerUser: finalOwnerUser,
            title,
            description,
            category,
            difficulty,
            points,
            isActive: isActive !== undefined ? isActive : true,
            tags: tags || [],
            requirements: {
                minLevel: minLevel || 0,
                preRequisiteChallenge: preRequisiteChallenge || null
            },
            rules: {
                maxPerDay: maxPerDay || 1,
                minUserLevel: minUserLevel || 0
            }
        });

        res.status(201).json({
            message: "Desafío creado exitosamente",
            challenge
        });
    } catch (error: any) {
        console.error("Error al crear desafío:", error);
        res.status(500).json({ 
            error: "Error al crear desafío",
            details: error.message 
        });
    }
};

// Actualizar un desafío
export const updateChallenge = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData: any = { ...req.body };
        const userRole = (req as any).user?.role;
        const userEmail = (req as any).user?.email;

        // Buscar el desafío primero (SIN populate porq generaba problemas)
        const challenge = await Challenge.findById(id);

        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        // Verificar permisos: solo admin o el owner pueden editar
        if (userRole !== "Administrador") {
            const User = (await import("../models/user")).default;
            const currentUser = await User.findOne({ email: userEmail });
            
            if (!currentUser || !challenge.ownerUser || 
                challenge.ownerUser.toString() !== currentUser._id.toString()) {
                return res.status(403).json({ 
                    error: "No tienes permiso para editar este desafío" 
                });
            }
        }

        // Manejar campos anidados
        if (req.body.minLevel !== undefined || req.body.preRequisiteChallenge !== undefined) {
            updateData.requirements = {};
            if (req.body.minLevel !== undefined) updateData.requirements.minLevel = req.body.minLevel;
            if (req.body.preRequisiteChallenge !== undefined) updateData.requirements.preRequisiteChallenge = req.body.preRequisiteChallenge;
        }

        if (req.body.maxPerDay !== undefined || req.body.minUserLevel !== undefined) {
            updateData.rules = {};
            if (req.body.maxPerDay !== undefined) updateData.rules.maxPerDay = req.body.maxPerDay;
            if (req.body.minUserLevel !== undefined) updateData.rules.minUserLevel = req.body.minUserLevel;
        }

        // Limpiar campos que se manejaron como anidados
        delete updateData.minLevel;
        delete updateData.preRequisiteChallenge;
        delete updateData.maxPerDay;
        delete updateData.minUserLevel;

        const updatedChallenge = await Challenge.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: "Desafío actualizado exitosamente",
            challenge: updatedChallenge
        });
    } catch (error: any) {
        console.error("Error al actualizar desafío:", error);
        res.status(500).json({ 
            error: "Error al actualizar desafío",
            details: error.message 
        });
    }
};

// Eliminar un desafío
// Eliminar desafío (baja lógica - solo cambia isActive a false)
export const deleteChallenge = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userEmail = req.user?.email;
        const userRole = req.user?.role;

        const challenge = await Challenge.findById(id);

        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        // Si no es administrador, verificar que sea el owner
        if (userRole !== "Administrador") {
            const currentUser = await User.findOne({ email: userEmail });
            if (!currentUser || !challenge.ownerUser || challenge.ownerUser.toString() !== currentUser._id.toString()) {
                return res.status(403).json({ error: "No tienes permiso para desactivar este desafío" });
            }
        }

        challenge.isActive = false;
        await challenge.save();

        res.status(200).json({
            message: "Desafío desactivado exitosamente",
            challenge
        });
    } catch (error: any) {
        console.error("Error al desactivar desafío:", error);
        res.status(500).json({ 
            error: "Error al desactivar desafío",
            details: error.message 
        });
    }
};

// Reactivar desafío (cambia isActive a true, solo el owner o admin)
export const reactivateChallenge = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userRole = (req as any).user?.role;
        const userEmail = (req as any).user?.email;

        // Buscar el desafío
        const challenge = await Challenge.findById(id);

        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        // Verificar permisos: solo admin o el owner pueden reactivar
        if (userRole !== "Administrador") {
            const User = (await import("../models/user")).default;
            const currentUser = await User.findOne({ email: userEmail });
            
            if (!currentUser || !challenge.ownerUser || 
                challenge.ownerUser.toString() !== currentUser._id.toString()) {
                return res.status(403).json({ 
                    error: "No tienes permiso para reactivar este desafío" 
                });
            }
        }

        // Reactivar el desafío
        challenge.isActive = true;
        await challenge.save();

        res.status(200).json({
            message: "Desafío reactivado exitosamente",
            challenge
        });
    } catch (error: any) {
        console.error("Error al reactivar desafío:", error);
        res.status(500).json({ 
            error: "Error al reactivar desafío",
            details: error.message 
        });
    }
};

// Obtener desafíos por categoría
export const getChallengesByCategory = async (req: Request, res: Response) => {
    try {
        const { category } = req.params;

        const challenges = await Challenge.find({ category, isActive: true })
            .populate('ownerUser', 'userName profile.displayName profile.isPublic')
            .sort({ difficulty: 1, points: -1 });

        res.status(200).json(challenges);
    } catch (error: any) {
        console.error("Error al obtener desafíos por categoría:", error);
        res.status(500).json({ 
            error: "Error al obtener desafíos",
            details: error.message 
        });
    }
};

// Obtener desafíos random (para asignar misiones)
export const getRandomChallenges = async (req: Request, res: Response) => {
    try {
        const { count = 3, type, userLevel = 1 } = req.query;

        const filter: any = { isActive: true };
        if (type) filter.type = type;
        filter['rules.minUserLevel'] = { $lte: Number(userLevel) };

        const challenges = await Challenge.aggregate([
            { $match: filter },
            { $sample: { size: Number(count) } }
        ]);

        res.status(200).json(challenges);
    } catch (error: any) {
        console.error("Error al obtener desafíos random:", error);
        res.status(500).json({ 
            error: "Error al obtener desafíos random",
            details: error.message 
        });
    }
};

// Incrementar estadísticas cuando se asigna un desafío
export const incrementAssigned = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const challenge = await Challenge.findByIdAndUpdate(
            id,
            { $inc: { 'stats.timesAssigned': 1 } },
            { new: true }
        );

        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        res.status(200).json({
            message: "Estadística actualizada",
            challenge
        });
    } catch (error: any) {
        console.error("Error al actualizar estadística:", error);
        res.status(500).json({ 
            error: "Error al actualizar estadística",
            details: error.message 
        });
    }
};

// Completar un desafío (incrementar estadísticas)
export const completeChallenge = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const challenge = await Challenge.findById(id);

        if (!challenge) {
            return res.status(404).json({ error: "Desafío no encontrado" });
        }

        // Verificar que stats existe
        if (!challenge.stats) {
            challenge.stats = {
                timesAssigned: 0,
                timesCompleted: 0,
                completionRate: 0
            };
        }

        // Incrementar completados
        challenge.stats.timesCompleted += 1;

        // Calcular tasa de completación
        if (challenge.stats.timesAssigned > 0) {
            challenge.stats.completionRate = 
                (challenge.stats.timesCompleted / challenge.stats.timesAssigned) * 100;
        }

        await challenge.save();

        res.status(200).json({
            message: "Desafío completado exitosamente",
            challenge
        });
    } catch (error: any) {
        console.error("Error al completar desafío:", error);
        res.status(500).json({ 
            error: "Error al completar desafío",
            details: error.message 
        });
    }
};

// Obtener estadísticas de desafíos
export const getChallengeStats = async (req: Request, res: Response) => {
    try {
        const totalChallenges = await Challenge.countDocuments();
        const activeChallenges = await Challenge.countDocuments({ isActive: true });
        const inactiveChallenges = await Challenge.countDocuments({ isActive: false });

        const statsByType = await Challenge.aggregate([
            { $group: { _id: "$type", count: { $sum: 1 } } }
        ]);

        const statsByCategory = await Challenge.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        const topCompleted = await Challenge.find()
            .sort({ 'stats.timesCompleted': -1 })
            .limit(10)
            .select('title stats.timesCompleted stats.completionRate');

        res.status(200).json({
            total: totalChallenges,
            active: activeChallenges,
            inactive: inactiveChallenges,
            byType: statsByType,
            byCategory: statsByCategory,
            topCompleted
        });
    } catch (error: any) {
        console.error("Error al obtener estadísticas:", error);
        res.status(500).json({ 
            error: "Error al obtener estadísticas",
            details: error.message 
        });
    }
};

// Obtener estadísticas por categoría de desafíos
export const getChallengeTypeComplete = async (req: Request, res: Response) => {
    try {
        // Obtener estadísticas por categoría de desafío
        const statsByCategory = await Challenge.aggregate([
            {
                $group: {
                    _id: "$category",
                    totalAssigned: { $sum: "$stats.timesAssigned" },
                    totalCompleted: { $sum: "$stats.timesCompleted" },
                    totalChallenges: { $sum: 1 }
                }
            },
            {
                $project: {
                    category: "$_id",
                    totalAssigned: 1,
                    totalCompleted: 1,
                    totalChallenges: 1,
                    _id: 0
                }
            },
            {
                $sort: { totalCompleted: -1 }
            }
        ]);

        res.status(200).json({
            data: statsByCategory.map(stat => ({
                category: stat.category,
                totalChallenges: stat.totalChallenges,
                totalAssigned: stat.totalAssigned,
                totalCompleted: stat.totalCompleted
            }))
        });

    } catch (error: any) {
        console.error("Error al obtener estadísticas por categoría:", error);
        res.status(500).json({ 
            error: "Error al obtener estadísticas por categoría",
            details: error.message 
        });
    }
}