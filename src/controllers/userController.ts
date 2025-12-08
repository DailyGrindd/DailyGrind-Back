import { Request, Response } from "express";
import User from "../models/user";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { auth } from "../config/firebase";
import { calculateUserLevelInfo, updateUserLevelIfNeeded } from "../utils/levelSystem";

// Obtener todos los usuarios o filtrados por role
export const getUsers = async (req: Request, res: Response) => {
    try {
        const role = req.query.role as string | undefined;
        let users;
        if (role) {
            users = await User.find({ role }).select('-profile -stats');
        } else {
            users = await User.find().select('-profile -stats');
        }
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

// Obtener un usuario por email
export const getUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

// Crear usuarios para administradores
export const createUser = async (req: Request, res: Response) => {
    try {
        const { userName, email, password, role, displayName, avatarUrl, isPublic, zone } = req.body;
        const pass_hash = await bcrypt.hash(password, 10);

        const user = await User.create({
            userName, email, password: pass_hash, role, level: 1,
            profile: { displayName, avatarUrl, isPublic, zone }
        });

        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

// Registro de usuarios nuevos
export const registerUser = async (req: Request, res: Response) => {
    try {
        const { userName, email, password, displayName, avatarUrl, isPublic, zone } = req.body;
        const pass_hash = await bcrypt.hash(password, 10);

        const user = await User.create({
            userName, email, password: pass_hash, role: "Usuario", level: 1,
            profile: { displayName, avatarUrl, isPublic, zone }
        });

        res.status(201).json({ user: { email: user.email, role: user.role, level: user.level, displayName: user.profile?.displayName, totalPoints: user.stats?.totalPoints, avatarUrl: user.profile?.avatarUrl }});
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

// Update de usuarios parte admin
export const updateUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        const { password, role, level, ...profileUpdates } = req.body;
        
        if (password) {
            const pass_hash = await bcrypt.hash(password, 10);
            user.password = pass_hash;
        }

        if (role) user.role = role;
        if (level) user.level = level;

        // Actualiza campos de profile si existen
        if (Object.keys(profileUpdates).length > 0) {
            user.profile = { ...user.profile, ...profileUpdates };
        }

        await user.save();
        res.status(200).json({ message: "Usuario actualizado correctamente", user });
        
    } catch (error) {
        res.status(500).json({ error: error });
    }
}

// Dar de baja de usuarios parte admin
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        user.isActive = false;
        await user.save();
        
        res.status(200).json({ message: "Usuario dado de baja correctamente" });
    } catch (error) {
        res.status(500).json({ error: error });
    }
}

// Dar de alta de usuarios parte admin
export const activateUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        user.isActive = true;
        await user.save();
        
        res.status(200).json({ message: "Usuario dado de alta correctamente" });
    } catch (error) {
        res.status(500).json({ error: error });
    }
}

// Login de usuarios
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado. Debes registrarte primero." });
        } else if (!user.isActive) {
            return res.status(403).json({ error: "Tu cuenta ha sido desactivada. Contacta con el administrador." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Contraseña incorrecta" });

        const accessToken = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: '7d' }
        );

        // Cookie 
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 15 * 60 * 1000, // 15m
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        res.status(200).json({ 
            messaje: "Login exitoso", 
            user: { 
                _id: user._id,
                email: user.email, 
                role: user.role, 
                level: user.level, 
                displayName: user.profile?.displayName, 
                totalPoints: user.stats?.totalPoints, 
                avatarUrl: user.profile?.avatarUrl ,
                zone: user.profile?.zone
            } 
        });
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
}

// Logout de usuarios
export const logout = async (req: Request, res: Response) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.json({ message: "Logout exitoso" });
}

// Verificar acceso de usuario
export const userAccess = async (req: Request, res: Response) => {
    try {
        const { email } = (req as any).user;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ isAuthenticated: false });

        return res.status(200).json({
            isAuthenticated: true,
            _id: user._id,
            email: user.email,
            name: user.userName,
            role: user.role,
            level: user.level,
            displayName: user.profile?.displayName,
            totalPoints: user.stats?.totalPoints,
            avatarUrl: user.profile?.avatarUrl,      
            zone: user.profile?.zone,                 
            isPublic: user.profile?.isPublic 
        });

    } catch (error) {
        return res.status(500).json({ isAuthenticated: false, error });
    }
};

// Verificar disponibilidad de email o username
export const checkAvailability = async (req: Request, res: Response) => {
    try {
        const { email, displayName } = req.query;

        if (!email && !displayName) {
            return res.status(400).json({ error: "Debes proporcionar email o displayName" });
        }

        const result: any = {};

        if (email) {
            const emailExists = await User.findOne({ email });
            result.email = {
                value: email,
                available: !emailExists
            };
        }

        if (displayName) {
            const displayNameExists = await User.findOne({ "profile.displayName": displayName });
            result.displayName = {  
                value: displayName,
                available: !displayNameExists
            };
        }

        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({ error: "Error al verificar disponibilidad" });
    }
};

