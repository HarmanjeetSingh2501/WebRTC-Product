
var AppProcess = (function () {
  var peers_connection_ids = [];
  var peers_connection = [];
  var serverProces;
  var my_connection_id;
  var remote_vid_stream = [];
  var remote_aud_stream = [];
  var audio;
  var isAudioMute = true;
  var rtp_aud_senders = [];
  var video_states = {
    None: 0,
    Camera: 1,
    ScreenShare: 2,
  };
  var video_st = video_states.None;
  var videoCamTrack;
  var rtp_vid_senders = [];

  async function _init(SDP_function, my_connid) {
    serverProces = SDP_function;
    my_connection_id = my_connid;
    eventProcess();
    local_div = document.getElementById("localVideoPlayer");
  }
  function eventProcess() {
    $("#micMuteUnmute").on("click", async function () {
      if (!audio) {
        await loadAudio();
      }
      if (!audio) {
        alert("Audio permission has not granted");
        return;
      }
      if (isAudioMute) {
        audio.enabled = true;
        $(this).html(
          "<span class='material-icons' style='width:100%'>mic</span>"
        );
        updateMediaSenders(audio, rtp_aud_senders);
      } else {
        audio.enabled = false;
        $(this).html(
          "<span class='material-icons' style='width:100%'>mic_off</span>"
        );
        removeMediaSenders(rtp_aud_senders);
      }
      isAudioMute = !isAudioMute;
    });
    $("#videoCamOnOff").on("click", async function () {
      if (video_st == video_states.Camera) {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.Camera);
      }
    });
    $("#buttonScreenShareOnOff").on("click", async function () {
      if (video_st == video_states.ScreenShare) {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.ScreenShare);
      }
    });
  }
  async function loadAudio() {
    try {
      var astream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      audio = astream.getAudioTracks()[0];
      audio.enabled = false;
    } catch (e) {
      console.log(e);
    }
  }
  function connection_status(connection) {
    if (
      connection &&
      (connection.connectionState == "new" ||
        connection.connectionState == "connecting" ||
        connection.connectionState == "connected")
    ) {
      return true;
    } else {
      return false;
    }
  }
  async function updateMediaSenders(track, rtp_senders) {
    for (var con_id in peers_connection_ids) {
      if (connection_status(peers_connection[con_id])) {
        if (rtp_senders[con_id] && rtp_senders[con_id].track) {
          rtp_senders[con_id].replaceTrack(track);
        } else {
          rtp_senders[con_id] = peers_connection[con_id].addTrack(track);
        }
      }
    }
  }
  function removeMediaSenders(rtp_senders) {
    for (var con_id in peers_connection_ids) {
      if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) {
        peers_connection[con_id].removeTrack(rtp_senders[con_id]);
        rtp_senders[con_id] = null;
      }
    }
  }
  function removeVideoStream(rtp_vid_senders) {
    if (videoCamTrack) {
      videoCamTrack.stop();
      videoCamTrack = null;
      local_div.srcObject = null;
      removeMediaSenders(rtp_vid_senders);
    }
  }
  async function videoProcess(newVideoState) {
    if (newVideoState == video_states.None) {
      $("#videoCamOnOff").html(
        " <span class='material-icons'  style='width:100%'>videocam_off</span>"
      );
      $("#buttonScreenShareOnOff").html(
        '<span class="material-icons">present_to_all</span> <div>Present Now</div>'
      );
      video_st = newVideoState;
      removeVideoStream(rtp_vid_senders);
      return;
    }
    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html(
        " <span class='material-icons'  style='width:100%'>videocam_off</span>"
      );
    }
    try {
      var vstream = null;
      if (newVideoState == video_states.Camera) {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
      } else if (newVideoState == video_states.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
        vstream.oninactive = (e) => {
          removeVideoStream(rtp_vid_senders);
          $("#buttonScreenShareOnOff").html(
            '<span class="material-icons">present_to_all</span> <div>Present Now</div>'
          );
        };
      }
      if (vstream && vstream.getVideoTracks().length > 0) {
        videoCamTrack = vstream.getVideoTracks()[0];
        if (videoCamTrack) {
          local_div.srcObject = new MediaStream([videoCamTrack]);
          updateMediaSenders(videoCamTrack, rtp_vid_senders);
        }
      }
    } catch (e) {
      console.log(e);
      return;
    }
    video_st = newVideoState;
    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html(
        '<span class="material-icons" style="width:100%;">videocam</span>'
      );
      $("#buttonScreenShareOnOff").html(
        '<span class="material-icons">present_to_all</span> <div>Present Now</div>'
      );
    } else if (newVideoState == video_states.ScreenShare) {
      $("#videoCamOnOff").html(
        '<span class="material-icons" style="width:100%;">videocam_off</span>'
      );
      $("#buttonScreenShareOnOff").html(
        '<span class="material-icons text-success">present_to_all</span> <div class="text-success">Stop Present Now</div>'
      );
    }
  }
  var iceConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: "stun:stun1.l.google.com:19302",
      },
    ],
  };
  async function setConnection(connid) {
    var connection = new RTCPeerConnection(iceConfiguration);

    connection.onnegotiationneeded = async function (event) {
      await setOffer(connid);
    };
    connection.onicecandidate = function (event) {
      if (event.candidate) {
        serverProces(JSON.stringify({ icecandidate: event.candidate }), connid);
      }
    };
    connection.ontrack = function (event) {
      var remoteVideoPlayer = document.getElementById("v_" + connid);
      var remoteAudioPlayer = document.getElementById("a_" + connid);

      if (event.track.kind == "video") {
        if (!remoteVideoPlayer.srcObject) {
          remoteVideoPlayer.srcObject = new MediaStream();
          remoteVideoPlayer.srcObject.addTrack(event.track);
        } else {
          remoteVideoPlayer.srcObject.addTrack(event.track);
        }
        remoteVideoPlayer.play();
      } else if (event.track.kind == "audio") {
        if (!remoteAudioPlayer.srcObject) {
          remoteAudioPlayer.srcObject = new MediaStream();
          remoteAudioPlayer.srcObject.addTrack(event.track);
        } else {
          remoteAudioPlayer.srcObject.addTrack(event.track);
        }
        remoteAudioPlayer.play();
      }
    };
    peers_connection_ids[connid] = connid;
    peers_connection[connid] = connection;

    if (
      video_st == video_states.Camera ||
      video_st == video_states.ScreenShare
    ) {
      if (videoCamTrack) {
        updateMediaSenders(videoCamTrack, rtp_vid_senders);
      }
    }
    return connection;
  }

  async function setOffer(connid) {
    var connection = peers_connection[connid];
    var offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    serverProces(
      JSON.stringify({
        offer: connection.localDescription,
      }),
      connid
    );
  }
  async function SDPProcess(message, from_connid) {
    message = JSON.parse(message);
    if (message.offer) {
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer)
      );
      var answer = await peers_connection[from_connid].createAnswer();
      await peers_connection[from_connid].setLocalDescription(answer);
      serverProces(
        JSON.stringify({
          answer: answer,
        }),
        from_connid
      );
    } else if (message.answer) {
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.answer)
      );
    } else if (message.icecandidate) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid);
      }
      try {
        await peers_connection[from_connid].addIceCandidate(
          message.icecandidate
        );
      } catch (e) {
        console.log(e);
      }
    }
  }
  async function closeConnection(connid) {
    peers_connection_ids[connid] = null;
    if (peers_connection[connid]) {
      peers_connection[connid].close();
      peers_connection[connid] = null;
    }
    if (remote_aud_stream[connid]) {
      remote_aud_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_aud_stream[connid] = null;
    }
    if (remote_vid_stream[connid]) {
      remote_vid_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_vid_stream[connid] = null;
    }
  }
  return {
    setNewConnection: async function (connid) {
      await setConnection(connid);
    },
    init: async function (SDP_function, my_connid) {
      await _init(SDP_function, my_connid);
    },
    processClientFunc: async function (data, from_connid) {
      await SDPProcess(data, from_connid);
    },
    closeConnectionCall: async function (connid) {
      await closeConnection(connid);
    },
  };
})();

