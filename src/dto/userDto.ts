import userModel from "../models/user";
import { IsEmail, IsNotEmpty, IsOptional,IsString, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate, MinLength, IsBoolean } from "class-validator";

@ValidatorConstraint({ async: true })
class isEmailUnique implements ValidatorConstraintInterface {
    async validate(email: string) {
        const user = await userModel.findOne({ email });
        return !user;
    }
    defaultMessage = () => "El correo ya está en uso";
}

@ValidatorConstraint({ async: true })
class isDisplayNameUnique implements ValidatorConstraintInterface {
    async validate(displayName: string) {
        const user = await userModel.findOne({ displayName });
        return !user;
    }
    defaultMessage = () => "El nickname ya está en uso";
}

@ValidatorConstraint({ async: true })
class isDisplayNameUniqueUpdate implements ValidatorConstraintInterface {
    async validate(displayName: string, args: ValidationArguments) {
        const email = (args.object as any).currentEmail; // Pasar el email actual
        const user = await userModel.findOne({ "profile.displayName": displayName });
        
        if (!user) return true;
        
        // Si existe, verifica que sea del mismo usuario
        return user.email === email;
    }

    defaultMessage = () => "El nickname ya está en uso";
}

@ValidatorConstraint({ async: true })
class isEmailUniqueUpdate implements ValidatorConstraintInterface {
    async validate(email: string, args: ValidationArguments) {
        const userId = (args.object as any).id;
        const user = await userModel.findOne({ email });

        if (user && !user._id.equals(userId)) {
            return false;
        }
        return true;
    }

    defaultMessage = () => "El correo ya está en uso";
}

export class CreateUserDto {
    @IsString({ message: "El nombre debe ser un texto" })
    @MinLength(3, { message: "El nombre debe tener al menos 3 caracteres" })
    @IsNotEmpty({ message: "El nombre del usuario es obligatorio" })
    userName!: string;

    @IsEmail({}, { message: "El correo no tiene un formato válido" })
    @IsNotEmpty({ message: "El correo del usuario es obligatorio" })
    @Validate(isEmailUnique)
    email!: string;

    @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
    @IsNotEmpty({ message: "La contraseña del usuario es obligatoria" })
    password!: string;

    // profile
    @IsString({ message: "El nombre de perfil debe ser un texto" })
    @IsNotEmpty({ message: "El nombre de perfil es obligatorio" })
    @Validate(isDisplayNameUnique)
    displayName!: string;

    @IsOptional()
    avatarUrl?: string;

    @IsNotEmpty({ message: "La ubicacion es obligatoria" })
    zone!: string;
}

export class UpdateUserDto {
    @IsString({ message: "El nombre debe ser un texto" })
    @MinLength(3, { message: "El nombre debe tener al menos 3 caracteres" })
    @IsOptional()
    userName?: string;

    @IsEmail({}, { message: "El correo no tiene un formato válido" })
    @Validate(isEmailUniqueUpdate)
    @IsOptional()
    email?: string;

    @MinLength(6, { message: "La contraseña debe tener al menos 6 caracteres" })
    @IsOptional()
    password?: string;

    // profile
    @IsString({ message: "El nombre de perfil debe ser un texto" })
    @IsOptional()
    @Validate(isDisplayNameUniqueUpdate)
    displayName?: string;

    @IsOptional()
    avatarUrl?: string;

    @IsOptional()
    zone?: string;
}