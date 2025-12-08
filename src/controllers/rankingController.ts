import { Request, Response } from "express";
import User from "../models/user";

//GET /api/ranking/global
export const getGlobalRanking = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const users = await User.find({
            'profile.isPublic': true,
            isActive: true
        })
        . select('profile.displayName profile.avatarUrl profile.zone level stats.totalPoints stats.totalCompleted')
        . sort({
            'stats.totalPoints': -1,//de mayor a menos
            'stats.totalCompleted': -1,
            'level': -1 
        })
        . skip(skip)
        . limit(limit)
        .lean();

        const totalUsers = await User.countDocuments({
            'profile.isPublic': true,
            isActive: true      
        });

        const rankings = users.map((user, index) => ({
            rank: skip + index + 1,
            userId: user._id,
            displayName: user.profile?.displayName || '',
            avatarUrl: user.profile?.avatarUrl || '',
            zone: user.profile?.zone || '',
            level: user.level,
            totalPoints: user.stats?.totalPoints || 0,
            totalCompleted: user.stats?.totalCompleted || 0
        }));
        res.status(200).json({
            totalUsers,
            page,
            limit,
            rankings,
            totalPages: Math.ceil(totalUsers / limit)
        });
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el ranking global." });
    }
}

export const getMyGlobalPosition = async (req: Request, res: Response) => {
    try {
        const userEmail = req.params.email;
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        //encontrar posicion del usuario
        const rank = await User.countDocuments({
            'profile.isPublic': true,
            isActive: true,
            $or: [
                { 'stats.totalPoints': { $gt: user.stats?.totalPoints || 0 } },
                {
                    'stats.totalPoints': user.stats?.totalPoints || 0,
                    'level': { $gt: user.level }
                },
                {
                    'stats.totalPoints': user.stats?.totalPoints || 0,
                    'level': user.level,
                    'stats.totalCompleted': { $gt: user.stats?.totalCompleted || 0 }
                }
            ]
        }) + 1;

        // usuarios cercanos +- 5 posiciones
        const nearbyAbove = await User.find({
            'profile.isPublic': true,
            isActive: true,
            $or: [
                { 'stats.totalPoints': { $gt: user.stats?.totalPoints || 0 } },
                {   
                    'stats.totalPoints': user.stats?.totalPoints || 0,
                    'level': { $gt: user.level }
                }
            ]
        })
        .select('profile.displayName profile.avatarUrl profile.zone level stats.totalPoints stats.totalCompleted')
        .sort({
            'stats.totalPoints': -1,
            'stats.totalCompleted': -1,
            'level': -1 
        })
        .limit(5)
        .lean();

        const nearbyBelow = await User.find({
            'profile.isPublic': true,
            isActive: true,
            $or: [
                { 'stats.totalPoints': { $lt: user.stats?.totalPoints || 0 } },
                {
                    'stats.totalPoints': user.stats?.totalPoints || 0,  
                    'level': { $lt: user.level }
                }
            ]
        })
        .select('profile.displayName profile.avatarUrl profile.zone level stats.totalPoints stats.totalCompleted')  
        .sort({
            'stats.totalPoints': -1,
            'stats.totalCompleted': -1,
            'level': -1
        })
        .limit(5)
        .lean();

        const totalUsers = await User.countDocuments({
            'profile.isPublic': true,
            isActive: true      
        });

        // Construir respuesta
        const nearby = [
            ...nearbyAbove.reverse().map((u, idx) => ({
                rank: rank - (nearbyAbove.length - idx),
                displayName: u.profile?.displayName || '',
                avatarUrl: u.profile?.avatarUrl || '',
                zone: u.profile?.zone || '',
                level: u.level,
                totalPoints: u.stats?.totalPoints || 0,
                totalCompleted: u.stats?.totalCompleted || 0
            })),
            {
                rank,
                userId: user._id,
                displayName: user.profile?.displayName || '',
                avatarUrl: user.profile?.avatarUrl || '',
                zone: user.profile?.zone || '',
                level: user.level,
                totalPoints: user.stats?.totalPoints || 0,
                totalCompleted: user.stats?.totalCompleted || 0,
                isCurrentUser: true
            },
            ...nearbyBelow.map((u, idx) => ({
                rank: rank + idx + 1,
                displayName: u.profile?.displayName || '',
                avatarUrl: u.profile?.avatarUrl || '',
                zone: u.profile?.zone || '',
                level: u.level,
                totalPoints: u.stats?.totalPoints || 0,
                totalCompleted: u.stats?.totalCompleted || 0
            }))
        ];

        res.status(200).json({
            myPosition: {
                rank,
                userId: user._id,
                displayName: user.profile?.displayName || '',
                avatarUrl: user.profile?.avatarUrl || '',
                zone: user.profile?.zone || '',
                level: user.level,
                totalPoints: user.stats?.totalPoints || 0,
                totalCompleted: user.stats?.totalCompleted || 0
            },
            nearby,
            totalUsers
        });

    } catch (error) {
        res.status(500).json({ error: "Error al obtener tu posición" });
    }
};

