import React, { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import levenshtein from "fast-levenshtein";

const TestingPatternMatching = () => {
  const [text, setText] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const intervalId = useRef(null);
  const isProcessing = useRef(false);
  const debouncedTimer = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(3);
  const [textdetected, setTextDetected] = useState([]);

  const targetPattern = /\d{3}-\d{3}-\d{3}/;
  const minConfidence = 90;

  useEffect(() => {
    checkCameraPermissionAndStart();
    return () => {
      clearInterval(intervalId.current);
      stopCamera();
    };
  }, []);

  // const checkCameraPermissionAndStart = async () => {
  //   try {
  //     const result = await navigator.permissions.query({ name: 'camera' });
  //     if (result.state === 'granted' || result.state === 'prompt') {
  //       startCamera();
  //     } else {
  //       alert('Camera permission is required. Please enable it in your browser settings.');
  //     }
  //   } catch (error) {
  //     console.error('Error checking camera permissions:', error);
  //   }
  // };

  const checkCameraPermissionAndStart = async () => {
    try {
      await startCamera();
    } catch (error) {
      alert(
        "Camera permission is required. Please enable it in your browser settings."
      );
      console.error("Error checking camera permissions:", error);
    }
  };

  const startCamera = async () => {
    try {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(
          (resolve) => (videoRef.current.onloadedmetadata = resolve)
        );

        const [track] = stream.getVideoTracks();
        const capabilities = track.getCapabilities();
        setMinZoom(capabilities.zoom?.min || 1);
        setMaxZoom(capabilities.zoom?.max || 3);
        setZoomLevel(capabilities.zoom?.min || 1);

        try {
          await videoRef.current.play();
        } catch (error) {
          console.warn("Autoplay blocked. User interaction required.");
        }

        intervalId.current = setInterval(() => processFrames(), 500);
      }
    } catch (error) {
      console.error("Error accessing the camera:", error);
    }
  };

  const stopCamera = () => {
    if (intervalId.current) clearInterval(intervalId.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null; // Set to null to fully release the stream
    }
  };

  const processFrames = () => {
    if (!videoRef.current || !canvasRef.current || isProcessing.current) return;
    isProcessing.current = true;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const video = videoRef.current;

    canvas.width = video.videoWidth / 2;
    canvas.height = video.videoHeight / 2;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    //pre-processing for increasing accuracy and text extraction
    // const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    // let data = imageData.data;
    // for (let i = 0; i < data.length; i += 4) {
    //   let grayscale = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    //   data[i] = data[i + 1] = data[i + 2] = grayscale > 150 ? 255 : 0; // Increase binarization threshold
    // }
    // context.putImageData(imageData, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      if (debouncedTimer.current) clearTimeout(debouncedTimer.current);
      debouncedTimer.current = setTimeout(() => {
        processOCR(blob);
        URL.revokeObjectURL(blob);
      }, 500);
    });
  };

  const processOCR = (blob) => {
    if (!blob) return;
    const dataURL = URL.createObjectURL(blob);

    Tesseract.recognize(dataURL, "eng")
      .then(({ data: { words } }) => {
        setTextDetected(words);
        const matchedWord = words.find(
          (word) =>
            targetPattern.test(word.text) && word.confidence > minConfidence
        );
        if (matchedWord) {
          setText(matchedWord.text);
          drawBoundingBoxes([matchedWord]);
          clearInterval(intervalId.current);
          stopCamera();
        } 
        else {
          const pattern = "123-456-789";
          const closestWord = words.reduce((closest, word) => {
            const distance = levenshtein.get(word.text, pattern);
            if (!closest || distance < closest.distance) {
              return { word, distance };
            }
            return closest;
          }, null);

          if (closestWord && closestWord.distance < 3) {
            setText(closestWord.word.text);
            console.log("Closest Match Found (via Levenshtein):", closestWord);
            drawBoundingBoxes([closestWord.word]);
            clearInterval(intervalId.current);
            stopCamera();
          } else {
            console.log("Pattern is not getting matched");
          }
        }
      })
      .catch((error) => console.error("Error processing OCR:", error))
      .finally(() => {
        URL.revokeObjectURL(dataURL);
        isProcessing.current = false;
      });
  };

  const drawBoundingBoxes = (words) => {
    const overlayCanvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlayCanvas || !video) return;

    overlayCanvas.width = video.videoWidth / 2;
    overlayCanvas.height = video.videoHeight / 2;
    const context = overlayCanvas.getContext("2d");
    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    context.strokeStyle = "red";
    context.lineWidth = 2;

    words.forEach((word) => {
      const { x0, y0, x1, y1 } = word.bbox;
      context.strokeRect(x0 / 2, y0 / 2, (x1 - x0) / 2, (y1 - y0) / 2);
    });
  };

  const handleZoomChange = (e) => {
    const newZoom = parseFloat(e.target.value);
    setZoomLevel(newZoom);
    const videoTrack = videoRef.current?.srcObject?.getVideoTracks()[0];
    videoTrack
      ?.applyConstraints({ advanced: [{ zoom: newZoom }] })
      .catch((error) => console.error("Zoom failed:", error));
  };

  return (
    <div>
      <h1>Pattern Matching OCR</h1>
      <video ref={videoRef} autoPlay playsInline></video>
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
      <canvas
        ref={overlayCanvasRef}
        style={{ position: "absolute", top: 0, left: 0 }}
      ></canvas>

      <div>
        <label>Zoom Level: </label>
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={(maxZoom - minZoom) / 10}
          value={zoomLevel}
          onChange={handleZoomChange}
        />
      </div>
      <p>Matched Text: {text}</p>

      <div>
        <p>Detected Texts:</p>
        {textdetected &&
          textdetected.map((val, ind) => (
            <p key={ind}>
              Text: {val?.text}, Confidence: {val?.confidence}
            </p>
          ))}
      </div>
    </div>
  );
};

export default TestingPatternMatching;