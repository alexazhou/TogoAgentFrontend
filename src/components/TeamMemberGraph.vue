<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAgentAvatarUrl } from '../avatar';

const props = defineProps<{
  teamName: string;
  selectedAgents: string[];
  readonly?: boolean;
}>();

const emit = defineEmits<{
  toggleAgent: [agentName: string];
}>();
const route = useRoute();
const router = useRouter();

const leaderAgent = computed(() => props.selectedAgents[0] ?? '');
const memberAgents = computed(() => props.selectedAgents.slice(1));
const teamId = computed(() => {
  const raw = route.params.teamId;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
});
const graphRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLElement | null>(null);
const graphWidth = ref(0);
const graphHeight = ref(0);
const canvasWidth = ref(0);
const canvasHeight = ref(0);
const baseContentMinLeft = ref(0);
const baseContentMaxRight = ref(0);
const baseContentMinTop = ref(0);
const baseContentMaxBottom = ref(0);
const dragContentMinLeft = ref(0);
const dragContentMaxRight = ref(0);
const dragContentMinTop = ref(0);
const dragContentMaxBottom = ref(0);
const panX = ref(0);
const panY = ref(0);
const zoom = ref(1);
const isPanning = ref(false);
const visibleMemberSlots = computed(() => {
  const slots = memberAgents.value.map((agentName) => ({
    name: agentName,
    agent: agentName,
  }));

  if (!props.readonly) {
    slots.push({ name: '', agent: '' });
  }

  return slots;
});
const isSingleMemberLayout = computed(() => visibleMemberSlots.value.length === 1);
const memberGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(visibleMemberSlots.value.length, 1)}, minmax(180px, 220px))`,
}));
const canvasStyle = computed(() => ({
  transform: `translate(-50%, 0) translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
}));
const boundingFrameStyle = computed(() => ({
  left: `${baseContentMinLeft.value}px`,
  top: `${baseContentMinTop.value}px`,
  width: `${Math.max(baseContentMaxRight.value - baseContentMinLeft.value, 0)}px`,
  height: `${Math.max(baseContentMaxBottom.value - baseContentMinTop.value, 0)}px`,
}));
let resizeObserver: ResizeObserver | null = null;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;
let metricsFrame = 0;

function updateMetrics(): void {
  graphWidth.value = graphRef.value?.clientWidth ?? 0;
  graphHeight.value = graphRef.value?.clientHeight ?? 0;
  canvasWidth.value = canvasRef.value?.offsetWidth ?? 0;
  canvasHeight.value = canvasRef.value?.offsetHeight ?? 0;

  const canvas = canvasRef.value;
  const graph = graphRef.value;
  if (!canvas || !graph) {
    baseContentMinLeft.value = 0;
    baseContentMaxRight.value = canvasWidth.value;
    baseContentMinTop.value = 0;
    baseContentMaxBottom.value = canvasHeight.value;
    return;
  }

  const nodes = Array.from(canvas.querySelectorAll<HTMLElement>(
    '.team-root, .member-node, .member-action-button, .member-rail, .member-single-link',
  ));
  if (nodes.length === 0) {
    baseContentMinLeft.value = 0;
    baseContentMaxRight.value = canvasWidth.value;
    baseContentMinTop.value = 0;
    baseContentMaxBottom.value = canvasHeight.value;
    return;
  }

  const graphRect = graph.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  let minLeft = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;
  let graphMinLeft = Number.POSITIVE_INFINITY;
  let graphMaxRight = Number.NEGATIVE_INFINITY;
  let graphMinTop = Number.POSITIVE_INFINITY;
  let graphMaxBottom = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    minLeft = Math.min(minLeft, rect.left - canvasRect.left);
    maxRight = Math.max(maxRight, rect.right - canvasRect.left);
    minTop = Math.min(minTop, rect.top - canvasRect.top);
    maxBottom = Math.max(maxBottom, rect.bottom - canvasRect.top);
    graphMinLeft = Math.min(graphMinLeft, rect.left - graphRect.left);
    graphMaxRight = Math.max(graphMaxRight, rect.right - graphRect.left);
    graphMinTop = Math.min(graphMinTop, rect.top - graphRect.top);
    graphMaxBottom = Math.max(graphMaxBottom, rect.bottom - graphRect.top);
  }

  baseContentMinLeft.value = minLeft;
  baseContentMaxRight.value = maxRight;
  baseContentMinTop.value = minTop;
  baseContentMaxBottom.value = maxBottom;
  dragContentMinLeft.value = graphMinLeft - panX.value;
  dragContentMaxRight.value = graphMaxRight - panX.value;
  dragContentMinTop.value = graphMinTop - panY.value;
  dragContentMaxBottom.value = graphMaxBottom - panY.value;
}

