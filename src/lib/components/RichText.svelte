<script lang="ts">
  import { parseRichText, facilityTooltipText, techTooltipText } from '$lib/richText';
  import { FACILITY_DEFS, TECH_DEFS } from '../../data/loader';
  import Tooltip from './Tooltip.svelte';

  let { source }: { source: string } = $props();

  const nodes = $derived(parseRichText(source));
</script>

{#each nodes as node}
  {#if node.kind === 'text'}
    {node.value}
  {:else if node.kind === 'bold'}
    <strong>{node.value}</strong>
  {:else if node.kind === 'italic'}
    <em>{node.value}</em>
  {:else if node.kind === 'underline'}
    <u>{node.value}</u>
  {:else if node.kind === 'facility'}
    {@const def = FACILITY_DEFS.get(node.id)}
    {#if def}
      <Tooltip text={facilityTooltipText(def)} direction="above">
        <span class="rich-token">{def.name}</span>
      </Tooltip>
    {:else}
      <span class="rich-unknown">[?facility:{node.id}]</span>
    {/if}
  {:else if node.kind === 'tech'}
    {@const def = TECH_DEFS.get(node.id)}
    {#if def}
      <Tooltip text={techTooltipText(def)} direction="above">
        <span class="rich-token">{def.name}</span>
      </Tooltip>
    {:else}
      <span class="rich-unknown">[?technology:{node.id}]</span>
    {/if}
  {/if}
{/each}

<style>
  .rich-token {
    color: var(--text-accent);
    border-bottom: 1px dotted currentColor;
    cursor: help;
  }

  .rich-unknown {
    color: #9b4a4a;
    font-size: 0.8em;
  }
</style>
