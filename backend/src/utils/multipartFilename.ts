/**
 * 修正 multipart 上传中的原始文件名编码。
 *
 * HTTP Content-Disposition 里 filename 常见两种现象：
 * 1）浏览器发 UTF-8 字节，解析库按 ISO-8859-1（latin1）塞进 JS 字符串 → 表现为类似「æµ‹è¯•」的乱码，
 *    且每个字符码点均 ≤255，可用 Buffer latin1→utf8 还原。
 * 2）解析库已正确得到 Unicode（含中文），字符码点会 >255，此时禁止再做 latin1 转换，否则会损坏文件名。
 */
import path from "node:path"; // basename：丢弃路径穿越片段

/**
 * @param raw Multer 提供的 originalname（可能已乱码）
 * @returns 尽量还原为 UTF-8 显示名；去掉路径与 NUL
 */
export function decodeMultipartFilename(raw: string): string {
  if (raw == null || typeof raw !== "string") {
    return ""; // 兜底：空串避免后续 DB NOT NULL 除非 schema 允许
  }
  // 统一分隔符后取最后一段，防止客户端传 "../../x.pdf"
  const base = path.basename(raw.replace(/\\/g, "/")).replace(/\0/g, "");
  if (base === "") return "";

  // 若存在任一字符码点 >255，视为已是合法 Unicode，不再按 latin1  reinterpret
  const looksLikeUtf8MisreadAsLatin1 = [...base].every(
    (ch) => ch.charCodeAt(0) <= 255
  );
  if (!looksLikeUtf8MisreadAsLatin1) {
    return base;
  }

  try {
    return Buffer.from(base, "latin1").toString("utf8").replace(/\0/g, "");
  } catch {
    return base;
  }
}
