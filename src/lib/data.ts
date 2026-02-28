import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const DATA_DIR = path.resolve('data');

export interface Person {
	nameFirst: string;
	nameLast: string;
	image?: string;
	cast: [string, string][]; // [production-slug, role]
	crew: [string, string][]; // [production-slug, job]
}

export interface Production {
	title: string;
	company: string;
	date: Date;
	year: number;
	slug: string;
	companySlug: string;
	image?: string;
	cast: [string, string[]][]; // [role, person-slugs[]]
	crew: [string, string[]][]; // [job, person-slugs[]]
}

export interface Company {
	name: string;
	productions: string[]; // production slugs
}

export interface SiteData {
	productions: Record<string, Production>;
	people: Record<string, Person>;
	companies: Record<string, Company>;
	sortedProductions: Production[];
}

function loadPeople(): Record<string, Person> {
	const raw = yaml.load(
		fs.readFileSync(path.join(DATA_DIR, 'people.yaml'), 'utf-8')
	) as Record<string, { nameFirst: string; nameLast: string; image?: string }>;

	const people: Record<string, Person> = {};
	for (const [slug, data] of Object.entries(raw)) {
		if (slug === 'null' || !slug) continue;
		people[slug] = {
			nameFirst: data.nameFirst,
			nameLast: data.nameLast,
			image: data.image,
			cast: [],
			crew: []
		};
	}
	return people;
}

export function gatherData(): SiteData {
	const people = loadPeople();
	const productions: Record<string, Production> = {};
	const companies: Record<string, Company> = {};

	const files = fs.readdirSync(path.join(DATA_DIR, 'productions')).filter((f) => f.endsWith('.yaml'));

	for (const file of files) {
		const raw = yaml.load(
			fs.readFileSync(path.join(DATA_DIR, 'productions', file), 'utf-8')
		) as {
			title: string;
			company: string;
			date: Date;
			image?: string;
			cast?: { [role: string]: string }[];
			crew?: { [job: string]: string }[];
		};

		const slug = path.basename(file, '.yaml');
		const companySlug = slug.split('-')[0];

		// Register company
		if (!companies[companySlug]) {
			companies[companySlug] = { name: raw.company, productions: [] };
		}
		companies[companySlug].productions.push(slug);

		const production: Production = {
			title: raw.title,
			company: raw.company,
			date: new Date(raw.date),
			year: new Date(raw.date).getFullYear(),
			slug,
			companySlug,
			image: raw.image,
			cast: [],
			crew: []
		};

		// Process cast and crew
		// Supports two formats:
		//   Original: - Alice: maya-haugen
		//   Decap CMS: - role: Alice
		//                person: maya-haugen
		for (const group of ['cast', 'crew'] as const) {
			const entries = raw[group] ?? [];
			const grouped: Record<string, string[]> = {};
			const roleKey = group === 'cast' ? 'role' : 'job';

			for (const entry of entries) {
				let role: string;
				let personSlug: string;

				if (roleKey in entry && 'person' in entry) {
					// Decap CMS format: { role: "Alice", person: "maya-haugen" }
					role = (entry as Record<string, string>)[roleKey];
					personSlug = (entry as Record<string, string>)['person'];
				} else {
					// Original format: { "Alice": "maya-haugen" }
					[role, personSlug] = Object.entries(entry)[0];
				}
				if (!personSlug) continue;

				// Auto-create person if not in people.yaml
				if (!people[personSlug]) {
					const parts = personSlug.split('-');
					people[personSlug] = {
						nameFirst: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
						nameLast: parts
							.slice(1)
							.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
							.join('-'),
						cast: [],
						crew: []
					};
				}

				people[personSlug][group].push([slug, role]);

				if (!grouped[role]) grouped[role] = [];
				grouped[role].push(personSlug);
			}

			production[group] = Object.entries(grouped);
		}

		productions[slug] = production;
	}

	// Sort company productions by date descending
	for (const company of Object.values(companies)) {
		company.productions.sort(
			(a, b) => productions[b].date.getTime() - productions[a].date.getTime()
		);
	}

	const sortedProductions = Object.values(productions).sort(
		(a, b) => b.date.getTime() - a.date.getTime()
	);

	// Group person cast/crew by production
	for (const person of Object.values(people)) {
		for (const group of ['cast', 'crew'] as const) {
			const grouped: Record<string, string[]> = {};
			for (const [prodSlug, role] of person[group]) {
				if (!grouped[prodSlug]) grouped[prodSlug] = [];
				grouped[prodSlug].push(role);
			}
			person[group] = Object.entries(grouped) as [string, string][];
		}
	}

	return { productions, people, companies, sortedProductions };
}
