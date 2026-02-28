/**
 * Seed script: reads YAML data files and inserts them into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... npx tsx supabase/seed.ts
 *
 * Requires the service role key (not the anon key) so it can bypass RLS.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
	console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DATA_DIR = path.resolve('data');

// ---------- load YAML ----------

interface RawPerson {
	nameFirst: string;
	nameLast: string;
	image?: string;
}

interface RawProduction {
	title: string;
	company: string;
	date: string;
	image?: string;
	cast?: Record<string, string>[];
	crew?: Record<string, string>[];
}

function loadPeople(): Record<string, RawPerson> {
	const raw = yaml.load(
		fs.readFileSync(path.join(DATA_DIR, 'people.yaml'), 'utf-8')
	) as Record<string, RawPerson>;

	const people: Record<string, RawPerson> = {};
	for (const [slug, data] of Object.entries(raw)) {
		if (slug === 'null' || !slug || !data.nameFirst) continue;
		people[slug] = data;
	}
	return people;
}

function loadProductions(): Record<string, RawProduction> {
	const productions: Record<string, RawProduction> = {};
	const files = fs
		.readdirSync(path.join(DATA_DIR, 'productions'))
		.filter((f) => f.endsWith('.yaml'));

	for (const file of files) {
		const slug = path.basename(file, '.yaml');
		const raw = yaml.load(
			fs.readFileSync(path.join(DATA_DIR, 'productions', file), 'utf-8')
		) as RawProduction;
		productions[slug] = raw;
	}
	return productions;
}

/** Convert a title to a URL slug: "Into the Woods" → "into-the-woods" */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Parse a single cast/crew entry which may be in original or Decap CMS format */
function parseEntry(
	entry: Record<string, string>,
	roleKey: string
): { roleName: string; personSlug: string } | null {
	let roleName: string;
	let personSlug: string;

	if (roleKey in entry && 'person' in entry) {
		roleName = entry[roleKey];
		personSlug = entry['person'];
	} else {
		[roleName, personSlug] = Object.entries(entry)[0];
	}

	if (!personSlug) return null;
	return { roleName, personSlug };
}

// ---------- seed ----------

