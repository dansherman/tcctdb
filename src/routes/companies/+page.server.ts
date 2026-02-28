import { gatherData } from '$lib/data';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const { companies } = gatherData();
	return { companies };
};
