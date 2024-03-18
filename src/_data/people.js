const groq = require('groq')
const {client, generateImageData} = require("./sanity.js");

const yearSort = (a,b) => {
	let result = (parseInt(a.production.year) > parseInt(b.production.year))
	return result
}
module.exports = async function () {
  const query = groq`*[_type == 'person' && (!excludePerson || !defined(excludePerson))]|order(nameFirst asc)|order(nameLast asc){
    "slug":slug.current,
		'title':nameFirst + " " + nameLast,
    nameLast,
    nameFirst,
    headshot,
    'raw_assignments': *[ _type == 'assignment' && references(^._id)]|order(production.performanceDates[0].dateAndTime asc){
			'jobName':job->jobName,
			production->{
				'title':show->title,
				'company':company->name,
				poster,
				slug,
				'firstDate':performanceDates[0].dateAndTime}
			},
		'raw_roles': *[ _type == 'role' && references(^._id)]|order(production.performanceDates[0].dateAndTime asc){
			'characterName':character->characterName,
			production->{
				'title':show->title,
				'company':company->name,
				poster,
				slug,
				'firstDate':performanceDates[0].dateAndTime},
				castMember
			},
  }`;
  let people = await client.fetch(query);

	for (let person of people) {
		let assignments = {}
		for (let assignment of person.raw_assignments) {
			if (!assignments.hasOwnProperty(assignment.production.slug.current)) {
				assignment.production.year = assignment.production.firstDate.slice(0,4)
				assignments[assignment.production.slug.current] = {production: assignment.production, assignments:[]}
			}
			assignments[assignment.production.slug.current].assignments.push(assignment)
		}
		let roles = {}
		for (let role of person.raw_roles) {
			if (!roles.hasOwnProperty(role.production.slug.current)) {
				role.production.year = role.production.firstDate.slice(0,4)
				roles[role.production.slug.current] = {production: role.production, roles:[]}
			}
			roles[role.production.slug.current].roles.push(role)
		}
		let rolesArray = Object.values(roles)
		rolesArray.sort(yearSort)
		person.roles = rolesArray
		let assignmentsArray = Object.values(assignments)
		assignmentsArray.sort(yearSort)
		person.assignments = assignmentsArray
	}
  return people;
}