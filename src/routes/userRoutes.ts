import { createUser, registerUser, login, logout, userAccess, checkAvailability, firebaseRegister, firebaseLogin, getUser, getUsers, updateUser, deleteUser, activateUser, getUserCountZone } from "../controllers/userController";
import express from "express";
import { CreateUserDto, UpdateUserDto } from "../dto/userDto";
import validationMiddleware from "../middlewares/middleware";
import { verifyToken, requireRole } from "../middlewares/auth";

const router = express.Router();

// POST - Rutas específicas PRIMERO
router.post("/firebase-register", firebaseRegister);
router.post("/firebase-login", firebaseLogin);
router.post("/register", validationMiddleware(CreateUserDto), registerUser);
router.post("/login", login);
router.post("/logout", logout);
router.post("/", verifyToken, requireRole('Administrador'), validationMiddleware(CreateUserDto), createUser);

// PUT 
router.put("/:email/activate", verifyToken, requireRole('Administrador'), activateUser);
router.put("/:email/desactivate", verifyToken, requireRole('Administrador'), deleteUser);
router.put("/:email", verifyToken, requireRole('Administrador'), validationMiddleware(UpdateUserDto), updateUser);

// GET 
router.get("/access/user", verifyToken, userAccess);
router.get("/check-availability", checkAvailability);
router.get("/zone-stats", verifyToken, requireRole('Administrador'), getUserCountZone);
router.get("/:email", verifyToken, requireRole('Administrador'), getUser);
router.get("/", verifyToken, requireRole('Administrador'), getUsers);

export default router;