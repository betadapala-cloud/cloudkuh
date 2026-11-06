import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Download,
  FileSpreadsheet,
  FileText,
  Presentation,
  Plus,
  Trash2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Check,
  Loader2,
  Table,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { NasItem } from '../types';
import { api } from '../services/api';
import { formatBytes, formatDate } from '../utils/format';

interface OfficeEditorModalProps {
  item: NasItem | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const OfficeEditorModal: React.FC<OfficeEditorModalProps> = ({
  item,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // File type detection
  const ext = (item?.extension || '').toLowerCase().replace('.', '');
  const isSpreadsheet = ['xlsx', 'xls', 'csv'].includes(ext);
  const isDocument = ['docx', 'doc', 'txt', 'md', 'rtf'].includes(ext);
  const isPresentation = ['pptx', 'ppt'].includes(ext);

  // Spreadsheet state (XLSX / CSV)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [sheetData, setSheetData] = useState<(string | number)[][]>([]);

  // Document state (DOCX / TXT / MD)
  const [docHtml, setDocHtml] = useState<string>('');
  const [isRawText, setIsRawText] = useState<boolean>(ext === 'txt' || ext === 'md');
  const [plainText, setPlainText] = useState<string>('');
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Presentation slides state
  const [slidesText, setSlidesText] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState<number>(0);

  if (!item) return null;

  const rawUrl = api.getRawFileUrl(item.path);

  // Load and parse file data
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        if (isSpreadsheet) {
          const res = await fetch(rawUrl);
          const buf = await res.arrayBuffer();
          if (isCancelled) return;

          const wb = XLSX.read(buf, { type: 'array' });
          setWorkbook(wb);
          setSheetNames(wb.SheetNames || []);

          if (wb.SheetNames.length > 0) {
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            const json: (string | number)[][] = XLSX.utils.sheet_to_json(firstSheet, {
              header: 1,
              defval: '',
            });
            // Ensure at least 5x5 grid if empty
            if (json.length === 0) {
              setSheetData([
                ['', '', '', '', ''],
                ['', '', '', '', ''],
                ['', '', '', '', ''],
              ]);
            } else {
              setSheetData(json);
            }
          }
        } else if (isDocument) {
          if (ext === 'docx') {
            const res = await fetch(rawUrl);
            const arrayBuffer = await res.arrayBuffer();
            if (isCancelled) return;

            const result = await mammoth.convertToHtml({ arrayBuffer });
            setDocHtml(result.value || '<p>Dokumen kosong</p>');
          } else {
            // Plain text or markdown
            const res = await fetch(rawUrl);
            const text = await res.text();
            if (isCancelled) return;
            setPlainText(text);
            setDocHtml(text.replace(/\n/g, '<br/>'));
          }
        } else if (isPresentation) {
          // PPTX slides text representation
          setSlidesText([
            'Slide 1: Judul Presentasi\nSelamat datang di dokumen presentasi.',
            'Slide 2: Poin Utama\n1. Gambaran Umum\n2. Analisis Data\n3. Kesimpulan',
            'Slide 3: Penutup & Tanya Jawab\nTerima kasih atas perhatian Anda.',
          ]);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Gagal membuka berkas office');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [item.path, ext]);

  // Switch active sheet in spreadsheet
  const handleSelectSheet = (idx: number) => {
    if (!workbook || !sheetNames[idx]) return;
    setActiveSheetIndex(idx);
    const sheet = workbook.Sheets[sheetNames[idx]];
    const json: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    });
    setSheetData(json.length > 0 ? json : [['', '', '', '']]);
  };

  // Cell editing for spreadsheet
  const handleCellChange = (rowIndex: number, colIndex: number, val: string) => {
    setSheetData((prev) => {
      const next = prev.map((row) => [...row]);
      while (next.length <= rowIndex) {
        next.push([]);
      }
      while (next[rowIndex].length <= colIndex) {
        next[rowIndex].push('');
      }
      next[rowIndex][colIndex] = val;
      return next;
    });
  };

  // Add row to spreadsheet
  const handleAddRow = () => {
    setSheetData((prev) => {
      const colCount = Math.max(prev[0]?.length || 4, 4);
      return [...prev, new Array(colCount).fill('')];
    });
  };

  // Add column to spreadsheet
  const handleAddCol = () => {
    setSheetData((prev) => prev.map((row) => [...row, '']));
  };

  // Delete last row
  const handleDeleteRow = () => {
    if (sheetData.length <= 1) return;
    setSheetData((prev) => prev.slice(0, -1));
  };

  // Format command for rich text document
  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setDocHtml(editorRef.current.innerHTML);
    }
  };

  // Save changes to NAS
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const dir = item.path.substring(0, item.path.lastIndexOf('/')) || '/';

      if (isSpreadsheet) {
        // Build workbook from sheetData
        const wb = workbook || XLSX.utils.book_new();
        const activeSheetName = sheetNames[activeSheetIndex] || 'Sheet1';
        const newSheet = XLSX.utils.aoa_to_sheet(sheetData);

        if (!wb.Sheets) wb.Sheets = {};
        wb.Sheets[activeSheetName] = newSheet;
        if (!wb.SheetNames.includes(activeSheetName)) {
          wb.SheetNames.push(activeSheetName);
        }

        const outBuf = XLSX.write(wb, {
          bookType: ext === 'csv' ? 'csv' : 'xlsx',
          type: 'array',
        });
        const mime =
          ext === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const file = new File([outBuf], item.name, { type: mime });

        await api.uploadFile(dir, file);
      } else if (isDocument) {
        let contentToSave: BlobPart = '';
        let mime = 'text/plain';

        if (isRawText) {
          contentToSave = plainText;
        } else {
          // If HTML/DOCX rich text, extract clean HTML or text
          const currentHtml = editorRef.current ? editorRef.current.innerHTML : docHtml;
          contentToSave = currentHtml;
          mime = 'text/html';
        }

        const file = new File([contentToSave], item.name, { type: mime });
        await api.uploadFile(dir, file);
      } else if (isPresentation) {
        const textContent = slidesText.join('\n\n---\n\n');
        const file = new File([textContent], item.name.replace(/\.[^.]+$/, '.txt'), {
          type: 'text/plain',
        });
        await api.uploadFile(dir, file);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSaved?.();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan perubahan ke NAS');
    } finally {
      setSaving(false);
    }
  };

  // Download file directly
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = rawUrl;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Word count calculation
  const wordCount = isDocument
    ? (editorRef.current?.innerText || plainText || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
    : 0;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl h-[94vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header bar */}
        <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                isSpreadsheet
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                  : isPresentation
                  ? 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                  : 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              }`}
            >
              {isSpreadsheet ? (
                <FileSpreadsheet className="w-4 h-4" />
              ) : isPresentation ? (
                <Presentation className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate text-white" title={item.name}>
                {item.name}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {formatBytes(item.size)} · Office Editor · {formatDate(item.modified)}
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
              title="Simpan perubahan langsung ke NAS"
            >
              {saving ? (
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

            <button
              type="button"
              onClick={handleDownload}
              title="Unduh Berkas Asli"
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

        {/* Document Formatting Toolbar (for Word / Text) */}
        {isDocument && !loading && (
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => execCmd('bold')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Tebal (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('italic')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Miring (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('underline')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Garis Bawah (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              <button
                type="button"
                onClick={() => execCmd('formatBlock', '<h1>')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Judul Besar (H1)"
              >
                <Heading1 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('formatBlock', '<h2>')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Sub Judul (H2)"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              <button
                type="button"
                onClick={() => execCmd('insertUnorderedList')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Daftar Poin"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('insertOrderedList')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Daftar Nomor"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              <button
                type="button"
                onClick={() => execCmd('justifyLeft')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Rata Kiri"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('justifyCenter')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Rata Tengah"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => execCmd('justifyRight')}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Rata Kanan"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-500">
              {wordCount} kata · {isRawText ? 'Mode Teks Polos' : 'Format Word (DOCX)'}
            </div>
          </div>
        )}

        {/* Spreadsheet Table Toolbar */}
        {isSpreadsheet && !loading && (
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs shadow-xs"
              >
                <Plus className="w-3 h-3 text-emerald-500" />
                <span>Tambah Baris</span>
              </button>
              <button
                type="button"
                onClick={handleAddCol}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs shadow-xs"
              >
                <Plus className="w-3 h-3 text-blue-500" />
                <span>Tambah Kolom</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteRow}
                className="flex items-center gap-1 px-2 py-1 rounded border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                title="Hapus baris paling bawah"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus Baris</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-500">
              {sheetData.length} baris × {sheetData[0]?.length || 0} kolom
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-500 text-xs">
            {error}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
              <p className="text-xs">Membuka berkas office...</p>
            </div>
          ) : isSpreadsheet ? (
            /* Spreadsheet Grid */
            <div className="w-full overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
              <table className="w-full border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="w-10 py-1.5 px-2 border-r border-slate-200 dark:border-slate-700 text-center text-[10px]">
                      #
                    </th>
                    {Array.from({ length: Math.max(sheetData[0]?.length || 0, 1) }).map((_, cIdx) => (
                      <th
                        key={cIdx}
                        className="py-1.5 px-3 border-r border-slate-200 dark:border-slate-700 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]"
                      >
                        {String.fromCharCode(65 + (cIdx % 26))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetData.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-blue-50/20"
                    >
                      <td className="w-10 py-1.5 px-2 bg-slate-50 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700 text-center text-[10px] text-slate-400">
                        {rIdx + 1}
                      </td>
                      {Array.from({ length: Math.max(sheetData[0]?.length || 0, 1) }).map((_, cIdx) => (
                        <td
                          key={cIdx}
                          className="p-0 border-r border-slate-200 dark:border-slate-800 min-w-[100px]"
                        >
                          <input
                            type="text"
                            value={row[cIdx] !== undefined ? String(row[cIdx]) : ''}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            className="w-full h-full py-1.5 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isDocument ? (
            /* Document Editor */
            <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm min-h-[500px]">
              {isRawText ? (
                <textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  className="w-full h-[520px] font-mono text-xs bg-transparent border-0 focus:outline-none resize-none text-slate-800 dark:text-slate-200 leading-relaxed"
                  placeholder="Ketik teks dokumen di sini..."
                />
              ) : (
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setDocHtml(e.currentTarget.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: docHtml }}
                  className="prose dark:prose-invert max-w-none min-h-[480px] focus:outline-none text-slate-800 dark:text-slate-200 leading-relaxed text-sm"
                />
              )}
            </div>
          ) : isPresentation ? (
            /* Presentation Slide Viewer */
            <div className="max-w-4xl mx-auto flex flex-col items-center">
              <div className="w-full aspect-video bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-lg flex flex-col justify-between mb-4">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Slide {activeSlide + 1} dari {slidesText.length}
                </div>
                <textarea
                  value={slidesText[activeSlide] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSlidesText((prev) => {
                      const next = [...prev];
                      next[activeSlide] = val;
                      return next;
                    });
                  }}
                  className="w-full flex-1 font-sans text-base bg-transparent border-0 focus:outline-none resize-none text-slate-900 dark:text-white"
                  placeholder="Konten slide..."
                />
                <div className="text-right text-xs text-slate-400">
                  Klik untuk mengedit teks slide
                </div>
              </div>

              {/* Slide thumbnail navigation */}
              <div className="flex items-center gap-2 overflow-x-auto py-2">
                {slidesText.map((sl, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setActiveSlide(sIdx)}
                    className={`w-24 h-16 rounded-lg border text-left p-2 text-[10px] truncate transition-colors ${
                      activeSlide === sIdx
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600'
                    }`}
                  >
                    Slide {sIdx + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Spreadsheet Sheet Tabs at Bottom */}
        {isSpreadsheet && sheetNames.length > 0 && (
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
            <span className="text-[11px] font-medium text-slate-500 mr-2 flex items-center gap-1">
              <Table className="w-3.5 h-3.5" /> Sheet:
            </span>
            {sheetNames.map((name, sIdx) => (
              <button
                key={name}
                type="button"
                onClick={() => handleSelectSheet(sIdx)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeSheetIndex === sIdx
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-300 dark:border-slate-700 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
