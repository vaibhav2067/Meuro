const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");

if (!roomId) {
  alert("No room ID found! Redirecting...");
  window.location.href = "vr.html";
}

import * as THREE from "three";
import { GLTFLoader } from "GLTFLoader";
import { OrbitControls } from "OrbitControls";
import { db, ref, set, onValue, onDisconnect, push, remove, get} from "./firebaseConfig.js";
import { CSS2DRenderer} from "CSS2DRenderer";
import { AxesHelper } from "three";


// Firebase Refs
const cameraRef = ref(db, `rooms/${roomId}/camera`);
const modelRef = ref(db, `rooms/${roomId}/model`);
const usersRef = ref(db, `rooms/${roomId}/users`);
const messagesRef = ref(db, `rooms/${roomId}/messages`);
const lightsRef = ref(db, `rooms/${roomId}/lights`);

// Generate a unique ID for the user
const userId = push(usersRef).key;
const userRef = ref(db, `rooms/${roomId}/users/${userId}`);
const username = `User-${Math.floor(Math.random() * 1000)}`;
// Set user data in Firebase
set(userRef, { name: username, active: true });
// Remove user from Firebase when they leave
onDisconnect(userRef)
  .remove()
  .then(() => {
    get(usersRef).then((snapshot) => {
      if (!snapshot.exists()) {
        remove(modelRef);
      }
    });
  });
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const dropZone = document.getElementById("dropZone");
// Renderer Setup
let renderer = new THREE.WebGLRenderer({ antialias: true });
dropZone.appendChild(renderer.domElement);
function updateRendererSize() {
  const width = dropZone.clientWidth;
  const height = dropZone.clientHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", updateRendererSize);
updateRendererSize();
// Camera and Controls
camera.position.set(0, 2, 5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.addEventListener("change", updateCameraPosition);
function updateCameraPosition() {
  set(cameraRef, {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  });
}
onValue(cameraRef, (snapshot) => {
  if (snapshot.exists()) {
    const pos = snapshot.val();
    camera.position.set(pos.x, pos.y, pos.z);
  }
});
// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);
const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.copy(camera.position);
scene.add(keyLight);
// Function to Update Light in Firebase
function updateLightSettings() {
  set(lightsRef, {
    ambientIntensity: ambientLight.intensity,
    directionalIntensity: directionalLight.intensity,
    directionalPosition: {
      x: directionalLight.position.x,
      y: directionalLight.position.y,
      z: directionalLight.position.z,
    },
    keyLightOn: keyLight.visible,
  });
}
// Sync Key Light with Camera
function updateKeyLightPosition() {
  keyLight.position.copy(camera.position);
  keyLight.target.position.copy(controls.target);
  keyLight.target.updateMatrixWorld();
}
controls.addEventListener("change", updateKeyLightPosition);
// Listen for Light Changes from Firebase
onValue(lightsRef, (snapshot) => {
  if (snapshot.exists()) {
    const data = snapshot.val();
    ambientLight.intensity = data.ambientIntensity;
    directionalLight.intensity = data.directionalIntensity;
    directionalLight.position.set(
      data.directionalPosition.x,
      data.directionalPosition.y,
      data.directionalPosition.z
    );
    keyLight.visible = data.keyLightOn;
  }
});
// Event Listeners to Adjust Lights
document.getElementById("dirX").addEventListener("input", (e) => {
  directionalLight.position.x = parseFloat(e.target.value);
  updateLightSettings();
});
document.getElementById("dirY").addEventListener("input", (e) => {
  directionalLight.position.y = parseFloat(e.target.value);
  updateLightSettings();
});
document.getElementById("dirZ").addEventListener("input", (e) => {
  directionalLight.position.z = parseFloat(e.target.value);
  updateLightSettings();
});
document.getElementById("toggleKeyLight").addEventListener("click", () => {
  keyLight.visible = !keyLight.visible;
  updateLightSettings();
});

// Global Model Variable
let model = null;
function updateModelPosition() {
  if (model) {
    set(modelRef, {
      x: model.position.x,
      y: model.position.y,
      z: model.position.z,
      rotX: model.rotation.x,
      rotY: model.rotation.y,
      rotZ: model.rotation.z,
      scale: model.scale.x,
    });
  }
}
document.addEventListener("keydown", (event) => {
  if (!model) return;
  if (event.key === "ArrowUp") model.position.z -= 0.1;
  if (event.key === "ArrowDown") model.position.z += 0.1;
  if (event.key === "ArrowLeft") model.position.x -= 0.1;
  if (event.key === "ArrowRight") model.position.x += 0.1;
  if (event.key === "q") model.rotation.y -= 0.1;
  if (event.key === "e") model.rotation.y += 0.1;
  if (event.key === "+")
    model.scale.set(
      model.scale.x + 0.1,
      model.scale.y + 0.1,
      model.scale.z + 0.1
    );
  if (event.key === "-")
    model.scale.set(
      model.scale.x - 0.1,
      model.scale.y - 0.1,
      model.scale.z - 0.1
    );

  updateModelPosition();
});
function loadModel(url) {
  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      if (model) scene.remove(model);
      model = gltf.scene;
      model.scale.set(1, 1, 1);
      model.position.set(0, 0, 0);
      scene.add(model);
    }
  );
}
onValue(modelRef, (snapshot) => {
  if (snapshot.exists()) {
    const data = snapshot.val();
    if (data.modelUrl) {
      console.log("Loading model from Firebase:", data.modelUrl);
      loadModel(data.modelUrl);
    }
  }
});
// Gizmo Scene
const gizmoScene = new THREE.Scene();
const gizmoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
gizmoCamera.position.set(0, 0, 5);
const gizmoRenderer = new THREE.WebGLRenderer({ alpha: true });
gizmoRenderer.setSize(100, 100);
document.getElementById("gizmoContainer").appendChild(gizmoRenderer.domElement);
function createGizmoAxis(color, dir) {
  const material = new THREE.LineBasicMaterial({ color });
  const points = [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(0.5)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  const coneGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
  const coneMaterial = new THREE.MeshBasicMaterial({ color });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.copy(dir.clone().multiplyScalar(0.5));
  cone.lookAt(new THREE.Vector3(0, 0, 0));
  const axisGroup = new THREE.Group();
  axisGroup.add(line);
  axisGroup.add(cone);
  gizmoScene.add(axisGroup);
  return axisGroup;
}
const xAxis = createGizmoAxis(0xff0000, new THREE.Vector3(1, 0, 0));
const yAxis = createGizmoAxis(0x00ff00, new THREE.Vector3(0, 1, 0));
const zAxis = createGizmoAxis(0x0000ff, new THREE.Vector3(0, 0, 1));
function updateGizmo() {
  gizmoCamera.position.copy(camera.position);
  gizmoCamera.quaternion.copy(camera.quaternion);
  gizmoRenderer.render(gizmoScene, gizmoCamera);
}
// Animation Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateGizmo();
  renderer.render(scene, camera);
}
animate();
// Drag & Drop Logic
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("highlight");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("highlight");
  });
});
dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("highlight");
  const file = event.dataTransfer.files[0];
  if (!file) return;
  document.getElementById("dropText").style.display = "none";
  console.log("File dropped:", file.name);
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = function (e) {
    console.log("File loaded into memory.");
    const arrayBuffer = e.target.result;
    const loader = new GLTFLoader();
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);
    console.log("Blob URL created:", url);
    set(modelRef, { modelUrl: url });
    loadModel(url);
    loader.load(
      url,
      (gltf) => {
        console.log("Model loaded:", gltf.scene);
        if (model) scene.remove(model);
        model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        scene.add(model);
        updateModelPosition();
      },
      undefined,
      (error) => {
        console.error("Error loading model:", error);
      }
    );
  };
});
// Move Model with Arrow Keys
document.addEventListener("keydown", (event) => {
  if (!model) return;
  if (event.key === "ArrowUp") model.position.z -= 0.1;
  if (event.key === "ArrowDown") model.position.z += 0.1;
  if (event.key === "ArrowLeft") model.position.x -= 0.1;
  if (event.key === "ArrowRight") model.position.x += 0.1;
  updateModelPosition();
});
//active users
const presenceDiv = document.querySelector(".Presence");
onValue(usersRef, (snapshot) => {
  if (snapshot.exists()) {
    const users = snapshot.val();
    presenceDiv.innerHTML = "";
    Object.values(users).forEach((user) => {
      const userElement = document.createElement("p");
      userElement.textContent = user.name;
      presenceDiv.appendChild(userElement);
    });
  } else {
    presenceDiv.innerHTML = "<p>No active users</p>";
  }
});
//message area
function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const message = chatInput.value.trim();
  if (message === "") return;
  const newMessageRef = push(messagesRef);
  set(newMessageRef, {
    username: username,
    text: message,
  });
  chatInput.value = "";
}
const sendMessageBtn = document.getElementById("sendMessageBtn");
if (sendMessageBtn) {
  sendMessageBtn.addEventListener("click", sendMessage);
} else {
  console.error("Send button not found!");
}
remove(messagesRef)
  .then(() => {
    console.log("Previous chat messages cleared.");
  })
  .catch((error) => {
    console.error("Error clearing chat messages:", error);
  });
