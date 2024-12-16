// import React, { useEffect, useRef, useState } from "react";
// import Tesseract from "tesseract.js";

// const BoundingPattern = () => {
//   const [text, setText] = useState("");
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const overlayCanvasRef = useRef(null);
//   const intervalId = useRef(null);
//   const isProcessing = useRef(false);
//   const debouncedTimer = useRef(null);
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const [minZoom, setMinZoom] = useState(1);
//   const [maxZoom, setMaxZoom] = useState(3);
//   const [textDetected, setTextDetected] = useState([]);

//   const targetPattern = /\d{3}-\d{3}-\d{3}/;
//   const minConfidence = 80;

//   useEffect(() => {
//     checkCameraPermissionAndStart();
//     return () => {
//       clearInterval(intervalId.current);
//       stopCamera();
//     };
//   }, []);

//   const checkCameraPermissionAndStart = async () => {
//     try {
//       await startCamera();
//     } catch (error) {
//       alert(
//         "Camera permission is required. Please enable it in your browser settings."
//       );
//       console.error("Error checking camera permissions:", error);
//     }
//   };

//   const startCamera = async () => {
//     try {
//       if (videoRef.current?.srcObject) {
//         const tracks = videoRef.current.srcObject.getTracks();
//         tracks.forEach((track) => track.stop());
//       }

//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: "environment" },
//       });
//       if (videoRef.current) {
//         videoRef.current.srcObject = stream;
//         await new Promise(
//           (resolve) => (videoRef.current.onloadedmetadata = resolve)
//         );

//         const [track] = stream.getVideoTracks();
//         const capabilities = track.getCapabilities();
//         setMinZoom(capabilities.zoom?.min || 1);
//         setMaxZoom(capabilities.zoom?.max || 3);
//         setZoomLevel(capabilities.zoom?.min || 1);

//         try {
//           await videoRef.current.play();
//         } catch (error) {
//           console.warn("Autoplay blocked. User interaction required.");
//         }

//         intervalId.current = setInterval(() => processFrames(), 250);
//       }
//     } catch (error) {
//       console.error("Error accessing the camera:", error);
//     }
//   };

//   const stopCamera = () => {
//     if (intervalId.current) clearInterval(intervalId.current);
//     if (videoRef.current?.srcObject) {
//       videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
//       videoRef.current.srcObject = null;
//     }
//   };

//   const processFrames = () => {
//     if (!videoRef.current || !canvasRef.current || isProcessing.current) return;
//     isProcessing.current = true;

//     const canvas = canvasRef.current;
//     const context = canvas.getContext("2d");
//     const video = videoRef.current;

//     // Set canvas dimensions equal to video dimensions
//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;

//     // Draw the video frame onto the canvas
//     context.drawImage(video, 0, 0, canvas.width, canvas.height);

//     // Center rectangle dimensions
//     const rectWidth = 200; // Fixed width
//     const rectHeight = 50; // Fixed height
//     const x = (canvas.width - rectWidth) / 2; // Center X position
//     const y = (canvas.height - rectHeight) / 2; // Center Y position

//     // Extract image data only from within the rectangle
//     const imageData = context.getImageData(x, y, rectWidth, rectHeight);

//     // Create a temporary canvas to crop the specific area
//     const tempCanvas = document.createElement("canvas");
//     const tempContext = tempCanvas.getContext("2d");

//     tempCanvas.width = rectWidth;
//     tempCanvas.height = rectHeight;
//     tempContext.putImageData(imageData, 0, 0);

//     tempCanvas.toBlob((blob) => {
//       if (!blob) return;
//       if (debouncedTimer.current) clearTimeout(debouncedTimer.current);
//       debouncedTimer.current = setTimeout(() => {
//         processOCR(blob);
//         URL.revokeObjectURL(blob);
//       }, 250);
//     });
//   };

//   const processOCR = (blob) => {
//     if (!blob) return;
//     const dataURL = URL.createObjectURL(blob);

//     Tesseract.recognize(dataURL, "eng")
//       .then(({ data: { words } }) => {
//         setTextDetected(words);
//         const matchedWord = words.find(
//           (word) =>
//             targetPattern.test(word.text) && word.confidence > minConfidence
//         );
//         if (matchedWord) {
//           setText(matchedWord.text);
//           drawBoundingBoxes([matchedWord]);
//           clearInterval(intervalId.current);
//           stopCamera();
//         }
//       })
//       .catch((error) => console.error("Error processing OCR:", error))
//       .finally(() => {
//         URL.revokeObjectURL(dataURL);
//         isProcessing.current = false;
//       });
//   };

//   const drawBoundingBoxes = (words) => {
//     const overlayCanvas = overlayCanvasRef.current;
//     const video = videoRef.current;
//     if (!overlayCanvas || !video) return;

//     overlayCanvas.width = video.videoWidth;
//     overlayCanvas.height = video.videoHeight;
//     const context = overlayCanvas.getContext("2d");
//     context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
//     context.strokeStyle = "red";
//     context.lineWidth = 2;

