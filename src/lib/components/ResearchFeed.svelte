<script lang="ts">
  import type { FieldPoints, NewsItem, SignalState } from '../../engine/types';

  let {
    fields,
    newsFeed,
    signal,
  }: {
    fields: FieldPoints;
    newsFeed: NewsItem[];
    signal: SignalState;
  } = $props();

  interface FieldMeta {
    key: keyof FieldPoints;
    label: string;
    color: string;
  }

  const FIELD_META: FieldMeta[] = [
    { key: 'physics',       label: 'Physics',       color: '#6ab0d8' },
    { key: 'mathematics',   label: 'Mathematics',   color: '#a07ad8' },
    { key: 'engineering',   label: 'Engineering',   color: '#c8a040' },
    { key: 'biochemistry',  label: 'Biochemistry',  color: '#4ab88a' },
    { key: 'computing',     label: 'Computing',     color: '#d86a6a' },
    { key: 'socialScience', label: 'Social Sci.',   color: '#d8a86a' },
  ];

  // Scale field bars: 200 pts = full bar for visual purposes
  const FIELD_SCALE = 200;

  function fieldPct(val: number): number {
    return Math.min(100, (val / FIELD_SCALE) * 100);
  }

  const recentNews = $derived([...newsFeed].reverse().slice(0, 10));

  function signalLabel(s: SignalState): string {
    if (s.decodeProgress >= 100) return 'DECODED';
    if (s.eraStrength === 'urgent')     return 'URGENT';
    if (s.eraStrength === 'structured') return 'STRUCTURED';
    return 'FAINT';
  }

  function signalColor(s: SignalState): string {
    if (s.decodeProgress >= 100) return '#4a9b7a';
    if (s.eraStrength === 'urgent')     return '#c84a4a';
    if (s.eraStrength === 'structured') return '#c8a040';
    return '#4a6878';
  }
</script>

<aside class="research-feed">
  <div class="panel-title">RESEARCH FIELDS</div>

  <div class="fields-list">
    {#each FIELD_META as meta}
      {@const val = fields[meta.key]}
      <div class="field-row">
        <span class="field-name">{meta.label}</span>
        <div class="field-bar-track">
          <div
            class="field-bar-fill"
            style="width: {fieldPct(val)}%; background: {meta.color}"
          ></div>
        </div>
        <span class="field-num" style="color: {meta.color}">{val}</span>
      </div>
    {/each}
  </div>

  <div class="section-divider"></div>

  <div class="panel-title">SIGNAL TRACK</div>
  <div class="signal-row">
    <span class="signal-label" style="color: {signalColor(signal)}">{signalLabel(signal)}</span>
    <div class="signal-track">
      <div
        class="signal-fill"
        style="width: {signal.decodeProgress}%; background: {signalColor(signal)}"
      ></div>
    </div>
    <span class="signal-pct" style="color: {signalColor(signal)}">{signal.decodeProgress.toFixed(0)}%</span>
  </div>

  <div class="section-divider"></div>

  <div class="panel-title">NEWS FEED</div>
  <div class="news-list">
    {#each recentNews as item (item.id)}
      <div class="news-item">
        <span class="news-turn">T{item.turn}</span>
        <span class="news-text">{item.text}</span>
      </div>
    {/each}
    {#if newsFeed.length === 0}
      <div class="empty">No dispatches yet.</div>
    {/if}
  </div>
</aside>

<style>
  .research-feed {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    background: #0c1018;
    border-left: 1px solid #1e2530;
    overflow-y: auto;
    min-width: 0;
  }

  .panel-title {
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    color: #5a6878;
    border-bottom: 1px solid #1e2530;
    padding-bottom: 0.3rem;
    margin-bottom: 0.2rem;
    flex-shrink: 0;
  }

  .section-divider {
    height: 1px;
    background: #1a2030;
    margin: 0.3rem 0;
    flex-shrink: 0;
  }

  .fields-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.68rem;
  }

  .field-name {
    color: #8a9aaa;
    width: 6rem;
    flex-shrink: 0;
    font-size: 0.65rem;
  }

  .field-bar-track {
    flex: 1;
    height: 5px;
    background: #1a2030;
    border-radius: 2px;
    overflow: hidden;
    min-width: 0;
  }

  .field-bar-fill {
    height: 100%;
    transition: width 0.4s ease;
  }

  .field-num {
    width: 2.5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 0.68rem;
    flex-shrink: 0;
  }

  .signal-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.7rem;
  }

  .signal-label {
    width: 5.5rem;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    flex-shrink: 0;
  }

  .signal-track {
    flex: 1;
    height: 6px;
    background: #1a2030;
    border-radius: 2px;
    overflow: hidden;
  }

  .signal-fill {
    height: 100%;
    transition: width 0.4s ease;
  }

  .signal-pct {
    width: 2.5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 0.68rem;
    flex-shrink: 0;
  }

  .news-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    overflow-y: auto;
  }

  .news-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .news-turn {
    color: #4a6878;
    font-size: 0.62rem;
    flex-shrink: 0;
    padding-top: 0.05rem;
    font-variant-numeric: tabular-nums;
  }

  .news-text {
    color: #7a8a98;
    flex: 1;
    min-width: 0;
  }

  .empty {
    color: #3a4050;
    font-size: 0.68rem;
    font-style: italic;
  }
</style>
