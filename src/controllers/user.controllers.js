import { User } from "../model/user.model.js";
import apierrorhandler from "../utils/apierrorhandler.utils.js";
import asynchandlers from "../utils/asynchandler.utils.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { added } from "../model/addeduser.model.js";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import { Resend } from "resend";

const Registeruser=asynchandlers(async(req,res)=>{
    const{email,username,password,avatar}=req.body
    console.log(email,username,password,avatar)
     const verificationCode = Math.floor(100000 + Math.random() * 900000);
     console.log("code is",verificationCode)
    if(!email||!username||!password||!avatar){
        throw new apierrorhandler(400,"Please fill all the empty fields")
    }
    const finduser=await User.findOne({email})
    if(finduser){
        if(finduser.isverified){
          throw new apierrorhandler("user already registered")
        }
        else{
          const hashing=await bcrypt.hash(password,10)
          finduser.username=username
          finduser.password=hashing
          finduser.avatar=avatar
          finduser.verificationcode=verificationCode
              await finduser.save() 

        }
    }
 const resend = new Resend(process.env.RESEND_EMAIL_SECRET);

const { data, error } = await resend.emails.send({
  from: "onboarding@resend.dev",
  to: email,
  subject: "Verify your email address",
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
      <h2>Email Verification</h2>
      <p>Your verification code is:</p>
      <h1>${verificationCode}</h1>
      <p>This code is valid for 10 minutes.</p>
    </div>
  `,
});

if (error) {
  console.error("Resend error:", error);
}
console.log("Resend mail data is ",data)

    if(!finduser){
    const hashedpassword=await bcrypt.hash(password,10)
    const newUser=await User.create({
        email:email,
        username:username,
        password:hashedpassword,
        avatar:avatar,
        verificationcode:verificationCode,
        isverified:false//user hasnt been verified yet
    })
    if(!newUser){
        throw new apierrorhandler(500,"Cant create the new user")
    }
  
    }   
   return res.status(200).json({
    message:"user registered successfully"
   })
  
})
const verifyuser=asynchandlers(async(req,res)=>{
    const {otp}=req.body
    console.log(otp)
    if(!otp){
        throw new apierrorhandler(400,"Cant recieve the otp")
    }
    const user=await User.findOne({verificationcode:otp})//now we have the user
    if(!user){
        throw new apierrorhandler(400,"Cant find the user")
    }
    if(user.verificationcode!=otp){
        throw new apierrorhandler(400,"Verification failed")
    }
    user.isverified=true
    await user.save()
   return res.status(200).json({
    data:null,
    message:"User verified successfully"
   })
})
//we will update that object simultaneously
const LoginUser = asynchandlers(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new apierrorhandler(400,"plz fill all the required fields")
  }
  console.log("email is",email)

  const findUser = await User.findOne({ email });
  if (!findUser) {
    throw new apierrorhandler(404, "Cannot find the user, please signup");
  }

  const compare = await bcrypt.compare(password, findUser.password);
  if (!compare) {
    throw new apierrorhandler(401, "Password is incorrect");
  }
  if(!findUser.isverified){
    throw new res.status(403)
  }
  const accesstoken = await findUser.generateaccesstoken(); // instance method
  const refreshtoken = await findUser.generaterefreshtoken(); // instance method
  if (!accesstoken || !refreshtoken) {
    throw new apierrorhandler(500, "Cannot generate tokens");
  }
  

 return res.status(200).json({
  data:accesstoken,refreshtoken,
  message:"User logged in successfully"
 })
});
const roomidgenerator=asynchandlers(async(req,res)=>{
  const userid=req.user.id

 if(!mongoose.Types.ObjectId.isValid(userid)){
  throw new apierrorhandler(400,"user id is not valid")
 }
  const roomId=Math.random().toString(36).substring(2,15)+Math.random().toString(36).substring(2,15)
  const expires= Date.now() + 60 * 60 * 2000;
  const user=await User.findByIdAndUpdate(userid,{
    roomId:roomId,
    roomExpiresat:expires
  },{
    new:true
  })
  if(!user){
    throw new apierrorhandler(400,"cant update the user")
  }
  return res.status(200).json({
    message:"roomId generated successfully",
    data:user
  })
})
const verifyroomid=asynchandlers(async(req,res)=>{
  const {roomid}=req.body
  if(!roomid){
    throw new apierrorhandler(400,"cant find the room id")
  }
  const finduser=await User.findOne({roomId:roomid})
  if(!finduser){
    throw new apierrorhandler(400,"room id is not matched")
  }
  if(Date.now()>finduser.roomExpiresat){
    throw new apierrorhandler(400,"room id has expired")
  }
  const update=await added.create({
    roomid:roomid
  })
  if(!update){
    throw new apierrorhandler(500,"cant update the user")
  }
  
  return res.status(200).json({
    message:"room id verified successfully",
    data:finduser
  })
})
  const getavatar=asynchandlers(async(req,res)=>{
    const userid=req.user.id
   if(!mongoose.Types.ObjectId.isValid(userid)){
  throw new apierrorhandler(400,"user id is not valid")
 }
    const finduser=await User.findById(userid)
 
    if(!finduser){
     throw new apierrorhandler(402,"Cant find the user")
    }
    return res.status(200).json({
      message:"Avatar fetched successfully",
      data:finduser.avatar
    })
  })
  const authgoogle=asynchandlers(async(req,res)=>{
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
     try {
      const {token}=req.body
      if(!token){
       throw new apierrorhandler(401,"Cant find the credential")
      }
      const ticket=await client.verifyIdToken({
        idToken:token,
        audience:process.env.GOOGLE_CLIENT_ID
      })
      const payload=ticket.getPayload()
      console.log("payload is ",payload)
      const {email,username}=payload
      const CheckUser=await User.findOne({email})
      if(!CheckUser){
      const createuser=await User.create({
          email,
          username,
          isverified:true
        })
      }
   
      return res.status(200).json({
        message:"User saved in Db",
        data:CheckUser
      })
     } catch (error) {
      console.log(error)

     }
  })
  const Sendmail=asynchandlers(async(req,res)=>{
    const {email}=req.body
    if(!email){
      throw new apierrorhandler(401,"Plz send Email")
    }
    console.log("requestcame")
    const user=await User.findOne({email})
   
    const resetToken = crypto.randomBytes(32).toString("hex");
     const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

    user.resetpasswordtoken=hashedToken
    user.resetTokenexpiry=Date.now() + 15 * 60 * 1000;
    await user.save()
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

    const resend = new Resend(process.env.RESEND_EMAIL_SECRET);

const { data, error } = await resend.emails.send({
  from: "onboarding@resend.dev",
  to: email,
  subject: "Verify your email address",
   html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Reset your password</h2>
          <p>We received a request to reset your password.</p>
          <p>Click the button below to set a new password. This link will expire in <strong>15 minutes</strong>.</p>
    
          <a href="${resetLink}" 
             style="
               display: inline-block;
               padding: 12px 20px;
               margin: 16px 0;
               background-color: #000;
               color: #fff;
               text-decoration: none;
               border-radius: 6px;
               font-weight: bold;
             ">
            Reset Password
          </a>
    
          <p>If you did not request this, you can safely ignore this email.</p>
    
          <p style="font-size: 12px; color: #888;">
            This is an automated message. Please do not reply.
          </p>
        </div>
      `
    ,
});

if (error) {
  console.error("Resend error:", error);
}
console.log("Resend mail data is ",data)

    return res.status(200).json({
      message:"email sent successfully"
    })
    })
    const ResetPassword=asynchandlers(async(req,res)=>{
      const {token,newPassword,confirmPassword}=req.body
      if(!token||!newPassword||!confirmPassword){
        throw new apierrorhandler(401,"Plz fill all the details")
      }
      
      const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
      const user=await User.findOne({
        resetpasswordtoken:hashedToken,
          resetTokenexpiry: { $gt: Date.now() }
      })
      if(!user){
        throw new apierrorhandler(402,"User not found")
      }
    
      if(newPassword!=confirmPassword){
        throw new apierrorhandler(402,"Password doesnt match")
      }
      const hashed=await bcrypt.hash(newPassword,10)
      user.password=hashed
      user.resetpasswordtoken=null
      await user.save();
      return res.status(200).json({
        message:"Password reseted successfully",
        data:null
      })
    })

export default {
    Registeruser,
    verifyuser,
    LoginUser,
    roomidgenerator,
    verifyroomid,
    getavatar,
    authgoogle,
    Sendmail,
    ResetPassword

};




