import type { SupabaseClient } from '@supabase/supabase-js';

// ---------- Public interfaces (unchanged from before) ----------

export interface Person {
	nameFirst: string;
	nameLast: string;
	image?: string;
	cast: [string, string[]][]; // [production-slug, roles[]]
	crew: [string, string[]][]; // [production-slug, jobs[]]
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

// ---------- Supabase queries ----------

export async function gatherData(supabase: SupabaseClient): Promise<SiteData> {
	// Fetch all data in parallel
	const [companiesRes, peopleRes, productionsRes, rolesRes] = await Promise.all([
		supabase.from('companies').select('id, slug, name'),
		supabase.from('people').select('id, slug, name_first, name_last, image_url'),
		supabase
			.from('productions')
			.select('id, slug, title, company_id, opening_date, image_url, companies(slug, name)')
			.order('opening_date', { ascending: false }),
		supabase
			.from('roles')
			.select('production_id, person_id, role_name, role_type, sort_order, productions(slug), people(slug)')
			.order('sort_order', { ascending: true })
	]);

	if (companiesRes.error) throw companiesRes.error;
	if (peopleRes.error) throw peopleRes.error;
	if (productionsRes.error) throw productionsRes.error;
	if (rolesRes.error) throw rolesRes.error;

	// Build lookup maps by id
	const companyById = new Map<string, { slug: string; name: string }>();
	const companies: Record<string, Company> = {};
	for (const c of companiesRes.data) {
		companyById.set(c.id, { slug: c.slug, name: c.name });
		companies[c.slug] = { name: c.name, productions: [] };
	}

	const personById = new Map<string, string>(); // id → slug
	const people: Record<string, Person> = {};
	for (const p of peopleRes.data) {
		personById.set(p.id, p.slug);
		people[p.slug] = {
			nameFirst: p.name_first,
			nameLast: p.name_last,
			image: p.image_url || undefined,
			cast: [],
			crew: []
		};
	}

	const productionById = new Map<string, string>(); // id → slug
	const productions: Record<string, Production> = {};
	for (const p of productionsRes.data) {
		productionById.set(p.id, p.slug);
		const company = p.companies as unknown as { slug: string; name: string };
		const date = new Date(p.opening_date);

		productions[p.slug] = {
			title: p.title,
			company: company.name,
			date,
			year: date.getFullYear(),
			slug: p.slug,
			companySlug: company.slug,
			image: p.image_url || undefined,
			cast: [],
			crew: []
		};

		// Register production under its company
		if (companies[company.slug]) {
			companies[company.slug].productions.push(p.slug);
		}
	}

	// Process roles into the production and person data structures
	// Group by production + role_type, maintaining order
	const prodRoleGroups = new Map<string, Map<string, string[]>>(); // prodSlug → Map<roleName, personSlugs[]>
	const prodCrewGroups = new Map<string, Map<string, string[]>>();
	const personCastMap = new Map<string, Map<string, string[]>>(); // personSlug → Map<prodSlug, roles[]>
	const personCrewMap = new Map<string, Map<string, string[]>>();

	for (const role of rolesRes.data) {
		const prodSlug = (role.productions as unknown as { slug: string }).slug;
		const personSlug = (role.people as unknown as { slug: string }).slug;

		if (role.role_type === 'cast') {
			// Production side: group person slugs by role name
			if (!prodRoleGroups.has(prodSlug)) prodRoleGroups.set(prodSlug, new Map());
			const roleMap = prodRoleGroups.get(prodSlug)!;
			if (!roleMap.has(role.role_name)) roleMap.set(role.role_name, []);
			roleMap.get(role.role_name)!.push(personSlug);

			// Person side: group roles by production slug
			if (!personCastMap.has(personSlug)) personCastMap.set(personSlug, new Map());
			const castMap = personCastMap.get(personSlug)!;
			if (!castMap.has(prodSlug)) castMap.set(prodSlug, []);
			castMap.get(prodSlug)!.push(role.role_name);
		} else {
			if (!prodCrewGroups.has(prodSlug)) prodCrewGroups.set(prodSlug, new Map());
			const crewMap = prodCrewGroups.get(prodSlug)!;
			if (!crewMap.has(role.role_name)) crewMap.set(role.role_name, []);
			crewMap.get(role.role_name)!.push(personSlug);

			if (!personCrewMap.has(personSlug)) personCrewMap.set(personSlug, new Map());
			const jobMap = personCrewMap.get(personSlug)!;
			if (!jobMap.has(prodSlug)) jobMap.set(prodSlug, []);
			jobMap.get(prodSlug)!.push(role.role_name);
		}
	}

	// Apply grouped roles to production objects
	for (const [prodSlug, roleMap] of prodRoleGroups) {
		if (productions[prodSlug]) {
			productions[prodSlug].cast = Array.from(roleMap.entries());
		}
	}
	for (const [prodSlug, crewMap] of prodCrewGroups) {
		if (productions[prodSlug]) {
			productions[prodSlug].crew = Array.from(crewMap.entries());
		}
	}

	// Apply grouped roles to person objects
	for (const [personSlug, castMap] of personCastMap) {
		if (people[personSlug]) {
			people[personSlug].cast = Array.from(castMap.entries());
		}
	}
	for (const [personSlug, jobMap] of personCrewMap) {
		if (people[personSlug]) {
			people[personSlug].crew = Array.from(jobMap.entries());
		}
	}

	const sortedProductions = Object.values(productions).sort(
		(a, b) => b.date.getTime() - a.date.getTime()
	);

	return { productions, people, companies, sortedProductions };
}

// ---------- Focused queries (avoid loading everything for single-entity pages) ----------

export async function getProduction(supabase: SupabaseClient, slug: string) {
	const { data: prod, error: prodErr } = await supabase
		.from('productions')
		.select('id, slug, title, opening_date, image_url, companies(slug, name)')
		.eq('slug', slug)
		.single();

	if (prodErr || !prod) return null;

	const company = prod.companies as unknown as { slug: string; name: string };

	const { data: roles, error: rolesErr } = await supabase
		.from('roles')
		.select('role_name, role_type, sort_order, people(slug, name_first, name_last, image_url)')
		.eq('production_id', prod.id)
		.order('sort_order', { ascending: true });

	if (rolesErr) throw rolesErr;

	// Build people map and cast/crew arrays
	const people: Record<string, Person> = {};
	const castGroups = new Map<string, string[]>();
	const crewGroups = new Map<string, string[]>();

	for (const role of roles ?? []) {
		const person = role.people as unknown as {
			slug: string;
			name_first: string;
			name_last: string;
			image_url: string | null;
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

		const groups = role.role_type === 'cast' ? castGroups : crewGroups;
		if (!groups.has(role.role_name)) groups.set(role.role_name, []);
		groups.get(role.role_name)!.push(person.slug);
	}

	const production: Production = {
		title: prod.title,
		company: company.name,
		date: new Date(prod.opening_date),
		year: new Date(prod.opening_date).getFullYear(),
		slug: prod.slug,
		companySlug: company.slug,
		image: prod.image_url || undefined,
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
		.select('role_name, role_type, productions(slug, title, opening_date, image_url, companies(slug, name))')
		.eq('person_id', person.id)
		.order('sort_order', { ascending: true });

	if (rolesErr) throw rolesErr;

	// Group roles by production
	const castMap = new Map<string, string[]>();
	const crewMap = new Map<string, string[]>();
	const productions: Record<string, Production> = {};

	for (const role of roles ?? []) {
		const prod = role.productions as unknown as {
			slug: string;
			title: string;
			opening_date: string;
			image_url: string | null;
			companies: { slug: string; name: string };
		};

		if (!productions[prod.slug]) {
			productions[prod.slug] = {
				title: prod.title,
				company: prod.companies.name,
				date: new Date(prod.opening_date),
				year: new Date(prod.opening_date).getFullYear(),
				slug: prod.slug,
				companySlug: prod.companies.slug,
				image: prod.image_url || undefined,
				cast: [],
				crew: []
			};
		}

		const map = role.role_type === 'cast' ? castMap : crewMap;
		if (!map.has(prod.slug)) map.set(prod.slug, []);
		map.get(prod.slug)!.push(role.role_name);
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
		.select('slug, title, opening_date, image_url')
		.eq('company_id', company.id)
		.order('opening_date', { ascending: false });

	if (prodsErr) throw prodsErr;

	const productions: Record<string, Production> = {};
	for (const p of prods ?? []) {
		productions[p.slug] = {
			title: p.title,
			company: company.name,
			date: new Date(p.opening_date),
			year: new Date(p.opening_date).getFullYear(),
			slug: p.slug,
			companySlug: company.slug,
			image: p.image_url || undefined,
			cast: [],
			crew: []
		};
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
		.select('slug, title, opening_date, image_url, companies(slug, name)')
		.order('opening_date', { ascending: false });

	if (error) throw error;

	const productions: Production[] = [];
	const companies: Record<string, Company> = {};

	for (const p of data ?? []) {
		const company = p.companies as unknown as { slug: string; name: string };
		productions.push({
			title: p.title,
			company: company.name,
			date: new Date(p.opening_date),
			year: new Date(p.opening_date).getFullYear(),
			slug: p.slug,
			companySlug: company.slug,
			image: p.image_url || undefined,
			cast: [],
			crew: []
		});

		if (!companies[company.slug]) {
			companies[company.slug] = { name: company.name, productions: [] };
		}
		companies[company.slug].productions.push(p.slug);
	}

	return { productions, companies };
}
