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
// app.use(fileUpload());
// app.post("/attachimg", function(req, resp){
//     var data= req.body;
//     var imageFile= req.files.zipfile;
//     console.log(imageFile);
//     var dir= "public/attachment/"+data.meeting_id+"/";
//     if(!fs.existsSync(dir)){
//         fs.mkdirSync(dir);
//     }
//     imageFile.mv("public/attachment/"+data.meeting_id+"/"+imageFile.name, function(error){
//         if(error){
//             console.log("couldn't upload the image file, error:", error);
//         }
//         else{
//             console.log("Image file successfully uploaded");
//         }
//     })
// })
// Middleware for handling file uploads
app.use(fileUpload());

// Route for handling file uploads
app.post("/attachimg", function (req, res) {
  // Check if there are any files uploaded
  if (!req.files || !req.files.zipfile) {
    return res.status(400).send('No files were uploaded.');
  }

  // Extract the uploaded file
  const imageFile = req.files.zipfile;

  // Create directory if it doesn't exist
  const dir = path.join(__dirname, "public", "attachment", req.body.meeting_id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true }); // Use recursive option to create nested directories
  }

  // Move the uploaded file to the specified directory
  imageFile.mv(path.join(dir, imageFile.name), function (error) {
    if (error) {
      console.error("Couldn't upload the image file:", error);
      return res.status(500).send("Internal server error");
    } else {
      console.log("Image file successfully uploaded");
      return res.send("File uploaded successfully");
    }
  });
});
