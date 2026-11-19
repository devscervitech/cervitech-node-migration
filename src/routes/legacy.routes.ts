// src/routes/legacy.routes.ts
import { Router } from "express";
import { legacyLogger } from "../middlewares/legacyLogger";
import { AuthController } from "../controllers/auth.controller";
import { UserController } from "../controllers/user.controller";
import { NeckAngleController } from "../controllers/neckAngle.controller";
import { GoalController } from "../controllers/goal.controller";
import { TransactionController } from "../controllers/transaction.controller";

const router = Router();
router.use(legacyLogger);

// -------------------------
// AUTH & USER LIFECYCLE
// -------------------------

// Login
router.post("/user/login", (req, res) => {
  req.body = {
    emailOrUsername: req.body.EmailOrUsername ?? req.body.emailOrUsername ?? req.body.email,
    password: req.body.Password ?? req.body.password,
    mobileChannel: req.body.MobileChannel ?? req.body.mobileChannel,
    fcmToken: req.body.FCMToken ?? req.body.fcmToken,
  };
  return AuthController.authenticate(req, res);
});

// Signup
router.post("/user/signup", (req, res) => {
  req.body = {
    username: req.body.Username ?? req.body.username,
    firstName: req.body.FirstName ?? req.body.firstName,
    lastName: req.body.LastName ?? req.body.lastName,
    email: (req.body.Email ?? req.body.email)?.toLowerCase?.() ?? req.body.email,
    password: req.body.Password ?? req.body.password,
    confirmPassword: req.body.ConfirmPassword ?? req.body.confirmPassword,
    mobileChannel: req.body.MobileChannel ?? req.body.mobileChannel,
    fcmToken: req.body.FCMToken ?? req.body.fcmToken,
    pictureUrl: req.body.pictureUrl ?? req.body.PictureUrl,
  };
  return AuthController.signup(req, res);
});

// Update FCM token
router.put("/user/updatefcmtoken", (req, res) => {
  req.body = {
    fcmToken: req.body.FCMToken ?? req.body.fcmToken ?? req.body.token,
    _id: req.body.UserId ?? req.body.userId ?? req.body._id,
  };
  return UserController.updateFCMToken(req, res);
});

// Send password reset token
router.post("/user/sendpasswordresettoken", (req, res) => {
  req.body = { email: req.body.Email ?? req.body.email };
  return AuthController.sendPasswordToken(req, res);
});

// Reset password
router.put("/user/resetpassword", (req, res) => {
  req.body = {
    token: req.body.Token ?? req.body.token ?? req.query.token,
    newPassword: req.body.NewPassword ?? req.body.newPassword ?? req.body.ConfirmNewPassword ?? req.body.NewPassword,
    email: req.body.Email ?? req.body.email,
  };
  return AuthController.resetPassword(req, res);
});

// Delete account
router.delete("/user/delete", (req, res) => {
  const id = req.query.id;
  const token = req.query.token;
  if (token) {
    req.query = { token: String(token) };
    return UserController.confirmDeleteMyAccount(req as any, res);
  } else if (id) {
    req.params = { id: String(id) };
    return UserController.deleteById(req as any, res);
  } else {
    return res.status(400).json({ success: false, message: "id or token required" });
  }
});

// Get user by email
router.get("/user", (req, res) => {
  if (req.query.email) {
    req.body = { email: String(req.query.email) };
    return UserController.getByEmail(req as any, res);
  }
  return res.status(404).json({ success: false, message: "Not found" });
});

// Get response rate
router.get("/user/getresponserate", (req, res) => {
  return UserController.getResponseRate(req as any, res);
});

// Post response
router.post("/user/postResponse", (req, res) => {
  req.body = { id: req.body.Id ?? req.body.id ?? req.body.userId };
  return (UserController as any).postResponse
    ? (UserController as any).postResponse(req as any, res)
    : res.status(501).json({ success: false, message: "Not implemented" });
});

// -------------------------
// NECK ANGLE & GOALS
// -------------------------

router.get("/user/neckangleparameters", (req, res) => {
  return (UserController as any).getNeckAngleParameters
    ? (UserController as any).getNeckAngleParameters(req, res)
    : res.status(501).json({ success: false, message: "Not implemented" });
});

router.post("/user/postneckanglerecords", (req, res) => {
  req.body = { records: req.body.neckanglerecords ?? req.body.records ?? req.body };
  return (NeckAngleController as any).postBatchNeckAngleRecords
    ? (NeckAngleController as any).postBatchNeckAngleRecords(req, res)
    : res.status(501).json({ success: false, message: "Not implemented" });
});

// Goals
router.post("/goal/turnon", (req, res) => {
  req.body = {
    appUserId: req.body.AppUserId ?? req.body.userId,
    targetedAverageNeckAngle: req.body.TargetedAverageNeckAngle ?? req.body.targetedAverageNeckAngle,
  };
  return (GoalController as any).turnOnGoalByUserId
    ? (GoalController as any).turnOnGoalByUserId(req, res)
    : res.status(501).json({ success: false, message: "Not implemented" });
});

router.get("/goal/getgoals", (req, res) => {
  req.query = req.query || {};
  req.query.userid = req.query.userid ?? req.query.userId ?? req.query.id;
  return (GoalController as any).getGoalsByUserId
    ? (GoalController as any).getGoalsByUserId(req, res)
    : res.status(501).json({ success: false, message: "Not implemented" });
});

// -------------------------
// TRANSACTIONS
// -------------------------

router.post("/transaction", (req, res) => {
  req.body = {
    appUserId: req.body.AppUserId ?? req.body.appUserId,
    paymentRef: req.body.Payment_Ref ?? req.body.paymentRef ?? req.body.payment_ref,
    amount: req.body.Amount ?? req.body.amount,
    status: req.body.Status ?? req.body.status,
    description: req.body.Description ?? req.body.description,
  };
  return TransactionController.createTransactionRecord(req, res);
});

export default router;
