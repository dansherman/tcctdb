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

	// Remove the null placeholder entry
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

// ---------- seed ----------

async function seed() {
	console.log('Loading YAML data...');
	const rawPeople = loadPeople();
	const rawProductions = loadProductions();

	// Collect unique companies from production files
	const companySlugs = new Map<string, string>(); // slug → name
	for (const [prodSlug, prod] of Object.entries(rawProductions)) {
		const companySlug = prodSlug.split('-')[0];
		if (!companySlugs.has(companySlug)) {
			companySlugs.set(companySlug, prod.company);
		}
	}

	// 1. Insert companies
	console.log(`Inserting ${companySlugs.size} companies...`);
	const companyRows = Array.from(companySlugs.entries()).map(([slug, name]) => ({
		slug,
		name
	}));
	const { data: companies, error: compErr } = await supabase
		.from('companies')
		.upsert(companyRows, { onConflict: 'slug' })
		.select('id, slug');

	if (compErr) {
		console.error('Error inserting companies:', compErr);
		process.exit(1);
	}
	const companyMap = new Map(companies!.map((c) => [c.slug, c.id]));
	console.log('  Companies done.');

	// 2. Collect all person slugs (from people.yaml + auto-created from productions)
	const allPersonSlugs = new Set(Object.keys(rawPeople));
	for (const prod of Object.values(rawProductions)) {
		for (const group of [prod.cast, prod.crew]) {
			for (const entry of group ?? []) {
				const roleKey = group === prod.cast ? 'role' : 'job';
				let personSlug: string;
				if (roleKey in entry && 'person' in entry) {
					personSlug = (entry as Record<string, string>)['person'];
				} else {
					personSlug = Object.values(entry)[0];
				}
				if (personSlug) allPersonSlugs.add(personSlug);
			}
		}
	}

	// 3. Insert people
	console.log(`Inserting ${allPersonSlugs.size} people...`);
	const personRows = Array.from(allPersonSlugs).map((slug) => {
		const raw = rawPeople[slug];
		if (raw) {
			return {
				slug,
				name_first: raw.nameFirst,
				name_last: raw.nameLast || '',
				image_url: raw.image || null
			};
		}
		// Auto-create from slug
		const parts = slug.split('-');
		return {
			slug,
			name_first: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
			name_last: parts
				.slice(1)
				.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
				.join('-'),
			image_url: null
		};
	});

	const { data: people, error: pplErr } = await supabase
		.from('people')
		.upsert(personRows, { onConflict: 'slug' })
		.select('id, slug');

	if (pplErr) {
		console.error('Error inserting people:', pplErr);
		process.exit(1);
	}
	const personMap = new Map(people!.map((p) => [p.slug, p.id]));
	console.log('  People done.');

	// 4. Insert productions
	console.log(`Inserting ${Object.keys(rawProductions).length} productions...`);
	const productionRows = Object.entries(rawProductions).map(([slug, prod]) => {
		const companySlug = slug.split('-')[0];
		return {
			slug,
			title: prod.title,
			company_id: companyMap.get(companySlug)!,
			opening_date: prod.date,
			image_url: prod.image || null
		};
	});

	const { data: productions, error: prodErr } = await supabase
		.from('productions')
		.upsert(productionRows, { onConflict: 'slug' })
		.select('id, slug');

	if (prodErr) {
		console.error('Error inserting productions:', prodErr);
		process.exit(1);
	}
	const productionMap = new Map(productions!.map((p) => [p.slug, p.id]));
	console.log('  Productions done.');

	// 5. Insert roles (cast + crew)
	console.log('Inserting roles...');
	const roleRows: {
		production_id: string;
		person_id: string;
		role_name: string;
		role_type: string;
		sort_order: number;
	}[] = [];

	for (const [prodSlug, prod] of Object.entries(rawProductions)) {
		const productionId = productionMap.get(prodSlug)!;

		for (const [groupName, roleType] of [
			['cast', 'cast'],
			['crew', 'crew']
		] as const) {
			const entries = prod[groupName] ?? [];
			const roleKey = groupName === 'cast' ? 'role' : 'job';

			let sortOrder = 0;
			for (const entry of entries) {
				let roleName: string;
				let personSlug: string;

				if (roleKey in entry && 'person' in entry) {
					roleName = (entry as Record<string, string>)[roleKey];
					personSlug = (entry as Record<string, string>)['person'];
				} else {
					[roleName, personSlug] = Object.entries(entry)[0];
				}

				if (!personSlug || !personMap.has(personSlug)) continue;

				roleRows.push({
					production_id: productionId,
					person_id: personMap.get(personSlug)!,
					role_name: roleName,
					role_type: roleType,
					sort_order: sortOrder++
				});
			}
		}
	}

	// Insert in batches of 500 to avoid payload limits
	const BATCH_SIZE = 500;
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
	console.log(`  ${Object.keys(rawProductions).length} productions`);
	console.log(`  ${roleRows.length} roles`);
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
