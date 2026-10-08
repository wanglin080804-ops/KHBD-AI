import os

app_path = "src/App.tsx"
server_path = "server.ts"

with open(app_path, "r", encoding="utf-8") as f:
    app_code = f.read()

# 1. Imports
app_code = app_code.replace("import katex from 'katex';", "import katex from 'katex';\nimport { PDFDocument } from 'pdf-lib';")

# 2. States
state_insert = """  const [inputMode, setInputMode] = useState<'ai' | 'upload'>('ai');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pageStart, setPageStart] = useState<string>('');
  const [pageEnd, setPageEnd] = useState<string>('');"""
app_code = app_code.replace("  const [extraContext, setExtraContext] = useState<string>('');", f"  const [extraContext, setExtraContext] = useState<string>('');\n{state_insert}")

# 3. slicePdf & handleGenerate validation
handle_gen_old = """  const handleGenerate = async () => {
    if (!subject.trim() || !grade.trim() || !lessonName.trim()) {
      showToast("Vui lòng điền đầy đủ Môn học, Khối Lớp và Tên bài học!", "error");
      return;
    }"""
handle_gen_new = """  const slicePdf = async (file: File, start: number, end: number): Promise<File> => {
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
  };

  const handleGenerate = async () => {
    if (inputMode === 'ai' && (!subject.trim() || !grade.trim() || !lessonName.trim())) {
      showToast("Vui lòng điền đầy đủ Môn học, Khối Lớp và Tên bài học!", "error");
      return;
    }
    if (inputMode === 'upload' && !uploadFile) {
      showToast("Vui lòng tải lên tài liệu!", "error");
      return;
    }
    if (inputMode === 'upload' && !lessonName.trim()) {
      showToast("Vui lòng nhập tên bài học!", "error");
      return;
    }"""
app_code = app_code.replace(handle_gen_old, handle_gen_new)

# 4. API Call
fetch_old = """      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType,
          subject: subject.trim(),
          grade: grade.trim(),
          bookSet: bookSet.trim(),
          lessonName: lessonName.trim(),
          extraContext: extraContext.trim(),
          apiKey: keyToSend
        })
      });"""
fetch_new = """      const formData = new FormData();
      formData.append('taskType', taskType);
      formData.append('subject', subject.trim());
      formData.append('grade', grade.trim());
      formData.append('bookSet', bookSet.trim());
      formData.append('lessonName', lessonName.trim());
      formData.append('extraContext', extraContext.trim());
      formData.append('apiKey', keyToSend);
      formData.append('inputMode', inputMode);

      if (inputMode === 'upload' && uploadFile) {
        if (uploadFile.name.toLowerCase().endsWith('.pdf') && pageStart && pageEnd) {
          const start = parseInt(pageStart);
          const end = parseInt(pageEnd);
          if (start > 0 && end >= start) {
            const slicedFile = await slicePdf(uploadFile, start, end);
            formData.append('file', slicedFile);
          } else {
             throw new Error("Trang bắt đầu và kết thúc không hợp lệ");
          }
        } else {
          formData.append('file', uploadFile);
          if (pageStart || pageEnd) {
             formData.append('pageRange', `Từ trang ${pageStart} đến trang ${pageEnd}`);
          }
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData
      });"""
app_code = app_code.replace(fetch_old, fetch_new)

# 5. UI Elements
ui_insert = """          {/* Input Mode Toggle */}
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
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full mb-4 bg-white p-2 rounded border border-gray-300"
              />
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Từ trang số</label>
                  <input type="number" value={pageStart} onChange={e => setPageStart(e.target.value)} placeholder="VD: 15" className="w-full p-2 border rounded" />
                </div>
                <div className="flex-1">
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
"""
app_code = app_code.replace("          {/* Document Type & Subject */}", ui_insert + "\n          {/* Document Type & Subject */}")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(app_code)


with open(server_path, "r", encoding="utf-8") as f:
    server_code = f.read()

server_code = server_code.replace("import express from 'express';", "import express from 'express';\nimport multer from 'multer';")

server_code = server_code.replace("const app = express();\napp.use(express.json({ limit: '10mb' }));", "const app = express();\napp.use(express.json({ limit: '50mb' }));\n\nconst upload = multer({ dest: 'uploads/' });")

