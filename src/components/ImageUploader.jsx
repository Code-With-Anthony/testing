import React, { useState } from 'react';
import Tesseract from 'tesseract.js';

const ImageUploader = () => {
    const [image, setImage] = useState(null);
    const [extractedText, setExtractedText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const patternRegex = /\b\d{3}-\d{3}-\d{3}\b/; // Pattern to match 100-085-090 like format

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImage(URL.createObjectURL(file));
        }
    };

    const handleCapturePhoto = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {
                facingMode: 'environment'
            } });
            const videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.play();

            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                const context = canvas.getContext('2d');
                context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                const imageDataUrl = canvas.toDataURL('image/png');
                setImage(imageDataUrl);
                stream.getTracks().forEach(track => track.stop());
            }, 3000);

        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    };

    const extractTextFromImage = async () => {
        if (!image) {
            alert('Please upload an image first!');
            return;
        }

        setIsLoading(true);
        try {
            const result = await Tesseract.recognize(image, 'eng', {
                logger: (m) => console.log(m) // Logs the progress of text recognition
            });
            const extracted = result.data.text;
            setExtractedText(extracted);
            const patternMatch = patternRegex.exec(extracted);

            if (patternMatch) {
                alert(`Pattern Found: ${patternMatch[0]}`);
            } else {
                alert('Pattern not found in the extracted text.');
            }
        } catch (error) {
            console.error('Error extracting text:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container">
            <h1>Image Text Extractor</h1>
            <div className="button-group">
                <input type="file" accept="image/*" onChange={handleImageUpload} />
                <button onClick={handleCapturePhoto}>Capture from Camera</button>
            </div>

            {image && <img src={image} alt="Uploaded preview" className="uploaded-image" style={{height: '300px', width: '300px'}} />}
            
            <button onClick={extractTextFromImage} disabled={isLoading}>
                {isLoading ? 'Extracting Text...' : 'Extract Text from Image'}
            </button>

            {extractedText && (
                <div className="output">
                    <h3>Extracted Text:</h3>
                    <p>{extractedText}</p>
                </div>
            )}
        </div>
    );
};

export default ImageUploader;