import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const OBFUSCATED_TEST_KEY = "d0c5ZENrUUdrUDVnS0ZObXlNTmx6Uk5WQm5aYnJhUy0wMWRzN0JNYWgxSUk2TlI4YkEuUUE=";
const key = Buffer.from(OBFUSCATED_TEST_KEY, 'base64').toString('utf-8').split('').reverse().join('');

const ai = new GoogleGenAI({
  apiKey: key,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

async function main() {
  const raw = fs.readFileSync(String.raw`C:\Users\kazek\.gemini\antigravity-ide\brain\91daf143-f4b4-4a86-bcf9-acbd809aaa6b\scratch\toc_out.json`, 'utf-8');
  
  const prompt = `Tôi có kết quả trích xuất text từ các file PDF sách giáo khoa sau đây:
  
${raw.substring(0, 50000)}

  Hãy phân tích và trả về DUY NHẤT một mã JSON có cấu trúc như sau, liệt kê ĐẦY ĐỦ các bài học theo đúng mục lục:
  {
    "Ngữ văn": {
      "Lớp 6": ["Bài 1: ...", "Bài 2: ..."],
      "Lớp 9": [...]
    },
    "Công nghệ (Nông nghiệp/Trồng trọt)": {
      "Lớp 10": [...],
      "Lớp 11": [...],
      "Lớp 12": [...]
    }
  }
  Tuyệt đối không xuất thêm bất kỳ chữ nào ngoài JSON hợp lệ.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    let resText = response.text || '{}';
    resText = resText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    fs.writeFileSync('./data/lessons.json', resText);
    console.log("XONG! Đã tạo data/lessons.json");
  } catch (err) {
    console.error("Lỗi:", err);
  }
}

main();
