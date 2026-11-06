import { Request, Response } from "express";
import type { MeResponse } from "@algoforge/contracts";
import { serializeAuthUser } from "../serializers/auth";
import { userService } from "../services/user.service";
import { asyncHandler } from "../utils/async-handler";
import { clearAuthCookies } from "../utils/cookies";
import { parseUpdateProfile } from "../validation/user";

class UserController {
  /** PATCH /api/users/me */
  updateMe = asyncHandler(async (req: Request, res: Response) => {
    const input = parseUpdateProfile(req.body);
    const user = await userService.updateProfile(req.auth!.user.id, input);
    const body: MeResponse = { user: serializeAuthUser(user) };
    res.json(body);
  });

  /** DELETE /api/users/me */
  deleteMe = asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteAccount(req.auth!.user.id);
    clearAuthCookies(res);
    res.status(204).send();
  });
}

export const userController = new UserController();
