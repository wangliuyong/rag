<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowRef } from "vue";
import * as echarts from "echarts";
import type { ECharts } from "echarts";

const lineRef = ref<HTMLDivElement | null>(null);
const barRef = ref<HTMLDivElement | null>(null);
const lineChart = shallowRef<ECharts | null>(null);
const barChart = shallowRef<ECharts | null>(null);

const axisColor = "#64748b";
const splitColor = "rgba(100, 116, 139, 0.12)";
const lineColor = "#7aa3c9";
const barPrimary = "#6b8fb8";
const barMuted = "rgba(107, 143, 184, 0.45)";

const tableRows = [
  { name: "制度汇编 2025.pdf", type: "PDF", size: "2.4 MB", status: "就绪", time: "2026-05-07 14:22" },
  { name: "员工手册.docx", type: "DOCX", size: "890 KB", status: "索引中", time: "2026-05-08 09:10" },
  { name: "安全规范.pdf", type: "PDF", size: "1.1 MB", status: "就绪", time: "2026-05-06 16:45" },
  { name: "流程说明.docx", type: "DOCX", size: "320 KB", status: "待索引", time: "2026-05-08 11:02" },
  { name: "合规检查清单.pdf", type: "PDF", size: "3.8 MB", status: "就绪", time: "2026-05-05 10:18" },
];

function chartBase() {
  return {
    textStyle: { fontFamily: "system-ui, 'PingFang SC', sans-serif" },
    grid: { left: 48, right: 20, top: 36, bottom: 28 },
  };
}

function initCharts() {
  if (!lineRef.value || !barRef.value) return;
  lineChart.value?.dispose();
  barChart.value?.dispose();

  const line = echarts.init(lineRef.value, undefined, { renderer: "canvas" });
  line.setOption({
    ...chartBase(),
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: splitColor } },
      axisLine: { show: false },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    series: [
      {
        name: "问答量",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2, color: lineColor },
        itemStyle: { color: lineColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(122, 163, 201, 0.35)" },
            { offset: 1, color: "rgba(122, 163, 201, 0.02)" },
          ]),
        },
        data: [120, 182, 151, 234, 290, 330, 310],
      },
    ],
  });

  const bar = echarts.init(barRef.value, undefined, { renderer: "canvas" });
  bar.setOption({
    ...chartBase(),
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: ["人事", "财务", "合规", "研发", "行政"],
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: splitColor } },
      axisLine: { show: false },
      axisLabel: { color: axisColor, fontSize: 11 },
    },
    series: [
      {
        name: "文档数",
        type: "bar",
        barWidth: "44%",
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: barPrimary },
            { offset: 1, color: barMuted },
          ]),
        },
        data: [42, 38, 56, 71, 33],
      },
    ],
  });

  lineChart.value = line;
  barChart.value = bar;
}

function resizeCharts() {
  lineChart.value?.resize();
  barChart.value?.resize();
}

let ro: ResizeObserver | null = null;

onMounted(async () => {
  await nextTick();
  initCharts();
  window.addEventListener("resize", resizeCharts);
  ro = new ResizeObserver(() => resizeCharts());
  if (lineRef.value) ro.observe(lineRef.value);
  if (barRef.value) ro.observe(barRef.value);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCharts);
  ro?.disconnect();
  lineChart.value?.dispose();
  barChart.value?.dispose();
  lineChart.value = null;
  barChart.value = null;
});
</script>

<template>
  <div class="dash">
    <header class="dash-head">
      <h1 class="dash-title">数据总览</h1>
      <p class="dash-sub">文档索引与智能问答运行态势（示例数据）</p>
    </header>

    <section class="stat-grid" aria-label="核心指标">
      <div class="stat-card">
        <span class="stat-label">文档总数</span>
        <strong class="stat-value">248</strong>
        <span class="stat-trend up">+12.4% 较上周</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">已向量化片段</span>
        <strong class="stat-value">18.6k</strong>
        <span class="stat-trend up">+8.1%</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">近 7 日问答</span>
        <strong class="stat-value">1,847</strong>
        <span class="stat-trend down">-2.3%</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">索引成功率</span>
        <strong class="stat-value">99.2%</strong>
        <span class="stat-trend muted">稳定</span>
      </div>
    </section>

    <section class="charts" aria-label="图表">
      <el-card shadow="never" class="chart-card">
        <template #header>
          <span class="card-cap">问答趋势</span>
        </template>
        <div ref="lineRef" class="chart-box" role="img" aria-label="折线图：近七日问答量" />
      </el-card>
      <el-card shadow="never" class="chart-card">
        <template #header>
          <span class="card-cap">知识库分布</span>
        </template>
        <div ref="barRef" class="chart-box" role="img" aria-label="柱状图：各部门文档数量" />
      </el-card>
    </section>

    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="table-head">
          <span class="card-cap">最近文档动态</span>
          <span class="table-hint">演示数据 · 可与文档中心数据后续打通</span>
        </div>
      </template>
      <el-table :data="tableRows" stripe class="dash-table" size="default">
        <el-table-column prop="name" label="文件名" min-width="200" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="88" align="center" />
        <el-table-column prop="size" label="大小" width="100" align="right" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === '就绪' ? 'success' : row.status === '索引中' ? 'warning' : 'info'"
              effect="dark"
              size="small"
              round
            >
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="更新时间" min-width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.dash {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 4px 32px;
}

.dash-head {
  margin-bottom: 24px;
}

.dash-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.dash-sub {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 520px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  position: relative;
  padding: 20px 20px 18px;
  border-radius: var(--adm-radius, 12px);
  background: linear-gradient(
    155deg,
    rgba(30, 42, 62, 0.55) 0%,
    rgba(18, 26, 40, 0.85) 100%
  );
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: var(--adm-shadow-sm, 0 2px 12px rgba(0, 0, 0, 0.22));
  overflow: hidden;
}

.stat-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.stat-label {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: var(--el-text-color-primary);
  line-height: 1.1;
}

.stat-trend {
  display: block;
  margin-top: 10px;
  font-size: 12px;
}

.stat-trend.up {
  color: #7eb89a;
}

.stat-trend.down {
  color: #c99a7a;
}

.stat-trend.muted {
  color: var(--el-text-color-placeholder);
}

.charts {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 960px) {
  .charts {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  min-height: 320px;
}

.card-cap {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.chart-box {
  width: 100%;
  height: 280px;
}

.table-card {
  border-radius: var(--adm-radius, 12px);
}

.table-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.table-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-weight: 400;
}

.dash-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}
</style>