generate_old = "app.post('/api/generate', async (req, res) => {"
generate_new = "app.post('/api/generate', upload.single('file'), async (req, res) => {"
server_code = server_code.replace(generate_old, generate_new)

body_old = "    const { taskType, subject, grade, bookSet, lessonName, extraContext, apiKey: userKey } = req.body;"
body_new = "    const { taskType, subject, grade, bookSet, lessonName, extraContext, apiKey: userKey, inputMode, pageRange } = req.body;\n    const uploadedFile = req.file;"
server_code = server_code.replace(body_old, body_new)

prompt_old = """    const userPrompt = `Hãy soạn tài liệu giáo dục hoàn chỉnh cho giáo viên:
- Loại tài liệu: ${docTypeName}
- Môn học: ${subject}
- Khối lớp: ${grade}
${bookSetText}- Tên bài học / Chủ đề: ${lessonName}
- Yêu cầu bổ sung đặc biệt từ giáo viên: ${extraContext ? extraContext : 'Soạn chi tiết, đầy đủ các hoạt động, thực tế, khả thi trong giảng dạy.'}

Yêu cầu thực hiện:
1. Viết cực kỳ chi tiết, chỉn chu, chuyên nghiệp, không tóm tắt qua loa.
2. Đúng mẫu biểu hiện hành của Bộ Giáo dục và Đào tạo Việt Nam.
3. Sử dụng Markdown rõ ràng và công thức Toán/Khoa học (nếu có) bằng LaTeX kẹp giữa $...$ hoặc $$...$$.`;"""

prompt_new = """    let userPrompt = `Hãy soạn tài liệu giáo dục hoàn chỉnh cho giáo viên:
- Loại tài liệu: ${docTypeName}
- Môn học: ${subject}
- Khối lớp: ${grade}
${bookSetText}- Tên bài học / Chủ đề: ${lessonName}
- Yêu cầu bổ sung đặc biệt từ giáo viên: ${extraContext ? extraContext : 'Soạn chi tiết, đầy đủ các hoạt động, thực tế, khả thi trong giảng dạy.'}`;

    if (inputMode === 'upload' && uploadedFile) {
       if (pageRange) {
         userPrompt += `\\n\\nCHÚ Ý QUAN TRỌNG: Hãy CHỈ sử dụng nội dung từ file đính kèm (tập trung vào đoạn ${pageRange}) để soạn bài. Tuyệt đối bám sát nội dung file, không bịa thêm kiến thức ngoài.`;
       } else {
         userPrompt += `\\n\\nCHÚ Ý QUAN TRỌNG: Hãy sử dụng nội dung từ file đính kèm để soạn bài. Tuyệt đối bám sát nội dung file.`;
       }
    }

    userPrompt += `\\n\\nYêu cầu thực hiện:
1. Viết cực kỳ chi tiết, chỉn chu, chuyên nghiệp, không tóm tắt qua loa.
2. Đúng mẫu biểu hiện hành của Bộ Giáo dục và Đào tạo Việt Nam.
3. Sử dụng Markdown rõ ràng và công thức Toán/Khoa học (nếu có) bằng LaTeX kẹp giữa $...$ hoặc $$...$$.`;

    let aiContents: any = userPrompt;
    
    let uploadResult;
    if (inputMode === 'upload' && uploadedFile) {
       uploadResult = await ai.files.upload({
          file: uploadedFile.path,
          mimeType: uploadedFile.mimetype,
       });
       aiContents = [uploadResult, userPrompt];
    }"""
server_code = server_code.replace(prompt_old, prompt_new)

gen_call_old = """    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: sysPrompt,
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
      },
    });"""
gen_call_new = """    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using latest model supporting files efficiently
      contents: aiContents,
      config: {
        systemInstruction: sysPrompt,
        temperature: 0.7,
      },
    });

    if (uploadedFile && os.path.exists(uploadedFile.path)) {
       os.unlink(uploadedFile.path);
    }
"""
server_code = server_code.replace(gen_call_old, gen_call_new)

# One more fix: os module is python, in server.ts we need fs!
server_code = server_code.replace("if (uploadedFile && os.path.exists(uploadedFile.path)) {\n       os.unlink(uploadedFile.path);\n    }", "if (uploadedFile && fs.existsSync(uploadedFile.path)) {\n       fs.unlinkSync(uploadedFile.path);\n    }")


with open(server_path, "w", encoding="utf-8") as f:
    f.write(server_code)

print("Patch applied successfully")
