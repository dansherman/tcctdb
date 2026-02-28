import { gatherData } from '$lib/data';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const { sortedProductions, companies } = gatherData();
	return { productions: sortedProductions, companies };
};
