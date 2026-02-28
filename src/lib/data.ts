import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- Public interfaces ----------

export interface Person {
	nameFirst: string;
	nameLast: string;
	image?: string;
	cast: [string, string[]][]; // [production-slug, character-names[]]
	crew: [string, string[]][]; // [production-slug, crew-position-titles[]]
}

export interface Show {
	title: string;
	slug: string;
	authors?: string;
	description?: string;
}

export interface Production {
	title: string;
	showSlug: string;
	company: string;
	date: Date;
	year: number;
	slug: string;
	companySlug: string;
	image?: string;
	cast: [string, string[]][]; // [character-name, person-slugs[]]
	crew: [string, string[]][]; // [crew-position-title, person-slugs[]]
}

export interface Company {
	name: string;
	productions: string[]; // production slugs
}

// ---------- Helpers ----------

/** Extract the display name from a role row (character name for cast, position title for crew) */
function roleName(role: { role_type: string; characters: { name: string } | null; crew_positions: { title: string } | null }): string {
	if (role.role_type === 'cast' && role.characters) return role.characters.name;
	if (role.role_type === 'crew' && role.crew_positions) return role.crew_positions.title;
	return '(unknown)';
}

/** Build a Production object from a Supabase row that includes shows(...) and companies(...) */
function toProduction(p: {
	slug: string;
	opening_date: string;
	image_url: string | null;
	shows: { slug: string; title: string };
	companies: { slug: string; name: string };
}): Production {
	const date = new Date(p.opening_date);
	return {
		title: p.shows.title,
		showSlug: p.shows.slug,
		company: p.companies.name,
		date,
		year: date.getFullYear(),
		slug: p.slug,
		companySlug: p.companies.slug,
		image: p.image_url || undefined,
		cast: [],
		crew: []
	};
}

// ---------- Focused queries ----------

export async function getProduction(supabase: SupabaseClient, slug: string) {
	const { data: prod, error: prodErr } = await supabase
		.from('productions')
		.select('id, slug, opening_date, image_url, shows(slug, title), companies(slug, name)')
		.eq('slug', slug)
		.single();

	if (prodErr || !prod) return null;

	const { data: roles, error: rolesErr } = await supabase
		.from('roles')
		.select('role_type, sort_order, characters(name), crew_positions(title), people(slug, name_first, name_last, image_url)')
		.eq('production_id', prod.id)
		.order('sort_order', { ascending: true });

	if (rolesErr) throw rolesErr;

	const people: Record<string, Person> = {};
	const castGroups = new Map<string, string[]>();
	const crewGroups = new Map<string, string[]>();

	for (const role of roles ?? []) {
		const person = role.people as unknown as {
			slug: string; name_first: string; name_last: string; image_url: string | null;
		};

		if (!people[person.slug]) {
			people[person.slug] = {
				nameFirst: person.name_first,
				nameLast: person.name_last,
				image: person.image_url || undefined,
				cast: [],
				crew: []
			};
		}

		const name = roleName(role as any);
		const groups = role.role_type === 'cast' ? castGroups : crewGroups;
		if (!groups.has(name)) groups.set(name, []);
		groups.get(name)!.push(person.slug);
	}

	const show = prod.shows as unknown as { slug: string; title: string };
	const company = prod.companies as unknown as { slug: string; name: string };

	const production: Production = {
		...toProduction({ ...prod, shows: show, companies: company }),
		cast: Array.from(castGroups.entries()),
		crew: Array.from(crewGroups.entries())
	};

	const companies: Record<string, Company> = {
		[company.slug]: { name: company.name, productions: [] }
	};

	return { production, people, companies };
}

export async function getPerson(supabase: SupabaseClient, slug: string) {
	const { data: person, error: personErr } = await supabase
		.from('people')
		.select('id, slug, name_first, name_last, image_url')
		.eq('slug', slug)
		.single();

	if (personErr || !person) return null;

	const { data: roles, error: rolesErr } = await supabase
		.from('roles')
		.select('role_type, characters(name), crew_positions(title), productions(slug, opening_date, image_url, shows(slug, title), companies(slug, name))')
		.eq('person_id', person.id)
		.order('sort_order', { ascending: true });

	if (rolesErr) throw rolesErr;

	const castMap = new Map<string, string[]>();
	const crewMap = new Map<string, string[]>();
	const productions: Record<string, Production> = {};

	for (const role of roles ?? []) {
		const prod = role.productions as unknown as {
			slug: string; opening_date: string; image_url: string | null;
			shows: { slug: string; title: string };
			companies: { slug: string; name: string };
		};

		if (!productions[prod.slug]) {
			productions[prod.slug] = toProduction(prod);
		}

		const name = roleName(role as any);
		const map = role.role_type === 'cast' ? castMap : crewMap;
		if (!map.has(prod.slug)) map.set(prod.slug, []);
		map.get(prod.slug)!.push(name);
	}

	const personData: Person = {
		nameFirst: person.name_first,
		nameLast: person.name_last,
		image: person.image_url || undefined,
		cast: Array.from(castMap.entries()),
		crew: Array.from(crewMap.entries())
	};

	return { person: personData, productions, slug: person.slug };
}

