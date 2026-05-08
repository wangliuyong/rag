<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import * as echarts from "echarts";
import type { ECharts } from "echarts";
import { api } from "../api/client";

type DocItem = {
  id: string;
  original_name: string;
  mime?: string;
  size?: number;
  status: "pending" | "indexing" | "ready" | "failed";
  chunk_count: number;
  error_message?: string | null;
  created_at?: string;
  updated_at: string;
};

const loading = ref(false);
const items = ref<DocItem[]>([]);
const lineRef = ref<HTMLDivElement | null>(null);
const barRef = ref<HTMLDivElement | null>(null);
let lineChart: ECharts | null = null;
let barChart: ECharts | null = null;

const stats = computed(() => {
  const list = items.value;
  const ready = list.filter((d) => d.status === "ready").length;
  const processing = list.filter(
    (d) => d.status === "pending" || d.status === "indexing"
  ).length;
  const failed = list.filter((d) => d.status === "failed").length;
  return {
    total: list.length,
    ready,
    processing,
    failed,
  };
});

const recentDocs = computed(() =>
  [...items.value]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 10)
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

function buildLineOption() {
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const base = Math.max(0, stats.value.total);
  const data = days.map((_, i) =>
    Math.max(0, Math.round(base * (0.35 + 0.1 * i) + Math.sin(i * 0.7) * 2))
  );
  return {
    backgroundColor: "transparent",
    grid: { left: 44, right: 20, top: 36, bottom: 28 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255,255,255,0.92)",
      borderColor: "rgba(181,168,217,0.35)",
      textStyle: { color: "#5c6478", fontSize: 12 },
    },
    xAxis: {
      type: "category",
      data: days,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "rgba(163,176,198,0.35)" } },
      axisLabel: { color: "#8a93a6", fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisLabel: { color: "#8a93a6", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(163,176,198,0.12)" } },
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        showSymbol: true,
        lineStyle: { width: 2, color: "#b5a8d9" },
        itemStyle: { color: "#d4caeb", borderColor: "#b5a8d9", borderWidth: 1 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(181,168,217,0.38)" },
            { offset: 1, color: "rgba(181,168,217,0)" },
          ]),
        },
        data,
      },
    ],
  };
}

function buildBarOption() {
  const s = stats.value;
  return {
    backgroundColor: "transparent",
    grid: { left: 44, right: 20, top: 28, bottom: 36 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(255,255,255,0.92)",
      borderColor: "rgba(181,168,217,0.35)",
      textStyle: { color: "#5c6478", fontSize: 12 },
    },
    xAxis: {
      type: "category",
      data: ["已就绪", "处理中", "失败"],
      axisLine: { lineStyle: { color: "rgba(163,176,198,0.35)" } },
      axisLabel: { color: "#8a93a6", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      axisLabel: { color: "#8a93a6", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(163,176,198,0.12)" } },
    },
    series: [
      {
        type: "bar",
        barWidth: "42%",
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#d4caeb" },
            { offset: 1, color: "#9b8cc4" },
          ]),
        },
        data: [s.ready, s.processing, s.failed],
      },
    ],
  };
}

function resizeCharts() {
  lineChart?.resize();
  barChart?.resize();
}

function initCharts() {
  if (!lineRef.value || !barRef.value) return;
  if (lineChart) lineChart.dispose();
  if (barChart) barChart.dispose();
  lineChart = echarts.init(lineRef.value, undefined, { renderer: "canvas" });
  barChart = echarts.init(barRef.value, undefined, { renderer: "canvas" });
  lineChart.setOption(buildLineOption());
  barChart.setOption(buildBarOption());
}

onMounted(async () => {
  await load();
  await nextTick();
  initCharts();
  window.addEventListener("resize", resizeCharts);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCharts);
  lineChart?.dispose();
  barChart?.dispose();
  lineChart = null;
  barChart = null;
});

watch(
  items,
  () => {
    nextTick(() => {
      if (!lineChart || !barChart) return;
      lineChart.setOption(buildLineOption());
      barChart.setOption(buildBarOption());
    });
  },
  { deep: true }
);

