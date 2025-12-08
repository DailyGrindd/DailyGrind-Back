import jwt from "jsonwebtoken";
import { JwtPayload } from "../types/type";
import { Request, Response, NextFunction } from "express";

declare module 'express-serve-static-core' {
    interface Request {
        user?: JwtPayload;
    }
}

// Verificar el token 
export function verifyToken(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies.accessToken;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        req.user = decoded;
        next();
    }
    catch (error) {
        validateRefreshToken(req, res, next);
    }
}

// Por si falla el access token 
export function validateRefreshToken(req: Request, res: Response, next: NextFunction) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token requerido" });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as JwtPayload;

        // Nuevo access token
        const newAccessToken = jwt.sign(
            { email: decoded.email, role: decoded.role },
            process.env.JWT_SECRET!,
            { expiresIn: '15m' }
        );

        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 15 * 60 * 1000, // 15m
        });

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: "Refresh token inválido o expirado" });
    }
}

// Verificar rol
export function requireRole(role: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.user?.role !== role) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        next();
    }
}