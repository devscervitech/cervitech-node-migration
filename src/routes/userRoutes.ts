import express from "express";
import { updatePictureUrl, updateSubscription, getResponseRate } from "../controllers/UserController";
import {Router} from "express";
import UserController from "../controllers/UserController";

const router = Router();
router.put("/updatepictureurl", updatePictureUrl);
router.put("/updatesubscription/:id", updateSubscription);
router.get("get-response-rate/:id", getResponseRate);

export default router;
