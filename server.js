const express = require("express");
const path = require("path");
const app = express();
const fs= require("fs");
const server = app.listen(3000, function () {
  console.log("listening to port 3000");
});
const fileUpload= require("express-fileupload");
const io = require("socket.io")(server, {
  allowEIO3: true, // Corrected option name
});


app.use(express.static(path.join(__dirname, "")));
app.use(fileUpload());
var userConnections = [];
io.on("connection", (socket) => {
  console.log("socket id is", socket.id);
  socket.on("userconnect", (data) => {
    console.log("userconnect", data.displayName, data.meetingid);
    var other_users = userConnections.filter(
      (p) => p.meeting_id == data.meetingid
    );
    userConnections.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });
    var userCount = userConnections.length;
    console.log(userCount);
    other_users.forEach((v)=>{
        socket.to(v.connectionId).emit("inform_others_about_me",{
            other_user_id: data.displayName,
            connId: socket.id,
            userNumber: userCount

        })
    })
    socket.emit("inform_me_about_other_user", other_users);
  });
  socket.on("SDPProcess", (data)=>{
    socket.to(data.to_connid).emit("SDPProcess",{
        message: data.message,
        from_connid:socket.id
    })
  })
  socket.on("sendMessage", (msg)=>{
    console.log(msg);
    var mUser = userConnections.find((user) => user.connectionId === socket.id);
    if (mUser) {
        var meetingId = mUser.meeting_id;
        var usersInSameMeeting = userConnections.filter((user) => user.meeting_id === meetingId);
        usersInSameMeeting.forEach((user) => {
            io.to(user.connectionId).emit("showChatMessage", {
                from: mUser.user_id,
                message: msg
            });
        });
    }
});
socket.on("fileTransferToOther", (msg)=>{
    console.log(msg);
    var mUser = userConnections.find((user) => user.connectionId === socket.id);
    if (mUser) {
        var meetingId = mUser.meeting_id;
        var usersInSameMeeting = userConnections.filter((user) => user.meeting_id === meetingId);
        usersInSameMeeting.forEach((user) => {
            io.to(user.connectionId).emit("showFileMessage", {
            username: msg.username,
            meetingid:msg.meetingid,
            filePath: msg.filePath,
            fileName: msg.fileName
            });
        });
    }
});


socket.on("disconnect", function(){
    console.log("Disconnected");
    var disUser = userConnections.find((user) => user.connectionId === socket.id);
    if (disUser) {
        var meetingId = disUser.meeting_id;
        userConnections = userConnections.filter((user) => user.connectionId !== socket.id);
        var usersInSameMeeting = userConnections.filter((user) => user.meeting_id === meetingId);
        usersInSameMeeting.forEach((user) => {
           var userNumberAfterLeave= userConnections.length;
            io.to(user.connectionId).emit("inform_other_about_disconnected_user", {
                connId: socket.id,
                uNumber: userNumberAfterLeave
            });
        });
    }
});
});

app.post("/attachimg", function(req, resp){
    var data= req.body;
    var imageFile= req.files.zipfile;
    console.log(imageFile);
    var dir= "public/attachment/"+data.meeting_id+"/";
    if(!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    imageFile.mv("public/attachment/"+data.meeting_id+"/"+imageFile.name, function(error){
        if(error){
            console.log("couldn't upload the image file, error:", error);
        }
        else{
            console.log("Image file successfully uploaded");
        }
    })
})