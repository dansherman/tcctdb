import { getCompany } from '$lib/data';
import { getSupabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = getSupabase();
	const result = await getCompany(supabase, params.slug);

	if (!result) throw error(404, 'Company not found');

	return result;
};
