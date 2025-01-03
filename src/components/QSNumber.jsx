import { useCallback, useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import "./QSNumber.css";
import capture from "../assets/captureIcon.png";
import flashOff from "../assets/flashOff.png";
import flashOn from "../assets/flashOn.png";
import {uploadIcon} from "../assets/index.js";
import ImageCropModal from "./ImageCropModal/ImageCropModal.js";
import {PATTERNS, imgTessConfig,  tesseractConfig} from './utils/QSConfig.js'
const QSNumber = (props) => {
  // const { t } = useTranslation("common");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalId = useRef(null);
  const isProcessing = useRef(false);
  const debouncedTimer = useRef(null);
  const recognitionTimeout = useRef(null);
  const [zoomLevels, setZoomLevels] = useState([]);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isZoomOptionsVisible, setIsZoomOptionsVisible] = useState(false);
  const [matchedText, setMatchedText] = useState(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  //toast state management
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // image upload state management
  const [isLoading, setIsLoading] = useState(false);

  // image capture error state management
  const [errorModel, setErrorModel] = useState(false);
  // image cropping
  const [imageClicked, setImageClicked] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [currentImageCroppingIndex, setCurrentImageCroppingIndex] = useState(0);
  let croppedImageArray = [];
  const [crop, setCrop] = useState({
    height: 100,
    // aspect: 1 / 1,
    unit: "%",
    width: 100,
  });
  const [isCrop, setIsCrop] = useState(false);
  const [back, setBack] = useState(false);
  const imageRef = useRef(null);
  // const [singleCroppedImage, setSingleCroppedImage] = useState({});

  // manual qs
  const [manualQsClicked, setManualQsClicked] = useState(false);

  const [isZoomSupported, setIsZoomSupported] = useState(false);

  useEffect(() => {
    checkCameraPermissionAndStart();
    return () => {
      clearInterval(intervalId.current);
      clearTimeout(recognitionTimeout.current);
      stopCamera();
    };
  }, []);

  const extractTextFromImage = async (image) => {
    if (!image) {
      alert("Please upload an image first!");
      return;
    }

    setIsLoading(true);
    try {
      const result = await Tesseract.recognize(image, "eng", imgTessConfig);

      // Ensure finalValue is defined correctly
      const finalValue = result.data.words || []; // Default to an empty array if undefined
      // console.log("final value: ", finalValue);

      let flag = false;

      // Filter to get values that satisfy the conditions
      const value = finalValue.filter((val) => {
        const check = PATTERNS.target.test(val.text);
        console.log("Pattern is matched: ", check);
        console.log("Confidence of text: ", val.confidence);
        if (
          PATTERNS.target.test(val.text) &&
          val.confidence > PATTERNS.confidence.min
        ) {
          flag = true;
          return (
            PATTERNS.target.test(val.text) &&
            val.confidence > PATTERNS.confidence.min
          ); // Accessing val.text for pattern matching
        }
      });

      if (flag) {
        console.log("value: ", value);
        setMatchedText(value.map((v) => v.text).join(", "));
        setShowToast(true);
        setToastMessage(
          `Pattern Found: ${value.map((v) => v.text).join(", ")}`
        );
        stopCamera();
        flag = false;
      } else {
        alert('pattern not found')
        setImageClicked(false);
        setShowToast(true);
        setToastMessage(
          "Pattern not found in the extracted text. Try to Crop or upload clear image"
        );
      }
    } catch (error) {
      console.error("Error extracting text:", error);
    } finally {
      setIsLoading(false);
      setImageClicked(false);
    }
  };

  const checkCameraPermissionAndStart = async () => {
    try {
      await startCamera();
    } catch (error) {
      setShowToast(true);
      setToastMessage(
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
        video: { facingMode: "environment", advanced: [{zoom: true}] },
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
        } else {
          setIsZoomSupported(false);
          console.log("Zoom Not supported in the device");
        }

        try {
          await videoRef.current.play();
        } catch (error) {
          console.warn("Autoplay blocked. User interaction required.", error);
        }

        recognitionTimeout.current = setTimeout(() => {
          setShowToast(true);
          setToastMessage(
            "Unable to scan, dont panic. Try Capturing or uploading image"
          );
          setShowButtons(true);
        }, 3000);

        intervalId.current = setInterval(() => processFrames(), 250);
      }
    } catch (error) {
      setShowToast(true);
      setToastMessage(
        "Camera permission is required. Please enable it in your browser settings."
      );
      console.error("Error accessing the camera:", error);
    }
  };

  const calculateZoomLevels = (minZoom, maxZoom) => {
    const step = maxZoom / 5; // Divide max zoom into 5 parts
    const levels = Array.from({ length: 5 }, (_, i) =>
      Math.round((i + 1) * step)
    );
    setZoomLevels(levels);
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
    } else {
      setShowToast(true);
      setToastMessage("Unable to Zoom the camera");
    }
  }, []);

  const toggleZoomOptions = () => {
    if (!isZoomSupported) {
      setShowToast(true);
      setToastMessage("Unable to Zoom the camera");
    }
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

    // Step 1: Draw the video frame onto the canvas
    drawVideoFrame(video, canvas);

    // Step 2: Extract image data from the center of the canvas
    const imageData = extractCroppedImageData(canvas);

    //testing pre-processing
    // const preprocessedImage = preprocessImage(imageData);

    // Step 3: Create a cropped image from the extracted image data
    const tempCanvas = createCroppedCanvas(imageData);

    // Step 4: Convert the canvas to a blob and process it
    convertCanvasToBlob(tempCanvas);
  };

  // Draws the video frame onto the canvas. video - The video element to draw from. canvas - The canvas to draw onto.
  const drawVideoFrame = (video, canvas) => {
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  // Extracts image data from a centered rectangle within the canvas. canvas - The canvas to extract image data from.
  const extractCroppedImageData = (canvas) => {
    const context = canvas.getContext("2d");

    const rectWidth = 200;
    const rectHeight = 50;
    // const rectWidth = canvas.width * 0.25;

    // Centering the bounding box
    const x = (canvas.width - rectWidth) / 2;
    const y = (canvas.height - rectHeight) / 2;

    return context.getImageData(x, y, rectWidth, rectHeight);
  };

  // Creates a temporary canvas to hold the cropped image data. imageData - The image data to place into the temporary canvas.
  const createCroppedCanvas = (imageData) => {
    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d");

    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;

    tempContext.putImageData(imageData, 0, 0);

    return tempCanvas;
  };

  // Converts the contents of a canvas to a blob and processes the OCR. tempcanvas - The canvas containing the cropped image.
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

  //working pre-processing
  const preprocessImage = (imageData) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = imageData.width;
    canvas.height = imageData.height;

    // Put the original image data on the canvas
    ctx.putImageData(imageData, 0, 0);

    // Get image data for processing
    const processedImageData = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
    const data = processedImageData.data;

    // Calculate global average brightness for adaptive thresholding
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += gray;
    }
    const avgBrightness = totalBrightness / (data.length / 4);

    // Adaptive threshold based on average brightness
    const adaptiveThreshold = avgBrightness * 0.7;

    // Apply adaptive binarization
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const binary = gray < adaptiveThreshold ? 0 : 255;
      data[i] = data[i + 1] = data[i + 2] = binary;
    }

    // Put processed data back on canvas
    ctx.putImageData(processedImageData, 0, 0);
    return processedImageData;
  };

  const processOCR = async (blob) => {
    if (!blob) {
      return;
    }

    let dataURL = null;

    try {
      dataURL = URL.createObjectURL(blob);

      let start = performance.now();

      const result = await Tesseract.recognize(dataURL, "eng", tesseractConfig);

      // Early return if no result data
      if (!result?.data?.words) {
        return;
      }

      const words = result.data.words;

      // Process matches
      const matches = words.reduce(
        (acc, word) => {
          const isPatternMatch = PATTERNS.target.test(word.text);
          const confidence = word.confidence;

          return {
            ...acc,
            highConfidence:
              acc.highConfidence ||
              (isPatternMatch && confidence > PATTERNS.confidence.min),
            lowConfidence:
              acc.lowConfidence ||
              (isPatternMatch &&
                confidence > PATTERNS.confidence.low &&
                confidence < PATTERNS.confidence.min),
            bestMatch:
              !acc.bestMatch &&
              isPatternMatch &&
              confidence > PATTERNS.confidence.min
                ? word
                : acc.bestMatch,
          };
        },
        { highConfidence: false, lowConfidence: false, bestMatch: null }
      );

      // Handle zoom adjustment for low confidence matches
      if (
        matches.lowConfidence &&
        currentZoom !== zoomLevels[zoomLevels.length - 1]
      ) {
        setCurrentZoom(zoomLevels[1]);
      }

      // Handle successful match
      if (matches.bestMatch) {
        setImageClicked(false);
        let end = performance.now();
        console.log(`OCR Started at ${start}`);
        console.log(`OCR Ended at ${end}`);
        console.log(`OCR took ${end - start} milliseconds.`);
        const filteredText = matches.bestMatch.text.replace(/[^0-9-]/g, ""); // Removes everything except numbers and hyphen

        // Batch state updates
        const updateStates = () => {
          setMatchedText(filteredText);
          setShowButtons(false);
          setToastMessage(`Pattern Found: ${filteredText}`);
        };

        // Clean up camera and intervals
        clearInterval(intervalId.current);
        stopCamera();

        // Update states
        updateStates();
        return filteredText;
      }
    } catch (error) {
      setToastMessage("Error processing image");
      setShowToast(true);
    } finally {
      // Clean up resources
      if (dataURL) {
        URL.revokeObjectURL(dataURL);
      }
      isProcessing.current = false;
    }

    return null;
  };

  const takeImage = () => {
    // Stop continuous frame processing
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null; // Clear reference
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Step 1: Draw the video frame onto the canvas
    drawVideoFrame(video, canvas);

    const extractMiddleImage = (canvas) => {
      const context = canvas.getContext("2d");

      // const rectWidth = 200;
      // const rectHeight = 50;
      const rectHeight = 50;
      const rectWidth = canvas.width * 0.25;

      // Centering the bounding box
      const x = (canvas.width - rectWidth) / 2;
      const y = (canvas.height - rectHeight) / 2;

      return context.getImageData(x, y, rectWidth, rectHeight);
    };

    // Step 2: Extract image data from the center of the canvas
    // const imageData = extractCroppedImageData(canvas);
    const imageData = extractMiddleImage(canvas);

    // Step 3: Create a cropped image from the extracted image data
    const tempCanvas = createCroppedCanvas(imageData);

    setImageClicked(true);

    tempCanvas.toBlob((blob) => {
      if (!blob) return;

      const imageUrl = URL.createObjectURL(blob);
      const imageFileDetails = new File(
        [blob],
        `captured_image_${Date.now()}.png`,
        { type: "image/png" }
      );
      const imageFileData = {
        imageUrl,
        imageName: `captured_image_${Date.now()}.png`,
        imageFileDetails,
        crop: false,
      };
      setImageFiles([imageFileData]);
    });
  };

  const toggleTorch = async () => {
    const videoTrack = streamRef.current.getVideoTracks()[0];

    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          advanced: [{ torch: torchEnabled }],
        });
        setTorchEnabled(!torchEnabled);
      } catch (error) {
      alert("flash issue");
        setShowToast(true);
        setToastMessage("Unable to toggle flashlight");
      }
    } else {
      setShowToast(true);
      alert("flash issue");
      setToastMessage("error in toggling flashlight");
    }
  };

  // image cropping functions
  const hideImageCroppingModal = () => {
    setImageClicked(false);
    intervalId.current = setInterval(() => processFrames(), 250);
  };

  const imageCroppingFurtherClick = async () => {
    if (!back) {
      croppedImageArray = [
        ...croppedImageArray,
        imageFiles[currentImageCroppingIndex],
      ];
    } else {
      if (!isCrop) {
        croppedImageArray = imageFiles;
      } else {
        croppedImageArray[currentImageCroppingIndex] =
          imageFiles[currentImageCroppingIndex];
      }
    }
    if (imageFiles.length !== currentImageCroppingIndex + 1) {
      setCurrentImageCroppingIndex(currentImageCroppingIndex + 1);
    } else {
      setImageFiles(croppedImageArray);
      extractTextFromImage(imageFiles[0].imageUrl);
      setImageClicked(false);
      setCurrentImageCroppingIndex(currentImageCroppingIndex + 1);
    }
  };

  const imageCropClick = () => {
    const array = imageFiles.slice();
    array[currentImageCroppingIndex].crop = true;
    setImageFiles(array);
    setIsCrop(true);
  };

  const onImageLoaded = (image) => {
    imageRef.current = image;
  };

  const onCropComplete = (crop) => {
    console.log("Crop completed with dimensions:", crop);
    // makeClientCrop(crop);
  };

  const onCropChange = (newCrop) => {
    setCrop(newCrop);
  };

  const getCroppedImg = (image, crop) => {
    const imageElement = imageRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = imageElement?.naturalWidth / imageElement.width;
    const scaleY = imageElement?.naturalHeight / imageElement.height;

    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      imageElement,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Canvas is empty");
          reject(new Error("Canvas is empty"));
          return;
        }
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          let fileName =
            imageFiles[currentImageCroppingIndex].imageName.split(".")[0];
          dataURLtoFile(reader.result, `${fileName}_cropped.png`);
          resolve(reader.result);
        };
      });
    });
  };

  // const handleCropOkayClick = async () => {
  //   console.log("check this please: ", imageRef, crop.width, crop.height);
  //   if (imageRef.current && crop.width && crop.height) {
  //     await getCroppedImg(imageRef, crop)
  //       .then((croppedImageUrl) => {
  //         // Call Tesseract after cropping is done
  //         extractTextFromImage(croppedImageUrl);
  //       })
  //       .catch((error) => {
  //         console.error("Error cropping image:", error);
  //       });
  //   } else {
  //     console.error("Invalid crop dimensions", crop);
  //   }
  // };

  const handleCropOkayClick = async () => {

    if (imageRef.current && crop.width && crop.height) {
      try {
        const croppedImageUrl = await getCroppedImg(imageRef, crop);
        // Call Tesseract after cropping is done
        await extractTextFromImage(croppedImageUrl);
      } catch (error) {
        setErrorModel(true);
        console.error("Error cropping image:", error);
        // <AlertPopUp
        //   modaltitle={t("error", { framework: "react-i18next" })}
        //   onHide={!errorModel}
        //   modalcontent={t("ECI", { framework: "react-i18next" })}
        //   buttontext={t("back", { framework: "react-i18next" })}
        //   show={errorModel}
        // />;
      }
    } else {
      setErrorModel(true);
      console.error("Invalid crop dimensions", crop);
      // <AlertPopUp
      //   modaltitle={t("error", { framework: "react-i18next" })}
      //   onHide={!errorModel}
      //   modalcontent={t("ICD", { framework: "react-i18next" })}
      //   buttontext={t("back", { framework: "react-i18next" })}
      //   show={errorModel}
      // />;
    }
    setErrorModel(false);
  };

  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(","),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    let croppedImage = new File([u8arr], filename, { type: mime });
    let croppedFileData = {
      imageUrl: URL.createObjectURL(croppedImage),
      imageName: croppedImage.name,
      imageFileDetails: croppedImage,
    };
    console.log("Cropped file data:", croppedFileData);
  };

  const handleCancelCrop = () => {
    const array = imageFiles.slice();
    array[currentImageCroppingIndex].crop = false;
    setImageFiles(array);
    setIsCrop(false);
  };

  const imageCroppingBackClick = () => {
    const array = imageFiles.slice();
    array[currentImageCroppingIndex].crop = false;
    setImageFiles(array);
    setBack(true);
    setCurrentImageCroppingIndex(currentImageCroppingIndex - 1);
  };

  // manual qs number
  const handleManualQSNumber = () => {
    if (intervalId.current && manualQsClicked) {
      clearInterval(intervalId.current);
      intervalId.current = null; // Clear reference
    }

    setManualQsClicked(!manualQsClicked);
  };

  return (
    <div className="video-container">
      {/* <ToastComponent
        show={showToast}
        content={toastMessage}
        onHide={() => setShowToast(false)}
        warning={true}
      /> */}

      <video ref={videoRef} autoPlay playsInline className="video-stream" />

      <div className={`detection-box`}></div>

      <canvas ref={canvasRef} className="hidden-canvas"></canvas>

      {/* {isLoading ? (
        <LoaderComponent />
      ) : ( */}
        <ImageCropModal
          imageCropModal={imageClicked}
          hideImageCroppingModal={hideImageCroppingModal}
          imageFiles={imageFiles}
          currentImageCroppingIndex={currentImageCroppingIndex}
          crop={crop}
          isRetake={true}
          onCameraAction={hideImageCroppingModal}
          onImageLoaded={onImageLoaded}
          onCropComplete={onCropComplete}
          onCropChange={onCropChange}
          handleCancelCrop={handleCancelCrop}
          handleCropOkayClick={handleCropOkayClick}
          imageCroppingBackClick={imageCroppingBackClick}
          imageCropClick={imageCropClick}
          imageCroppingFurtherClick={imageCroppingFurtherClick}
        />
      {/* )} */}

      {/* {
        manualQsClicked && (
          <MapExistingEquipmentOrPersonPopup
            show={manualQsClicked}
            modalHeader={
              props.isExchangeModule
                ? t("addEquipmentToEm", {
                    framework: "react-i18next",
                  })
                : "mapEquipmentHeader"
            }
            onHide={handleManualQSNumber}
            // resultStatus={props.radioValue}
            // handleChangeRadio={props.handleChangeRadio}
            // onFurtherClick={props.furtherClick}
            // showConfirmationDiv={props.showConfirmationDiv}
            // showDivForOptions={props.showDivForOptions}
            // qsSearchValue={props.qsSearchValue}
            // setQsSearchValue={props.setQsSearchValue}
            // setQsSearchValueForAPI={props.setQsSearchValueForAPI}
            // resultStatusForMappedEquipmentConfirmation={
            //   props.radioValueForMappedEquipmentConfirmation
            // }
            // handleChangeRadioForMappedModuleConfirmation={
            //   props.handleChangeRadioForMappedEquipmentConfirmation
            // }
            // setShowValidQsToast={props.setShowValidQsToast}
            // labelForExisting={
            //   props.fieldValue[FieldTypes.MAP_EXISTING_EQUIPMENT_BY_QS]
            // }
            // labelForNew={props.fieldValue[FieldTypes.CREATE_NEW_TEST_EQUIPMENT]}
            // valueForExisting="mapEquistingEquipment"
            // valueForNew={props.fieldValue[FieldTypes.NEW_EQUIPMENT]}
            // isExchangeModule={props.isExchangeModule}
          />
        )} */}

      <div className="button-container">
        {showButtons && (
          <>
            <button onClick={takeImage} className="image-click-button">
              <img src={capture} alt="Click" className="action-icon" />
            </button>
            <button onClick={handleManualQSNumber} className="upload-button">
              <img src={uploadIcon} alt="upload" className="action-icon" />
            </button>
          </>
        )}
        <button
          onClick={toggleTorch}
          className={`torch-button ${torchEnabled ? "torch-on" : ""}`}
        >
          <img
            src={torchEnabled ? flashOn : flashOff}
            alt={torchEnabled ? "Flash On" : "Flash Off"}
            className="action-icon"
          />
        </button>
        <button onClick={toggleZoomOptions} className="zoom-button">
          {currentZoom}x
        </button>

        {isZoomOptionsVisible && (
          <div className="zoom-options">
            {zoomLevels?.map((zoom, index) => (
              <button
                key={index}
                onClick={() => handleZoomChange(zoom)}
                className={`zoom-level-button ${
                  currentZoom === zoom ? "active-zoom" : ""
                }`}
              >
                {zoom}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* <div className="text-detection">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default QSNumber;
