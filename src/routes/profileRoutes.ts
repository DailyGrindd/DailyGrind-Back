import { Router } from 'express';
import {
    getMyProfile,
    getPublicProfile,
    searchPublicUsers,
    updateMyProfile
} from '../controllers/profileController';
import { verifyToken, requireRole } from "../middlewares/auth";
import validationMiddleware from "../middlewares/middleware";
import { UpdateProfileDto } from "../dto/userDto";

const router = Router();
//rutas publicas
router.get('/public/:userName', getPublicProfile);
router.get('/search/public', searchPublicUsers);

// rutas protegidas
router.get('/:email', verifyToken, getMyProfile);
router.put('/:email', verifyToken, validationMiddleware(UpdateProfileDto), updateMyProfile); 


export default router;