// Registro con Firebase (solo email/password en Firebase, resto manual)
export const firebaseRegister = async (req: Request, res: Response) => {
    try {
        const { idToken, userName, displayName, avatarUrl, isPublic, zone } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: "Token de Firebase requerido" });
        }

        if (!userName || !displayName || !zone) {
            return res.status(400).json({ error: "userName, displayName y zone son obligatorios" });
        }

        // Verificar el token de Firebase
        const decodedToken = await auth.verifyIdToken(idToken);
        const { uid, email } = decodedToken;

        if (!email) {
            return res.status(400).json({ error: "Email no encontrado en el token" });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "El usuario ya existe" });
        }

        // Verificar que el displayName no esté en uso
        const existingDisplayName = await User.findOne({ "profile.displayName": displayName });
        if (existingDisplayName) {
            return res.status(400).json({ error: "El nickname ya está en uso" });
        }

        // Crear nuevo usuario con los datos del formulario
        const user = await User.create({
            userName,
            email,
            password: uid, // Usamos el UID de Firebase como password (no se usará para login tradicional)
            role: "Usuario",
            level: 1,
            profile: {
                displayName,
                avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`,
                isPublic: isPublic !== undefined ? isPublic : true,
                zone
            }
        });

        // Generar tokens JWT propios
        const accessToken = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: '7d' }
        );

        // Establecer cookies
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 15 * 60 * 1000, // 15m
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        res.status(201).json({
            message: "Usuario registrado exitosamente con Firebase",
            user: {
                _id: user._id,
                email: user.email,
                userName: user.userName,
                role: user.role,
                level: user.level,
                displayName: user.profile?.displayName,
                avatarUrl: user.profile?.avatarUrl
            }
        });

    } catch (error: any) {
        console.error("Error en registro Firebase:", error);
        res.status(500).json({
            error: "Error al registrar con Firebase",
            details: error.message
        });
    }
};

// Login con Firebase (solo verifica email/password en Firebase)
export const firebaseLogin = async (req: Request, res: Response) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ error: "Token de Firebase requerido" });
        }

        // Verificar el token de Firebase
        const decodedToken = await auth.verifyIdToken(idToken);
        const { email } = decodedToken;

        if (!email) {
            return res.status(400).json({ error: "Email no encontrado en el token" });
        }

        // Buscar el usuario en la base de datos
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado. Debes registrarte primero." });
        }
        else if (!user.isActive) {
            return res.status(403).json({ error: "Tu cuenta ha sido desactivada. Contacta con el administrador." });
        }

        // Generar tokens JWT propios
        const accessToken = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: '7d' }
        );

        // Establecer cookies
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 15 * 60 * 1000, // 15m
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        // Actualizar última actividad
        user.lastActive = new Date();
        await user.save();

        res.status(200).json({
            message: "Login exitoso con Firebase",
            user: {
                _id: user._id,
                email: user.email,
                userName: user.userName,
                role: user.role,
                level: user.level,
                displayName: user.profile?.displayName,
                totalPoints: user.stats?.totalPoints,
                avatarUrl: user.profile?.avatarUrl,
                zone: user.profile?.zone
            }
        });

    } catch (error: any) {
        console.error("Error en login Firebase:", error);
        res.status(500).json({
            error: "Error al hacer login con Firebase",
            details: error.message
        });
    }
};

// Obtener cuantos usuarios por cada provincia existen
export const getUserCountZone = async (req: Request, res: Response) => {
    try {
        const provinces = [
            "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", 
            "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", 
            "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", 
            "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", 
            "Santiago del Estero", "Tierra del Fuego", "Tucumán"
        ];

        // Contar usuarios por provincia
        const userCountByZone = await User.aggregate([
            {
                $match: {
                    "profile.zone": { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: "$profile.zone",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const zoneMap = new Map<string, number>();
        provinces.forEach(province => {
            zoneMap.set(province, 0);
        });

        // Actualizar con los datos reales
        userCountByZone.forEach(item => {
            if (zoneMap.has(item._id)) {
                zoneMap.set(item._id, item.count);
            }
        });

        // Convertir a array de objetos
        const result = Array.from(zoneMap.entries()).map(([zone, count]) => ({
            zone,
            count
        }));

        res.status(200).json({
            totalProvinces: provinces.length,
            data: result
        });

    } catch (error) {
        console.error("Error al obtener conteo por zona:", error);
        res.status(500).json({ 
            error: "Error al obtener conteo por zona",
            details: error 
        });
    }
}

// Obtener información completa del nivel y experiencia del usuario autenticado
export const getMyLevelInfo = async (req: Request, res: Response) => {
    try {
        const userEmail = req.user?.email;

        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Actualizar nivel si es necesario antes de devolver la información
        const hasLeveledUp = await updateUserLevelIfNeeded(user);
        
        // Calcular información completa del nivel
        const levelInfo = calculateUserLevelInfo(user.level, user.stats?.totalPoints || 0);

        const response: any = {
            levelInfo: {
                currentLevel: levelInfo.currentLevel,
                totalPoints: levelInfo.totalPoints,
                currentLevelPoints: levelInfo.currentLevelPoints,
                pointsToNextLevel: levelInfo.pointsToNextLevel,
                pointsRequiredForNextLevel: levelInfo.pointsRequiredForNextLevel,
                progressPercent: levelInfo.progressPercent
            },
            stats: user.stats
        };

        // Si acabó de subir de nivel al hacer la consulta
        if (hasLeveledUp) {
            response.levelUp = {
                message: `¡Has subido al nivel ${levelInfo.currentLevel}!`,
                newLevel: levelInfo.currentLevel
            };
        }

        res.status(200).json(response);

    } catch (error: any) {
        console.error("Error al obtener información de nivel:", error);
        res.status(500).json({ 
            error: "Error al obtener información de nivel",
            details: error.message 
        });
    }
};

// Obtener ranking de usuarios por nivel (calculado dinámicamente desde puntos)
export const getLevelRanking = async (req: Request, res: Response) => {
    try {
        const { limit = 10, zone } = req.query;

        // Construir filtro
        const filter: any = {};
        if (zone) {
            filter['profile.zone'] = zone;
        }

        const users = await User.find(filter)
            .select('userName level profile.displayName profile.zone stats.totalPoints stats.totalCompleted')
            .sort({ 
                'stats.totalPoints': -1, // Ordenar por puntos totales
                level: -1 
            })
            .limit(Number(limit));

        // Calcular nivel real para cada usuario y formatear
        const ranking = users.map((user, index) => {
            const levelInfo = calculateUserLevelInfo(user.level, user.stats?.totalPoints || 0);
            
            return {
                position: index + 1,
                userName: user.userName,
                displayName: user.profile?.displayName,
                zone: user.profile?.zone,
                storedLevel: user.level, // Nivel almacenado en BD
                effectiveLevel: levelInfo.currentLevel, // Nivel efectivo (considerando puntos)
                calculatedFromPoints: levelInfo.calculatedLevel, // Nivel puro basado en puntos
                totalPoints: levelInfo.totalPoints,
                totalCompleted: user.stats?.totalCompleted || 0,
                progressPercent: levelInfo.progressPercent,
                canLevelUp: levelInfo.isLevelUp // Si puede subir de nivel
            };
        });

        res.status(200).json({
            ranking,
            filter: zone ? { zone } : null
        });

    } catch (error: any) {
        console.error("Error al obtener ranking de niveles:", error);
        res.status(500).json({ 
            error: "Error al obtener ranking de niveles",
            details: error.message 
        });
    }
};

// Estadísticas generales de niveles en la plataforma
export const getLevelStats = async (req: Request, res: Response) => {
    try {
        const users = await User.find()
            .select('level stats.totalPoints');

        // Calcular estadísticas basadas en niveles calculados dinámicamente
        const levelDistribution = new Map<number, number>();
        let totalCalculatedLevels = 0;
        let maxCalculatedLevel = 1;
        let totalPoints = 0;

        users.forEach(user => {
            const levelInfo = calculateUserLevelInfo(user.level, user.stats?.totalPoints || 0);
            const effectiveLevel = levelInfo.currentLevel; // Usar nivel efectivo
            
            levelDistribution.set(effectiveLevel, (levelDistribution.get(effectiveLevel) || 0) + 1);
            totalCalculatedLevels += effectiveLevel;
            maxCalculatedLevel = Math.max(maxCalculatedLevel, effectiveLevel);
            totalPoints += levelInfo.totalPoints;
        });

        // Convertir a array ordenado
        const distributionArray = Array.from(levelDistribution.entries())
            .sort(([a], [b]) => a - b)
            .map(([level, count]) => ({ level, userCount: count }));

        res.status(200).json({
            levelDistribution: distributionArray,
            general: {
                totalUsers: users.length,
                avgLevel: users.length > 0 ? parseFloat((totalCalculatedLevels / users.length).toFixed(2)) : 0,
                maxLevel: maxCalculatedLevel,
                totalPoints: totalPoints,
                avgPoints: users.length > 0 ? Math.floor(totalPoints / users.length) : 0
            }
        });

    } catch (error: any) {
        console.error("Error al obtener estadísticas de niveles:", error);
        res.status(500).json({ 
            error: "Error al obtener estadísticas de niveles",
            details: error.message 
        });
    }
};

// Función para sincronizar todos los niveles de usuarios con sus puntos (solo administradores)
export const syncAllUserLevels = async (req: Request, res: Response) => {
    try {
        const users = await User.find();
        let updatedCount = 0;

        for (const user of users) {
            const hasLeveledUp = await updateUserLevelIfNeeded(user);
            if (hasLeveledUp) {
                updatedCount++;
            }
        }

        res.status(200).json({
            message: `Sincronización completada. ${updatedCount} usuarios actualizaron su nivel.`,
            totalUsers: users.length,
            updatedUsers: updatedCount
        });

    } catch (error: any) {
        console.error("Error al sincronizar niveles:", error);
        res.status(500).json({ 
            error: "Error al sincronizar niveles de usuarios",
            details: error.message 
        });
    }
};