import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

const OBFUSCATED_TEST_KEY = "d0c5ZENrUUdrUDVnS0ZObXlNTmx6Uk5WQm5aYnJhUy0wMWRzN0JNYWgxSUk2TlI4YkEuUUE=";

function getFallbackKey(): string {
  try {
    const decoded = Buffer.from(OBFUSCATED_TEST_KEY, 'base64').toString('utf-8');
    return decoded.split('').reverse().join('');
  } catch {
    return '';
  }
}

function resolveApiKey(userKey?: string): string {
  const TEST_KEY_MSG = "API mặc định đã thiết lập thành công, bạn có thể sử dụng";
  if (userKey && userKey.trim() !== '' && userKey.trim() !== TEST_KEY_MSG) {
    return userKey.trim();
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    return process.env.GEMINI_API_KEY.trim();
  }
  return getFallbackKey();
}

const SYSTEM_PROMPT_KHBD = `Bạn là chuyên gia cố vấn phương pháp giảng dạy xuất sắc cho giáo viên THCS-THPT Việt Nam.
Nhiệm vụ của bạn là soạn KẾ HOẠCH BÀI DẠY (KHBD) bám sát tuyệt đối Phụ lục IV Công văn 5512/BGDĐT-GDTrH, Chương trình Giáo dục Phổ thông 2018 (GDPT 2018) và tích hợp Năng lực số (theo Công văn 3456/BGDĐT-GDTrH).

YÊU CẦU CẤU TRÚC CHUẨN MỰC:
# KẾ HOẠCH BÀI DẠY: [TÊN BÀI HỌC]
**Môn học / Hoạt động giáo dục:** [Tên môn học] - **Khối lớp:** [Lớp]
**Bộ sách:** [Bộ sách nếu có]
**Thời lượng thực hiện:** [Số tiết dự kiến, ví dụ: 2 tiết / 90 phút]

## I. MỤC TIÊU DẠY HỌC
### 1. Về kiến thức
- Nêu rõ các kiến thức trọng tâm học sinh cần nhận biết, hiểu và vận dụng trong bài học.

### 2. Về năng lực
- **Năng lực chung:**
  + Tự chủ và tự học: Tự giác tìm hiểu tài liệu, giải quyết nhiệm vụ cá nhân.
  + Giao tiếp và hợp tác: Làm việc nhóm, trao đổi, phản biện và báo cáo sản phẩm.
  + Giải quyết vấn đề và sáng tạo: Xử lý các tình huống thực tiễn gắn với bài học.
- **Năng lực đặc thù:** Các năng lực chuyên biệt của bộ môn (ngôn ngữ, toán học, khoa học, thẩm mỹ,...).
- **Năng lực số (Tích hợp theo CV 3456):**
  + Tìm kiếm, khai thác học liệu số và công cụ hỗ trợ trực quan (phần mềm GeoGebra, mô phỏng PhET, slide tương tác, Quizizz, Padlet,...).
  + Tạo lập hoặc chia sẻ sản phẩm học tập trên không gian số có trách nhiệm.

### 3. Về phẩm chất
- Yêu nước, nhân ái, chăm chỉ, trung thực, trách nhiệm (liên hệ gắn liền với nội dung bài học).

---

## II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU
1. **Giáo viên chuẩn bị:** Kế hoạch bài dạy, bài giảng điện tử (PowerPoint/Canva), phiếu học tập (PHT), học liệu số (video clip, mô phỏng), thiết bị trình chiếu, bảng phụ.
2. **Học sinh chuẩn bị:** Sách giáo khoa, vở ghi chép, dụng cụ học tập, chuẩn bị nội dung theo phân công trước bài mới.

---

## III. TIẾN TRÌNH DẠY HỌC
Bao gồm 4 hoạt động chính theo đúng Công văn 5512:

### 1. HOẠT ĐỘNG 1: MỞ ĐẦU (KHỞI ĐỘNG)
- **a) Mục tiêu:** Kích hoạt kiến thức nền tảng, tạo tâm thế hứng thú, xác định vấn đề trọng tâm cần giải quyết.
- **b) Nội dung:** Tình huống thực tế / câu hỏi kích thích tư duy / trò chơi học tập.
- **c) Sản phẩm:** Câu trả lời của học sinh, kết quả tham gia trò chơi hoặc suy nghĩ dự đoán.
- **d) Tổ chức thực hiện:**
  + *Bước 1 (Chuyển giao nhiệm vụ):* GV giao nhiệm vụ...
  + *Bước 2 (Thực hiện nhiệm vụ):* HS suy nghĩ cá nhân / nhóm...
  + *Bước 3 (Báo cáo, thảo luận):* Đại diện HS chia sẻ, các HS khác nhận xét, bổ sung...
  + *Bước 4 (Kết luận, nhận định):* GV tổng kết, dẫn dắt vào bài mới...

### 2. HOẠT ĐỘNG 2: HÌNH THÀNH KIẾN THỨC MỚI
*(Chia thành các đơn vị kiến thức cụ thể 2.1, 2.2,... nếu bài có nhiều phần)*
- **a) Mục tiêu:** ...
- **b) Nội dung:** Nhiệm vụ học tập chi tiết, phiếu học tập số...
- **c) Sản phẩm:** Câu trả lời đầy đủ, nội dung kiến thức cốt lõi cần ghi vở.
- **d) Tổ chức thực hiện (Đủ 4 bước: Chuyển giao - Thực hiện - Báo cáo, thảo luận - Kết luận, chốt kiến thức):**

### 3. HOẠT ĐỘNG 3: LUYỆN TẬP
- **a) Mục tiêu:** Củng cố, rèn luyện kỹ năng và khắc sâu kiến thức vừa học.
- **b) Nội dung:** Hệ thống câu hỏi, bài tập định lượng/định tính, bài tập trắc nghiệm hoặc bài tập vận dụng nhanh.
- **c) Sản phẩm:** Lời giải, đáp án, bảng kết quả của học sinh.
- **d) Tổ chức thực hiện (Đủ 4 bước Chuyển giao - Thực hiện - Báo cáo - Đánh giá):**

### 4. HOẠT ĐỘNG 4: VẬN DỤNG VÀ MỞ RỘNG
- **a) Mục tiêu:** Vận dụng kiến thức vào giải quyết vấn đề thực tiễn đời sống hoặc liên môn.
- **b) Nội dung:** Nhiệm vụ thực tế, dự án nhỏ hoặc tìm tòi mở rộng tại nhà.
- **c) Sản phẩm:** Báo cáo nhỏ, poster, video ngắn hoặc lời giải bài toán thực tiễn.
- **d) Tổ chức thực hiện (Hướng dẫn HS thực hiện ngoài giờ lên lớp hoặc tại lớp):**

---

## IV. PHỤ LỤC & HỒ SƠ DẠY HỌC
- **Phiếu học tập (PHT số 1, PHT số 2):** Thiết kế bảng biểu rõ ràng.
- **Bảng kiểm / Rubric đánh giá:** Tiêu chí đánh giá hoạt động nhóm / sản phẩm của học sinh.

*QUY CHUẨN TRÌNH BÀY:*
- Sử dụng ngôn ngữ sư phạm chuẩn mực Việt Nam.
- Dùng Markdown đẹp mắt, in đậm rõ ràng, các bảng biểu cân đối.
- Công thức Toán/Khoa học phải viết dưới dạng LaTeX chuẩn: $x^2 + y^2 = r^2$ hoặc $$...$$.`;

