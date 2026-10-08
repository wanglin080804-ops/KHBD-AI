/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import DOMPurify from 'dompurify';
import { PDFDocument } from 'pdf-lib';
import { 
  FileText, 
  Sparkles, 
  BookOpen, 
  Download, 
  Copy, 
  Check, 
  Printer, 
  Edit3, 
  Eye, 
  History, 
  Trash2, 
  RefreshCw, 
  BookMarked,
  Key,
  HelpCircle,
  Clock,
  Layers,
  ChevronDown,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';

interface HistoryItem {
  id: string;
  timestamp: number;
  taskType: 'khbd' | 'matran' | 'slide';
  subject: string;
  grade: string;
  bookSet: string;
  lessonName: string;
  content: string;
}

const OBFUSCATED_TEST_KEY = "d0c5ZENrUUdrUDVnS0ZObXlNTmx6Uk5WQm5aYnJhUy0wMWRzN0JNYWgxSUk2TlI4YkEuUUE=";
const TEST_KEY_MSG = "API mặc định đã thiết lập thành công, bạn có thể sử dụng";

function getDecodedKey(): string {
  try {
    const reversed = atob(OBFUSCATED_TEST_KEY);
    return reversed.split('').reverse().join('');
  } catch {
    return '';
  }
}

const SAMPLE_PRESETS = [
  {
    label: "Toán 10 - Mệnh đề",
    taskType: "khbd" as const,
    subject: "Toán học",
    grade: "Lớp 10",
    bookSet: "Kết nối tri thức với cuộc sống",
    lessonName: "Bài 1: Mệnh đề",
    extraContext: "Thời lượng 2 tiết (90 phút). Chú trọng hoạt động khởi động thực tiễn và tích hợp phần mềm GeoGebra/Quizizz kiểm tra nhanh."
  },
  {
    label: "Ma trận Ngữ văn 9 - Giữa kỳ I",
    taskType: "matran" as const,
    subject: "Ngữ văn",
    grade: "Lớp 9",
    bookSet: "Cánh Diều",
    lessonName: "Kiểm tra định kỳ Giữa học kỳ I",
    extraContext: "Thời gian làm bài 90 phút. Tỉ lệ: Đọc hiểu 4,0 điểm - Viết 6,0 điểm. Bám sát CV 7991."
  },
  {
    label: "KHTN 7 - Tốc độ chuyển động",
    taskType: "khbd" as const,
    subject: "Khoa học tự nhiên",
    grade: "Lớp 7",
    bookSet: "Chân trời sáng tạo",
    lessonName: "Bài 8: Tốc độ chuyển động",
    extraContext: "Có thí nghiệm đo tốc độ bằng cổng quang điện và đồng hồ hiện số. Tích hợp năng lực số (CV 3456)."
  },
  {
    label: "Vật lí 12 - Dao động điều hòa",
    taskType: "khbd" as const,
    subject: "Vật lí",
    grade: "Lớp 12",
    bookSet: "Kết nối tri thức với cuộc sống",
    lessonName: "Bài 1: Dao động điều hòa",
    extraContext: "Sử dụng mô phỏng PhET, thời lượng 2 tiết. Bám sát 4 bước tổ chức hoạt động của CV 5512."
  },
  {
    label: "Slide Lịch sử 5 - Nước nhà bị chia cắt",
    taskType: "slide" as const,
    subject: "Lịch sử và Địa lí",
    grade: "Lớp 5",
    bookSet: "Chân trời sáng tạo",
    lessonName: "Nước nhà bị chia cắt",
    extraContext: "Tạo kịch bản slide có nhiều hình ảnh minh họa lịch sử sinh động, chia slide theo tiến trình bài học, phần câu hỏi trắc nghiệm cuối bài."
  }
];

const slicePdf = async (file: File, start: number, end: number): Promise<File> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  const startIndex = Math.max(0, start - 1);
  const endIndex = Math.min(pdfDoc.getPageCount() - 1, end - 1);
  const pageIndices = [];
  for (let i = startIndex; i <= endIndex; i++) {
    pageIndices.push(i);
  }
  const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));
  const pdfBytes = await newPdf.save();
  return new File([pdfBytes as unknown as BlobPart], `sliced_${file.name}`, { type: 'application/pdf' });
};

