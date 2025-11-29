import { createUser, registerUser, login, logout, userAccess } from "../controllers/userController";
import express from "express";
import { CreateUserDto } from "../dto/userDto";
import validationMiddleware from "../middlewares/middleware";
import { verifyToken, requireRole } from "../middlewares/auth";

const router = express.Router();

router.post("/", verifyToken, requireRole('Administrador'), validationMiddleware(CreateUserDto), createUser);
router.post("/register", validationMiddleware(CreateUserDto), registerUser);
router.post("/login", login);
router.post("/logout", logout);
router.get("/access/user", verifyToken, userAccess);

export default router;