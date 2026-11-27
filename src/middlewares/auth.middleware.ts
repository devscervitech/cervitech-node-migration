import { Request, Response, NextFunction } from "express";
import { TokenUtil, isUserTokenRole, InvalidTokenError } from "../utils/token.util";
import TokenBlacklist from "../models/TokenBlacklist";
import type { BackofficeAccessLevel } from "../enums/backofficeAccessLevel";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: "APP_USER" | "BACKOFFICE_USER";
    username?: string;
    email?: string;
    /** Current back-office authorization level, loaded from the database. */
    accessLevel?: string;
    /**
     * Back-office only. From the current stored value, never the token
     * claims; true unless the stored value is exactly false (fail closed).
     */
    readOnly?: boolean;
  };
}

/**
 * Status contract for every guard in this file. Clients depend on the split,
 * so keep new branches on the right side of it:
 *
 *   401  Authentication failed. There is no usable identity: no header, a
 *        malformed, expired, revoked or unverifiable token, or a token whose
 *        role claim cannot be trusted. The caller must sign in again.
 *   403  Authentication succeeded and the identity is established, but this
 *        account may not perform this action: wrong role, insufficient access
 *        level, or a read-only account. Signing in again changes nothing.
 *   503  Verification could not be completed (e.g. the account lookup failed).
 *        The caller should retry, not sign out.
 *
 * Before this was enforced, a dead token and a permission refusal both
 * returned 403, so clients could only tell them apart by string-matching the
 * message. The mobile client treated any 403 as a dead session, which turned
 * one back-office permission error into a sign-out loop for every user.
 */
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

    // Verifies the token and returns a minimal record of the current account
    // from the lookup verification already performs (no additional query).
    const { payload, account } = await TokenUtil.verifyUserTokenWithAccount(token);

    // 401, not 403: the token itself is unusable, so this is an
    // authentication failure. 403 would tell the client "you are signed in
    // but not allowed", and it would keep presenting a token that can never
    // work. See the status contract above authenticateJWT.
    if (!isUserTokenRole(payload.role) || account.role !== payload.role) {
      return res.status(401).json({
        success: false,
        message: "Token missing role information.",
      });
    }

    // Identity comes from the current stored record, not the JWT claims.
    req.user = {
      userId: account.userId,
      role: account.role,
      username: account.username,
      email: account.email,
    };

    if (account.role === "BACKOFFICE_USER") {
      req.user.accessLevel = account.accessLevel;
      req.user.readOnly = account.readOnly;
    }

    next();
  } catch (err) {
    if (!(err instanceof InvalidTokenError)) {
      return res.status(503).json({ success: false, message: 'Authentication temporarily unavailable' });
    }
    // 401, not 403: verification failed, so there is no authenticated
    // identity to refuse anything to. The message string is deliberately
    // unchanged -- clients string-match it today (see B19), so this release
    // moves the status only.
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

export const authorizeRole = (role: "APP_USER" | "BACKOFFICE_USER") => {
  return function authorizeRoleMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
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

/** Restrict back-office account administration to an explicitly assigned level. */
export const requireAccessLevel = (...allowedLevels: BackofficeAccessLevel[]) => {
  return function requireAccessLevelMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in.",
      });
    }

    if (
      req.user.role !== "BACKOFFICE_USER" ||
      !allowedLevels.includes(req.user.accessLevel as BackofficeAccessLevel)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Administrator privileges are required.",
      });
    }

    next();
  };
};

/**
 * Allows administrative mutations only for a BACKOFFICE_USER whose current
 * stored readOnly value is exactly false. Missing or unexpected values fail
 * closed. Use after authenticateJWT and authorizeRole('BACKOFFICE_USER').
 * Read routes and self-service authentication (logout, change-password) must
 * not use it. Account administration must also pass requireAccessLevel('ADMIN').
 */
export const requireWritable = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Please log in.",
    });
  }

  if (req.user.role !== "BACKOFFICE_USER") {
    return res.status(403).json({
      success: false,
      message: "Access denied.",
    });
  }

  if (req.user.readOnly !== false) {
    return res.status(403).json({
      success: false,
      message: "This account has read-only access.",
    });
  }

  next();
};