// GET /api/ranking/zone/:zone
export const getZoneRanking = async (req: Request, res: Response) => {
    try {
        const { zone } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const users = await User.find({
            'profile.zone': zone,
            'profile.isPublic': true,
            isActive: true
        })
        .select('profile.displayName profile.avatarUrl level stats.totalPoints stats.totalCompleted')
        .sort({ 
            'stats.totalPoints': -1, 
            'level': -1, 
            'stats.totalCompleted': -1 
        })
        .skip(skip)
        .limit(limit)
        .lean();

        const totalUsersInZone = await User.countDocuments({
            'profile.zone': zone,
            'profile.isPublic': true,
            isActive: true
        });

        const rankings = users.map((user, index) => ({
            rank: skip + index + 1,
            userId: user._id,
            displayName: user.profile?.displayName || '',
            avatarUrl: user.profile?.avatarUrl || '',
            level: user.level,
            totalPoints: user.stats?.totalPoints || 0,
            totalCompleted: user.stats?.totalCompleted || 0
        }));

        res.status(200).json({
            zone,
            totalUsersInZone,
            page,
            limit,
            totalPages: Math.ceil(totalUsersInZone / limit),
            rankings
        });

    } catch (error) {
        res.status(500).json({ error: "Error al obtener el ranking de zona" });
    }
};

// GET /api/ranking/zone/:zone/me
export const getMyZonePosition = async (req: Request, res: Response) => {
    try {
        const { zone } = req.params;
        const userEmail = req.params.email;

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Verificar que el usuario pertenece a esta zona
        if (user.profile?.zone !== zone) {
            return res.status(400).json({ error: "No perteneces a esta zona" });
        }

        // Encontrar posición en la zona
        const rank = await User.countDocuments({
            'profile.zone': zone,
            'profile.isPublic': true,
            isActive: true,
            $or: [
                { 'stats.totalPoints': { $gt: user.stats?.totalPoints || 0 } },
                {
                    'stats.totalPoints': user.stats?.totalPoints || 0,
                    'level': { $gt: user.level }
                },
                {
                    'stats.totalPoints': user.stats?.totalPoints || 0,
                    'level': user.level,
                    'stats.totalCompleted': { $gt: user.stats?.totalCompleted || 0 }
                }
            ]
        }) + 1;

        // Usuarios cercanos en la zona
        const nearbyAbove = await User.find({
            'profile.zone': zone,
            'profile.isPublic': true,
            isActive: true,
            $or: [
                { 'stats.totalPoints': { $gt: user.stats?.totalPoints || 0 } },
                {
                    'stats.totalPoints': user.stats?.totalPoints || 0,
                    'level': { $gt: user.level }
                }
            ]
        })
        .select('profile.displayName profile.avatarUrl level stats.totalPoints stats.totalCompleted')
        .sort({ 'stats.totalPoints': -1, 'level': -1, 'stats.totalCompleted': -1 })
        .limit(5)
        .lean();

        const nearbyBelow = await User.find({
            'profile.zone': zone,
            'profile.isPublic': true,
            isActive: true,
            $or: [
                { 'stats.totalPoints': { $lt: user.stats?.totalPoints || 0 } },
                {
                    'stats.totalPoints': user.stats?.totalPoints || 0,
                    'level': { $lt: user.level }
                }
            ]
        })
        .select('profile.displayName profile.avatarUrl level stats.totalPoints stats.totalCompleted')
        .sort({ 'stats.totalPoints': 1, 'level': 1, 'stats.totalCompleted': 1 })
        .limit(5)
        .lean();

        const totalUsersInZone = await User.countDocuments({
            'profile.zone': zone,
            'profile.isPublic': true,
            isActive: true
        });

        const nearby = [
            ...nearbyAbove.reverse().map((u, idx) => ({
                rank: rank - (nearbyAbove.length - idx),
                displayName: u.profile?.displayName || '',
                avatarUrl: u.profile?.avatarUrl || '',
                level: u.level,
                totalPoints: u.stats?.totalPoints || 0,
                totalCompleted: u.stats?.totalCompleted || 0
            })),
            {
                rank,
                userId: user._id,
                displayName: user.profile?.displayName || '',
                avatarUrl: user.profile?.avatarUrl || '',
                level: user.level,
                totalPoints: user.stats?.totalPoints || 0,
                totalCompleted: user.stats?.totalCompleted || 0,
                isCurrentUser: true
            },
            ...nearbyBelow.map((u, idx) => ({
                rank: rank + idx + 1,
                displayName: u.profile?.displayName || '',
                avatarUrl: u.profile?.avatarUrl || '',
                level: u.level,
                totalPoints: u.stats?.totalPoints || 0,
                totalCompleted: u.stats?.totalCompleted || 0
            }))
        ];

        res.status(200).json({
            zone,
            myPosition: {
                rank,
                userId: user._id,
                displayName: user.profile?.displayName || '',
                avatarUrl: user.profile?.avatarUrl || '',
                level: user.level,
                totalPoints: user.stats?.totalPoints || 0,
                totalCompleted: user.stats?.totalCompleted || 0
            },
            nearby,
            totalUsersInZone
        });

    } catch (error) {
        res.status(500).json({ error: "Error al obtener tu posición en la zona" });
    }
};