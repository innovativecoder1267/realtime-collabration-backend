import mongoose from "mongoose";
import jwt from "jsonwebtoken";
const userschema=new mongoose.Schema({
    username:{
        type:String,
    },
    email:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    verificationcode:{
        type:Number,
        
    },
    roomId:{
        type:String,
        default:""
    },
    avatar:{
        type:String,
        required:true
    },
    roomExpiresat:{
        type:Date,
    },
    isverified:{
        type:Boolean,
        required:true,
        default:false
    },
    resetpasswordtoken:{
        type:String
    },
    resetTokenexpiry:{
        type:Date
    }
})

 
userschema.methods.generateaccesstoken = function() {
    const payload = {
        id: this._id,
        email: this.email,
        username: this.username,
        ts: Date.now(),
        rnd: Math.random().toString(36).slice(2)
    }

     

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" });
}


userschema.methods.generaterefreshtoken=function(){
    return jwt.sign(
        {
        id:this._id,
        ts: Date.now(), // force uniqueness
        rnd: Math.random().toString(36).substring(2, 10),
        },
        process.env.JWT_SECRET,
        {expiresIn:"2h"}
    )

}

export const User=mongoose.model("User",userschema)