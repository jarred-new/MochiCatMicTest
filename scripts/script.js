const levelHeader = document.getElementById("levelHeader");
const cat = document.getElementById("cat");
const calibrateButton = document.getElementById("calibrateButton");
const recordButton = document.getElementById("recordButton")

var maxLoud;
let maxLoudKey = localStorage.getItem("maxLoud");

if (maxLoudKey == null) {
  maxLoud = -24;
} else {
  maxLoud = maxLoudKey;
}

function calibrate() {
  let loudCalibrateVal = prompt("Enter dB to Calibrate (negative values only from -80 and above)", maxLoud);
  
  if (loudCalibrateVal != null) {
    maxLoud = loudCalibrateVal;
    localStorage.setItem("maxLoud", maxLoud);
  }
}

async function startLoudnessMeter() {
  try {
    // 1. Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    // 2. Setup Web Audio API pipeline
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    // Configure FFT size (lower numbers yield faster responses but less frequency granularity)
    analyser.fftSize = 256; 
    source.connect(analyser);
    
    // 3. Create a data buffer to hold time-domain samples
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    
    levelHeader.textContent = "Microphone connected! Monitoring volume...";

    function checkLoudness() {
      // Copy raw PCM data into our buffer
      analyser.getFloatTimeDomainData(dataArray);
      
      // Calculate Root Mean Square (RMS) amplitude
      let sumSquares = 0.0;
      for (let i = 0; i < bufferLength; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      
      const rms = Math.sqrt(sumSquares / bufferLength);
      
      // Convert normalized value (0.0 to 1.0) into logarithmic Decibels (dB)
      // Lower clamp avoids Math.log10(0) returning negative Infinity
      const db = rms > 0.0001 ? 20 * Math.log10(rms) : -80; 

      // 4. Output the results
      // rms scales linearly between 0 (silence) and roughly 0.707 (maximum sine wave loudness)
      dbFixed = db.toFixed(1);
      
      if (dbFixed < maxLoud) {
        cat.src = "img/loud.jpg";
      }
      else {
        cat.src = "img/normal1.jpg";
      }
      
      levelHeader.textContent = `Linear Level: ${rms.toFixed(4)} | Decibels: ${dbFixed} dB`;
      
      // Loop smoothly at the screen's frame rate
      requestAnimationFrame(checkLoudness);
    }
    
    checkLoudness();
    
  } catch (error) {
    levelHeader.textContent = "Microphone access denied or error occurred: " + error;
  }
}

let mediaRecorder;
let audioChunks = [];

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    // Collect data chunks as they become available
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    // Export and play/download the file when recording stops
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Example: Play the recorded audio in the browser
      const audio = new Audio(audioUrl);
      audio.play();
    };

    mediaRecorder.start();
    console.log("Recording started...");
  } catch (error) {
    console.error("Microphone access denied or error occurred:", error);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    // Stop all audio tracks to turn off the microphone hardware light
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    console.log("Recording stopped.");
  }
}

// The record button onClick event
function record() {
  let presses = 0;
  presses++;
  
  console.log(presses);
  
  if (presses == 1) {
    startRecording();
    recordButton.textContent = "Stop Recording";
  } 
  else if (presses == 2) {
    presses = 0;
    stopRecording();
    recordButton.textContent = "Record Mic";
  }
}

// Execute the meter
startLoudnessMeter();