export async function getCompany(supabase: SupabaseClient, slug: string) {
	const { data: company, error: compErr } = await supabase
		.from('companies')
		.select('id, slug, name')
		.eq('slug', slug)
		.single();

	if (compErr || !company) return null;

	const { data: prods, error: prodsErr } = await supabase
		.from('productions')
		.select('slug, opening_date, image_url, shows(slug, title)')
		.eq('company_id', company.id)
		.order('opening_date', { ascending: false });

	if (prodsErr) throw prodsErr;

	const productions: Record<string, Production> = {};
	for (const p of prods ?? []) {
		const show = p.shows as unknown as { slug: string; title: string };
		productions[p.slug] = toProduction({
			...p,
			shows: show,
			companies: { slug: company.slug, name: company.name }
		});
	}

	const companyData: Company = {
		name: company.name,
		productions: (prods ?? []).map((p) => p.slug)
	};

	return { company: companyData, productions };
}

export async function getAllPeople(supabase: SupabaseClient) {
	const { data, error } = await supabase
		.from('people')
		.select('slug, name_first, name_last, image_url')
		.order('name_last', { ascending: true })
		.order('name_first', { ascending: true });

	if (error) throw error;

	const people: Record<string, Person> = {};
	for (const p of data ?? []) {
		people[p.slug] = {
			nameFirst: p.name_first,
			nameLast: p.name_last,
			image: p.image_url || undefined,
			cast: [],
			crew: []
		};
	}
	return people;
}

export async function getAllCompanies(supabase: SupabaseClient) {
	const { data, error } = await supabase
		.from('companies')
		.select('slug, name')
		.order('name', { ascending: true });

	if (error) throw error;

	const companies: Record<string, Company> = {};
	for (const c of data ?? []) {
		companies[c.slug] = { name: c.name, productions: [] };
	}
	return companies;
}

export async function getAllProductions(supabase: SupabaseClient) {
	const { data, error } = await supabase
		.from('productions')
		.select('slug, opening_date, image_url, shows(slug, title), companies(slug, name)')
		.order('opening_date', { ascending: false });

	if (error) throw error;

	const productions: Production[] = [];
	const companies: Record<string, Company> = {};

	for (const p of data ?? []) {
		const show = p.shows as unknown as { slug: string; title: string };
		const company = p.companies as unknown as { slug: string; name: string };

		productions.push(toProduction({ ...p, shows: show, companies: company }));

		if (!companies[company.slug]) {
			companies[company.slug] = { name: company.name, productions: [] };
		}
		companies[company.slug].productions.push(p.slug);
	}

	return { productions, companies };
}

// ---------- Show queries ----------

export async function getAllShows(supabase: SupabaseClient) {
	const { data, error } = await supabase
		.from('shows')
		.select('slug, title, authors, description')
		.order('title', { ascending: true });

	if (error) throw error;

	return (data ?? []).map((s): Show => ({
		title: s.title,
		slug: s.slug,
		authors: s.authors || undefined,
		description: s.description || undefined
	}));
}

export async function getShow(supabase: SupabaseClient, slug: string) {
	const { data: show, error: showErr } = await supabase
		.from('shows')
		.select('id, slug, title, authors, description')
		.eq('slug', slug)
		.single();

	if (showErr || !show) return null;

	// Get all characters for this show
	const { data: chars, error: charErr } = await supabase
		.from('characters')
		.select('id, name, description, sort_order')
		.eq('show_id', show.id)
		.order('sort_order', { ascending: true });

	if (charErr) throw charErr;

	// Get all productions of this show
	const { data: prods, error: prodsErr } = await supabase
		.from('productions')
		.select('slug, opening_date, image_url, companies(slug, name)')
		.eq('show_id', show.id)
		.order('opening_date', { ascending: false });

	if (prodsErr) throw prodsErr;

	const productions: Production[] = (prods ?? []).map((p) => {
		const company = p.companies as unknown as { slug: string; name: string };
		return toProduction({
			...p,
			shows: { slug: show.slug, title: show.title },
			companies: company
		});
	});

	const characters = (chars ?? []).map((c) => ({
		name: c.name,
		description: c.description || undefined
	}));

	const showData: Show = {
		title: show.title,
		slug: show.slug,
		authors: show.authors || undefined,
		description: show.description || undefined
	};

	return { show: showData, characters, productions };
}
