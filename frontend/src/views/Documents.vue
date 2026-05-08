<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
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
let timer: ReturnType<typeof setInterval> | null = null;

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
  const fd = new FormData();
  fd.append("file", options.file as File);
  try {
    await api.post("/documents", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    ElMessage.success("上传成功，正在索引…");
    await load();
    options.onSuccess?.({} as never);
  } catch (e) {
    options.onError?.(e as never);
    ElMessage.error("上传失败");
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
  <el-card shadow="never">
    <template #header>
      <div class="header-row">
        <span>制度文档</span>
        <el-button type="primary" link :loading="loading" @click="load">
          刷新
        </el-button>
      </div>
    </template>

    <el-upload
      class="uploader"
      drag
      :show-file-list="false"
      :http-request="customUpload"
      accept=".pdf,.docx"
    >
      <div class="upload-inner">
        <div class="upload-title">拖拽文件到此处</div>
        <div class="upload-sub">或 <em>点击选择</em> PDF / DOCX</div>
      </div>
      <template #tip>
        <div class="el-upload__tip">单文件最大 50MB，上传后自动解析并向量化。</div>
      </template>
    </el-upload>

    <el-table :data="items" stripe class="mt" v-loading="loading">
      <el-table-column prop="original_name" label="文件名" min-width="200" />
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status)" size="small">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="chunk_count" label="片段数" width="100" />
      <el-table-column prop="updated_at" label="更新时间" width="180" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="reindex(row)">
            重建索引
          </el-button>
          <el-button type="danger" link size="small" @click="removeRow(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-alert
      v-for="row in items.filter((i) => i.status === 'failed')"
      :key="row.id"
      class="mt"
      type="error"
      :title="row.original_name"
      :description="row.error_message || '未知错误'"
      show-icon
      :closable="false"
    />
  </el-card>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.uploader {
  width: 100%;
}
.upload-inner {
  padding: 24px 0;
  text-align: center;
  color: var(--el-text-color-regular);
}
.upload-title {
  font-size: 16px;
  margin-bottom: 8px;
}
.upload-sub em {
  color: var(--el-color-primary);
  font-style: normal;
}
.mt {
  margin-top: 16px;
}
</style>
