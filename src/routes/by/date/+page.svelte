<script lang="ts">
	import ProductionList from '$lib/components/ProductionList.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>By Date - TCCTDB</title>
</svelte:head>

<h2>Productions by Date</h2>
<ProductionList productions={data.productions} companies={data.companies} />