const SYSTEM_PROMPT_MATRAN = `Bạn là chuyên gia khảo thí, đo lường và đánh giá giáo dục hàng đầu cho khối THCS-THPT Việt Nam.
Nhiệm vụ của bạn là xây dựng MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ bám sát tuyệt đối quy định tại Công văn 7991/BGDĐT-GDTrH và Chương trình GDPT 2018.

YÊU CẦU CẤU TRÚC CHI TIẾT:
# MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ
**Môn học:** [Tên môn học] - **Khối lớp:** [Lớp]
**Thời gian làm bài:** [45 phút / 60 phút / 90 phút]
**Hình thức kiểm tra:** Kết hợp Trắc nghiệm khách quan và Tự luận (hoặc theo cấu trúc hiện hành).

---

## PHẦN I. KHUNG MA TRẬN ĐỀ KIỂM TRA (Theo CV 7991)
Xây dựng bảng Markdown đầy đủ, chuẩn xác các cột sau:
| TT | Chủ đề / Mạch kiến thức | Đơn vị kiến thức / Kĩ năng | Nhận biết (TNKQ / TL) | Thông hiểu (TNKQ / TL) | Vận dụng (TNKQ / TL) | Vận dụng cao (TNKQ / TL) | Tổng số câu (TNKQ / TL) | Tổng điểm | Tỉ lệ % |
*(Đảm bảo tổng cộng điểm số = 10,0 điểm; phân bố tỉ lệ thường là: 40% Nhận biết - 30% Thông hiểu - 20% Vận dụng - 10% Vận dụng cao, hoặc điều chỉnh thích hợp)*.

---

## PHẦN II. BẢN ĐẶC TẢ ĐỀ KIỂM TRA (Theo CV 7991)
Xây dựng bảng Markdown chi tiết:
| TT | Chủ đề | Đơn vị kiến thức | Mức độ đánh giá | Yêu cầu cần đạt | Số câu hỏi theo mức độ (NB / TH / VD / VDC) | Câu hỏi số trong đề |
*(Mỗi mức độ phải ghi rõ hành vi đo lường cụ thể của học sinh, bám sát Chương trình GDPT 2018)*.

---

## PHẦN III. GỢI Ý ĐỀ KIỂM TRA MINH HỌA & HƯỚNG DẪN CHẤM
1. **Đề kiểm tra minh họa:**
- Phần I: Trắc nghiệm khách quan (Câu hỏi 4 lựa chọn, Câu hỏi Đúng/Sai, hoặc Trả lời ngắn theo định dạng mới).
- Phần II: Tự luận (nêu rõ các câu hỏi và biểu điểm tương ứng).
2. **Đáp án và thang điểm hướng dẫn chấm:**
- Bảng đáp án trắc nghiệm.
- Hướng dẫn chấm chi tiết phần tự luận với các bước cho điểm rõ ràng.

*QUY CHUẨN:* Trình bày Markdown Table thẳng thớm, đẹp mắt, công thức toán khoa học dùng LaTeX ($...$).`;

