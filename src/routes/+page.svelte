<script lang="ts">
	import CompanyLink from '$lib/components/CompanyLink.svelte';
	import DateStamp from '$lib/components/DateStamp.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Home - TCCTDB</title>
</svelte:head>

<h2>A <del>somewhat complete</del> <ins>growing</ins> database of community theater in the twin cities.</h2>

<dl class="productions">
	{#each data.productions as production}
		<div>
			<dt><a href="/productions/{production.slug}">{production.title}</a></dt>
			<dd>
				<span><CompanyLink slug={production.companySlug} company={data.companies[production.companySlug]} /></span>
				<span><DateStamp date={new Date(production.date)} /></span>
			</dd>
		</div>
	{/each}
</dl>

<div>
	Sort by:
	<a href="/by/title">Title</a>
	<a href="/by/company">Company</a>
	<a href="/by/date">Date</a>
</div>

<section class="about">
	Contact <a href="mailto:dan@4communitytheatre.org">dan@4communitytheatre.org</a> if you have questions or updated data.
</section>