async function seed() {
	console.log('Loading YAML data...');
	const rawPeople = loadPeople();
	const rawProductions = loadProductions();

	// ---- Collect unique companies ----
	const companySlugs = new Map<string, string>(); // slug → name
	for (const [prodSlug, prod] of Object.entries(rawProductions)) {
		const companySlug = prodSlug.split('-')[0];
		if (!companySlugs.has(companySlug)) {
			companySlugs.set(companySlug, prod.company);
		}
	}

	// ---- Collect unique shows (by title) ----
	// Map title → { slug, characterNames (from all productions of this show) }
	const showsByTitle = new Map<string, { slug: string; characterNames: Set<string> }>();
	for (const prod of Object.values(rawProductions)) {
		if (!showsByTitle.has(prod.title)) {
			showsByTitle.set(prod.title, { slug: slugify(prod.title), characterNames: new Set() });
		}
		const show = showsByTitle.get(prod.title)!;
		for (const entry of prod.cast ?? []) {
			const parsed = parseEntry(entry, 'role');
			if (parsed) show.characterNames.add(parsed.roleName);
		}
	}

	// ---- Collect unique crew position titles ----
	const crewPositionTitles = new Set<string>();
	for (const prod of Object.values(rawProductions)) {
		for (const entry of prod.crew ?? []) {
			const parsed = parseEntry(entry, 'job');
			if (parsed) crewPositionTitles.add(parsed.roleName);
		}
	}

	// ---- 1. Insert companies ----
	console.log(`Inserting ${companySlugs.size} companies...`);
	const companyRows = Array.from(companySlugs.entries()).map(([slug, name]) => ({ slug, name }));
	const { data: companies, error: compErr } = await supabase
		.from('companies')
		.upsert(companyRows, { onConflict: 'slug' })
		.select('id, slug');
	if (compErr) { console.error('Error inserting companies:', compErr); process.exit(1); }
	const companyMap = new Map(companies!.map((c) => [c.slug, c.id]));
	console.log('  Companies done.');

	// ---- 2. Insert people ----
	const allPersonSlugs = new Set(Object.keys(rawPeople));
	for (const prod of Object.values(rawProductions)) {
		for (const [group, roleKey] of [['cast', 'role'], ['crew', 'job']] as const) {
			for (const entry of prod[group] ?? []) {
				const parsed = parseEntry(entry, roleKey);
				if (parsed) allPersonSlugs.add(parsed.personSlug);
			}
		}
	}

	console.log(`Inserting ${allPersonSlugs.size} people...`);
	const personRows = Array.from(allPersonSlugs).map((slug) => {
		const raw = rawPeople[slug];
		if (raw) {
			return { slug, name_first: raw.nameFirst, name_last: raw.nameLast || '', image_url: raw.image || null };
		}
		const parts = slug.split('-');
		return {
			slug,
			name_first: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
			name_last: parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-'),
			image_url: null
		};
	});
	const { data: people, error: pplErr } = await supabase
		.from('people')
		.upsert(personRows, { onConflict: 'slug' })
		.select('id, slug');
	if (pplErr) { console.error('Error inserting people:', pplErr); process.exit(1); }
	const personMap = new Map(people!.map((p) => [p.slug, p.id]));
	console.log('  People done.');

	// ---- 3. Insert shows ----
	console.log(`Inserting ${showsByTitle.size} shows...`);
	const showRows = Array.from(showsByTitle.entries()).map(([title, { slug }]) => ({ slug, title }));
	const { data: shows, error: showErr } = await supabase
		.from('shows')
		.upsert(showRows, { onConflict: 'slug' })
		.select('id, slug, title');
	if (showErr) { console.error('Error inserting shows:', showErr); process.exit(1); }
	// Map by title for lookups (since productions reference shows by title)
	const showMapByTitle = new Map(shows!.map((s) => [s.title, s.id]));
	const showMapBySlug = new Map(shows!.map((s) => [s.slug, s.id]));
	console.log('  Shows done.');

	// ---- 4. Insert characters ----
	const characterRows: { show_id: string; name: string; sort_order: number }[] = [];
	for (const [title, { characterNames }] of showsByTitle) {
		const showId = showMapByTitle.get(title)!;
		let order = 0;
		for (const charName of characterNames) {
			characterRows.push({ show_id: showId, name: charName, sort_order: order++ });
		}
	}
	console.log(`Inserting ${characterRows.length} characters...`);
	const BATCH_SIZE = 500;
	// Insert characters in batches
	const allCharacters: { id: string; show_id: string; name: string }[] = [];
	for (let i = 0; i < characterRows.length; i += BATCH_SIZE) {
		const batch = characterRows.slice(i, i + BATCH_SIZE);
		const { data: chars, error: charErr } = await supabase
			.from('characters')
			.upsert(batch, { onConflict: 'show_id,name' })
			.select('id, show_id, name');
		if (charErr) { console.error('Error inserting characters:', charErr); process.exit(1); }
		allCharacters.push(...chars!);
	}
	// Map: showId + charName → charId
	const characterMap = new Map(allCharacters.map((c) => [`${c.show_id}::${c.name}`, c.id]));
	console.log('  Characters done.');

	// ---- 5. Insert crew positions ----
	console.log(`Inserting ${crewPositionTitles.size} crew positions...`);
	const crewPosRows = Array.from(crewPositionTitles).map((title) => ({ title }));
	const { data: crewPositions, error: cpErr } = await supabase
		.from('crew_positions')
		.upsert(crewPosRows, { onConflict: 'title' })
		.select('id, title');
	if (cpErr) { console.error('Error inserting crew positions:', cpErr); process.exit(1); }
	const crewPosMap = new Map(crewPositions!.map((cp) => [cp.title, cp.id]));
	console.log('  Crew positions done.');

	// ---- 6. Insert productions (now with show_id) ----
	console.log(`Inserting ${Object.keys(rawProductions).length} productions...`);
	const productionRows = Object.entries(rawProductions).map(([slug, prod]) => {
		const companySlug = slug.split('-')[0];
		return {
			slug,
			show_id: showMapByTitle.get(prod.title)!,
			company_id: companyMap.get(companySlug)!,
			opening_date: prod.date,
			image_url: prod.image || null
		};
	});
	const { data: productions, error: prodErr } = await supabase
		.from('productions')
		.upsert(productionRows, { onConflict: 'slug' })
		.select('id, slug');
	if (prodErr) { console.error('Error inserting productions:', prodErr); process.exit(1); }
	const productionMap = new Map(productions!.map((p) => [p.slug, p.id]));
	console.log('  Productions done.');

	// ---- 7. Insert roles (cast → character_id, crew → crew_position_id) ----
	console.log('Inserting roles...');
	const roleRows: {
		production_id: string;
		person_id: string;
		role_type: string;
		character_id: string | null;
		crew_position_id: string | null;
		sort_order: number;
	}[] = [];

	for (const [prodSlug, prod] of Object.entries(rawProductions)) {
		const productionId = productionMap.get(prodSlug)!;
		const showId = showMapByTitle.get(prod.title)!;

		// Cast roles → link to character
		let sortOrder = 0;
		for (const entry of prod.cast ?? []) {
			const parsed = parseEntry(entry, 'role');
			if (!parsed || !personMap.has(parsed.personSlug)) continue;

			const characterId = characterMap.get(`${showId}::${parsed.roleName}`);
			if (!characterId) {
				console.warn(`  Warning: character "${parsed.roleName}" not found for show "${prod.title}"`);
				continue;
			}

			roleRows.push({
				production_id: productionId,
				person_id: personMap.get(parsed.personSlug)!,
				role_type: 'cast',
				character_id: characterId,
				crew_position_id: null,
				sort_order: sortOrder++
			});
		}

		// Crew roles → link to crew position
		sortOrder = 0;
		for (const entry of prod.crew ?? []) {
			const parsed = parseEntry(entry, 'job');
			if (!parsed || !personMap.has(parsed.personSlug)) continue;

			const crewPositionId = crewPosMap.get(parsed.roleName);
			if (!crewPositionId) {
				console.warn(`  Warning: crew position "${parsed.roleName}" not found`);
				continue;
			}

			roleRows.push({
				production_id: productionId,
				person_id: personMap.get(parsed.personSlug)!,
				role_type: 'crew',
				character_id: null,
				crew_position_id: crewPositionId,
				sort_order: sortOrder++
			});
		}
	}

	for (let i = 0; i < roleRows.length; i += BATCH_SIZE) {
		const batch = roleRows.slice(i, i + BATCH_SIZE);
		const { error: roleErr } = await supabase.from('roles').insert(batch);
		if (roleErr) {
			console.error(`Error inserting roles batch ${i / BATCH_SIZE + 1}:`, roleErr);
			process.exit(1);
		}
	}
	console.log(`  ${roleRows.length} roles inserted.`);

	console.log('\nSeed complete!');
	console.log(`  ${companySlugs.size} companies`);
	console.log(`  ${allPersonSlugs.size} people`);
	console.log(`  ${showsByTitle.size} shows`);
	console.log(`  ${allCharacters.length} characters`);
	console.log(`  ${crewPositionTitles.size} crew positions`);
	console.log(`  ${Object.keys(rawProductions).length} productions`);
	console.log(`  ${roleRows.length} roles`);
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
