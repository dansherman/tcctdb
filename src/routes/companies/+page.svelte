<script lang="ts">
	import CompanyLink from '$lib/components/CompanyLink.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Companies - TCCTDB</title>
</svelte:head>

<h2>Companies</h2>

<dl>
	{#each Object.entries(data.companies) as [slug, company]}
		<div>
			<dt><CompanyLink {slug} {company} /></dt>
			<dd></dd>
		</div>
	{/each}
</dl>