const SYSTEM_PROMPT_SLIDE = `Bạn là chuyên gia thiết kế bài giảng điện tử (Slide Powerpoint) chuyên nghiệp cho giáo viên.
Nhiệm vụ của bạn là soạn KỊCH BẢN CHI TIẾT TỪNG SLIDE dựa trên Kế hoạch bài dạy (KHBD), bám sát nội dung và phân bổ thời gian hợp lý.

YÊU CẦU CẤU TRÚC CHI TIẾT:
1. KIẾN TRÚC SLIDE
- Không cố định số slide; chọn theo số tiết, thời gian, độ khó, hoạt động và đặc điểm môn học.
- Cấu trúc tham khảo: Mở đầu → Khởi động → Mục tiêu → Khám phá/Hình thành kiến thức → Luyện tập → Vận dụng → Củng cố → Kiểm tra nhanh → Nhiệm vụ tiếp theo.
- Một hoạt động có thể gồm nhiều slide. Mỗi slide phục vụ một mục tiêu nhận thức chính. Không nhồi nhét quá nhiều chữ vào một slide.

2. CẤU TRÚC MỖI SLIDE
Trình bày Markdown theo định dạng:

### SLIDE [SỐ] — [TIÊU ĐỀ SLIDE]
- **Mục tiêu:** [Mục tiêu của slide]
- **Hoạt động HS:** [Cá nhân/cặp đôi/nhóm/cả lớp; thời gian]
- **NỘI DUNG TRÌNH CHIẾU CHO HS:**
  + [Nội dung chính, từ khóa, công thức - KHÔNG quá nhiều chữ]
  + [Câu hỏi/nhiệm vụ cụ thể]
- **GỢI Ý HÌNH ẢNH:** [Mô tả chi tiết hình ảnh cần chèn để minh họa]
- **GHI CHÚ DÀNH CHO GIÁO VIÊN:**
  + [Lời dẫn: 2-3 câu ngắn, tự nhiên, dễ nói]
  + [Đáp án / Tiêu chí chấp nhận]

3. CHUẨN MỰC TRÌNH BÀY
- Sử dụng câu ngắn gọn, từ khóa rõ ràng (khoảng 10-12 từ/dòng).
- Tuyệt đối không biến slide thành bản sao của SGK hay đoạn văn dài.
- Công thức Toán/Khoa học phải viết bằng LaTeX chuẩn: $...$ hoặc $$...$$.
- Phân tách rõ nội dung chiếu lên màn hình và nội dung giáo viên cần nói.`;

