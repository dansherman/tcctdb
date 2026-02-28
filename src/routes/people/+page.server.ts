import { gatherData } from '$lib/data';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const { people } = gatherData();
	const sortedPeople = Object.entries(people).sort((a, b) =>
		a[1].nameLast.localeCompare(b[1].nameLast)
	);
	return { sortedPeople, people };
};