function statusLabel(s: DocItem["status"]) {
  const m: Record<DocItem["status"], string> = {
    ready: "已就绪",
    pending: "待索引",
    indexing: "索引中",
    failed: "失败",
  };
  return m[s];
}

function statusType(s: DocItem["status"]) {
  const m: Record<DocItem["status"], "success" | "warning" | "info" | "danger"> =
    {
      ready: "success",
      pending: "info",
      indexing: "warning",
      failed: "danger",
    };
  return m[s];
}
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <div class="page-head">
      <h1 class="page-title">数据概览</h1>
      <p class="page-desc">制度文档与索引状态总览</p>
    </div>

    <el-row :gutter="16" class="stat-row">
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card">
          <div class="stat-label">文档总数</div>
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-foot">知识库条目</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card stat-card--accent">
          <div class="stat-label">已就绪</div>
          <div class="stat-value">{{ stats.ready }}</div>
          <div class="stat-foot">可参与问答</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card">
          <div class="stat-label">处理中</div>
          <div class="stat-value">{{ stats.processing }}</div>
          <div class="stat-foot">排队或索引中</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="stat-card stat-card--warn">
          <div class="stat-label">索引失败</div>
          <div class="stat-value">{{ stats.failed }}</div>
          <div class="stat-foot">需检查源文件</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">索引趋势</span>
            <span class="panel-sub">近 7 日（示意）</span>
          </div>
          <div ref="lineRef" class="chart-box" />
        </div>
      </el-col>
      <el-col :xs="24" :lg="10">
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">状态分布</span>
            <span class="panel-sub">当前库</span>
          </div>
          <div ref="barRef" class="chart-box chart-box--sm" />
        </div>
      </el-col>
    </el-row>

    <div class="panel panel--table">
      <div class="panel-head">
        <span class="panel-title">最近文档</span>
        <span class="panel-sub">按更新时间</span>
      </div>
      <el-table
        :data="recentDocs"
        stripe
        class="dash-table"
        empty-text="暂无文档"
      >
        <el-table-column prop="original_name" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="light">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="chunk_count" label="片段数" width="96" align="center" />
        <el-table-column prop="updated_at" label="更新时间" width="170" />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
}

.page-head {
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.page-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-row {
  margin-bottom: 16px;
}

.stat-card {
  border-radius: var(--nm-radius-md, 16px);
  padding: 18px 20px;
  background: linear-gradient(145deg, var(--nm-surface-2, #f2f5fa), var(--nm-surface, #eef1f7));
  border: none;
  box-shadow: var(--nm-raise);
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #c5cfe0, #b5a8d9);
  opacity: 0.75;
}

.stat-card--accent::before {
  background: linear-gradient(90deg, #d4caeb, #b5a8d9);
  opacity: 1;
}

.stat-card--warn::before {
  background: linear-gradient(90deg, #e8d4c8, #d4b8a8);
  opacity: 0.9;
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.04em;
}

.stat-value {
  margin: 10px 0 6px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.stat-foot {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.chart-row {
  margin-bottom: 16px;
}

.panel {
  border-radius: var(--nm-radius-md, 16px);
  padding: 16px 18px 12px;
  background: linear-gradient(145deg, var(--nm-surface-2, #f2f5fa), var(--nm-surface, #eef1f7));
  border: none;
  box-shadow: var(--nm-raise);
  margin-bottom: 16px;
}

.panel--table {
  padding-bottom: 4px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 2px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.panel-sub {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.chart-box {
  width: 100%;
  height: 280px;
}

.chart-box--sm {
  height: 280px;
}

.dash-table {
  width: 100%;
  background: transparent;
}

.dash-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.dash-table :deep(th.el-table__cell) {
  background: rgba(255, 255, 255, 0.45) !important;
  font-weight: 600;
  font-size: 12px;
  color: var(--nm-text, #5c6478) !important;
}

.dash-table :deep(.el-table__cell) {
  border-color: rgba(255, 255, 255, 0.35);
}
</style>
