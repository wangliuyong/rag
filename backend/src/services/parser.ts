import mammoth from "mammoth";
import { readFile } from "node:fs/promises";
import pdfParse from "pdf-parse";

export type ParsedDoc = {
  text: string;
  sourceKind: "pdf" | "docx";
};

export async function parseDocument(
  filePath: string,
  mime: string
): Promise<ParsedDoc> {
  const buf = await readFile(filePath);

  if (mime === "application/pdf" || filePath.toLowerCase().endsWith(".pdf")) {
    const data = await pdfParse(buf);
    return { text: data.text ?? "", sourceKind: "pdf" };
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filePath.toLowerCase().endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value ?? "", sourceKind: "docx" };
  }

  throw new Error(`不支持的文件类型: ${mime}`);
}
