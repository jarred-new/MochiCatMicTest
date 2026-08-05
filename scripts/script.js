const levelHeader = document.getElementById("levelHeader");
const cat = document.getElementById("cat");
const calibrateButton = document.getElementById("calibrateButton");
const recordButton = document.getElementById("recordButton");

var maxLoud;
let maxLoudKey = localStorage.getItem("maxLoud");

var dbFixed;
var recordedAudioName = "recorded_audio";
var recordedAudioNamekey = localStorage.getItem("recordedAudioName");
//var dbCheck;

function calibrate() {
  let loudCalibrateVal = prompt(
    "Enter dB to Calibrate (negative values only from -80 and above)",
    maxLoud,
  );

  if (loudCalibrateVal != null) {
    maxLoud = loudCalibrateVal;
    localStorage.setItem("maxLoud", maxLoud);
  }
}

async function startLoudnessMeter() {
  try {
    // 1. Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

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
      dbFixed = Math.abs(db.toFixed(1));

      // 5. Update the cat image based on loudness
      if (dbFixed < maxLoud) {
        cat.src = "img/loud.jpg";
      } else {
        cat.src = "img/normal1.jpg";
      }

      levelHeader.textContent = `Linear Level: ${rms.toFixed(4)} | Decibels: ${dbFixed} dB`;

      // Loop smoothly at the screen's frame rate
      requestAnimationFrame(checkLoudness);
    }

    checkLoudness();
  } catch (error) {
    levelHeader.textContent =
      "Microphone access denied or error occurred: " + error;
  }
}

if (maxLoudKey == null) {
  maxLoud = 24;
  // dbCheck = dbFixed < maxLoud;
} else {
  maxLoud = maxLoudKey;
}

// Recording: capture raw PCM and encode to MP3 client-side using lamejs
let mediaStream;
let audioChunks = [];
let audioContextRecording = null;
let sourceNode = null;
let scriptNode = null;
let mp3Encoder = null;
let mp3Data = [];
let isRecording = false;

function loadLame() {
  return new Promise((resolve, reject) => {
    if (window.lamejs) return resolve(window.lamejs);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lamejs@1.2.0/lame.min.js';
    s.onload = () => resolve(window.lamejs);
    s.onerror = () => reject(new Error('Failed to load lamejs'));
    document.head.appendChild(s);
  });
}

function floatTo16BitPCM(float32Array) {
  const l = float32Array.length;
  const buf = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return buf;
}

async function startRecording() {
  try {
    await loadLame();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStream = stream;

    audioContextRecording = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioContextRecording.createMediaStreamSource(stream);

    const bufferSize = 4096;
    scriptNode = audioContextRecording.createScriptProcessor(bufferSize, 1, 1);

    // mono, sampleRate from context, 128kbps
    mp3Encoder = new lamejs.Mp3Encoder(1, audioContextRecording.sampleRate, 128);
    mp3Data = [];

    scriptNode.onaudioprocess = function (e) {
      if (!isRecording) return;
      const input = e.inputBuffer.getChannelData(0);
      const int16 = floatTo16BitPCM(input);
      const mp3buf = mp3Encoder.encodeBuffer(int16);
      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
      }
    };

    sourceNode.connect(scriptNode);
    scriptNode.connect(audioContextRecording.destination);

    isRecording = true;
    console.log('Recording started (encoding to MP3)...');
  } catch (error) {
    alert('Microphone access denied or error occurred: ' + error);
  }
}

function stopRecording() {
  if (!isRecording) return;

  isRecording = false;

  try {
    // finalize mp3
    const mp3buf = mp3Encoder.flush();
    if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));

    // concatenate
    let length = 0;
    for (let i = 0; i < mp3Data.length; i++) length += mp3Data[i].length;
    const merged = new Uint8Array(length);
    let offset = 0;
    for (let i = 0; i < mp3Data.length; i++) {
      merged.set(new Uint8Array(mp3Data[i].buffer), offset);
      offset += mp3Data[i].length;
    }

    const audioBlob = new Blob([merged], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    audioBlob.name = 'recorded_audio.mp3';
    const downloadLink = document.createElement('a');
    downloadLink.href = audioUrl;
    downloadLink.download = recordedAudioName + '.mp3';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    console.log('Recording stopped. MP3 ready.');
  } catch (err) {
    console.error('Error finalizing MP3:', err);
    alert('Error while encoding MP3: ' + err);
  } finally {
    // clean up audio nodes and stop tracks
    try {
      if (scriptNode) {
        scriptNode.disconnect();
        scriptNode.onaudioprocess = null;
      }
      if (sourceNode) sourceNode.disconnect();
      if (audioContextRecording) audioContextRecording.close();
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  }
}

// The record button onClick event
function record() {
  let pressed = recordButton.getAttribute('data-pressed') === 'true';

  if (!pressed) {
    startRecording();
    recordButton.textContent = 'Stop Recording';
    recordButton.setAttribute('data-pressed', 'true');
  } else {
    stopRecording();
    recordButton.textContent = 'Record Mic';
    recordButton.setAttribute('data-pressed', 'false');
  }
}

function changeRecordName() {
  const newName = prompt('Enter new name for the recorded file (without extension):', recordedAudioName);
  if (newName) {
    recordedAudioName = newName;
    localStorage.setItem('recordedAudioName', recordedAudioName);
    alert(`Recorded file name changed to: ${recordedAudioName}.mp3`);
  }
}

// Execute the meter
startLoudnessMeter();
