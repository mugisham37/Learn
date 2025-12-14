/**
 * Type definitions for PDFKit and related PDF operations
 */

export interface PDFDocumentOptions {
  size?: string;
  layout?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface PDFPage {
  width: number;
  height: number;
}

export interface PDFDocument {
  page: PDFPage;
  on(event: 'data', callback: (chunk: Buffer) => void): void;
  on(event: 'end', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  end(): void;
  rect(x: number, y: number, width: number, height: number): PDFDocument;
  stroke(color?: string): PDFDocument;
  lineWidth(width: number): PDFDocument;
  fontSize(size: number): PDFDocument;
  font(font: string): PDFDocument;
  fillColor(color: string): PDFDocument;
  text(text: string, x?: number, y?: number, options?: {
    width?: number;
    align?: 'left' | 'center' | 'right';
  }): PDFDocument;
  moveTo(x: number, y: number): PDFDocument;
  lineTo(x: number, y: number): PDFDocument;
  image(buffer: Buffer, x: number, y: number, options?: {
    width?: number;
    height?: number;
  }): PDFDocument;
}

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark: string;
    light: string;
  };
}