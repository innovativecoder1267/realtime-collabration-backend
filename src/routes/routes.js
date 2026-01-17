import { Router } from "express";
import userControllers from "../controllers/user.controllers.js";
import { verifytokens } from "../middleware/jwt.middleware.js";
const route=Router();

route.post("/register",userControllers.Registeruser)
route.post("/login",userControllers.LoginUser)
route.post("/verify",userControllers.verifyuser)
route.post("/roomid",verifytokens,userControllers.roomidgenerator)
route.post("/entrypoint",userControllers.verifyroomid)
route.get("/getavatar",verifytokens,userControllers.getavatar)
route.post("/authgoogle",userControllers.authgoogle)
route.post("/forgot",userControllers.Sendmail)
route.post("/reset",userControllers.ResetPassword)
export default route;