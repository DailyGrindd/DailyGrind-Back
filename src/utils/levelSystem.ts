

// Sistema de niveles basado directamente en puntos totales acumulados
// 
// LÓGICA DEL SISTEMA:
// - La fórmula 50 * nivel^1.4 define los PUNTOS TOTALES necesarios para alcanzar cada nivel
// - Nivel 1: 0 puntos totales
// - Nivel 2: 132 puntos totales (50 * 2^1.4)
// - Nivel 3: 233 puntos totales (50 * 3^1.4)
// - Etc.
//
// EJEMPLOS:
// - Con 100 puntos totales → Nivel 1 (76% progreso hacia nivel 2)
// - Con 132 puntos totales → Nivel 2 (recién alcanzado)
// - Con 200 puntos totales → Nivel 2 (67% progreso hacia nivel 3)

/**
 * Calcula los puntos TOTALES necesarios para alcanzar un nivel específico
 * Formula: 50 * nivel^1.4 (escalado más suave para facilitar progreso)
 * Nivel 1: 0 puntos
 * Nivel 2: 132 puntos
 * Nivel 3: 233 puntos, etc.
 */
export const getPointsRequiredForLevel = (level: number): number => {
    if (level <= 1) return 0;
    return Math.floor(50 * Math.pow(level, 1.4));
};

// FUNCIÓN ELIMINADA: getTotalPointsForLevel era redundante
// Usar getPointsRequiredForLevel directamente

/**
 * Calcula qué nivel corresponde a una cantidad de puntos totales
 * considerando el nivel actual del usuario como mínimo
 */
export const getLevelFromPoints = (totalPoints: number, currentStoredLevel: number = 1): number => {
    const safePoints = Math.max(0, Math.floor(totalPoints || 0));
    const safeCurrentLevel = Math.max(1, Math.floor(currentStoredLevel || 1));
    
    // Si no hay puntos, está en nivel 1
    if (safePoints === 0) {
        return Math.max(1, safeCurrentLevel);
    }
    
    // Encontrar el nivel más alto que puede alcanzar con sus puntos
    let level = 1;
    while (level < 100) { // Límite de seguridad
        const pointsNeededForNextLevel = getPointsRequiredForLevel(level + 1);
        if (safePoints < pointsNeededForNextLevel) {
            break; // No tiene suficientes puntos para el siguiente nivel
        }
        level++;
    }
    
    // El nivel nunca puede ser menor al nivel actual almacenado
    return Math.max(level, safeCurrentLevel);
};

/**
 * Calcula cuántos puntos faltan para el próximo nivel
 */
export const getPointsToNextLevel = (currentLevel: number, totalPoints: number): number => {
    const safeLevel = Math.max(1, Math.floor(currentLevel || 1));
    const safePoints = Math.max(0, Math.floor(totalPoints || 0));
    
    const pointsRequiredForNextLevel = getPointsRequiredForLevel(safeLevel + 1);
    
    return Math.max(0, pointsRequiredForNextLevel - safePoints);
};

/**
 * Información completa del nivel del usuario basada en puntos totales
 */
export interface UserLevelInfo {
    currentLevel: number;
    calculatedLevel: number; // Nivel basado en puntos totales
    totalPoints: number;
    currentLevelPoints: number; // Progreso en puntos dentro del nivel actual
    pointsToNextLevel: number;
    pointsRequiredForNextLevel: number;
    progressPercent: number;
    isLevelUp: boolean; // Si debería subir de nivel
}

/**
 * Calcula toda la información de nivel basada en puntos totales
 * considerando el nivel actual almacenado como mínimo
 */