onValue(messagesRef, (snapshot) => {
  const chatContainer = document.getElementById("chatContainer");
  chatContainer.innerHTML = "";
  if (snapshot.exists()) {
    const messages = snapshot.val();
    Object.values(messages).forEach((msg) => {
      const msgElement = document.createElement("div");
      msgElement.classList.add("message");
      msgElement.innerHTML = `
              <div class="msg-content">
                <strong>${msg.username}:</strong> ${msg.text}
              </div>
            `;
      chatContainer.appendChild(msgElement);
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let mediaRecorder;
let audioChunks = [];
let recording = false; // Prevent duplicate event triggers
const voiceIndicator = document.getElementById("voiceIndicator");

// Reference for storing voice messages
const audioRef = ref(db, "voiceMessages");

// Function to start recording
async function startRecording() {
  if (recording) return; // Prevent duplicate calls
  recording = true;

  try {
    await remove(audioRef);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    voiceIndicator.style.display = "block";

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      voiceIndicator.style.display = "none";
      recording = false; // Reset the flag

      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();

      reader.onloadend = function () {
        const base64Audio = reader.result.split(",")[1];
        const newAudioRef = push(audioRef);
        set(newAudioRef, { username, audio: base64Audio });
      };

      reader.readAsDataURL(audioBlob);
      audioChunks = [];
    };
  } catch (error) {
    console.error("Error accessing microphone:", error);
    recording = false; // Reset the flag if an error occurs
  }
}

// Function to stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    recording = false;
  }
}

// Add event listeners for Push-to-Talk (Spacebar)
document.addEventListener("keydown", (event) => {
  if (event.key === " " && !recording && document.activeElement !== document.getElementById("chatInput")) {
    event.preventDefault(); // Prevent scrolling
    startRecording();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === " " && recording) {
    event.preventDefault(); // Prevent scrolling
    stopRecording();
  }
});


// Function to play received voice messages
onValue(audioRef, (snapshot) => {
  if (snapshot.exists()) {
    const messages = snapshot.val();
    Object.values(messages).forEach((msg) => {
      const audio = new Audio(`data:audio/webm;base64,${msg.audio}`);
      audio.play();
    });
  }
});
