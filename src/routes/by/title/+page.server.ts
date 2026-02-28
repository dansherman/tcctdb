import { getAllProductions } from '$lib/data';
import { getSupabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = getSupabase();
	const { productions, companies } = await getAllProductions(supabase);
	productions.sort((a, b) => a.title.localeCompare(b.title));
	return { productions, companies };
};
