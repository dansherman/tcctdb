<script lang="ts">
	let { data } = $props();
	const { company, productions } = data;
</script>

<svelte:head>
	<title>{company.name} - TCCTDB</title>
</svelte:head>

<div>
	<h2>{company.name}</h2>

	{#if company.productions.length > 0}
		<h3>Productions</h3>
		<dl>
			{#each company.productions as prodSlug}
				{#if productions[prodSlug]}
					<div>
						<dt><a href="/productions/{prodSlug}">{productions[prodSlug].title}</a></dt>
						<dd>
							{new Date(productions[prodSlug].date).toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'short'
							})}
						</dd>
					</div>
				{/if}
			{/each}
		</dl>
	{/if}
</div>
