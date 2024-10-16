//A universal client structure for the new Kaffe-Diem prototype.

import WebSocket from "ws"
import {v4 as uuidv4} from "uuid";

//Each client instance is it's own websocket connection and user in the eyes of the server (This means each client will need to log in seperately)
class Client{
    private socket: WebSocket;

    private externalMethods = new Map();
    private responseHandlers = new Map();

    constructor(port:number){
        console.log("Initiating new client using port: " + port)

        this.socket = new  WebSocket("ws:https://localhost:" + port)

        this.socket.addEventListener("open", () => this.handleSocketConnection())
    }

    
    //  --  Socket management  --

    //Handles inital connection with server
    private handleSocketConnection(){
        console.log("Client successfully connected!")

        this.socket.addEventListener("message", (message) => this.handleIncomingMessage(JSON.parse(message.data.toString()) as commandBase));
        this.socket.addEventListener("close", (closeEvent) => this.handleSocketClosure(closeEvent))
    }

    //Incoming messages with types RESPONSE or ERROR have locally defined functionality.
    //The RESPONSE type will handle a response from a previously sent message using a locally generated ID and calling the resolve of the assigned promise with message.data being passed as a parameter.
    private handleIncomingMessage(message: any){
        console.log(message)

        if(message.type == "RESPONSE"){
            this.handleMessageResponse(message.id, message.data);
        }
        else if(message.type == "ERROR"){
            this.handleError(message.data);
        }
        else{
            this.handleExternalMethodCall(message.type, message.data)
        }
    }

    //CURRENTLY WILL ONLY PRINT TO CONSOLE. NO AUTOMATIC RUNTIME RECONNECTION
    private handleSocketClosure(closeEvent: WebSocket.CloseEvent){
        console.log("SOCKET CLOSED. Clean:" + closeEvent.wasClean)
    }


    //  --  Server WebSocket communication  --

    //Client.send takes a commandBase structured object and sends it through the websocket alongside a locally generated ID. Returns a Promise, and the resolve of that promise is stored alongside the message ID so that a response can be handled later
    public send(message:commandBase){
        return new Promise((resolve) => {
            var ID = uuidv4();
            this.responseHandlers.set(ID, resolve);
            message.id = ID;
            this.socket.send(JSON.stringify(message))
        })
    }

    //Calls a resolve in the "responseHandlers" map using the ID. Passes "data" as the parameter
    public handleMessageResponse(id: string, data: any){
        if(this.responseHandlers.has(id)){
            var handler = this.responseHandlers.get(id);
            handler && handler(data);
            this.responseHandlers.delete(id);
        }
    }

    //CURRENTLY WILL ONLY PRINT TO CONSOLE
    public handleError(data: errorMessageJSONStructure){
        console.log(data.errorMessage);
    }


    //  --  UV Client external functionality  --

    //External scripts can call Client.registerMethod() to have external methods listen to server-sent commands. The "type" parameter is the name of the command and should be the same as some server-sent commandBase.type.
    public registerMethod(type:string, method: CallableFunction){
        this.externalMethods.set(type, method);
    }

    //External scripts will have all listening methods to "type" called with "data" being passed as the parameter
    private handleExternalMethodCall(type: string, data:any){
        if(!this.externalMethods.get(type)(data)){
            console.log("No external method was found. Attempted name <" + type + "> with data: " + data)
        };
    }


    //  --  PUBLIC METHODS  --

    //Login
    public login(username: string, password: string){
        this.send({
                type:"login",
                data:{
                    username,
                    password
                }
            } as commandBase
        )
    }
}

//Defines the base JSON structure for any command being sent to the server
//The data variable will vary based on the command type and contains whatever information the command is sending
interface commandBase{
    type: string;
    id: string;
    data: any;
}

interface errorMessageJSONStructure{
    errorMessage:string;
}