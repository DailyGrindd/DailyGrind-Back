import {Request, Response} from 'express';
import User from '../models/user';
import UserBadge from '../models/userBadge';
import DailyQuest from '../models/dailyQuest';
import Badge from '../models/badge';
import mongoose from 'mongoose';
import challenge from '../models/challenge';
import badge from '../models/badge';

export const getMyProfile = async (req: Request, res: Response) => {
    try {
        const email = req.params.email;

        const user = await User.findOne({email}).select("-password");//para proteger la password
        if (!user) {
            return res.status(404).json({error: "Usuario no encontrado"});
        }
        //badges del usuario
        const userBadges = await UserBadge.find({userId: user._id}).populate('badgeId');

        //dailyquest entre las 00hs de hoy y las 00hs de mañana
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const mañana = new Date(hoy);
        mañana.setDate(hoy.getDate() + 1);

        const dailyQuest = await DailyQuest.findOne({
            userId: user._id,
            date: { $gte: hoy, $lt: mañana }
        }).populate({path: "missions.challengeId"});
            
        // estadisticas del dia
        const todayMissions = dailyQuest?.missions || [];
        const completedToday = todayMissions.filter(m => m.status === "completed").length;
        const pendingToday = todayMissions.filter(m => m. status === "pending"). length;
        const skippedToday = todayMissions. filter(m => m.status === "skipped").length;
        
        // Obtener historial de desafíos completados (últimos 30 días)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentQuests = await DailyQuest. find({
            userId: user._id,
            date: { $gte: thirtyDaysAgo }
        }).populate("missions.challengeId");

        const completedChallenges = recentQuests.flatMap(quest => 
            quest.missions.filter(m => m.status === "completed")
        );

        const globalCompleted = completedChallenges.filter(m => m.type === "global").length;
        const personalCompleted = completedChallenges.filter(m => m. type === "personal"). length;

        return res.status(200).json({
            user: {
                id: user._id,
                userName: user.userName,
                email: user.email,
                role: user.role,
                level: user.level,
                profile: user.profile,
                stats: user.stats,
                lastActive: user.lastActive
            },
            badges: userBadges.map(ub => ({
                badge: ub.badgeId,
                earnedAt: ub.earnedAt
            })),
            dailyProgress: {
                date: hoy,
                missions: todayMissions,
                summary: {
                    total: todayMissions.length,
                    completed: completedToday,
                    pending: pendingToday,
                    skipped: skippedToday
                },
                rerollsUsed: dailyQuest?.rerollCount || 0,
                canReroll: (dailyQuest?. rerollCount || 0) < 1
            },
            recentActivity: {
                last30Days: {
                    totalCompleted: completedChallenges.length,
                    globalCompleted,
                    personalCompleted,
                    totalPointsEarned: completedChallenges.reduce((sum, m) => sum + (m.pointsAwarded || 0), 0)
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({error: error});
    }   
}

//perfil publico de otro usuario
export const getPublicProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId).select("-password -email");
        if (!user) {
            return res.status(404).json({error: "Usuario no encontrado"});
        }
        if (! user.profile?. isPublic) {
            return res.status(403).json({ error: "Este perfil es privado" });
        }
        const userBadges = await UserBadge.find({userId: user._id}).populate('badgeId');
        
        return res.status(200).json({
            user: {
            id: user._id,
            userName: user.userName,
            level: user.level,
            profile: user.profile,
            stats: user.stats,
            lastActive: user.lastActive
            },
            badges: userBadges.map(ub => ({
            badge: ub.badgeId,
            earnedAt: ub.earnedAt   
            }))
        });
    }   catch (error) {
        res.status(500).json({error: error});
    }   
}
