<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import { api } from "../api/client";

type DocItem = {
  id: string;
  original_name: string;
  mime: string;
  size: number;
  status: "pending" | "indexing" | "ready" | "failed";
  chunk_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const items = ref<DocItem[]>([]);
const loading = ref(false);
const keyword = ref("");
const uploadVisible = ref(false);
const uploadKey = ref(0);
const uploading = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const filteredItems = computed(() => {
  const k = keyword.value.trim().toLowerCase();
  if (!k) return items.value;
  return items.value.filter((row) =>
    row.original_name.toLowerCase().includes(k)
  );
});

const totalCount = computed(() => items.value.length);
const filteredCount = computed(() => filteredItems.value.length);
const failedCount = computed(
  () => filteredItems.value.filter((i) => i.status === "failed").length
);

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get<{ items: DocItem[] }>("/documents");
    items.value = data.items;
  } finally {
    loading.value = false;
  }
}

function needsPoll(list: DocItem[]) {
  return list.some((d) => d.status === "pending" || d.status === "indexing");
}

function openUploadDialog() {
  uploadKey.value += 1;
  uploadVisible.value = true;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

onMounted(async () => {
  await load();
  timer = setInterval(async () => {
    if (!needsPoll(items.value)) return;
    await load();
  }, 2500);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

async function customUpload(options: UploadRequestOptions) {
  uploading.value = true;
  const fd = new FormData();
  fd.append("file", options.file as File);
  try {
    await api.post("/documents", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    ElMessage.success("上传成功，正在索引…");
    uploadVisible.value = false;
    await load();
    options.onSuccess?.({} as never);
  } catch (e) {
    options.onError?.(e as never);
    ElMessage.error("上传失败");
  } finally {
    uploading.value = false;
  }
}

async function removeRow(row: DocItem) {
  await ElMessageBox.confirm(`确定删除「${row.original_name}」？`, "确认", {
    type: "warning",
  });
  await api.delete(`/documents/${row.id}`);
  ElMessage.success("已删除");
  await load();
}

async function reindex(row: DocItem) {
  await api.post(`/documents/${row.id}/reindex`);
  ElMessage.success("已加入重建队列");
  await load();
}

function statusTag(status: DocItem["status"]) {
  const map: Record<DocItem["status"], "info" | "warning" | "success" | "danger"> =
  {
    pending: "info",
    indexing: "warning",
    ready: "success",
    failed: "danger",
  };
  return map[status];
}

function statusText(status: DocItem["status"]) {
  const map: Record<DocItem["status"], string> = {
    pending: "待索引",
    indexing: "索引中",
    ready: "就绪",
    failed: "失败",
  };
  return map[status];
}
</script>

<template>
  <div class="page-documents">
    <header class="hero">
      <div class="hero-accent" aria-hidden="true" />
      <div class="hero-copy">
        <!-- <span class="hero-eyebrow">文档中心</span> -->
        <h1 class="page-title">文档管理</h1>
        <p class="page-sub">
          上传 PDF / Word 后自动解析并向量化，供智能问答检索使用。
        </p>
      </div>
      <div class="hero-stats" v-if="totalCount > 0">
        <div class="stat-chip">
          <span class="stat-value">{{ totalCount }}</span>
          <span class="stat-label">份文档</span>
        </div>
      </div>
    </header>

    <el-card shadow="never" class="surface-card">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-input v-model="keyword" class="search-input" clearable size="large" placeholder="搜索文件名…">
            <template #prefix>
              <span class="search-prefix" aria-hidden="true" />
            </template>
          </el-input>
          <span v-if="totalCount > 0" class="toolbar-meta">
            显示 <strong>{{ filteredCount }}</strong> / {{ totalCount }} 条
          </span>
        </div>
        <div class="toolbar-actions">
          <el-button size="large" :loading="loading" @click="load">
            刷新
          </el-button>
          <el-button type="primary" size="large" @click="openUploadDialog">
            上传文档
          </el-button>
        </div>
      </div>

      <div class="table-wrap">
        <el-table :data="filteredItems" stripe v-loading="loading" class="doc-table" empty-text="暂无文档，或没有符合搜索条件的记录"
          :header-cell-style="{
            fontWeight: '600',
            fontSize: '13px',
            color: 'var(--el-text-color-secondary)',
          }">
          <el-table-column type="index" label="#" width="52" align="center" />
          <el-table-column prop="original_name" label="文件名" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="file-name">
                <span class="file-dot" aria-hidden="true" />
                {{ row.original_name }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="108" align="right">
            <template #default="{ row }">
              <span class="mono muted">{{ formatSize(row.size) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="112" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status)" size="small" effect="light" round>
                {{ statusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="chunk_count" label="片段数" width="96" align="center">
            <template #default="{ row }">
              <span class="mono">{{ row.chunk_count }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="updated_at" label="更新时间" min-width="160">
            <template #default="{ row }">
              <span class="muted">{{ row.updated_at }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="168" fixed="right" align="right">
            <template #default="{ row }">
              <el-button type="primary" link @click="reindex(row)">
                重建索引
              </el-button>
              <el-button type="danger" link @click="removeRow(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <section v-if="failedCount > 0" class="fail-section">
        <div class="fail-section-head">
          <span class="fail-section-title">索引异常</span>
          <span class="fail-section-count">{{ failedCount }} 条</span>
        </div>
        <el-alert v-for="row in filteredItems.filter((i) => i.status === 'failed')" :key="row.id" class="fail-banner"
          type="error" :title="row.original_name" :description="row.error_message || '未知错误'" show-icon
          :closable="false" />
      </section>
    </el-card>

    <el-dialog v-model="uploadVisible" title="上传文档" width="520px" destroy-on-close align-center append-to-body
      class="upload-dialog" :close-on-click-modal="!uploading" :close-on-press-escape="!uploading">
      <p class="dialog-tip">
        支持 <strong>PDF</strong>、<strong>DOCX</strong>，单文件不超过 50MB。上传后将自动加入索引队列。
      </p>
      <el-upload :key="uploadKey" class="dialog-uploader" drag :show-file-list="true" :disabled="uploading"
        :http-request="customUpload" accept=".pdf,.docx">
        <div class="upload-drop-inner">
          <div class="upload-graphic" aria-hidden="true" />
          <div class="upload-text">将文件拖到此处，或 <em>点击选择</em></div>
          <div class="upload-hint">
            每次选择一个文件；可关闭对话框后再次上传更多。
          </div>
        </div>
      </el-upload>
      <template #footer>
        <el-button size="large" @click="uploadVisible = false" :disabled="uploading">
          关闭
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-documents {
  max-width: 1120px;
  margin: 0 auto;
  padding: 4px 0 40px;
}

.hero {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 28px;
}

.hero-accent {
  width: 4px;
  min-height: 54px;
  margin-top: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg,
      var(--el-color-primary),
      var(--el-color-primary-light-5));
  flex-shrink: 0;
  opacity: 0.9;
}

.hero-copy {
  flex: 1;
  min-width: 0;
}

.hero-eyebrow {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 10px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.page-sub {
  margin: 0;
  max-width: 520px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.hero-stats {
  flex-shrink: 0;
  padding-top: 8px;
}

.stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  padding: 12px 16px;
  border-radius: var(--nm-radius-sm, 14px);
  background: linear-gradient(145deg, var(--nm-surface-2, #f2f5fa), var(--nm-surface, #eef1f7));
  border: none;
  box-shadow: var(--nm-raise-sm);
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.1;
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.surface-card {
  border-radius: var(--nm-radius-lg, 22px);
  border: none;
  background: linear-gradient(145deg, var(--nm-surface-2, #f2f5fa), var(--nm-surface, #eef1f7));
  box-shadow: var(--nm-raise);
}

.surface-card :deep(.el-card__body) {
  padding: 20px 22px 22px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 4px 4px 20px;
  margin: 0 -4px 4px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.search-input {
  width: min(320px, 100%);
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  transition: box-shadow 0.2s ease, background 0.2s ease;
}

.search-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color-hover) inset;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
}

.search-prefix {
  display: block;
  width: 14px;
  height: 14px;
  margin: 0 2px;
  border: 2px solid var(--el-text-color-placeholder);
  border-radius: 50%;
  position: relative;
  opacity: 0.65;
}

.search-prefix::after {
  content: "";
  position: absolute;
  width: 6px;
  height: 2px;
  background: var(--el-text-color-placeholder);
  border-radius: 1px;
  right: -4px;
  bottom: -1px;
  transform: rotate(45deg);
}

.toolbar-meta {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.toolbar-meta strong {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.toolbar-actions {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.toolbar-actions :deep(.el-button) {
  border-radius: 10px;
  padding-left: 18px;
  padding-right: 18px;
}

.table-wrap {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-extra-light);
  background: var(--el-fill-color-blank);
}

.doc-table {
  width: 100%;
  --el-table-border-color: transparent;
}

.doc-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.doc-table :deep(.el-table__header-wrapper th.el-table__cell) {
  background: var(--el-fill-color-light) !important;
  border-bottom: 1px solid var(--el-border-color-lighter) !important;
}

.doc-table :deep(.el-table__body .el-table__cell) {
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.doc-table :deep(.el-table__body tr:hover > td.el-table__cell) {
  background: var(--el-fill-color-lighter) !important;
}

.doc-table :deep(.el-table__empty-block) {
  padding: 48px 16px;
}

.file-name {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.file-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg,
      var(--el-color-primary-light-3),
      var(--el-color-primary));
  flex-shrink: 0;
}

.mono {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.fail-section {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.fail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.fail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-danger);
}

.fail-section-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.fail-banner {
  margin-top: 10px;
  border-radius: 10px;
}

.fail-banner:first-of-type {
  margin-top: 0;
}

.dialog-tip {
  margin: 0 0 18px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.dialog-tip strong {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.dialog-uploader {
  width: 100%;
}

.upload-drop-inner {
  padding: 12px 0 8px;
  text-align: center;
}

.upload-graphic {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 14px;
  background: linear-gradient(145deg,
      var(--el-color-primary-light-7),
      var(--el-color-primary-light-9));
  border: 1px dashed var(--el-color-primary-light-5);
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.upload-graphic::after {
  content: "";
  position: absolute;
  inset: 14px 12px;
  border-radius: 6px;
  background: var(--el-color-primary-light-5);
  opacity: 0.95;
}

.dialog-uploader :deep(.el-upload-dragger:hover .upload-graphic) {
  transform: scale(1.04);
  box-shadow: var(--nm-raise-sm);
}

.upload-text {
  font-size: 15px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.upload-text em {
  color: var(--el-color-primary);
  font-style: normal;
  font-weight: 600;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.5;
}

.dialog-uploader :deep(.el-upload-dragger) {
  padding: 32px 20px 26px;
  border-radius: 14px;
  border-style: dashed;
  border-width: 1.5px;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.dialog-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}
</style>

<style>
.upload-dialog.el-dialog {
  border-radius: 16px;
  overflow: hidden;
}

.upload-dialog .el-dialog__header {
  padding: 20px 22px 12px;
  margin: 0;
}

.upload-dialog .el-dialog__title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.upload-dialog .el-dialog__body {
  padding: 8px 22px 10px;
}

.upload-dialog .el-dialog__footer {
  padding: 12px 22px 20px;
}
</style>
