import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import route from "./src/routes/routes.js";
import cors from "cors";
import { Server } from "socket.io";
import http from "node:http";


dotenv.config();
const app = express();

const port = process.env.PORT || 4000;
const mongodburi = process.env.MONGO_URI;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);  
app.get("/", (req, res) => {
  res.send("Realtime Collaboration Backend is running 🚀");
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// In-memory rooms map: { [roomId]: { users:[], allowed:[], diffs:[], notification:[] } }
const rooms = {};
 
io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);
  socket.id=socket.id
  // JOIN ROOM
  socket.on("join-room", ({ roomId, userid, avatar, name }) => {
    if (!roomId) return;
    console.log("room joined request:", socket.id, roomId, userid, name);

    socket.join(roomId);
    socket.roomId = roomId;
  
    if (!rooms[roomId]) {
      rooms[roomId] = { host:{userid,socketid:socket.id}, users: [], allowed: [], diffs: [], notification: [] };
    }

    // find existing by userid (persistent client id stored in sessionStorage)
    const existingUser = rooms[roomId].users.find((u) => u.userid === userid);

    if (existingUser) {
      // reconnect: update socket id and also update allowed[] entries that used old socket id
      const oldSocketId = existingUser.user;
      existingUser.user = socket.id;
      if(rooms[roomId].host.userid===userid){
        rooms[roomId].host.socketid=socket.id
        Emithost(roomId)
      }
      // update allowed list entries that pointed to the old socket id
      const allowed = rooms[roomId].allowed;
      const idx = allowed.indexOf(oldSocketId);
      if (idx !== -1) {
        allowed[idx] = socket.id;
        console.log("Updated allowed entry from", oldSocketId, "to", socket.id);
      }
      console.log("🔁 Reconnect: updated existing user", userid, "->", socket.id);
    } else {
      // new join
      rooms[roomId].users.push({ userid, user: socket.id, name });
      // notify others only when actually new
      socket.to(roomId).emit("new-user", `New user entered in ${roomId}`);
    }

    // ensure room has an initial host (first allowed)
    if (rooms[roomId].allowed.length === 0) {
      rooms[roomId].allowed.push(socket.id);
    }

    // send up-to-date user list to everyone in room (including sender)
    io.to(roomId).emit("name", rooms[roomId].users);

    console.log("Room state:", JSON.stringify(rooms[roomId], null, 2));
    console.log("📥 Joined room:", roomId);
  });
  socket.on("voice-request",({roomid,name})=>{
    if(!rooms[roomid])return;
   const hostsocketid=rooms[roomid].host.socketid

    console.log(`voice popup socket id is${hostsocketid} name is ${name} roomid is ${roomid} `)
    io.to(hostsocketid).emit("voice-popup",({
      message:`${name}wants to talk`,
      fromsocketid:socket.id,
      fromname:name,
      
    }))
  })
 
  socket.on("end-room",(roomId)=>{
    if(!rooms[roomId])return
    console.log("End request received",roomId)
    io.to(roomId).emit("ended","room has been ended")
    delete rooms[roomId]
    console.log("room deleted")
  })

  socket.on("disconnect",()=>{
    const {roomid}=socket
    if(!rooms[roomid])return;
    rooms[roomid].users=rooms[roomid].users.filter((u)=>u.user!=socket.id)
    if(rooms[roomid].host.socketid===socket.id){
      const next=rooms[roomid].users[0]
      if(next){
        rooms[roomid].host={
         userid:next.userid,
         socketid:next.user
        }
        Emithost(roomid)
      }else{
        delete rooms[roomid];//room empty
        return;
      }
    }
    rooms[roomid].allowed=rooms[roomid].allowed.filter((id) =>id!=socket.id)


      // baaki users ko notify
  socket.to(roomid).emit("user-left", socket.id);
  })
 socket.on("webrtc-offer", ({targetedsocketid,offer})=> {
  console.log("web rtc offer received",targetedsocketid,offer)
  io.to(targetedsocketid).emit("webrtc-offer", {
    offer,
    from: socket.id,
  });
});
   function Emithost(roomId){
    if(!rooms[roomId])return;
    io.to(roomId).emit("host-updated",rooms[roomId].host)
  }

// ================= WEBRTC ANSWER =================
socket.on("webrtc-answer", ({ targetedsocketid, answer }) => {
  console.log("are haaaa")
  io.to(targetedsocketid).emit("webrtc-answer", {
    answer,
    from: socket.id,
  });
});
  socket.on("ice-candidate",({targetedid,candidate})=>{
  io.to(targetedid).emit("ice-candidate",{candidate})
  })

  // grant drawing permission (host -> target)
  socket.on("grant-draw", ({ roomid, targetedid }) => {
    if (!rooms[roomid]) return;
    if (!rooms[roomid].allowed.includes(targetedid)) {
      rooms[roomid].allowed.push(targetedid);
    }
    io.to(roomid).emit("granted", rooms[roomid].allowed);
    io.to(targetedid).emit("role-popup",{
      role:"draw granted",
      message:"You have been Granted drawing"
    })
  });

  // typing indicator (broadcast to room except sender)
  socket.on("typing", ({ roomid, Typing }) => {
    socket.to(roomid).emit("typing-status", Typing);
  });
  
  // request the user list (sender only gets it)
  socket.on("get-userlist", (roomId) => {
    if (!rooms[roomId]) return;
    socket.emit("user",rooms[roomId].users);
  });
  //removing user from array {-from manage room}
  socket.on("remove-user",({roomId,targetedid})=>{
    if(!rooms[roomId])return;
    if(rooms[roomId].host.socketid!=socket.id)return
    rooms[roomId].users=rooms[roomId].users.filter((u)=>u.user!=targetedid)

    const targeted=io.sockets.sockets.get(targetedid)
      if (targeted) {//optional case handling 
    targeted.leave(roomId);
    targeted.emit("kicked", "You were removed from the room");
    console.log("user kicked ")
  }
    //just the confirmation message
    io.to(roomId).emit("user-removed","user removed successfully")
  })
  // request allow-list (sender only)
  socket.on("allow-list", (roomid) => {
    if (!rooms[roomid]) return;
    socket.emit("list", rooms[roomid].allowed);
  });

  // receive diffs from authorized clients and store them
  socket.on("sync-update", ({ roomId, diff }) => {
    if (!roomId || !diff) return;
    if (!rooms[roomId]) return;

    // authorization
    if (!rooms[roomId].allowed.includes(socket.id)) {
      console.log("❌ UNAUTHORIZED DRAW BLOCKED", socket.id);
      return;
    }
    
    // push diff to room state
    rooms[roomId].diffs.push(diff);
    // cap diffs array for memory
    if (rooms[roomId].diffs.length > 500) rooms[roomId].diffs.shift();
      
    // broadcast diff to everyone in room except sender
    socket.to(roomId).emit("sync-update", diff);
  });
  socket.on("re-assign",({roomid,targetedid})=>{
    console.log("room id",roomid,"user is ",targetedid)
    if(!rooms[roomid])return;
    const allowed=rooms[roomid].allowed //here we got the allowed
    const index=allowed.indexOf(targetedid)
    if(index==0||index==-1)return;//if index is 0 then it is a host it is the extra safety check i think
     allowed.splice(index,1)
     io.to(roomid).emit("granted", allowed);        
  })

  // dashboard / client asks for full state (send to everyone in room)
  socket.on("get-state", (roomid) => {
    if (!roomid || !rooms[roomid]) return;
    if (!rooms[roomid].diffs || rooms[roomid].diffs.length === 0) {
      // nothing to send
      socket.emit("state", []); // explicit empty
      return;
    }
    // send current diffs to everyone in room (so fresh clients can rebuild)
    socket.emit("state", rooms[roomid].diffs);
    console.log("📤 Emitted state to room", roomid);
  });

  // chat messages (pass-through)
  socket.on("messages", ({ message, roomid }) => {
    socket.to(roomid).emit("messages", message);
  });
socket.on("leave-call", ({ roomid,uimessage }) => {
  if (!rooms[roomid]) return;

  // 🔥 Emit to EVERYONE in room except sender
  socket.to(roomid).emit("leaved",uimessage);
});

});
  
// routes + start
app.use("/", route);
const startServer = async () => {
  try {
    if (mongodburi) {
      await mongoose.connect(mongodburi);
      console.log("Connected to MongoDB ✅");
    } else {
      console.log("No Mongo URI provided; starting without DB connection");
    }
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server + Socket.IO running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error("DB connection failed ❌", err);
  }
};

startServer(); 

