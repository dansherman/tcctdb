<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Shows - TCCTDB</title>
</svelte:head>

<h2>Shows</h2>

<dl>
	{#each data.shows as show}
		<div>
			<dt><a href="/shows/{show.slug}">{show.title}</a></dt>
			{#if show.authors}
				<dd>{show.authors}</dd>
			{/if}
		</div>
	{/each}
</dl>
