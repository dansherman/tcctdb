<script lang="ts">
	import CompanyLink from '$lib/components/CompanyLink.svelte';
	import DateStamp from '$lib/components/DateStamp.svelte';

	let { data } = $props();
	const { show, characters, productions } = data;
</script>

<svelte:head>
	<title>{show.title} - TCCTDB</title>
</svelte:head>

<h2>{show.title}</h2>

{#if show.authors}
	<p>By {show.authors}</p>
{/if}

{#if show.description}
	<p>{show.description}</p>
{/if}

{#if characters.length > 0}
	<h3>Characters</h3>
	<ul>
		{#each characters as character}
			<li>{character.name}</li>
		{/each}
	</ul>
{/if}

{#if productions.length > 0}
	<h3>Productions</h3>
	<dl class="productions">
		{#each productions as production}
			<div>
				<dt><a href="/productions/{production.slug}">{production.company}</a></dt>
				<dd>
					<DateStamp date={new Date(production.date)} />
				</dd>
			</div>
		{/each}
	</dl>
{/if}
