import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Save,
  RotateCw,
  Printer,
  PenTool,
  Type,
  FileCheck,
  Undo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Loader2,
  Check,
} from 'lucide-react';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { NasItem } from '../types';
import { api } from '../services/api';
import { formatBytes, formatDate } from '../utils/format';

interface PdfEditorModalProps {
  item: NasItem | null;
  onClose: () => void;
  onSaved?: () => void;
}

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export const PdfEditorModal: React.FC<PdfEditorModalProps> = ({
  item,
  onClose,
  onSaved,
}) => {
  const [activeTool, setActiveTool] = useState<'view' | 'pen' | 'text' | 'signature'>('view');
  const [penColor, setPenColor] = useState<string>('#ef4444'); // Default red annotation
  const [penWidth, setPenWidth] = useState<number>(3);
  const [rotation, setRotation] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(100);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Drawing canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);

  // Text annotations
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [newAnnotationInput, setNewAnnotationInput] = useState<string>('Catatan PDF');

  // Signature state
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigDrawing, setIsSigDrawing] = useState<boolean>(false);

  if (!item) return null;

  const rawUrl = api.getRawFileUrl(item.path);

  // Initialize canvas when entering pen/signature mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTool, zoom, rotation]);

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'pen') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Save history for undo
    setCanvasHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool !== 'pen') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.closePath();
    }
  };

  // Undo last drawing
  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvasHistory.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lastState = canvasHistory[canvasHistory.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setCanvasHistory((prev) => prev.slice(0, -1));
  };

  // Clear all annotations
  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setCanvasHistory([]);
    }
    setTextAnnotations([]);
  };

  // Add text annotation
  const handleAddTextAnnotation = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'text') return;
    const container = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - container.left;
    const y = e.clientY - container.top;

    const newNote: TextAnnotation = {
      id: `text-${Date.now()}`,
      x,
      y,
      text: newAnnotationInput || 'Catatan Baru',
      color: penColor,
      fontSize: 14,
    };

    setTextAnnotations((prev) => [...prev, newNote]);
    setEditingTextId(newNote.id);
  };

  // Rotate document
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Save modified PDF to NAS
  const handleSaveToNas = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      // Fetch original PDF bytes
      const response = await fetch(rawUrl);
      const existingPdfBytes = await response.arrayBuffer();

      // Load into pdf-lib
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // 1. Apply page rotation if modified
      if (rotation !== 0) {
        pages.forEach((page) => {
          const currentRot = page.getRotation().angle;
          page.setRotation(degrees((currentRot + rotation) % 360));
        });
      }

      // 2. Embed drawing annotations from canvas if any
      const canvas = canvasRef.current;
      if (canvas) {
        const hasDrawing = canvasHistory.length > 0;
        if (hasDrawing) {
          const pngDataUrl = canvas.toDataURL('image/png');
          const pngImage = await pdfDoc.embedPng(pngDataUrl);
          const firstPage = pages[0];
          if (firstPage) {
            const { width, height } = firstPage.getSize();
            firstPage.drawImage(pngImage, {
              x: 0,
              y: 0,
              width,
              height,
            });
          }
        }
      }

      // 3. Embed text annotations
      if (textAnnotations.length > 0 && pages[0]) {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        const containerWidth = canvasRef.current?.width || width;
        const containerHeight = canvasRef.current?.height || height;

        textAnnotations.forEach((ann) => {
          // Convert container coords to PDF coords
          const pdfX = (ann.x / containerWidth) * width;
          const pdfY = height - (ann.y / containerHeight) * height;

          firstPage.drawText(ann.text, {
            x: Math.max(10, pdfX),
            y: Math.max(10, pdfY),
            size: ann.fontSize || 12,
            font,
            color: rgb(0.9, 0.1, 0.1),
          });
        });
      }

      // Serialize modified PDF
      const pdfBytes = await pdfDoc.save();

      // Upload directly back to NAS (overwrite current file)
      const dir = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
      const modifiedFile = new File([pdfBytes.buffer as ArrayBuffer], item.name, { type: 'application/pdf' });

      await api.uploadFile(dir, modifiedFile);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSaved?.();
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan perubahan PDF ke NAS');
    } finally {
      setIsSaving(false);
    }
  };

  // Print PDF
  const handlePrint = () => {
    const iframe = document.getElementById('pdf-native-frame') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    } else {
      window.open(rawUrl, '_blank');
    }
  };

  // Download PDF
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = rawUrl;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl h-[94vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Top Header Bar */}
        <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate text-white" title={item.name}>
                {item.name}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {formatBytes(item.size)} · PDF Dokumen · {formatDate(item.modified)}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Tool Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setActiveTool('view')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTool === 'view'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mode Baca / Pratinjau Normal"
              >
                Baca
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('pen')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                  activeTool === 'pen'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Coretan / Sorot Pena"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pena</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('text')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                  activeTool === 'text'
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tambah Catatan Teks"
              >
                <Type className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Teks</span>
              </button>
            </div>

            {/* Pen Color Palette (when pen or text is active) */}
            {(activeTool === 'pen' || activeTool === 'text') && (
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                {['#ef4444', '#facc15', '#3b82f6', '#10b981', '#000000'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setPenColor(color)}
                    className={`w-4 h-4 rounded-full border transition-transform ${
                      penColor === color ? 'scale-125 border-white shadow-xs' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Pilih Warna ${color}`}
                  />
                ))}
                {activeTool === 'pen' && (
                  <select
                    value={penWidth}
                    onChange={(e) => setPenWidth(Number(e.target.value))}
                    className="ml-1 text-[11px] bg-slate-900 text-slate-200 rounded px-1 py-0.5 border border-slate-700"
                    title="Ketebalan Pena"
                  >
                    <option value={2}>2px</option>
                    <option value={4}>4px</option>
                    <option value={8}>8px (Stabilo)</option>
                    <option value={14}>14px</option>
                  </select>
                )}
              </div>
            )}

            {/* Undo / Clear Actions */}
            {(activeTool === 'pen' || textAnnotations.length > 0) && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  title="Batalkan Coretan Terakhir (Undo)"
                  disabled={canvasHistory.length === 0}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  title="Hapus Semua Coretan"
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Rotate */}
            <button
              type="button"
              onClick={handleRotate}
              title="Putar Dokumen 90° Searah Jarum Jam"
              className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Save to NAS Button */}
            <button
              type="button"
              onClick={handleSaveToNas}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              title="Simpan anotasi / rotasi langsung ke NAS"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersimpan!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan ke NAS</span>
                </>
              )}
            </button>

            {/* Print & Download */}
            <button
              type="button"
              onClick={handlePrint}
              title="Cetak Dokumen"
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDownload}
              title="Unduh Berkas PDF"
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Tutup (Esc)"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Text Annotation Input Tooltip */}
        {activeTool === 'text' && (
          <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/50 flex items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2 flex-1">
              <span>Teks Catatan:</span>
              <input
                type="text"
                value={newAnnotationInput}
                onChange={(e) => setNewAnnotationInput(e.target.value)}
                placeholder="Ketik teks yang ingin ditempelkan pada PDF..."
                className="flex-1 max-w-md px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
              />
              <span className="text-[11px] text-slate-500 italic">
                Klik area dokumen di bawah untuk menempatkan teks
              </span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {saveError && (
          <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-500 text-xs">
            {saveError}
          </div>
        )}

        {/* Main Document Viewport */}
        <div
          className="relative flex-1 bg-slate-200 dark:bg-slate-950 overflow-hidden flex items-center justify-center"
          onClick={handleAddTextAnnotation}
        >
          {/* PDF Frame Container */}
          <div
            className="relative w-full h-full flex items-center justify-center transition-transform duration-200"
            style={{
              transform: `rotate(${rotation}deg) scale(${zoom / 100})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Native browser embedded PDF engine */}
            <iframe
              id="pdf-native-frame"
              src={`${rawUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              title={item.name}
              className="w-full h-full border-0 bg-white shadow-xl"
            />

            {/* Interactive Annotation Canvas Overlay (active when Pen or Text tool is on) */}
            {(activeTool === 'pen' || activeTool === 'text') && (
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className={`absolute inset-0 z-20 w-full h-full ${
                  activeTool === 'pen' ? 'cursor-crosshair' : 'cursor-text'
                }`}
              />
            )}

            {/* Rendered Text Annotations */}
            {textAnnotations.map((ann) => (
              <div
                key={ann.id}
                style={{
                  position: 'absolute',
                  left: `${ann.x}px`,
                  top: `${ann.y}px`,
                  color: ann.color,
                }}
                className="z-30 px-2 py-0.5 rounded bg-white/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 shadow-md font-semibold text-xs pointer-events-auto"
              >
                {ann.text}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Zoom & Status Bar */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>Mode: {activeTool === 'pen' ? 'Pena Coretan' : activeTool === 'text' ? 'Tambah Teks' : 'Membaca'}</span>
            {rotation !== 0 && <span>· Rotasi: {rotation}°</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(50, prev - 15))}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-xs w-12 text-center">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(200, prev + 15))}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
              title="Perbesar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
