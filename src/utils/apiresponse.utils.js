class apiresponse{
    constructor(statuscode,message,data="success"){
        this.statuscode=statuscode,
        this.message=message,
        this.data=data
    }
}
export default apiresponse;