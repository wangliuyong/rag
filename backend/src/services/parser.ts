/** 文档解析：根据 MIME / 扩展名选择 PDF 或 DOCX 抽取纯文本 */
import mammoth from "mammoth"; // Word docx 转 HTML/纯文本库
import { readFile } from "node:fs/promises"; // 异步读整个文件为 Buffer
import pdfParse from "pdf-parse"; // PDF 缓冲解析为 text

/** 解析结果：抽取的正文与来源类型（便于日志或后续分渠道优化） */
export type ParsedDoc = {
  text: string; // 全文或尽力抽取的正文（可能含换行）
  sourceKind: "pdf" | "docx"; // 解析分支标识
};

/**
 * 从磁盘路径读取文件并按类型解析为纯文本。
 * @param filePath 绝对路径
 * @param mime HTTP/存储记录的 MIME，用于与扩展名双重判断
 */
export async function parseDocument(
  filePath: string,
  mime: string
): Promise<ParsedDoc> {
  const buf = await readFile(filePath); // 一次性读入内存（大文件场景可后续改为流式）

  if (mime === "application/pdf" || filePath.toLowerCase().endsWith(".pdf")) {
    const data = await pdfParse(buf); // pdf-parse 返回 info + text 等
    return { text: data.text ?? "", sourceKind: "pdf" }; // text 可能 undefined，归一为字符串
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filePath.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: buf }); // 仅要纯文本而非 HTML
    return { text: result.value ?? "", sourceKind: "docx" }; // value 为正文
  }

  throw new Error(`不支持的文件类型: ${mime}`); // 白名单外类型显式失败
}
