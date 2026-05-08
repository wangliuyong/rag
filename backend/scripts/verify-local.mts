/**
 * 不依赖 Qdrant / DashScope 的本地校验：切分与基础模块可加载。
 * 完整链路请在启动 Docker 与配置 .env 后手动验收。
 */
import { splitText } from "../src/services/chunker.js";

const sample = `
第一章 请假制度
员工申请年假须提前 5 个工作日提交 OA 流程；病假需提供二级以上医院证明。
第二章 差旅报销
一线城市住宿费上限每晚 600 元，二线城市 450 元。超出部分自理。
${"这是一条用于拉长文本的说明。".repeat(40)}
`;

const chunks = await splitText(sample);
if (chunks.length < 1) {
  console.error("切分结果为空");
  process.exit(1);
}
console.log("verify-local: chunker OK, chunks =", chunks.length);
