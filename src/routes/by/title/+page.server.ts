import { gatherData } from '$lib/data';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const { sortedProductions, companies } = gatherData();
	const productions = [...sortedProductions].sort((a, b) => a.title.localeCompare(b.title));
	return { productions, companies };
};
