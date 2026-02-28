<script lang="ts">
	import CompanyLink from './CompanyLink.svelte';
	import DateStamp from './DateStamp.svelte';
	import type { Production, Company } from '$lib/data';

	let { productions, companies }: { productions: Production[]; companies: Record<string, Company> } = $props();
</script>

<dl class="productions">
	{#each productions as production}
		<div>
			<dt><a href="/productions/{production.slug}">{production.title}</a></dt>
			<dd>
				<span><CompanyLink slug={production.companySlug} company={companies[production.companySlug]} /></span>
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
