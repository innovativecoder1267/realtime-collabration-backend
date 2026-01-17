import jwt from "jsonwebtoken";

export const verifytokens = (req, res, next) => {
  const autheader = req.headers["authorization"];

  if (autheader && autheader.startsWith("Bearer ")) {
    const token = autheader.split(" ")[1];
  try {
    const decoded=jwt.verify(token,process.env.JWT_SECRET)
    const userid=decoded?.id
    if(!userid){
      return res.status(400).json({
        message:"user not found",
        data:null
      })
    }
    req.user={id:userid}
    next();
  } catch (error) {
    console.error("error occured",error)
    return res.status(401).json({
      message:`error occured ${error}`,
      data:null
    })
  }
  } 
}