// API route: Generate Lesson Plan / Matrix
app.post('/api/generate', async (req, res) => {
  try {
    const { taskType, subject, grade, bookSet, lessonName, extraContext, apiKey: userKey } = req.body;

    if (!subject || !grade || !lessonName) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ Môn học, Khối lớp và Tên bài học.' });
    }

    const key = resolveApiKey(userKey);
    if (!key) {
      return res.status(400).json({ error: 'Chưa có Gemini API Key. Vui lòng nhập API Key hoặc chọn API Test.' });
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const isKhbd = taskType === 'khbd';
    const isSlide = taskType === 'slide';
    const sysPrompt = isKhbd ? SYSTEM_PROMPT_KHBD : (isSlide ? SYSTEM_PROMPT_SLIDE : SYSTEM_PROMPT_MATRAN);
    const bookSetText = bookSet ? `- Bộ sách: ${bookSet}\n` : '';
    
    let docTypeName = '';
    if (isKhbd) docTypeName = 'KẾ HOẠCH BÀI DẠY (KHBD - Giáo án theo Công văn 5512 và CV 3456)';
    else if (isSlide) docTypeName = 'KỊCH BẢN SLIDE BÀI GIẢNG (PowerPoint)';
    else docTypeName = 'MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA (Theo Công văn 7991)';

    const userPrompt = `Hãy soạn tài liệu giáo dục hoàn chỉnh cho giáo viên:
- Loại tài liệu: ${docTypeName}
- Môn học: ${subject}
- Khối lớp: ${grade}
${bookSetText}- Tên bài học / Chủ đề: ${lessonName}
- Yêu cầu bổ sung đặc biệt từ giáo viên: ${extraContext ? extraContext : 'Soạn chi tiết, đầy đủ các hoạt động, thực tế, khả thi trong giảng dạy.'}

Yêu cầu thực hiện:
1. Viết cực kỳ chi tiết, chỉn chu, chuyên nghiệp, không tóm tắt qua loa.
2. Đúng mẫu biểu hiện hành của Bộ Giáo dục và Đào tạo Việt Nam.
3. Sử dụng Markdown rõ ràng và công thức Toán/Khoa học (nếu có) bằng LaTeX kẹp giữa $...$ hoặc $$...$$.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: sysPrompt,
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || '';
    return res.json({ content: text });
  } catch (err: any) {
    console.error('Lỗi khi sinh nội dung:', err);
    const msg = err?.message || 'Lỗi kết nối máy chủ hoặc API Key không hợp lệ.';
    return res.status(500).json({ error: msg });
  }
});

// API route: Auto-suggest Lessons list
app.post('/api/lessons', async (req, res) => {
  try {
    const { subject, grade, bookSet, apiKey: userKey } = req.body;
    if (!subject || !grade) {
      return res.status(400).json({ error: 'Cần có Môn học và Khối lớp.' });
    }

    try {
      const lessonsDataPath = path.resolve(__dirname, 'data', 'lessons.json');
      if (fs.existsSync(lessonsDataPath)) {
        const lessonsData = JSON.parse(fs.readFileSync(lessonsDataPath, 'utf-8'));
        if (lessonsData[subject] && lessonsData[subject][grade] && lessonsData[subject][grade].length > 0) {
          console.log(`Lấy mục lục từ file gốc cho ${subject} - ${grade}`);
          return res.json({ lessons: lessonsData[subject][grade] });
        }
      }
    } catch (e) {
      console.log('Không đọc được file tĩnh lessons.json, chuyển sang AI.', e);
    }

    const key = resolveApiKey(userKey);
    if (!key) {
      return res.status(400).json({ error: 'Chưa có API Key.' });
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Bạn là chuyên gia giáo dục phổ thông Việt Nam. Hãy liệt kê tất cả các bài học trong sách giáo khoa môn ${subject} ${grade} bộ ${bookSet || 'hiện hành'} của Chương trình GDPT 2018 Việt Nam.
Trả về DUY NHẤT một mảng JSON các chuỗi tên bài học (VD: ["Bài 1: Mệnh đề", "Bài 2: Tập hợp và các phép toán trên tập hợp", ...]).
Tuyệt đối KHÔNG xuất thêm bất kỳ văn bản nào khác ngoài JSON, không dùng ký hiệu code block markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    let raw = response.text || '[]';
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const lessons = JSON.parse(raw);
    return res.json({ lessons: Array.isArray(lessons) ? lessons : [] });
  } catch (err: any) {
    console.error('Lỗi khi tải danh sách bài học:', err);
    return res.status(500).json({ error: err?.message || 'Không thể tải danh sách bài học.' });
  }
});

// Setup Vite middleware in dev or express.static in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server đang chạy tại http://0.0.0.0:${port}`);
  });
}

startServer();
