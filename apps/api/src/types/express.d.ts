import { Role } from "@algoforge/db";

declare global {
  namespace Express {
    interface Request {
      /** Correlation id, also returned in the X-Request-Id response header. */
      requestId?: string;
      auth?: {
        user: {
          id:       string;
          email:    string | null;
          username: string | null;
          name:     string | null;
          image:    string | null;
          role:     Role;
        };
        session: {
          id:        string;
          expiresAt: Date;
        };
      };
    }
  }
}

export {};
