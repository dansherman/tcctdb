import { gatherData } from '$lib/data';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = ({ params }) => {
	const { productions, people, companies } = gatherData();
	const production = productions[params.slug];

	if (!production) throw error(404, 'Production not found');

	return { production, people, companies };
};
