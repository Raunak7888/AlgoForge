import { UpdateProfileRequestSchema, type UpdateProfileRequest } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod } from "./common";

export function parseUpdateProfile(value: unknown): UpdateProfileRequest {
  const result = UpdateProfileRequestSchema.safeParse(value ?? {});
  if (!result.success) throw badRequestFromZod(result.error, "Invalid profile data.");
  if (result.data.name === undefined && result.data.username === undefined) {
    throw AppError.badRequest("Provide a name or a username to update.");
  }
  return result.data;
}
