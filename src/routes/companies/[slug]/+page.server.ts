import { gatherData } from '$lib/data';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = ({ params }) => {
	const { companies, productions } = gatherData();
	const company = companies[params.slug];

	if (!company) throw error(404, 'Company not found');

	return { company, productions };
};
