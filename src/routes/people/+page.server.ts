import { getAllPeople } from '$lib/data';
import { getSupabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = getSupabase();
	const people = await getAllPeople(supabase);
	// Already sorted by name_last from the query
	const sortedPeople = Object.entries(people);
	return { sortedPeople, people };
};
