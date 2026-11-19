import { Request, Response, NextFunction } from "express";
import { TokenUtil, InvalidTokenError } from "../utils/token.util";
import TokenBlacklist from "../models/TokenBlacklist";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: "APP_USER" | "BACKOFFICE_USER";
    username?: string;
    email?: string;
    accessLevel?: string;
  };
}

export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: "Token expired or revoked. Please log in again.",
      });
    }

    const payload = await TokenUtil.verifyUserToken(token);

    if (!payload.role) {
      return res.status(403).json({
        success: false,
        message: "Token missing role information.",
      });
    }

    req.user = {
      userId: payload.userId,
      role: payload.role,
      username: payload.username,
      email: payload.email,
      accessLevel: payload.accessLevel,
    };

    next();
  } catch (err: any) {
    if (!(err instanceof InvalidTokenError)) {
      return res.status(503).json({ success: false, message: 'Authentication temporarily unavailable' });
    }
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
      error: err.message,
    });
  }
};

export const authorizeRole = (role: "APP_USER" | "BACKOFFICE_USER") => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in.",
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only ${role}s are allowed.`,
      });
    }

    next();
  };
};