//     words.forEach((word) => {
//       const { x0, y0, x1, y1 } = word.bbox;
//       context.strokeRect(x0, y0, x1 - x0, y1 - y0);
//     });
//   };

//   const handleZoomChange = (e) => {
//     const newZoom = parseFloat(e.target.value);
//     setZoomLevel(newZoom);
//     const videoTrack = videoRef.current?.srcObject?.getVideoTracks()[0];
//     videoTrack
//       ?.applyConstraints({ advanced: [{ zoom: newZoom }] })
//       .catch((error) => console.error("Zoom failed:", error));
//   };

//   return (
//     <div>
//       <h1>Pattern Matching OCR</h1>
//       <div style={{ position: "relative" }}>
//         <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
//         <div
//           style={{
//             position: "absolute",
//             top: "50%",
//             left: "50%",
//             width: "200px",
//             height: "50px",
//             border: "2px solid red",
//             transform: "translate(-50%, -50%)",
//             boxSizing: "border-box",
//           }}
//         ></div>
//       </div>

//       <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
//       <canvas
//         ref={overlayCanvasRef}
//         style={{ position: "absolute", top: 0, left: 0 }}
//       ></canvas>

//       <div>
//         <label>Zoom Level: </label>
//         <input
//           type="range"
//           min={minZoom}
//           max={maxZoom}
//           step={(maxZoom - minZoom) / 10}
//           value={zoomLevel}
//           onChange={handleZoomChange}
//         />
//       </div>

//       <p>Matched Text: {text}</p>

//       <div>
//         <p>Detected Texts:</p>
//         {textDetected &&
//           textDetected.map((val, ind) => (
//             <p key={ind}>
//               Text: {val?.text}, Confidence: {val?.confidence}
//             </p>
//           ))}
//       </div>
//     </div>
//   );
// };

// export default BoundingPattern;

