class apierrorhandler extends Error{
    constructor(
        status,
        message="something went wrong 404-not found",
        error=[],
        stack=""
    ){
        super(message),
        this.statuscode=status,
        this.error=error,
        this.success=false,
        this.data=null
        if(stack){
            this.stack=stack
        }
        else{
            Error.captureStackTrace(this,this.constructor)
        }
    }

}
export default apierrorhandler