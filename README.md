<h1 align="center">DailyGrind</h1> 

API RESTful desarrollada en Node.js y TypeScript que implementa una capa de seguridad basada en autenticación y autorización por roles...
Las entidades principales son:
- **👤 User**

## 🚀 Características
- `API RESTful` modularizada en rutas y controladores
- Autenticación basada en `JWT` con `tokens` de acceso y refresh
- `Middleware` de autorización basado en roles
- Validación de datos con `DTOs` y `class-validator`
- Conexión a `MongoDB` con Mongoose y modelos definidos
- Configuración centralizada vía `.env`
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

## ⚙️ Instalación y configuracion
```bash
 # Clonar el repositorio
 git clone https://github.com/FernandoJaime/Materia-MetodologiasDesarrolloWeb.git
```
Crear un archivo .env en la raíz del proyecto basado en .envexample
```bash
 # Instalar dependencias
 npm install
 
 # Compilar a JavaScript (carpeta dist/)
 npm run build
 
 # Iniciar servidor 
 npm run dev
```
## 🧭 Rutas base de la API
```bash
 /api/users
```