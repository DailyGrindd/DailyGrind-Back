import { Request, Response } from "express";
import User from "../models/user";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { auth } from "../config/firebase";

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

// Eliminacion de usuarios parte admin
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findOneAndDelete({ email: req.params.email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
        
        res.status(200).json({ message: "Usuario eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ error: error });
    }
}

// Login de usuarios
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

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
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 15 * 60 * 1000, // 15m
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        res.status(200).json({ messaje: "Login exitoso", user: { email: user.email, role: user.role, level: user.level, displayName: user.profile?.displayName, totalPoints: user.stats?.totalPoints, avatarUrl: user.profile?.avatarUrl } });
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
            email: user.email,
            name: user.userName,
            role: user.role,
            level: user.level,
            displayName: user.profile?.displayName,
            totalPoints: user.stats?.totalPoints,
            avatarUrl: user.profile?.avatarUrl
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
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 15 * 60 * 1000, // 15m
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        res.status(201).json({
            message: "Usuario registrado exitosamente con Firebase",
            user: {
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
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 15 * 60 * 1000, // 15m
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        // Actualizar última actividad
        user.lastActive = new Date();
        await user.save();

        res.status(200).json({
            message: "Login exitoso con Firebase",
            user: {
                email: user.email,
                userName: user.userName,
                role: user.role,
                level: user.level,
                displayName: user.profile?.displayName,
                totalPoints: user.stats?.totalPoints,
                avatarUrl: user.profile?.avatarUrl
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