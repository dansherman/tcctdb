<script lang="ts">
	import ProductionList from '$lib/components/ProductionList.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>By Title - TCCTDB</title>
</svelte:head>

<h2>Productions by Title</h2>
<ProductionList productions={data.productions} companies={data.companies} />
