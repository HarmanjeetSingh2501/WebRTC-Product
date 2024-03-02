const express = require("express");
const path = require("path");
const app = express();
const server = app.listen(3000, function () {
  console.log("listening to port 3000");
});

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
    other_users.forEach((v)=>{
        socket.to(v.connectionId).emit("inform_others_about_me",{
            other_users: data.displayName,
            connId: socket.id,

        })
    })
  });
});
