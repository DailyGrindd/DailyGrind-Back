import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

// Procesar la private key correctamente
let processedPrivateKey = privateKey;
if (privateKey) {
    // Remover comillas si las tiene
    processedPrivateKey = privateKey.replace(/^["']|["']$/g, '');
    // Convertir \n literales a saltos de línea
    processedPrivateKey = processedPrivateKey.replace(/\\n/g, '\n');
}

if (!projectId || !processedPrivateKey || !clientEmail) {
    console.error('Faltan variables de entorno de Firebase');
    throw new Error('Firebase configuration is missing required environment variables');
}

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            privateKey: processedPrivateKey,
            clientEmail,
        }),
        projectId
    });
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
}

export const auth = admin.auth();
export default admin;