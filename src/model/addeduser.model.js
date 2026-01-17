import mongoose from "mongoose";

const addeduser=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    roomid:{
        type:String,
        required:true
    },
    usercount:{
        type:Number,
        default:0
    }
})
export const added=mongoose.model("added",addeduser);