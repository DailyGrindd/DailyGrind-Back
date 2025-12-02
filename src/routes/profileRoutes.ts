import { Router } from 'express';
import {
    getMyProfile,
    getPublicProfile,
    updateMyProfile
} from '../controllers/profileController';
import { verifyToken, requireRole } from "../middlewares/auth";
import validationMiddleware from "../middlewares/middleware";
import { UpdateProfileDto } from "../dto/userDto";

const router = Router();
// rutas protegidas
router.get('/:email', verifyToken, getMyProfile);
router.put('/:email', verifyToken, validationMiddleware(UpdateProfileDto), updateMyProfile); 
//rutas publicas
router.get('/public/:userName', getPublicProfile);

export default router;