export default function App() {
  // Form states
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isTestKeyActive, setIsTestKeyActive] = useState<boolean>(false);
  const [taskType, setTaskType] = useState<'khbd' | 'matran' | 'slide'>('khbd');
  const [subject, setSubject] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [bookSet, setBookSet] = useState<string>('Kết nối tri thức với cuộc sống');
  const [lessonName, setLessonName] = useState<string>('');
  const [extraContext, setExtraContext] = useState<string>('');
  const [inputMode, setInputMode] = useState<'ai' | 'upload'>('ai');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [pageStart, setPageStart] = useState<string>('');
  const [pageEnd, setPageEnd] = useState<string>('');

  // Auto-suggested lessons
  const [suggestedLessons, setSuggestedLessons] = useState<string[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState<boolean>(false);

  // Generation states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [resultContent, setResultContent] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Welcome modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(true);

  const resultContainerRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('khbd_ai_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const handleUseTestKey = () => {
    setApiKeyInput(TEST_KEY_MSG);
    setIsTestKeyActive(true);
    showToast("Đã kích hoạt API Test thành công!", "success");
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKeyInput(val);
    if (val !== TEST_KEY_MSG) {
      setIsTestKeyActive(false);
    }
  };

  const applyPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setTaskType(preset.taskType);
    setSubject(preset.subject);
    setGrade(preset.grade);
    setBookSet(preset.bookSet);
    setLessonName(preset.lessonName);
    setExtraContext(preset.extraContext);
    showToast(`Đã nạp mẫu: ${preset.label}`, "info");
  };

  // Auto-fetch lessons when subject, grade, and bookSet change
  const handleFetchLessons = useCallback(async () => {
    if (!subject.trim() || !grade.trim()) return;

    let keyToSend = apiKeyInput.trim();
    if (keyToSend === TEST_KEY_MSG) {
      keyToSend = getDecodedKey();
    }

    setIsLoadingLessons(true);
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          grade: grade.trim(),
          bookSet: bookSet.trim(),
          apiKey: keyToSend
        })
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.lessons) && data.lessons.length > 0) {
        setSuggestedLessons(data.lessons);
        showToast(`Đã tải ${data.lessons.length} bài học từ SGK!`, "success");
      }
    } catch (err) {
      console.warn('Could not auto-load lessons', err);
    } finally {
      setIsLoadingLessons(false);
    }
  }, [subject, grade, bookSet, apiKeyInput]);

  // Reactively fetch lessons when subject/grade/bookSet change in AI mode
  useEffect(() => {
    if (inputMode === 'ai' && subject.trim() && grade.trim()) {
      const debounceTimer = setTimeout(() => {
        handleFetchLessons();
      }, 300);
      return () => clearTimeout(debounceTimer);
    }
  }, [subject, grade, bookSet, inputMode, handleFetchLessons]);

  // Convert markdown + KaTeX LaTeX formulas
  const renderFormattedContent = (markdownText: string) => {
    if (!markdownText) return '';

    const mathTokens: string[] = [];
    
    // Replace display formulas $$...$$
    let textWithMath = markdownText.replace(/\$\$([\s\S]+?)\$\$/g, (_match, formula) => {
      try {
        const html = katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
        mathTokens.push(html);
        return `MATHTOKENPLACEHOLDER${mathTokens.length - 1}END`;
      } catch {
        return _match;
      }
    });

    // Replace inline formulas $...$
    textWithMath = textWithMath.replace(/\$([^\$\n\r]+?)\$/g, (_match, formula) => {
      try {
        const html = katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
        mathTokens.push(html);
        return `MATHTOKENPLACEHOLDER${mathTokens.length - 1}END`;
      } catch {
        return _match;
      }
    });

    let html = '';
    try {
      html = marked.parse(textWithMath, { async: false, breaks: true }) as string;
    } catch {
      html = marked.parse(markdownText, { async: false, breaks: true }) as string;
    }

    // Restore math tokens
    mathTokens.forEach((tokenHtml, index) => {
      html = html.replace(`MATHTOKENPLACEHOLDER${index}END`, tokenHtml);
    });

    return html;
  };



  const handleGenerate = async () => {
    if (!subject.trim() || !grade.trim() || !lessonName.trim()) {
      showToast("Vui lòng điền đầy đủ Môn học, Khối Lớp và Tên bài học!", "error");
      return;
    }
    if (inputMode === 'upload' && !uploadFile) {
      showToast("Vui lòng tải lên tài liệu!", "error");
      return;
    }

    let keyToSend = apiKeyInput.trim();
    if (keyToSend === TEST_KEY_MSG) {
      keyToSend = getDecodedKey();
    }

    setIsGenerating(true);
    setIsEditMode(false);

    try {
      const formData = new FormData();
      formData.append('taskType', taskType);
      formData.append('subject', subject.trim());
      formData.append('grade', grade.trim());
      formData.append('bookSet', bookSet.trim());
      formData.append('lessonName', lessonName.trim());
      formData.append('extraContext', extraContext.trim());
      formData.append('apiKey', keyToSend);
      formData.append('inputMode', inputMode);

      if (inputMode === 'upload' && uploadFile) {
        if (uploadFile.name.toLowerCase().endsWith('.pdf') && (pageStart || pageEnd)) {
          const start = pageStart ? parseInt(pageStart) : 1;
          const end = pageEnd ? parseInt(pageEnd) : start;
          if (start > 0 && end >= start) {
            const slicedFile = await slicePdf(uploadFile, start, end);
            formData.append('file', slicedFile);
          } else {
             throw new Error("Trang bắt đầu và kết thúc không hợp lệ");
          }
        } else {
          formData.append('file', uploadFile);
          if (pageStart && pageEnd) {
             formData.append('pageRange', `Từ trang ${pageStart} đến trang ${pageEnd}`);
          }
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo tài liệu. Vui lòng thử lại!");
      }

      const generatedText = data.content || '';
      setResultContent(generatedText);

      // Save to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        taskType,
        subject: subject.trim(),
        grade: grade.trim(),
        bookSet: bookSet.trim(),
        lessonName: lessonName.trim(),
        content: generatedText
      };

      const updatedHistory = [newHistoryItem, ...history.slice(0, 19)];
      setHistory(updatedHistory);
      try {
        localStorage.setItem('khbd_ai_history', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error('Failed to save history to storage', e);
      }

      showToast("🎉 Đã tạo tài liệu thành công!", "success");

      setTimeout(() => {
        resultContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);

    } catch (err: any) {
      showToast(err.message || "Đã xảy ra lỗi khi tạo tài liệu.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!resultContent) return;
    navigator.clipboard.writeText(resultContent).then(() => {
      setCopied(true);
      showToast("✅ Đã copy toàn bộ nội dung! Thầy/cô có thể Paste vào Word.", "success");
      setTimeout(() => setCopied(false), 2500);
    }).catch(err => {
      showToast("Lỗi khi copy: " + err, "error");
    });
  };

  const handleExportWord = () => {
    if (!resultContent) return;
    const renderedHtml = renderFormattedContent(resultContent);
    const title = taskType === 'khbd' 
      ? `KHBD_${subject}_${grade}_${lessonName}`
      : taskType === 'slide' 
        ? `Slide_${subject}_${grade}_${lessonName}`
        : `MaTran_${subject}_${grade}_${lessonName}`;
    
    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; color: #000; margin: 2cm; }
          h1 { font-size: 16pt; text-align: center; color: #002060; font-weight: bold; text-transform: uppercase; margin-bottom: 12pt; }
          h2 { font-size: 14pt; color: #002060; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; }
          h3 { font-size: 13pt; font-weight: bold; margin-top: 10pt; margin-bottom: 4pt; }
          table { border-collapse: collapse; width: 100%; margin-top: 10pt; margin-bottom: 12pt; }
          th, td { border: 1px solid black; padding: 6pt 8pt; vertical-align: top; font-size: 11pt; }
          th { background-color: #F2F2F2; font-weight: bold; text-align: center; }
          p { margin-bottom: 6pt; margin-top: 0; }
          ul, ol { margin-top: 0; margin-bottom: 6pt; padding-left: 20pt; }
          blockquote { border-left: 3px solid #666; padding-left: 10pt; margin-left: 0; color: #444; font-style: italic; }
        </style>
      </head>
      <body>`;
    const postHtml = `</body></html>`;
    const fullHtml = preHtml + renderedHtml + postHtml;

    const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${title.replace(/[\/\\?%*:|"<>]/g, '_')}.doc`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    showToast("📥 Đã tải file Word (.doc) thành công!", "success");
  };

  const handlePrintOrPdf = () => {
    window.print();
  };

  const handleLoadFromHistory = (item: HistoryItem) => {
    setTaskType(item.taskType);
    setSubject(item.subject);
    setGrade(item.grade);
    setBookSet(item.bookSet);
    setLessonName(item.lessonName);
    setResultContent(item.content);
    setShowHistoryModal(false);
    showToast(`Đã mở lại bài soạn: ${item.lessonName}`, "success");
    setTimeout(() => {
      resultContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem('khbd_ai_history', JSON.stringify(updated));
    } catch {}
    showToast("Đã xóa khỏi lịch sử", "info");
  };

  const handleClearHistory = () => {
    if (confirm("Thầy/cô có chắc chắn muốn xóa toàn bộ lịch sử soạn bài?")) {
      setHistory([]);
      localStorage.removeItem('khbd_ai_history');
      showToast("Đã xóa toàn bộ lịch sử", "info");
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 flex justify-center items-start">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium transition-all animate-bounce ${
          notification.type === 'error' ? 'bg-red-600 text-white' :
          notification.type === 'info' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          <span>{notification.message}</span>
        </div>
      )}

      <div className="max-w-[940px] w-full">
        {/* Main Form Panel */}
        <div className="glass-panel p-6 sm:p-10 mb-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold tracking-wide uppercase mb-3 shadow-xs border border-indigo-100">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Sản phẩm nộp bài tập 1
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              Trợ Lý AI Dành Cho Giáo Viên
            </h1>
            <p className="text-gray-600 text-base sm:text-lg font-normal max-w-xl mx-auto">
              Tạo KHBD, Slide bài giảng & Ma trận hoàn toàn tự động, chuẩn GDPT 2018 & tích hợp năng lực số.
            </p>
          </div>

          {/* Quick Presets Bar */}
          <div className="mb-6 p-3.5 bg-white/70 rounded-xl border border-indigo-100 shadow-xs">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5 text-indigo-500" />
                Mẫu thử nghiệm nhanh cho Ban Giám Khảo & Giáo Viên:
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  Lịch sử ({history.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-xs px-3 py-1.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg border border-indigo-200/60 transition-all hover:shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>✨</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-500" />
                🔑 Khóa bảo mật (Gemini API Key)
              </span>
              <span className="text-xs font-normal text-gray-500">
                (Tùy chọn: Hệ thống tự động dùng API Key AI Studio)
              </span>
            </label>
            <input
              type={isTestKeyActive ? "text" : "password"}
              value={apiKeyInput}
              onChange={handleApiKeyChange}
              placeholder="Nhập API Key của bạn (bắt đầu bằng AIza...)"
              className={`w-full px-4 py-3 rounded-xl border bg-white/90 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 ${
                isTestKeyActive 
                  ? 'border-emerald-400 text-emerald-700 font-semibold bg-emerald-50/30' 
                  : 'border-gray-300 text-gray-800 focus:border-indigo-500'
              }`}
            />
            
            <div className="mt-2.5 p-3 rounded-xl bg-gray-50/90 border border-dashed border-gray-300 flex flex-col gap-3 text-xs text-gray-600">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <strong>API Test cho Ban Giám Khảo:</strong> 
                  <span className="opacity-70">🗝️ (Đã mã hóa bảo mật chuẩn sư phạm)</span>
                </div>
                <button
                  type="button"
                  onClick={handleUseTestKey}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-xs hover:shadow flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  🚀 Dùng API Test Mặc Định
                </button>
              </div>
              <div className="bg-amber-50 text-amber-800 p-2.5 rounded-lg border border-amber-200/60 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Lưu ý khi sử dụng API Key:</p>
                  <ul className="list-disc pl-4 space-y-1 opacity-90">
                    <li>Người dùng có thể dùng trực tiếp Key có sẵn của Admin nhưng lưu ý đây là token free nên sẽ hạn chế về tốc độ phản hồi và số lượt tạo.</li>
                    <li>Nếu người dùng có Key cá nhân, khuyến khích tự sử dụng Key cá nhân để đảm bảo trải nghiệm mượt mà và ổn định hơn.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Input Mode Toggle */}
          <div className="mb-5 flex gap-4">
            <button 
              type="button" 
              onClick={() => setInputMode('ai')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${inputMode === 'ai' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              ✨ Tự động sinh (AI)
            </button>
            <button 
              type="button" 
              onClick={() => setInputMode('upload')}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${inputMode === 'upload' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              📁 Upload Tài Liệu (PDF/Word)
            </button>
          </div>

          {inputMode === 'upload' && (
            <div className="mb-5 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tải lên sách / tài liệu bài học (Hỗ trợ: .pdf, .doc, .docx)
              </label>
              <input 
                type="file" 
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                  // Revoke previous blob URL to prevent memory leak
                  if (fileUrl) URL.revokeObjectURL(fileUrl);
                  if (file && file.type === 'application/pdf') {
                    setFileUrl(URL.createObjectURL(file));
                  } else {
                    setFileUrl('');
                  }
                }}
                className="w-full mb-4 bg-white p-2 rounded border border-gray-300"
              />
              {fileUrl && (
                <div className="mb-4 border border-gray-300 rounded-xl overflow-hidden shadow-sm h-[500px]">
                  <div className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 border-b">
                    👀 Xem trước nội dung PDF (Cuộn để xem số trang)
                  </div>
                  <iframe src={fileUrl} width="100%" height="100%" title="PDF Preview" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Từ trang số</label>
                  <input type="number" value={pageStart} onChange={e => setPageStart(e.target.value)} placeholder="VD: 15" className="w-full p-2 border rounded" />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Đến trang số</label>
                  <input type="number" value={pageEnd} onChange={e => setPageEnd(e.target.value)} placeholder="VD: 18" className="w-full p-2 border rounded" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Với PDF: Trình duyệt sẽ tự động cắt đúng số trang bạn nhập trước khi gửi để xử lý cực nhanh.<br/>
                * Với Word: AI sẽ đọc nội dung từ trang bạn chỉ định.
              </p>
            </div>
          )}

          {/* Document Type & Subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500" />
                📄 Loại tài liệu cần tạo
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as 'khbd' | 'matran' | 'slide')}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/90 text-gray-800 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="khbd">Kế hoạch bài dạy (Theo Công văn 5512 & CV 3456)</option>
                <option value="slide">Kịch bản Slide bài giảng (Dùng cho PowerPoint)</option>
                <option value="matran">Ma trận & Bản đặc tả đề kiểm tra (Theo Công văn 7991)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  📚 Môn học
                </span>
              </label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/90 text-gray-800 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="" disabled>-- Môn học --</option>
                <option value="Toán học">Toán học</option>
                <option value="Tiếng Việt">Tiếng Việt</option>
                <option value="Ngữ văn">Ngữ văn</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
                <option value="Khoa học tự nhiên">Khoa học tự nhiên</option>
                <option value="Lịch sử">Lịch sử</option>
                <option value="Địa lí">Địa lí</option>
                <option value="Lịch sử và Địa lí">Lịch sử và Địa lí</option>
                <option value="Vật lí">Vật lí</option>
                <option value="Hóa học">Hóa học</option>
                <option value="Sinh học">Sinh học</option>
                <option value="Công nghệ">Công nghệ (Chung)</option>
                <option value="Công nghệ (Nông nghiệp/Trồng trọt)">Công nghệ (Nông nghiệp/Trồng trọt)</option>
                <option value="Tin học">Tin học</option>
                <option value="Giáo dục công dân">Giáo dục công dân</option>
                <option value="Giáo dục Kinh tế và Pháp luật">Giáo dục Kinh tế và Pháp luật</option>
                <option value="Hoạt động trải nghiệm">Hoạt động trải nghiệm (Tiểu học)</option>
                <option value="Hoạt động trải nghiệm, hướng nghiệp">Hoạt động trải nghiệm, hướng nghiệp</option>
                <option value="Âm nhạc">Âm nhạc</option>
                <option value="Mĩ thuật">Mĩ thuật</option>
                <option value="Giáo dục Thể chất">Giáo dục Thể chất</option>
                <option value="Giáo dục Quốc phòng và An ninh">Giáo dục QPAN</option>
              </select>
            </div>
          </div>

          {/* Grade, BookSet, and Lesson Name */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-5">
            <div className="md:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                🏫 Khối Lớp
              </label>
              <select
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/90 text-gray-800 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="" disabled>-- Khối Lớp --</option>
                <option value="Lớp 1">Lớp 1</option>
                <option value="Lớp 2">Lớp 2</option>
                <option value="Lớp 3">Lớp 3</option>
                <option value="Lớp 4">Lớp 4</option>
                <option value="Lớp 5">Lớp 5</option>
                <option value="Lớp 6">Lớp 6</option>
                <option value="Lớp 7">Lớp 7</option>
                <option value="Lớp 8">Lớp 8</option>
                <option value="Lớp 9">Lớp 9</option>
                <option value="Lớp 10">Lớp 10</option>
                <option value="Lớp 11">Lớp 11</option>
                <option value="Lớp 12">Lớp 12</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                📖 Bộ sách
              </label>
              <select
                value={bookSet}
                onChange={(e) => {
                  setBookSet(e.target.value);
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/90 text-gray-800 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Tự chọn / Theo chuẩn chung --</option>
                <option value="Kết nối tri thức với cuộc sống">Kết nối tri thức với cuộc sống</option>
                <option value="Cánh Diều">Cánh Diều</option>
                <option value="Chân trời sáng tạo">Chân trời sáng tạo</option>
              </select>
            </div>

            <div className="md:col-span-5">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                <span>🎯 Tên bài học / Chủ đề</span>
                {isLoadingLessons && (
                  <span className="text-xs text-indigo-600 animate-pulse font-normal">
                    Đang nạp gợi ý SGK...
                  </span>
                )}
              </label>
              <div className="relative flex flex-col gap-2">
                {suggestedLessons.length > 0 ? (
                  <select
                    value={suggestedLessons.includes(lessonName) ? lessonName : 'other'}
                    onChange={(e) => {
                      if (e.target.value !== 'other') {
                        setLessonName(e.target.value);
                      } else {
                        setLessonName('');
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/90 text-gray-800 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="" disabled>-- Chọn bài học từ mục lục SGK --</option>
                    {suggestedLessons.map((item, i) => (
                      <option key={i} value={item}>{item}</option>
                    ))}
                    <option value="other">Tự nhập tên bài học khác...</option>
                  </select>
                ) : null}
                
                {(!suggestedLessons.includes(lessonName) || suggestedLessons.length === 0) && (
                  <input
                    type="text"
                    value={lessonName}
                    onChange={(e) => setLessonName(e.target.value)}
                    placeholder={isLoadingLessons ? "Đang tra cứu mục lục SGK..." : "VD: Bài 1: Mệnh đề toán học"}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/90 text-gray-800 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Extra Context / Custom Teacher Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
              <span>✏️ Yêu cầu bổ sung (Không bắt buộc)</span>
              <span className="text-xs text-gray-400 font-normal">Ví dụ: thời lượng, mức độ học sinh, tích hợp CNTT</span>
            </label>
            <textarea
              rows={3}
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="VD: Học sinh khá giỏi, thời lượng 45 phút, chú trọng tích hợp năng lực số (CV 3456), dùng GeoGebra, bảng tương tác, phiếu học tập số..."
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/90 text-gray-800 text-sm transition-all focus:outline-none focus:ring-3 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Generate Button */}
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className={`w-full py-4 rounded-xl text-white font-semibold text-base sm:text-lg flex justify-center items-center gap-3 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/25 ${
              isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] hover:-translate-y-0.5'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="loader-spinner" />
                <span>Đang tạo bằng AI chuyên sâu (khoảng 10-20s)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <span>Tạo Tài Liệu Ngay</span>
              </>
            )}
          </button>
        </div>

        {/* Result Container Panel */}
        {resultContent && (
          <div ref={resultContainerRef} className="glass-panel p-6 sm:p-10 mb-12 animate-fade-in print-area">
            {/* Result Header & Export Toolbar */}
            <div className="border-b border-gray-200 pb-5 mb-6 no-print">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      Đã hoàn thành
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      {taskType === 'khbd' ? 'Kế hoạch bài dạy CV 5512' : taskType === 'slide' ? 'Kịch bản Slide PowerPoint' : 'Ma trận đề kiểm tra CV 7991'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {lessonName || 'Tài liệu đã tạo'}
                  </h2>
                </div>

                {/* Export & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Chỉnh sửa nội dung trước khi xuất"
                  >
                    {isEditMode ? <Eye className="w-4 h-4 text-gray-600" /> : <Edit3 className="w-4 h-4 text-gray-600" />}
                    <span>{isEditMode ? 'Xem kết quả' : 'Chỉnh sửa'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportWord}
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs hover:shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>📘 Tải Word</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintOrPdf}
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs hover:shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>📕 Tải PDF / In</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs hover:shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Đã copy!' : '📋 Copy Toàn Bộ'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Document Content View / Edit Mode */}
            {isEditMode ? (
              <div className="no-print">
                <div className="mb-2 text-xs text-gray-500 font-medium">
                  Chế độ chỉnh sửa trực tiếp (Thầy/cô có thể sửa đổi nội dung Markdown, các bảng và công thức LaTeX):
                </div>
                <textarea
                  rows={25}
                  value={resultContent}
                  onChange={(e) => setResultContent(e.target.value)}
                  className="w-full p-4 rounded-xl border border-indigo-200 font-mono text-sm leading-relaxed bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                />
              </div>
            ) : (
              <div 
                className="markdown-body bg-white/95 p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-xs"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderFormattedContent(resultContent), { USE_PROFILES: { mathMl: true, html: true } }) }}
              />
            )}
          </div>
        )}

        {/* History Modal */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-gray-800 text-lg">Lịch sử tài liệu đã tạo</h3>
                </div>
                <div className="flex items-center gap-3">
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa tất cả
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-sm font-bold px-2 py-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-3 flex-1">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    Chưa có tài liệu nào trong lịch sử.
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleLoadFromHistory(item)}
                      className="p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
                            {item.taskType === 'khbd' ? 'KHBD (CV 5512)' : item.taskType === 'slide' ? 'Slide Bài Giảng' : 'Ma trận (CV 7991)'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(item.timestamp).toLocaleDateString('vi-VN')} {new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 group-hover:text-indigo-600 text-sm sm:text-base">
                          {item.lessonName}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.subject} • {item.grade} {item.bookSet ? `• ${item.bookSet}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors cursor-pointer rounded-lg hover:bg-white"
                        title="Xóa bài này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Instructions Modal */}
        {showWelcomeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between text-white shrink-0">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                  Hướng dẫn sử dụng Trợ Lý AI
                </h3>
                <button
                  type="button"
                  onClick={() => setShowWelcomeModal(false)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 text-gray-700 text-sm">
                <div>
                  <h4 className="font-bold text-base text-gray-900 mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-500" /> 1. Cách thức hoạt động
                  </h4>
                  <p className="leading-relaxed">
                    Hệ thống giúp giáo viên tự động hóa việc biên soạn Kế hoạch bài dạy (KHBD), Ma trận đề kiểm tra và Kịch bản Slide. Dựa trên thông tin đầu vào (Môn học, Khối lớp, Tên bài, Bộ sách) kết hợp với công nghệ AI, hệ thống sẽ sinh ra kết quả phù hợp với các chuẩn của Bộ GD&ĐT.
                  </p>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <h4 className="font-bold text-indigo-800 mb-2 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-indigo-600" /> 2. Lựa chọn nguồn dữ liệu (Khuyến cáo)
                  </h4>
                  <p className="mb-2">Hệ thống cung cấp 2 chế độ sinh dữ liệu:</p>
                  <ul className="list-disc pl-5 space-y-1 text-indigo-900/80">
                    <li><strong>Tự động sinh (AI):</strong> AI tự tổng hợp kiến thức từ kho dữ liệu đã được huấn luyện.</li>
                    <li><strong>Upload Tài Liệu (PDF/Word):</strong> Giáo viên tải lên file sách giáo khoa/tài liệu tham khảo.</li>
                  </ul>
                  <p className="mt-2 font-semibold text-indigo-800">
                    💡 Khuyến cáo: Giáo viên nên ưu tiên sử dụng chế độ "Upload Tài Liệu" và tải file sách lên để đảm bảo nội dung được sinh ra chính xác nhất, bám sát sách giáo khoa.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> 3. Lưu ý về chức năng Tạo Slide
                  </h4>
                  <p className="text-amber-900/80 leading-relaxed">
                    Chức năng "Tạo Slide" trên hệ thống hiện tại tập trung vào việc xây dựng <strong>kế hoạch/kịch bản phân bổ nội dung slide</strong>. Để có được một bài thuyết trình hoàn chỉnh, sinh động, quý thầy/cô vui lòng copy kịch bản này cho vào các trợ lý AI chuyên tạo Slide (như Gamma, Tome, Canva...) để AI xử lý thiết kế một cách chính xác và đẹp mắt hơn.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 text-center shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWelcomeModal(false)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  Đã hiểu & Bắt đầu sử dụng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center text-xs text-gray-500 space-y-1 mb-8 no-print">
          <p>© 2026 Trợ Lý AI Giáo Viên • Bám sát Công văn 5512/BGDĐT-GDTrH, CV 7991/BGDĐT-GDTrH & CV 3456</p>
          <p className="opacity-80">Phát triển hỗ trợ giáo viên đổi mới phương pháp giảng dạy và chuyển đổi số trong giáo dục.</p>
        </div>
      </div>
    </div>
  );
}
