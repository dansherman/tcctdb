const groq = require("groq");
const {client, generateImageData} = require("../utils/sanity.js");


async function getImages() {
  // Learn more: https://www.sanity.io/docs/data-store/how-queries-work
  const query = groq`*[_type == 'photo']{_id,photo,caption}`;
  const photos = await client.fetch(query).catch((err) => console.error(err));
  const preparePosts = photos.map(generateImageData);
  return preparePosts;
}

module.exports = getImages;