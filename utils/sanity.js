const sanityClient = require("@sanity/client");
const projectId = "g8vgowfg";
const imageUrl = require("@sanity/image-url");

const client = sanityClient.createClient({
  projectId,
  dataset: "tcctdb",
  useCdn: true,
  apiVersion: "v2022-03-07",
});

function generateImageData({ photo }) {
  return {
    src_sm: `${imageUrl(client).image(photo).width(300).height(300).url()}`,
    src_tl: `${imageUrl(client).image(photo).width(480).height(600).url()}`,
    src_lg: `${imageUrl(client).image(photo).width(3000).url()}`,
  };
}

module.exports = {client, generateImageData}