import Tesseract from "tesseract.js";

//Tesseract congifuration
export const tesseractConfig = {
  // Optimize for number detection
  tessedit_char_whitelist: "0123456789-",
  // Use SINGLE_LINE since we're looking for one number pattern
  tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
  // Use LSTM_ONLY for better accuracy with numbers
  tessedit_ocr_engine_mode: Tesseract.OEM.TESSERACT_ONLY,
  // Additional optimizations
  tessjs_create_pdf: "0",
  tessjs_create_hocr: "0",
  tessedit_do_invert: "0",
  tessedit_enable_doc_dict: "0",
  tessedit_unrej_any_wd: "0",
  classify_bln_numeric_mode: "1",
  // Focus only on numeric content : but takes more time in ocr approx 150-200 ms
  // segment_nonalphabetic_script: 1,

  // disabling the chopping of words into different sub words for better speed and compromising accuracy
  // chop_enable: "0",
  tessedit_word_for_word: "1",
};

export const PATTERNS = {
  target: /\d{3}-\d{3}-\d{3}/,
  confidence: {
    min: 85,
    low: 30,
  },
};

export const imgTessConfig = {
  tessedit_char_whitelist: "0123456789-",
  tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
  tessedit_ocr_engine_mode: Tesseract.OEM.DEFAULT,
  classify_enable_learning: true,
};
