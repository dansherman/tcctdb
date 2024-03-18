const groq = require("groq");
const {client} = require("./sanity.js");


async function getImages() {
  // Learn more: https://www.sanity.io/docs/data-store/how-queries-work
  const query = groq`*[_type == 'photo']{_id,photo,caption, "attribution":attribution->name,roles[]->{"characterName":character->characterName, castMember{"name":person->nameFirst + " " + person->nameLast, "slug":person->slug}}}`;
  const photos = await client.fetch(query).catch((err) => console.error(err));
  return photos;
}

module.exports = getImages;