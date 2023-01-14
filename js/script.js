'use strict'

const APP_ID = "3fb449109bc84a39bdb6d171635e2e92";

const token = null;
const uid = String(new Date().getTime());

let client, channel;
let localStream, remoteStream, peerConnection;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get("room");

if (!roomId) {
  window.location = "lobby.html";
}

const servers = () => {
  iceSever: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ];
};

const constraint = {
  video:{
    width:{min:600, ideal:1920, max:1920},
    width:{min:480, ideal:1080, max:1080}
  },
  audio:true
}
const init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", handleUserJoined);
  channel.on("MemberLeft", handleMemberLeft);
  client.on("MessageFromPeer", handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia(constraint);
  document.getElementById("user-1").srcObject = localStream;
};

const handleMemberLeft = async (memberId) => {
  document.getElementById("user-2").style.display = "none";
  
  document.getElementById("user-1").classList.remove('small-frame')
};
const handleMessageFromPeer = async (message, memberId) => {
  message = JSON.parse(message.text);
  if (message.type === "offer") {
    createAnswer(memberId, message.offer);
  }
  if (message.type === "answer") {
    addAnswer(message.answer);
  }
  if (message.type === "candidate") {
    if (peerConnection) {
      await peerConnection.addIceCandidate(message.candidate);
    }
  }
};
const handleUserJoined = async (memberId) => {
  console.log("A new user has joined the channel: ", memberId);
  createOffer(memberId);
};

const createPeerConnection = async (memberId) => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";

  document.getElementById("user-1").classList.add('small-frame')

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    document.getElementById("user-1").srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (e) => {
    e.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (e) => {
    if (e.candidate) {
      client.sendMessageToPeer(
        { text: JSON.stringify({ type: "candidate", candidate: e.candidate }) },
        memberId
      );
    }
  };
};

const createOffer = async (memberId) => {
  await createPeerConnection(memberId);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", offer: offer }) },
    memberId
  );
};

const createAnswer = async (memberId, offer) => {
  await createPeerConnection(memberId);

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer: answer }) },
    memberId
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

const leaveChannel = async (memberId) => {
  await channel.leave();
  await client.logout();
};

const toggleCamera = async () => {
  const videoTrack = localStream.getTracks().find((track) => track.kind === "video");

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.querySelector("#camera-button span").innerText = "videocam_off";
  } else {
    videoTrack.enabled = true;
    document.querySelector("#camera-button span").innerText = "videocam";
  }
};

const toggleMic = async () => {
  const audioTrack = localStream.getTracks().find((track) => track.kind === "audio");

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.querySelector("#mic-button span").innerText = "mic_off";
  } else {
    audioTrack.enabled = true;
    document.querySelector("#mic-button span").innerText = "mic";
  }
};



window.addEventListener("beforeunload", leaveChannel);
document.querySelector("#camera-button").addEventListener("click", toggleCamera);
document.querySelector("#mic-button").addEventListener("click", toggleMic);


init();
