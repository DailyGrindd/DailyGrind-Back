import { Request, Response } from "express";
import User from "../models/user";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
        
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: error });
    }
};

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
            process.env.JWT_SECRET as string,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_REFRESH_SECRET as string,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
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

        res.status(200).json({ messaje: "Login exitoso", user: { email: user.email, role: user.role, level: user.level, displayName: user.profile?.displayName, totalPoints: user.stats?.totalPoints } });
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
            totalPoints: user.stats?.totalPoints
        });

    } catch (error) {
        return res.status(500).json({ isAuthenticated: false, error });
    }
};