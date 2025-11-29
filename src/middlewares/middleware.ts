import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { NextFunction, Request, Response } from "express";

const validationMiddleware = (dtoClass: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const output = plainToInstance(dtoClass, req.body) as any;
    output.id = req.params.id;

    if ('id' in output) {
      (output as any).id = req.params.id;
    }

    const errors = await validate(output, { forbidNonWhitelisted: true });

    if (errors.length > 0) {
      const formattedErrors = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
      }));
      return res.status(400).json(formattedErrors);
    }
    next();
  };
};

export default validationMiddleware;