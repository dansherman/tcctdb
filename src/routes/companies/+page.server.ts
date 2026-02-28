import { getAllCompanies } from '$lib/data';
import { getSupabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = getSupabase();
	const companies = await getAllCompanies(supabase);
	return { companies };
};
