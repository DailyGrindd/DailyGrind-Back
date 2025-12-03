import { IsMongoId, IsNotEmpty, IsNumber, Min, Max } from "class-validator";

export class AssignChallengeDto {
    @IsMongoId({ message: "El ID del desafío no es válido" })
    @IsNotEmpty({ message: "El ID del desafío es obligatorio" })
    challengeId!: string;

    @IsNumber({}, { message: "El slot debe ser un número" })
    @Min(4, { message: "Los slots para desafíos personales son 4 y 5" })
    @Max(5, { message: "Los slots para desafíos personales son 4 y 5" })
    @IsNotEmpty({ message: "El slot es obligatorio" })
    slot!: number;
}
