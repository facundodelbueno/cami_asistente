import type { Request } from "express";

export function requiredParam(req: Request, name: string) {
  const value = req.params[name];
  if (Array.isArray(value) || !value) {
    throw new Error(`Missing route param: ${name}`);
  }
  return value;
}
