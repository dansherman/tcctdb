<script lang="ts">
	let { data } = $props();
	const { person, productions } = data;
</script>

<svelte:head>
	<title>{person.nameFirst} {person.nameLast} - TCCTDB</title>
</svelte:head>

<div>
	<h2>{person.nameFirst} {person.nameLast}</h2>

	{#if person.image}
		<img src={person.image} alt="{person.nameFirst} {person.nameLast}" style="max-width: 200px; border-radius: 8px;" />
	{/if}

	{#if person.cast.length > 0}
		<h3>Cast</h3>
		<dl class="roster">
			{#each person.cast as [prodSlug, roles]}
				{#if productions[prodSlug]}
					<div>
						<dt>
							<a href="/productions/{prodSlug}">{productions[prodSlug].title}</a>
						</dt>
						<dd>
							{#each roles as role}
								{role}<br />
							{/each}
						</dd>
					</div>
				{/if}
			{/each}
		</dl>
	{/if}

	{#if person.crew.length > 0}
		<h3>Crew</h3>
		<dl class="roster">
			{#each person.crew as [prodSlug, jobs]}
				{#if productions[prodSlug]}
					<div>
						<dt>
							<a href="/productions/{prodSlug}">{productions[prodSlug].title}</a>
						</dt>
						<dd>
							{#each jobs as job}
								{job}<br />
							{/each}
						</dd>
					</div>
				{/if}
			{/each}
		</dl>
	{/if}
</div>
