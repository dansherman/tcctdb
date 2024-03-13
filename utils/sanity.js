const sanityClient = require("@sanity/client");
const projectId = "g8vgowfg";
const imageUrl = require("@sanity/image-url");

const client = sanityClient.createClient({
  projectId,
  dataset: "tcctdb",
  useCdn: true,
  apiVersion: "v2022-03-07",
});


const imgSizes = {
  "xs":{
    width: 96,
    height: 96
  },
  "sm":{
    width: 128,
    height: 128
  },
  "md":{
    width: 512,
    height: 512
  },
  "lg":{
    width: 1024,
    height: 1024
  },
  "xl":{
    width: 2048,
    height: 2048
  },
  "pt":{
    width: 256,
    height: 512
  }
}
function generateImageData(photoData, targetSize = "md") {
  let {photo} = photoData
  let {width, height} = imgSizes[targetSize]
  return imageUrl(client).image(photo).width(width).height(height).url()
}
module.exports = {client, generateImageData, imgSizes}