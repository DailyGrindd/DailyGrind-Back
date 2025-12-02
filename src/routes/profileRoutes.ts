import { Router } from 'express';
import {
    getMyProfile,
    getPublicProfile
} from '../controllers/profileController';
//import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();
// rutas protegidas
router.get('/:email', getMyProfile);//authenticateToken

//rutas publicas
router.get('/public/:userId', getPublicProfile);

export default router;