<script lang="ts">
	import PersonLink from '$lib/components/PersonLink.svelte';
	import CompanyLink from '$lib/components/CompanyLink.svelte';
	import DateStamp from '$lib/components/DateStamp.svelte';

	let { data } = $props();
	const { production, people, companies } = data;
</script>

<svelte:head>
	<title>{production.title} at {production.company} - TCCTDB</title>
</svelte:head>

<div id="production">
	<h2>{production.title}</h2>
	{#if production.image}
		<img src={production.image} alt="Poster for {production.title}" style="max-width: 300px;" />
	{/if}
	<div>
		<a href="/shows/{production.showSlug}">All productions of this show</a>
	</div>
	<div>
		<CompanyLink slug={production.companySlug} company={companies[production.companySlug]} />
		<DateStamp date={new Date(production.date)} />
	</div>
</div>

<div id="cast">
	<h3>Cast</h3>
	<dl class="roster">
		{#each production.cast as [role, personSlugs]}
			<div>
				<dt>{role}</dt>
				<dd>
					{#each personSlugs as pSlug}
						{#if people[pSlug]}
							<PersonLink slug={pSlug} person={people[pSlug]} />
							<br />
						{/if}
					{/each}
				</dd>
			</div>
		{/each}
	</dl>
</div>

<div id="crew">
	<h3>Crew</h3>
	<dl class="roster">
		{#each production.crew as [job, personSlugs]}
			<div>
				<dt>{job}</dt>
				<dd>
					{#each personSlugs as pSlug}
						{#if people[pSlug]}
							<PersonLink slug={pSlug} person={people[pSlug]} />
							<br />
						{/if}
					{/each}
				</dd>
			</div>
		{/each}
	</dl>
</div>
