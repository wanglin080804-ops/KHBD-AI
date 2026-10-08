import os
import re

app_path = "src/App.tsx"
server_path = "server.ts"

with open(app_path, "r", encoding="utf-8") as f:
    app_code = f.read()

# 1. Move slicePdf outside App component
slice_pdf_code = """  const slicePdf = async (file: File, start: number, end: number): Promise<File> => {
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
    return new File([pdfBytes], `sliced_${file.name}`, { type: 'application/pdf' });
  };"""
app_code = app_code.replace(slice_pdf_code, "")
app_code = app_code.replace("export default function App() {", slice_pdf_code.replace("  const", "const") + "\n\nexport default function App() {")

# 2. Add states for analyzing
state_insert = """  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);
  const [extractedLessons, setExtractedLessons] = useState<string[]>([]);"""
app_code = app_code.replace("  const [fileUrl, setFileUrl] = useState<string>('');", f"  const [fileUrl, setFileUrl] = useState<string>('');\n{state_insert}")

# 3. Add handleAnalyzeFile function
analyze_func = """  const handleAnalyzeFile = async (file: File) => {
    setIsAnalyzingFile(true);
    setExtractedLessons([]);
    let fileToUpload = file;
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const maxPages = Math.min(10, pdfDoc.getPageCount()); // get first 10 pages for TOC
        fileToUpload = await slicePdf(file, 1, maxPages);
      }
      
      const formData = new FormData();
      formData.append('file', fileToUpload);
      let keyToSend = apiKeyInput.trim() === TEST_KEY_MSG ? getDecodedKey() : apiKeyInput.trim();
      formData.append('apiKey', keyToSend);

      const res = await fetch('/api/analyze-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.type === 'book' && data.lessons && Array.isArray(data.lessons)) {
         setExtractedLessons(data.lessons);
         showToast(`Đã tìm thấy ${data.lessons.length} bài học trong sách!`, "success");
      } else if (data.type === 'single' && data.title) {
         setLessonName(data.title);
         showToast(`Đã lấy Tên bài học: ${data.title}`, "success");
      }
    } catch (err) {
      console.error(err);
      // Fail silently for user
    } finally {
      setIsAnalyzingFile(false);
    }
  };"""
app_code = app_code.replace("  const handleGenerate = async () => {", analyze_func + "\n\n  const handleGenerate = async () => {")

# 4. Modify file input onChange
old_onchange = """                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                  if (file && file.type === 'application/pdf') {
                    setFileUrl(URL.createObjectURL(file));
                  } else {
                    setFileUrl('');
                  }
                }}"""
new_onchange = """                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                  if (file && file.type === 'application/pdf') {
                    setFileUrl(URL.createObjectURL(file));
                  } else {
                    setFileUrl('');
                  }
                  if (file) {
                    handleAnalyzeFile(file);
                  }
                }}"""
app_code = app_code.replace(old_onchange, new_onchange)

# 5. Add UI elements for analysis results
ui_insert = """              {isAnalyzingFile && (
                <div className="text-sm text-indigo-600 font-medium animate-pulse mb-4 flex items-center gap-2">
                   <span className="loader-spinner !w-4 !h-4 !border-indigo-600 !border-t-transparent"></span>
                   🤖 Trợ lý AI đang lướt nhanh file để tìm Tên bài học / Mục lục...
                </div>
              )}
              {extractedLessons.length > 0 && (
                <div className="mb-4 p-3 bg-indigo-600/5 rounded-xl border border-indigo-200">
                   <label className="block text-sm font-semibold text-gray-700 mb-1">
                     📑 Đã phát hiện Mục lục trong sách. Hãy chọn bài học:
                   </label>
                   <select 
                     value={lessonName}
                     onChange={(e) => setLessonName(e.target.value)}
                     className="w-full p-2.5 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                   >
                      <option value="">-- Bấm để chọn bài học --</option>
                      {extractedLessons.map((l, i) => <option key={i} value={l}>{l}</option>)}
                   </select>
                </div>
              )}"""
app_code = app_code.replace("""              <div className="flex gap-4">""", ui_insert + """\n              <div className="flex gap-4">""")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(app_code)


with open(server_path, "r", encoding="utf-8") as f:
    server_code = f.read()

# Add /api/analyze-file endpoint
analyze_api = """
app.post('/api/analyze-file', upload.single('file'), async (req, res) => {
  try {
    const { apiKey: userKey } = req.body;
    const uploadedFile = req.file;
    if (!uploadedFile) return res.status(400).json({ error: 'No file' });

    const key = resolveApiKey(userKey);
    if (!key) return res.status(400).json({ error: 'Missing API Key' });

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const uploadResult = await ai.files.upload({
       file: uploadedFile.path,
       config: { mimeType: uploadedFile.mimetype }
    });

    const prompt = `Phân tích tài liệu này. Đây là sách giáo khoa hay một bài học/giáo án lẻ?
Nếu là sách giáo khoa có nhiều bài, hãy trích xuất tất cả các tên bài học (Mục lục) và trả về JSON chuẩn xác: {"type": "book", "lessons": ["Bài 1: ...", "Bài 2: ..."]}
Nếu là bài lẻ hoặc không tìm thấy mục lục dài, trích xuất tên bài học chính và trả về JSON: {"type": "single", "title": "Tên bài học"}
CHÚ Ý: Chỉ trả về chuỗi JSON hợp lệ, không có markdown block hay văn bản nào khác. Không giải thích.`;

    const aiContents = [
       {
           fileData: {
               mimeType: uploadResult.mimeType || uploadedFile.mimetype,
               fileUri: uploadResult.uri
           }
       },
       prompt
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: aiContents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);

    let raw = response.text || '{}';
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return res.json(JSON.parse(raw));
  } catch (err: any) {
    console.error('Lỗi khi analyze file:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ error: err?.message });
  }
});
"""

server_code = server_code.replace("app.post('/api/generate',", analyze_api + "\napp.post('/api/generate',")

with open(server_path, "w", encoding="utf-8") as f:
    f.write(server_code)

print("Analyze Patch applied successfully")
