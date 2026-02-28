import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export function getSupabase() {
	const url = env.SUPABASE_URL;
	const key = env.SUPABASE_ANON_KEY;

	if (!url || !key) {
		throw new Error(
			'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. ' +
				'Copy .env.example to .env and fill in your Supabase project credentials.'
		);
	}

	return createClient(url, key);
}
