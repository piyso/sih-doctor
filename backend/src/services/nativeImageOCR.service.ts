/**
 * Native Edge Image OCR Service
 * Executes hardware-accelerated local Tesseract (NEON on ARM / SSE on x86)
 * using local bundled bilingual models (English + Hindi) from backend/src/data/tessdata.
 * 
 * Zero cloud calls • 100% Air-Gapped • Sub-second throughput
 */

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { DocumentOCRService } from './documentOCR.service';
import { DigitizedDocument } from '../shared/types';

export class NativeImageOCRService {
  private static cachedBinaryPath: string | null = null;
  private static readonly TESSDATA_DIR = path.resolve(__dirname, '../data/tessdata');

  /**
   * Locate the native tesseract binary on the edge node
   */
  public static getTesseractBinary(): string {
    if (this.cachedBinaryPath) return this.cachedBinaryPath;

    const candidates = [
      '/opt/homebrew/bin/tesseract',
      '/usr/local/bin/tesseract',
      '/usr/bin/tesseract',
      'tesseract'
    ];

    for (const p of candidates) {
      if (p === 'tesseract') {
        this.cachedBinaryPath = 'tesseract';
        return 'tesseract';
      }
      if (fs.existsSync(p)) {
        this.cachedBinaryPath = p;
        return p;
      }
    }

    this.cachedBinaryPath = 'tesseract';
    return 'tesseract';
  }

  /**
   * Process an image buffer or Base64 string with native bilingual Tesseract
   */
  public static async processImage(
    imageData: Buffer | string,
    fileName: string = 'scanned_doc.png',
    patientId: string = 'patient-default',
    documentType: 'OLD_PRESCRIPTION' | 'LAB_REPORT' | 'DISCHARGE_SUMMARY' | 'OTHER' = 'OLD_PRESCRIPTION'
  ): Promise<DigitizedDocument> {
    const binary = this.getTesseractBinary();

    // Prepare temp directory
    const tempDir = path.join(os.tmpdir(), 'medi-kiosk-ocr');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const runId = uuidv4();
    const ext = path.extname(fileName) || '.png';
    const inputImagePath = path.join(tempDir, `input_${runId}${ext}`);
    const outputBase = path.join(tempDir, `out_${runId}`);
    const outputTxtPath = `${outputBase}.txt`;

    try {
      // Decode Buffer from base64 if string
      let imageBuffer: Buffer;
      if (typeof imageData === 'string') {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = imageData;
      }

      fs.writeFileSync(inputImagePath, imageBuffer);

      // Execute Native Tesseract with local tessdata and bilingual eng+hin
      const args = [
        inputImagePath,
        outputBase,
        '--tessdata-dir', this.TESSDATA_DIR,
        '-l', 'eng+hin',
        '--psm', '6' // Assume single uniform block of text / tabular report
      ];

      await new Promise<void>((resolve, reject) => {
        const proc = execFile(binary, args, { timeout: 10000 }, (error, stdout, stderr) => {
          if (error) {
            // If psm 6 failed, retry with auto page segmentation psm 3
            const retryArgs = [
              inputImagePath,
              outputBase,
              '--tessdata-dir', this.TESSDATA_DIR,
              '-l', 'eng+hin',
              '--psm', '3'
            ];
            execFile(binary, retryArgs, { timeout: 10000 }, (err2) => {
              if (err2) reject(new Error(`Native Tesseract execution failed: ${error.message} - ${stderr}`));
              else resolve();
            });
          } else {
            resolve();
          }
        });
      });

      let extractedText = '';
      if (fs.existsSync(outputTxtPath)) {
        extractedText = fs.readFileSync(outputTxtPath, 'utf8');
      }

      // If extracted text is blank or very short, flag low optical clarity
      if (!extractedText || extractedText.trim().length < 5) {
        extractedText = `[Optical Scan Received: ${fileName}]\n(Low contrast image or handwritten cursive requiring physician verification)`;
      }

      const digitized = DocumentOCRService.processDocumentText(
        extractedText,
        patientId,
        documentType
      );

      digitized.engineUsed = 'NATIVE_EDGE_TESSERACT';

      return digitized;
    } finally {
      // Clean up temporary files
      try {
        if (fs.existsSync(inputImagePath)) fs.unlinkSync(inputImagePath);
        if (fs.existsSync(outputTxtPath)) fs.unlinkSync(outputTxtPath);
      } catch (cleanupErr) {
        // Ignore temporary file cleanup errors
      }
    }
  }
}
