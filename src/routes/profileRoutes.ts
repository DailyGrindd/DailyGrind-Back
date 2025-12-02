import { Router } from 'express';
import {
    getMyProfile,
    getPublicProfile,
    updateMyProfile
} from '../controllers/profileController';
//import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();
// rutas protegidas
router.get('/:email', getMyProfile);//authenticateToken
router. put('/:email', updateMyProfile); // Nueva ruta para actualizar

//rutas publicas
router.get('/public/:userName', getPublicProfile);

export default router;