var MyApp = (function () {
    var socket = null;
    var user_id = "";
    var meeting_id = "";
    
    function init(uid, mid) {
      // Your initialization code here
      user_id = uid;
      meeting_id = mid;
      $("#meetingContainer").show();
      $("#me h2").text(user_id + "(Me)");
      document.title = user_id;
      event_process_for_signaling_server();
      eventHandeling();
    }
  
    function event_process_for_signaling_server() {
      socket = io.connect();
      var SDP_function = function (data, to_connid) {
        socket.emit("SDPProcess", {
          message: data,
          to_connid: to_connid,
        });
      };
      socket.on("connect", async () => {
        if (socket.connected) {
          await AppProcess.init(SDP_function, socket.id);
          if (user_id != "" && meeting_id != "") {
            socket.emit("userconnect", {
              displayName: user_id,
              meetingid: meeting_id,
            });
          }
        }
      });
      socket.on("inform_other_about_disconnected_user", function (data) {
        $("#" + data.connId).remove();
        $(".participants-counts").text(data.uNumber);
        $("#particiapant_"+data.connId+"").remove();
        AppProcess.closeConnectionCall(data.connId);
      });
      socket.on("inform_others_about_me", function (data) {
        addUser(data.other_user_id, data.connId, data.userNumber);
        AppProcess.setNewConnection(data.connId);
      });
      socket.on("showFileMessage", function(data){
        var time= new Date();
        var lTime= time.toLocaleString("en-US",{
            hour: "numeric",
            minute: "numeric",
            hour12: true
        })
        var attachFileAreaOther= document.querySelector(".show-attach-file");
        // attachFileAreaOther.innerHTML += "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/person.jpg' style='height:40px; width:40px' class='caller-image circle'><div style='font-weight:600; margin:0 5px;'>" + data.username + "</div>:<div><a style='color:#007bff;' href='" + data.filePath + "' download>" + data.fileName + "</a></div></div><br/>"
        if (attachFileAreaOther) {
            attachFileAreaOther.innerHTML += "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/person.jpg' style='height:40px; width:40px' class='caller-image circle'><div style='font-weight:600; margin:0 5px;'>" + data.username + "</div>:<div><a style='color:#007bff;' href='" + data.filePath + "' download>" + data.fileName + "</a></div></div><br/>";
        }
        

      })
      socket.on("inform_me_about_other_user", function (other_users) {
        var userNumber = other_users.length;
        var userNumb = userNumber + 1;
        if (other_users) {
          for (var i = 0; i < other_users.length; i++) {
            addUser(
              other_users[i].user_id,
              other_users[i].connectionId,
              userNumb
            );
            AppProcess.setNewConnection(other_users[i].connectionId);
          }
        }
      });
      socket.on("SDPProcess", async function (data) {
        await AppProcess.processClientFunc(data.message, data.from_connid);
      });
      socket.on("showChatMessage", function (data) {
        var time = new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });
        var messageHTML = `
              <div>
                  <span class="font-weight-bold mr-3" style="color: black">${data.from}</span>
                  <span class="message-time">${time}</span>
                  <br>
                  ${data.message}
              </div>
          `;
        $("#messages").append(messageHTML);
      });
    }
  
    function eventHandeling() {
      $("#btnsend").on("click", function () {
        var msgData = $("#msgbox").val();
        if (msgData.trim() !== "") {
          socket.emit("sendMessage", msgData);
          $("#msgbox").val(""); // Clear input field after sending message
        }
      });
      var url= window.location.href;
      $(".meeting_url").text(url);

      $("#divUsers").on("dblclick", "video", function(){
        if (this.requestFullscreen) {
            this.requestFullscreen();
        } else if (this.webkitRequestFullscreen) { /* Safari */
            this.webkitRequestFullscreen();
        } else if (this.msRequestFullscreen) { /* IE11 */
            this.msRequestFullscreen();
        }
    });
    }
  
    function addUser(other_user_id, connId, userNum) {
      var newDivId = $("#otherTemplate").clone();
      newDivId = newDivId.attr("id", connId).addClass("other");
      newDivId.find("h2").text(other_user_id);
      newDivId.find("video").attr("id", "v_" + connId);
      newDivId.find("audio").attr("id", "a_" + connId);
      newDivId.find(".participant-name").text(other_user_id);
      newDivId.show();
      $("#divUsers").append(newDivId);
      $(".in-call-wrap-up").append(
        ' <div class="in-call-wrap d-flex justify-content-between align-items-center mb-3" id="particiapant_' +
          connId +
          '"> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="public/Assets/images/person.jpg" alt="" class="border border-secondary" style="height: 40px; width: 40px; border-radius: 50%;"> </div> <div class="participant-name ml-2">'+other_user_id+'</div> </div> <div class="participant-action-wrap display-center"> <div class="participant-action-dot display-center mr-2 cursor-pointer"> <span class="material-icons">more_vert</span> </div> <div class="participant-action-pin display-center mr-2 cursor-pointer"> <span class="material-icons">push_pin</span> </div> </div> </div>'
      );
      $(".participants-counts").text(userNum);
    }
  
    $(document).on("click", ".people-heading", function () {
      $(".in-call-wrap-up").show(300);
      $(".chat-show-wrap").hide(300);
      $(this).addClass("active");
      $(".chat-heading").removeClass("active");
    });
    $(document).on("click", ".chat-heading", function () {
      $(".in-call-wrap-up").hide(300);
      $(".chat-show-wrap").show(300);
      $(this).addClass("active");
      
    });
    $(document).on("click", ".meeting-heading-cross", function () {
      $(".g-right-details-wrap").hide(300);
    });
    $(document).on("click", ".top-left-participant-wrap", function () {
        $(".people-heading").addClass("active");
        $(".chat-heading").removeClass("active");
      $(".g-right-details-wrap").show(300);
      $(".in-call-wrap-up").show(300);
      $(".chat-show-wrap").hide(300);
    });
    $(document).on("click", ".top-left-chat-wrap", function () {
        $(".people-heading").removeClass("active");
        $(".chat-heading").addClass("active");
      $(".g-right-details-wrap").show(300);
      $(".in-call-wrap-up").hide(300);
      $(".chat-show-wrap").show(300);
    });
    $(document).on("click", ".end-call-wrap", function () {
      $(".top-box-show").css({
        "display":"block",
      }).html(' <div class="top-box align-vertical-middle profile-dialogue-show"> <h4 class="mt-2" style="text-align:center; color:white;">Leave Meeting</h4> <hr> <div class="call-leave-cancel-action d-flex justify-content-center align-items-center w-100"> <a href="/action.html"><button class="call-leave-action btn btn-danger mr-5 ">Leave</button></a> <button class="call-cancel-action btn btn-secondary">Cancel</button> </div> </div>');
    });
    $(document).mouseup(function(e){
      var container= new Array();
      container.push($(".top-box-show"));
      $.each(container, function(key, value){
        if(!$(value).is(e.target) && $(value).has(e.target).length==0){
          $(value).empty();
        }
      });
    });
    $(document).mouseup(function(e){
        var container= new Array();
        container.push($(".g-deatils"));
        container.push($(".g-right-details-wrap"))
        $.each(container, function(key, value){
          if(!$(value).is(e.target) && $(value).has(e.target).length==0){
            $(value).hide(300);
          }
        });
      });
    $(document).on("click", ".call-cancel-action", function(){
      $('.top-box-show').html("");
    });
    $(document).on("click", ".copy_info", function(){
        var $temp = $("<input>");
        $("body").append($temp);
        $temp.val($(".meeting_url").text()).select();
        document.execCommand("copy");
        $temp.remove();
        $(".link-conf").show();
        setTimeout(function(){
            $(".link-conf").hide();
        },3000);
    })
    $(document).ready(function() {
        // Hide the details and attachment initially
        $('.g-deatils').hide();
    
        // Toggle visibility when clicking on "Meeting Details"
        $('.meetings-details-buttons').click(function() {
            $('.g-deatils').toggle();
            // Toggle arrow icon based on visibility
            if ($('.g-deatils').is(':visible')) {
                $('.meetings-details-buttons span').text('keyboard_arrow_up');
            } else {
                $('.meetings-details-buttons span').text('keyboard_arrow_down');
            }
        });
    });
    $(document).on("click", ".g-deatils-heading-attachment", function(){
        $(".g-deatils-heading-show").hide();
        $(".g-deatils-heading-show-attachment").show();
        $(this).addClass('active');
        $(".g-deatils-heading-deatils").removeClass('active');
    });
    $(document).on("click", ".g-deatils-heading-deatils", function(){
        $(".g-deatils-heading-show").show();
        $(".g-deatils-heading-show-attachment").hide();
        $(this).addClass('active');
        $(".g-deatils-heading-attachment").removeClass('active');
    });
    var base_url= window.location.origin;
    $(document).on("change", ".custom-file-input", function(){
        var fileName= $(this).val().split("\\").pop();
        $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
    })
    
    // $(document).on("click", ".share-attach", function(e){
    //     e.preventDefault();
    //     var file = $("#customFile").prop('files')[0]; // Get the selected file
    //     var formData = new FormData();
    //     formData.append("zipfile", file); // Append the file to the FormData object
    //     formData.append("meeting_id", meeting_id);
    //     formData.append("username", user_id);
    //     console.log(formData);
    //     $.ajax({
    //         url: base_url+"/attachimg",
    //         type: "POST",
    //         data: formData,
    //         contentType: false,
    //         processData: false,
    //         success: function(response){
    //             console.log(response);
    //         },
    //         error: function(){
    //             console.log('error');
    //         }
    //     });
    //     var attachFileArea = document.querySelector(".show-attach-file");
    //     var attachFileName = $("#customFile").val().split("\\").pop();
    //     var attachFilePath = "public/attachment/" + meeting_id + "/" + attachFileName;
    //     // attachFileArea.innerHTML += "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/person.jpg' style='height:40px; width:40px' class='caller-image circle'><div style='font-weight:600; margin:0 5px;'>" + user_id + "</div>:<div><a style='color:#007bff;' href='" + attachFilePath + "' download>" + attachFileName + "</a></div></div><br/>";        
    //     if (attachFileArea) {
    //         attachFileArea.innerHTML += "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/person.jpg' style='height:40px; width:40px' class='caller-image circle'><div style='font-weight:600; margin:0 5px;'>" + data.username + "</div>:<div><a style='color:#007bff;' href='" + data.filePath + "' download>" + data.fileName + "</a></div></div><br/>";
    //     }
        
    //     $("label.custom-file-label").text("");
    //     socket.emit("fileTransferToOther",{
    //         username: user_id,
    //         meetingid: meeting_id,
    //         filePath: attachFilePath,
    //         fileName: attachFileName
    //     })
    // })
    $(document).on("click", ".share-attach", function(e){
        e.preventDefault();
        var file = $("#customFile").prop('files')[0]; // Get the selected file
        var formData = new FormData();
        formData.append("zipfile", file); // Append the file to the FormData object
        formData.append("meeting_id", meeting_id);
        formData.append("username", user_id);
        console.log(formData);
        $.ajax({
            url: base_url+"/attachimg",
            type: "POST",
            data: formData,
            contentType: false,
            processData: false,
            success: function(response){
                console.log(response); // Log the response from the server if needed
            },
            error: function(){
                console.log('error');
            }
        });
        var attachFileArea = document.querySelector(".show-attach-file");
        var attachFileName = $("#customFile").val().split("\\").pop();
        var attachFilePath = "public/attachment/" + meeting_id + "/" + attachFileName;
        if (attachFileArea) {
            attachFileArea.innerHTML += "<div class='left-align' style='display:flex; align-items:center;'><img src='public/assets/images/person.jpg' style='height:40px; width:40px' class='caller-image circle'><div style='font-weight:600; margin:0 5px;'>" + user_id + "</div>:<div><a style='color:#007bff;' href='" + attachFilePath + "' download>" + attachFileName + "</a></div></div><br/>";
        }
        
        $("label.custom-file-label").text("");
        socket.emit("fileTransferToOther",{
            username: user_id,
            meetingid: meeting_id,
            filePath: attachFilePath,
            fileName: attachFileName
        });
    });
    
   
    return {
      _init: function (uid, mid) {
        init(uid, mid);
      },
    };
  })(); // <-- Add () here to invoke the function expression
  