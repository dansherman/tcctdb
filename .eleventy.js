const blocksToHtml = require('@sanity/block-content-to-html')

module.exports = function(eleventyConfig) {
  eleventyConfig.addWatchTarget("./css/")
  eleventyConfig.addFilter('sanityToHTML', function(value) {
    return blocksToHtml({
      blocks: value,
    })
  })
};


