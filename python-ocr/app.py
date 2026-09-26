import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import pytesseract
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)  

PORT = int(os.environ.get('PORT', 5002))

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'tracy-ocr'})

@app.route('/ocr', methods=['POST'])
def ocr():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    try:
        image = Image.open(file.stream)
        extracted_text = pytesseract.image_to_string(image)
        cleaned = extracted_text.strip()

        return jsonify({
            'text': cleaned,
            'confidence_note': 'OCR extraction may contain errors, especially with low-quality images or unusual fonts.'
        })
    except Exception as e:
        return jsonify({'error': f'OCR processing failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=True)