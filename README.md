<h1 align="center">DailyGrind - API Backend</h1> 

API RESTful para sistema de desafíos diarios para la mejora de habitos.

## 📖 Descripción
DailyGrind Backend es una API RESTful robusta que proporciona un sistema completo de gamificación con gestión de desafíos, cuests diarias, perfiles de usuario, rankings y un sistema de niveles dinámico. La API implementa autenticación mediante JWT con tokens de acceso/refresh, autorización basada en roles y validación exhaustiva de datos.

Las entidades principales son:
- **👤 User**
- **⭐ Challenge**
- **🎯 Daily Quest**

## 🚀 Características
- `API RESTful` modularizada en rutas y controladores
- Autenticación basada en `JWT` con `tokens` de acceso y refresh
- `Middleware` de autorización basado en roles
- Validación de datos con `DTOs` y `class-validator`
- Conexión a `MongoDB` con Mongoose y modelos definidos
- Configuración centralizada vía `.env`
- `Soporte Firebase` para autenticación alternativa
- `Scripts` para desarrollo y compilación a producción
- Soporte para `CORS` y `cookies` firmadas

## 🛠️ Tecnologías utilizadas
<img src="https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"><br>
<img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"><br>
<img src="https://img.shields.io/badge/Express%20js-000000?style=for-the-badge&logo=express&logoColor=white"><br>
<img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white"><br>
<img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white">

## 📋 Requisitos para utilizar la API
- `Node.js` >= 18
- `npm` o `yarn`
- Una instancia de `MongoDB` (MongoDB Atlas)
- `Firebase` Project

## ⚙️ Instalación y configuracion
```bash
 # Clonar el repositorio
 git clone https://github.com/DailyGrindd/DailyGrind-Back.git
```
- Crear un archivo `.env` en la raíz del proyecto basado en `.envexample`
- Crear un archivo `serviceAccountKey.json` en la raíz del proyecto basado en `accountkeyexample.txt`
```bash
 # Instalar dependencias
 npm install
 
 # Iniciar servidor 
 npm run dev
```
## 🧭 Rutas base de la API
```bash
 /api/users
 /api/challenges
 /api/profile
 /api/daily-quests
 /api/ranking
```