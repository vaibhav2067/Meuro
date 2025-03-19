import * as THREE from "three";
import { GLTFLoader } from "GLTFLoader";
import { OrbitControls } from "OrbitControls";
import {
  db,
  ref,
  set,
  onValue,
  onDisconnect,
  push,
  remove,
  get,
} from "./firebaseConfig.js";
import { CSS2DRenderer} from "CSS2DRenderer";
import { AxesHelper } from "three";

// Firebase Refs
const cameraRef = ref(db, "camera");
const modelRef = ref(db, "model");
const usersRef = ref(db, "users");
const messagesRef = ref(db, "messages");
const lightsRef = ref(db, "lights");

// Generate a unique ID for the user
const userId = push(usersRef).key;
const userRef = ref(db, `users/${userId}`);
const username = `User-${Math.floor(Math.random() * 1000)}`;

// Set user data in Firebase
set(userRef, { name: username, active: true });

// Remove user from Firebase when they leave
onDisconnect(userRef)
  .remove()
  .then(() => {
    get(usersRef).then((snapshot) => {
      if (!snapshot.exists()) {
        remove(modelRef); // Remove model when no users are active
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
      scale: model.scale.x, // Assuming uniform scaling
    });
  }
}

document.addEventListener("keydown", (event) => {
  if (!model) return;

  // Move model
  if (event.key === "ArrowUp") model.position.z -= 0.1;
  if (event.key === "ArrowDown") model.position.z += 0.1;
  if (event.key === "ArrowLeft") model.position.x -= 0.1;
  if (event.key === "ArrowRight") model.position.x += 0.1;

  // Rotate model
  if (event.key === "q") model.rotation.y -= 0.1;
  if (event.key === "e") model.rotation.y += 0.1;

  // Scale model
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

      // updateModelPosition();
    }
    // undefined,
    // (error) => {
    //   console.error("Error loading model:", error);
    // }
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

const gizmoX = document.querySelector(".x-axis");
const gizmoY = document.querySelector(".y-axis");
const gizmoZ = document.querySelector(".z-axis");

// Function to update axes based on camera rotation
function updateGizmo() {
  const rotation = camera.rotation;

  // Convert Three.js rotation to CSS
  const xRot = `rotateX(${rotation.x}rad)`;
  const yRot = `rotateY(${rotation.y}rad)`;
  const zRot = `rotateZ(${rotation.z}rad)`;

  gizmoX.style.transform = yRot;  // X-axis rotates with Y
  gizmoY.style.transform = xRot;  // Y-axis rotates with X
  gizmoZ.style.transform = zRot;  // Z-axis rotates with Z
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

        // Remove previous model before adding a new one
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

const presenceDiv = document.querySelector(".Presence");

onValue(usersRef, (snapshot) => {
  if (snapshot.exists()) {
    const users = snapshot.val();
    presenceDiv.innerHTML = ""; // Clear previous list
    Object.values(users).forEach((user) => {
      const userElement = document.createElement("p");
      userElement.textContent = user.name;
      presenceDiv.appendChild(userElement);
    });
  } else {
    presenceDiv.innerHTML = "<p>No active users</p>";
  }
});
function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const message = chatInput.value.trim();
  if (message === "") return;

  const newMessageRef = push(messagesRef);
  set(newMessageRef, {
    username: username, // Uses existing username variable
    text: message,
  });

  chatInput.value = ""; // Clear input field
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
  chatContainer.innerHTML = ""; // Clear existing messages

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

    // Auto-scroll to the latest message
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});