function scheduleMetricsUpdate(): void {
  if (metricsFrame) {
    cancelAnimationFrame(metricsFrame);
  }
  metricsFrame = requestAnimationFrame(() => {
    metricsFrame = 0;
    updateMetrics();
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampPan(nextX: number, nextY: number): { x: number; y: number } {
  const keepVisiblePx = 10;
  const minX = keepVisiblePx - dragContentMaxRight.value;
  const maxX = graphWidth.value - keepVisiblePx - dragContentMinLeft.value;
  const minY = keepVisiblePx - dragContentMaxBottom.value;
  const maxY = graphHeight.value - keepVisiblePx - dragContentMinTop.value;

  return {
    x: clamp(nextX, Math.min(minX, maxX), Math.max(minX, maxX)),
    y: clamp(nextY, Math.min(minY, maxY), Math.max(minY, maxY)),
  };
}

function resetPan(): void {
  const next = clampPan(
    (graphWidth.value - dragContentMaxRight.value - dragContentMinLeft.value) / 2,
    (graphHeight.value - dragContentMaxBottom.value - dragContentMinTop.value) / 2,
  );
  panX.value = next.x;
  panY.value = next.y;
  scheduleMetricsUpdate();
}

function startPan(event: PointerEvent): void {
  if (event.button !== 0 || !graphRef.value) {
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!props.readonly && target?.closest('button')) {
    return;
  }

  isPanning.value = true;
  panStartX = event.clientX;
  panStartY = event.clientY;
  panOriginX = panX.value;
  panOriginY = panY.value;
  graphRef.value.setPointerCapture(event.pointerId);
}

function movePan(event: PointerEvent): void {
  if (!isPanning.value) {
    return;
  }

  const next = clampPan(
    panOriginX + event.clientX - panStartX,
    panOriginY + event.clientY - panStartY,
  );
  panX.value = next.x;
  panY.value = next.y;
  scheduleMetricsUpdate();
}

function endPan(event?: PointerEvent): void {
  if (!isPanning.value) {
    return;
  }

  if (event && graphRef.value?.hasPointerCapture(event.pointerId)) {
    graphRef.value.releasePointerCapture(event.pointerId);
  }

  isPanning.value = false;
}

function handleWheelZoom(event: WheelEvent): void {
  if (!graphRef.value || event.deltaY === 0) {
    return;
  }

  event.preventDefault();
  const minZoom = 0.6;
  const maxZoom = 1.8;
  const zoomFactor = Math.exp(-event.deltaY * 0.0015);
  const nextZoom = clamp(zoom.value * zoomFactor, minZoom, maxZoom);

  if (Math.abs(nextZoom - zoom.value) < 0.0001) {
    return;
  }

  zoom.value = nextZoom;
}

function handlePrimaryAction(agentName: string): void {
  if (!agentName || props.readonly) {
    return;
  }

  emit('toggleAgent', agentName);
}

function handleActionButton(agentName: string): void {
  if (!agentName) {
    return;
  }

  if (props.readonly) {
    if (teamId.value === null) {
      return;
    }

    router.push({
      name: 'agent-detail',
      params: {
        teamId: teamId.value,
        agentName,
      },
    }).catch(console.error);
    return;
  }

  emit('toggleAgent', agentName);
}

onMounted(() => {
  updateMetrics();
  resetPan();
  if (!graphRef.value || !canvasRef.value) {
    return;
  }

  resizeObserver = new ResizeObserver(() => {
    updateMetrics();
    resetPan();
  });
  resizeObserver.observe(graphRef.value);
  resizeObserver.observe(canvasRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (metricsFrame) {
    cancelAnimationFrame(metricsFrame);
    metricsFrame = 0;
  }
});

watch(
  () => props.selectedAgents,
  async () => {
    await nextTick();
    updateMetrics();
    resetPan();
  },
  { deep: true, immediate: true },
);

watch([panX, panY], async () => {
  await nextTick();
  updateMetrics();
});

watch(zoom, async () => {
  await nextTick();
  updateMetrics();
  const next = clampPan(panX.value, panY.value);
  panX.value = next.x;
  panY.value = next.y;
});
</script>

<template>
  <div
    ref="graphRef"
    class="member-graph"
    :class="{ 'is-panning': isPanning, 'is-editing': !props.readonly }"
    @pointerdown="startPan"
    @pointermove="movePan"
    @pointerup="endPan"
    @pointercancel="endPan"
    @pointerleave="endPan"
    @wheel.prevent="handleWheelZoom"
  >
    <div ref="canvasRef" class="member-canvas" :style="canvasStyle">
      <div class="member-bounding-frame" :style="boundingFrameStyle" aria-hidden="true"></div>
      <div class="member-card-shell team-root-shell" :class="{ 'has-action': !!leaderAgent }">
        <button
          class="team-root member-card-button"
          :class="{ 'is-empty': !leaderAgent, 'is-readonly': props.readonly }"
          type="button"
          @click="handlePrimaryAction(leaderAgent)"
        >
          <img
            v-if="leaderAgent"
            class="member-avatar"
            :src="getAgentAvatarUrl(leaderAgent)"
            :alt="`${leaderAgent} avatar`"
          />
          <span>{{ leaderAgent || (teamName.trim() ? `${teamName.trim()} Leader` : '+') }}</span>
          <small>{{ leaderAgent ? 'Leader' : '负责人' }}</small>
        </button>
        <button
          v-if="leaderAgent && props.readonly"
          class="member-action-button"
          type="button"
          @pointerdown.stop
          @click.stop="handleActionButton(leaderAgent)"
        >
          {{ props.readonly ? '查看' : '移除' }}
        </button>
      </div>

      <div class="member-tree" :class="{ 'is-single-member': isSingleMemberLayout }">
        <div v-if="!isSingleMemberLayout" class="member-rail" aria-hidden="true"></div>
        <div v-else class="member-single-link" aria-hidden="true"></div>

        <div class="member-slots" :class="{ 'is-single-member': isSingleMemberLayout }" :style="memberGridStyle">
          <div
            v-for="(member, index) in visibleMemberSlots"
            :key="member.name || `empty-${index}`"
            class="member-card-shell member-node-shell"
            :class="{ 'has-action': !!member.name }"
          >
            <button
              class="member-node member-card-button"
              :class="{ 'is-empty': !member.name, 'is-readonly': props.readonly }"
              type="button"
              @click="handlePrimaryAction(member.name)"
            >
              <img
                v-if="member.name"
                class="member-avatar"
                :src="getAgentAvatarUrl(member.name)"
                :alt="`${member.name} avatar`"
              />
              <span>{{ member.name || '+' }}</span>
              <small>{{ member.name ? member.agent : '成员' }}</small>
            </button>
            <button
              v-if="member.name"
              class="member-action-button"
              type="button"
              @pointerdown.stop
              @click.stop="handleActionButton(member.name)"
            >
              {{ props.readonly ? '查看' : '移除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-graph {
  --member-grid-size: 28px;
  --member-grid-line: rgba(148, 163, 184, 0.16);
  --member-connector-line: rgba(37, 99, 235, 0.62);
  position: relative;
  height: 452px;
  padding: 8px 6px 0;
  display: grid;
  justify-items: center;
  align-content: start;
  background-image:
    linear-gradient(to right, var(--member-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--member-grid-line) 1px, transparent 1px);
  background-size: var(--member-grid-size) var(--member-grid-size);
  background-position: 0 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.member-graph.is-editing {
  background-color: color-mix(in srgb, var(--selected) 20%, #fff 80%);
}

.member-graph.is-panning {
  cursor: grabbing;
}

.member-bounding-frame {
  position: absolute;
  border: 0;
  border-radius: 0;
  background: transparent;
  pointer-events: none;
  z-index: 0;
}

.member-canvas {
  --member-card-width: 102px;
  --member-gap: 18px;
  position: relative;
  left: 50%;
  min-height: 260px;
  width: max-content;
  background: transparent;
  padding: 10px 6px 0;
  display: grid;
  justify-items: center;
  gap: 28px;
  will-change: transform;
  transform-origin: center center;
  z-index: 1;
}

.team-root {
  width: 132px;
  aspect-ratio: 3 / 4;
  box-sizing: border-box;
  border: 1px solid var(--team-create-node-border);
  border-radius: 24px;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
  padding: 10px;
  color: var(--text-strong);
  background: var(--surface-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 70%, transparent);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.team-root span,
.member-node span {
  font-weight: 600;
}

.team-root small,
.member-node small {
  color: var(--muted);
  font-size: 0.76rem;
}

.team-root:not(.is-empty):hover,
.member-node:not(.is-empty):hover {
  transform: translateY(-2px);
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 55%, transparent);
}

.team-root.is-readonly,
.member-node.is-readonly {
  cursor: grab;
}

.member-graph.is-panning .team-root.is-readonly,
.member-graph.is-panning .member-node.is-readonly {
  cursor: grabbing;
}

.member-card-shell {
  position: relative;
  display: grid;
  justify-items: center;
}

.team-root-shell {
  width: 132px;
}

.member-card-button {
  width: 100%;
}

.member-action-button {
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 44px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 48%, var(--panel-border) 52%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-bg) 76%, var(--selected) 24%);
  color: var(--text-strong);
  padding: 0 10px;
  font-size: 0.72rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;
  z-index: 3;
}

.member-card-shell.has-action:hover .member-action-button,
.member-card-shell.has-action:focus-within .member-action-button {
  opacity: 1;
  transform: translateY(0);
}

.member-action-button:hover {
  border-color: var(--focus-border);
  background: var(--selected);
}

.team-root.is-empty,
.member-node.is-empty {
  color: var(--muted);
  cursor: default;
  background: color-mix(in srgb, var(--surface-soft) 92%, var(--selected) 8%);
  border: 1px dashed color-mix(in srgb, var(--panel-border-strong) 88%, var(--focus-border) 12%);
  box-shadow: none;
}

.team-root.is-empty span,
.member-node.is-empty span {
  color: color-mix(in srgb, var(--text-strong) 58%, var(--muted) 42%);
}

.member-tree {
  position: relative;
  width: max-content;
  max-width: none;
  padding-top: 58px;
}

.member-rail {
  position: absolute;
  top: 0;
  left: calc(var(--member-card-width) / 2);
  right: calc(var(--member-card-width) / 2);
  height: 30px;
  border-top: 1px solid var(--member-connector-line);
}

.member-rail::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -30px;
  width: 1px;
  height: 30px;
  transform: translateX(-50%);
  background: var(--member-connector-line);
}

.member-slots {
  position: relative;
  display: grid;
  gap: var(--member-gap);
  justify-content: center;
  justify-items: center;
}

.member-slots.is-single-member {
  grid-template-columns: repeat(3, var(--member-card-width)) !important;
}

.member-slots.is-single-member .member-node-shell:nth-child(1) {
  grid-column: 2;
}

.member-slots.is-single-member .member-node-shell:nth-child(2) {
  grid-column: 3;
}

.member-node {
  position: relative;
  width: var(--member-card-width);
  aspect-ratio: 3 / 4;
  box-sizing: border-box;
  border: 1px solid var(--team-create-node-border);
  border-radius: 16px;
  background: var(--surface-soft);
  color: var(--text-strong);
  display: grid;
  place-items: center;
  align-content: center;
  gap: 2px;
  padding: 10px;
  text-align: center;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 70%, transparent);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: block;
  object-fit: cover;
  margin-bottom: 4px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--panel-border-strong) 30%, transparent);
}

.member-node::before {
  content: '';
  position: absolute;
  top: -50px;
  left: 50%;
  width: 1px;
  height: 50px;
  transform: translateX(-50%);
  background: var(--member-connector-line);
}

.member-tree.is-single-member .member-rail {
  display: none;
}

.member-single-link {
  position: absolute;
  top: -38px;
  left: 50%;
  width: 1px;
  height: 96px;
  transform: translateX(-50%);
  background: var(--member-connector-line);
}

@media (max-width: 960px) {
  .member-slots {
    width: 100%;
    grid-template-columns: repeat(2, minmax(180px, 1fr)) !important;
  }
}

@media (max-width: 640px) {
  .member-tree {
    width: 100%;
    padding-top: 0;
  }

  .member-slots {
    grid-template-columns: 1fr !important;
  }

  .member-rail,
  .member-node::before {
    display: none;
  }

  .member-action-button {
    opacity: 1;
    transform: none;
  }

  .member-graph {
    min-height: auto;
  }
}

</style>
