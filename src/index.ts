import "reflect-metadata";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes"
import challengeRoutes from "./routes/challengeRoutes"
import dailyQuestRoutes from "./routes/dailyQuestRoutes"
import cookieParser from "cookie-parser";
import profileRoutes from "./routes/profileRoutes";
import rankingRoutes from "./routes/rankingRoutes";
dotenv.config();
const app = express();
const port = process.env.PORT;
const mongoUri = process.env.MONGODB_URI!;

app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: [
        'https://daily-grind-front-329e.vercel.app',
        'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Set-Cookie']
}));
app.use(cookieParser());

app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/daily-quests', dailyQuestRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/ranking", rankingRoutes);
app.listen(port, () => {
    console.log(`APP escuchando on port ${port}`)
})

const connectToDb = async () => {
    try {
        await mongoose.connect(mongoUri, {
        });
        console.log('MongoDB conectado');

    } catch (error) {
        console.error(`Error de conexión a MongoDB: ${error}`);
    }
}
connectToDb();