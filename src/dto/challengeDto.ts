import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional, IsArray, Min, Max, IsMongoId } from "class-validator";

export class CreateChallengeDto {
    @IsString({ message: "El tipo debe ser un texto" })
    @IsNotEmpty({ message: "El tipo de desafío es obligatorio" })
    type!: string;

    @IsMongoId({ message: "El ID del usuario no es válido" })
    @IsOptional()
    ownerUser?: string;

    @IsString({ message: "El título debe ser un texto" })
    @IsNotEmpty({ message: "El título del desafío es obligatorio" })
    title!: string;

    @IsString({ message: "La descripción debe ser un texto" })
    @IsNotEmpty({ message: "La descripción del desafío es obligatoria" })
    description!: string;

    @IsString({ message: "La categoría debe ser un texto" })
    @IsNotEmpty({ message: "La categoría del desafío es obligatoria" })
    category!: string;

    @IsNumber({}, { message: "La dificultad debe ser un número" })
    @Min(1, { message: "La dificultad mínima es 1" })
    @Max(5, { message: "La dificultad máxima es 5" })
    @IsNotEmpty({ message: "La dificultad del desafío es obligatoria" })
    difficulty!: number;

    @IsNumber({}, { message: "Los puntos deben ser un número" })
    @Min(0, { message: "Los puntos no pueden ser negativos" })
    @IsNotEmpty({ message: "Los puntos del desafío son obligatorios" })
    points!: number;

    @IsBoolean({ message: "isActive debe ser verdadero o falso" })
    @IsOptional()
    isActive?: boolean;

    @IsArray({ message: "Tags debe ser un array" })
    @IsString({ each: true, message: "Cada tag debe ser un texto" })
    @IsOptional()
    tags?: string[];

    @IsNumber({}, { message: "El nivel mínimo debe ser un número" })
    @IsOptional()
    minLevel?: number;

    @IsMongoId({ message: "El ID del desafío prerequisito no es válido" })
    @IsOptional()
    preRequisiteChallenge?: string;

    @IsNumber({}, { message: "maxPerDay debe ser un número" })
    @IsOptional()
    maxPerDay?: number;

    @IsNumber({}, { message: "minUserLevel debe ser un número" })
    @IsOptional()
    minUserLevel?: number;
}

export class UpdateChallengeDto {
    @IsString({ message: "El tipo debe ser un texto" })
    @IsOptional()
    type?: string;

    @IsString({ message: "El título debe ser un texto" })
    @IsOptional()
    title?: string;

    @IsString({ message: "La descripción debe ser un texto" })
    @IsOptional()
    description?: string;

    @IsString({ message: "La categoría debe ser un texto" })
    @IsOptional()
    category?: string;

    @IsNumber({}, { message: "La dificultad debe ser un número" })
    @Min(1, { message: "La dificultad mínima es 1" })
    @Max(5, { message: "La dificultad máxima es 5" })
    @IsOptional()
    difficulty?: number;

    @IsNumber({}, { message: "Los puntos deben ser un número" })
    @Min(0, { message: "Los puntos no pueden ser negativos" })
    @IsOptional()
    points?: number;

    @IsBoolean({ message: "isActive debe ser verdadero o falso" })
    @IsOptional()
    isActive?: boolean;

    @IsArray({ message: "Tags debe ser un array" })
    @IsString({ each: true, message: "Cada tag debe ser un texto" })
    @IsOptional()
    tags?: string[];

    @IsNumber({}, { message: "El nivel mínimo debe ser un número" })
    @IsOptional()
    minLevel?: number;

    @IsMongoId({ message: "El ID del desafío prerequisito no es válido" })
    @IsOptional()
    preRequisiteChallenge?: string;

    @IsNumber({}, { message: "maxPerDay debe ser un número" })
    @IsOptional()
    maxPerDay?: number;

    @IsNumber({}, { message: "minUserLevel debe ser un número" })
    @IsOptional()
    minUserLevel?: number;
}
