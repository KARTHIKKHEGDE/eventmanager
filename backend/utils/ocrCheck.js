const Tesseract = require("tesseract.js");

async function verifyReceiptAmount(receiptUrl, claimedAmount) {
    try {
        console.log(`Processing OCR for: ${receiptUrl}`);
        const { data: { text } } = await Tesseract.recognize(receiptUrl, 'eng');

        // Clean text and look for the amount
        const cleanText = text.replace(/,/g, "").replace(/\$/g, "").replace(/₹/g, "");

        // Check if the amount (exact, or with decimals) exists in the text
        // We check for "5000", "5000.00", etc.
        const amountPattern = new RegExp(`\\b${claimedAmount}(\\.\\d{2})?\\b`);

        const isMatch = amountPattern.test(cleanText);

        return {
            verified: true,
            textFound: isMatch,
            scannedTextPreview: text.substring(0, 100) // For debugging
        };

    } catch (error) {
        console.error("OCR Error:", error.message);
        return { verified: false, error: true };
    }
}

module.exports = verifyReceiptAmount;