export const calculateUserLevelInfo = (
    storedLevel: number, 
    totalPoints: number
): UserLevelInfo => {
    // Validar y sanitizar inputs
    const safeStoredLevel = Math.max(1, Math.floor(storedLevel || 1));
    const safeTotalPoints = Math.max(0, Math.floor(totalPoints || 0));
    
    // Calcular nivel basado en puntos totales
    const calculatedLevelFromPoints = getLevelFromPoints(safeTotalPoints);
    
    // El nivel efectivo es el mayor entre el calculado y el almacenado
    // Esto evita que los usuarios "bajen" de nivel
    const effectiveLevel = Math.max(calculatedLevelFromPoints, safeStoredLevel);
    const isLevelUp = effectiveLevel > safeStoredLevel;
    
    // Calcular progreso dentro del nivel actual
    const pointsRequiredForCurrentLevel = getPointsRequiredForLevel(effectiveLevel);
    const pointsRequiredForNextLevel = getPointsRequiredForLevel(effectiveLevel + 1);
    const currentLevelPoints = safeTotalPoints - pointsRequiredForCurrentLevel;
    const pointsToNextLevel = getPointsToNextLevel(effectiveLevel, safeTotalPoints);
    const pointsNeededForThisLevel = pointsRequiredForNextLevel - pointsRequiredForCurrentLevel;
    
    const progressPercent = pointsNeededForThisLevel > 0 
        ? Math.floor((currentLevelPoints / pointsNeededForThisLevel) * 100)
        : 100;
    
    return {
        currentLevel: effectiveLevel,
        calculatedLevel: calculatedLevelFromPoints,
        totalPoints: safeTotalPoints,
        currentLevelPoints: Math.max(0, currentLevelPoints),
        pointsToNextLevel: Math.max(0, pointsToNextLevel),
        pointsRequiredForNextLevel: Math.max(0, pointsNeededForThisLevel),
        progressPercent: Math.max(0, Math.min(100, progressPercent)),
        isLevelUp
    };
};

/**
 * Calcula los puntos adicionales que debería otorgar un desafío basado en su dificultad
 * Esto se suma a los puntos base del desafío
 */
export const calculateBonusPointsFromChallenge = (points: number, difficulty: number): number => {
    // Multiplicador por dificultad: 0%, 20%, 50%, 80%, 100%
    const difficultyMultipliers = [0, 0, 0.2, 0.5, 0.8, 1.0];
    const multiplier = difficultyMultipliers[Math.min(difficulty, 5)] || 0;
    
    return Math.floor(points * multiplier);
};

/**
 * Actualiza el nivel del usuario si es necesario basado en sus puntos totales
 * Solo permite subidas de nivel, nunca bajadas
 */
export const updateUserLevelIfNeeded = async (user: any): Promise<boolean> => {
    const levelInfo = calculateUserLevelInfo(user.level, user.stats?.totalPoints || 0);
    
    // Solo actualizar si realmente hay una subida de nivel
    if (levelInfo.isLevelUp && levelInfo.currentLevel > user.level) {
        const previousLevel = user.level;
        user.level = levelInfo.currentLevel;
        await user.save();
        
        console.log(`Usuario ${user.email} subió del nivel ${previousLevel} al nivel ${levelInfo.currentLevel}`);
        return true;
    }
    
    return false;
};

/**
 * Verifica si un usuario puede subir de nivel sin actualizar la base de datos
 */
export const canUserLevelUp = (storedLevel: number, totalPoints: number): boolean => {
    const levelInfo = calculateUserLevelInfo(storedLevel, totalPoints);
    return levelInfo.isLevelUp && levelInfo.currentLevel > storedLevel;
};

/**
 * Obtiene información detallada sobre el estado del nivel del usuario
 */
export const getUserLevelStatus = (storedLevel: number, totalPoints: number) => {
    const safeStoredLevel = Math.max(1, Math.floor(storedLevel || 1));
    const safeTotalPoints = Math.max(0, Math.floor(totalPoints || 0));
    
    const calculatedFromPoints = getLevelFromPoints(safeTotalPoints);
    const effectiveLevel = Math.max(calculatedFromPoints, safeStoredLevel);
    
    return {
        storedLevel: safeStoredLevel,
        calculatedFromPoints,
        effectiveLevel,
        canLevelUp: effectiveLevel > safeStoredLevel,
        totalPoints: safeTotalPoints,
        isAtCorrectLevel: safeStoredLevel >= calculatedFromPoints
    };
};