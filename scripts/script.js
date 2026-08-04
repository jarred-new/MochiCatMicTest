const levelHeader = document.getElementById("levelHeader");
const cat = document.getElementById("cat");

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
      
      if (dbFixed > -24) {
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

// Execute the meter
startLoudnessMeter();
