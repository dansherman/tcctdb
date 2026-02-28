<script lang="ts">
	import PersonLink from '$lib/components/PersonLink.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>People - TCCTDB</title>
</svelte:head>

<h2>People</h2>

<dl>
	{#each data.sortedPeople as [slug, person]}
		{#if slug}
			<div>
				<dt><PersonLink {slug} {person} /></dt>
				<dd></dd>
			</div>
		{/if}
	{/each}
</dl>
