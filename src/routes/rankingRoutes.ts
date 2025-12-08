import { Router } from "express";
import { 
    getGlobalRanking, 
    getMyGlobalPosition,
    getZoneRanking,
    getMyZonePosition
} from "../controllers/rankingController";

const router = Router();

// Ranking global
router.get("/global", getGlobalRanking);
router.get("/global/:email",  getMyGlobalPosition);  
// Ranking por zona
router.get("/zone/:zone", getZoneRanking);
router.get("/zone/:zone/:email", getMyZonePosition); 

export default router;