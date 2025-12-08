import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

admin.initializeApp({
    credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail,
    }),
    projectId
});

export const auth = admin.auth();
export default admin;