import { useCallback, useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import "./QSNumber.css";
// import copyToClipboard from "../assets/copyToClipboard.svg";

const QSNoScanner = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalId = useRef(null);
  const isProcessing = useRef(false);
  const debouncedTimer = useRef(null);
  const [zoomLevels, setZoomLevels] = useState([]);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isZoomOptionsVisible, setIsZoomOptionsVisible] = useState(false);
  const [matchedText, setMatchedText] = useState(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [text, setText] = useState([]);

  const targetPattern = /\d{3}-\d{3}-\d{3}/;
  const minConfidence = 80;
  const lowConfidence = 65;

  useEffect(() => {
    checkCameraPermissionAndStart();
    return () => {
      clearInterval(intervalId.current);
      stopCamera();
    };
  }, []);

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
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(
          (resolve) => (videoRef.current.onloadedmetadata = resolve)
        );

        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();


        if (capabilities.zoom) {
          const { min, max } = capabilities.zoom;
          calculateZoomLevels(min, max);
        }
        else{
            alert("Zoom not supported on this device")
        }

        try {
          await videoRef.current.play();
        } catch (error) {
          console.warn("Autoplay blocked. User interaction required.", error);
        }

        intervalId.current = setInterval(() => processFrames(), 250);
      }
    } catch (error) {
      console.error("Error accessing the camera:", error);
    }
  };

  const calculateZoomLevels = (minZoom, maxZoom) => {
    const step = maxZoom / 5; // Divide max zoom into 5 parts
    const levels = Array.from({ length: 5 }, (_, i) =>
      Math.round((i + 1) * step)
    );
    setZoomLevels(levels);
    setCurrentZoom(levels[0]); // Set the default zoom level to the first value
    handleZoomChange(levels[1]);
  };

  const handleZoomChange = useCallback((zoom) => {
    const videoTrack = streamRef?.current.getVideoTracks()[0];
    const capabilities = videoTrack?.getCapabilities();

    if (capabilities?.zoom) {
      videoTrack.applyConstraints({
        advanced: [{ zoom }],
      });
      setCurrentZoom(zoom);
      setIsZoomOptionsVisible(false);
    }
  }, []);

  const toggleZoomOptions = () => {
    setIsZoomOptionsVisible(!isZoomOptionsVisible);
  };

  const stopCamera = () => {
    if (intervalId.current) clearInterval(intervalId.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Responsible for processing video frames to extract a specific region for OCR
  const processFrames = () => {
    if (!videoRef.current || !canvasRef.current || isProcessing.current) return;
    isProcessing.current = true;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Process only if video is ready
    if (video.readyState === 4) {
      // Step 1: Draw the video frame onto the canvas
      drawVideoFrame(video, canvas);

      // Step 2: Extract image data from the center of the canvas
      const imageData = extractCroppedImageData(canvas);

      // Step 3: Create a cropped image from the extracted image data
      const tempCanvas = createCroppedCanvas(imageData);

      // Step 4: Convert the canvas to a blob and process it
      convertCanvasToBlob(tempCanvas);
    }
  };

  // Draws the video frame onto the canvas.
  // video - The video element to draw from.
  // canvas - The canvas to draw onto.

  const drawVideoFrame = (video, canvas) => {
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  // Extracts image data from a centered rectangle within the canvas.
  //  canvas - The canvas to extract image data from.

  const extractCroppedImageData = (canvas) => {
    const context = canvas.getContext("2d");

    const rectWidth = 200;
    const rectHeight = 50;
    const x = (canvas.width - rectWidth) / 2;
    const y = (canvas.height - rectHeight) / 2;

    return context.getImageData(x, y, rectWidth, rectHeight);
  };

  // Creates a temporary canvas to hold the cropped image data.
  // imageData - The image data to place into the temporary canvas.

  const createCroppedCanvas = (imageData) => {
    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d");

    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;

    tempContext.putImageData(imageData, 0, 0);

    return tempCanvas;
  };

  // Converts the contents of a canvas to a blob and processes the OCR.
  // tempcanvas - The canvas containing the cropped image.

  const convertCanvasToBlob = (tempCanvas) => {
    tempCanvas.toBlob((blob) => {
      if (!blob) return;

      if (debouncedTimer.current) clearTimeout(debouncedTimer.current);

      debouncedTimer.current = setTimeout(() => {
        processOCR(blob);
        URL.revokeObjectURL(blob);
      }, 250);
    });
  };

  const processOCR = (blob) => {
    if (!blob) return;
    const dataURL = URL.createObjectURL(blob);

    Tesseract.recognize(dataURL, "eng")
      .then(({ data: { words } }) => {
        const matchedWord = words.find(
          (word) =>
            targetPattern.test(word.text) && word.confidence > minConfidence
        );

        const detectedTextWithConfidence = words.map((word) => ({
          text: word.text,
          confidence: word.confidence,
        }));
        setText((prevText) => [...prevText, ...detectedTextWithConfidence]);

        const lowConfidencePattern = words.find(
          (word) =>
            (targetPattern.test(word.text) &&
              word.confidence < minConfidence) ||
            word.confidence > lowConfidence
        );

        if (lowConfidencePattern) {
          setCurrentZoom(zoomLevels[2]);
        }

        if (matchedWord) {
          setMatchedText(matchedWord.text);
          navigator.vibrate && navigator.vibrate(150);
          clearInterval(intervalId.current);
          stopCamera();
        }
      })
      .catch((error) => console.error("Error processing OCR:", error))
      .finally(() => {
        URL.revokeObjectURL(dataURL);
        isProcessing.current = false;
      });
  };

  // Function to copy text to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert(`${text} copied to clipboard`);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const toggleTorch = async () => {
    const videoTrack = streamRef.current.getVideoTracks()[0];

    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          advanced: [{ torch: !torchEnabled }],
        });
        setTorchEnabled(!torchEnabled); // Toggle torch state
      } catch (error) {
        console.error("Error toggling torch:", error);
        alert("failed to turn off torch");
      }
    }
    else{
        alert("permissions required")
    }
  };

  return (
    <div style={{ height: "85vh", width: "100vw", position: "relative" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "200px",
          height: "50px",
          border: "2px solid #007bff",
          borderRadius: "15px",
          transform: "translate(-50%, -50%)",
          boxSizing: "border-box",
        }}
      ></div>

      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

      <div style={{ position: "absolute", bottom: "80px", right: "20px" }}>
        <button
          onClick={toggleTorch}
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            backgroundColor: torchEnabled ? "#ff0000" : "#007bff", // Red when on
            color: "#fff",
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: "pointer",
          }}
        >
          🔦
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
        }}
      >
        <button
          onClick={toggleZoomOptions}
          style={{
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            backgroundColor: "#007bff",
            color: "#fff",
            fontSize: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: "pointer",
          }}
        >
          {currentZoom}x
        </button>

        {isZoomOptionsVisible && (
          <div
            style={{
              position: "absolute",
              bottom: "70px",
              right: "0",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {zoomLevels.map((zoom, index) => (
              <button
                key={index}
                onClick={() => handleZoomChange(zoom)}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: currentZoom === zoom ? "#007bff" : "#fff",
                  color: currentZoom === zoom ? "#fff" : "#000",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #007bff",
                  cursor: "pointer",
                }}
              >
                {zoom}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* <div style={{ position: "absolute", bottom: "20px", left: "20px" }}>
        <h3>All Detected Text with Confidence:</h3>
        {text.map((item, index) => (
          <p key={index}>
            <strong>Text:</strong> {item.text} | <strong>Confidence:</strong>{" "}
            {item.confidence.toFixed(2)}%
          </p>
        ))}
      </div> */}

      {matchedText && (
        <div className="bottom-sheet">
          <div className="bottom-sheet-content">
            <h3>Qs Number Detected</h3>
            <p>{matchedText}</p>
            <button
              onClick={() => copyToClipboard(matchedText)}
              style={{
                marginLeft: "10px",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              📋 Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QSNoScanner;
