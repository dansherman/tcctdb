import { gatherData } from '$lib/data';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = ({ params }) => {
	const { people, productions } = gatherData();
	const person = people[params.slug];

	if (!person) throw error(404, 'Person not found');

	return { person, productions, slug: params.slug };
};
