const blocksToHtml = require("@sanity/block-content-to-html");
const pluginWebc = require("@11ty/eleventy-plugin-webc");
const { EleventyRenderPlugin } = require("@11ty/eleventy");
const { imgSizes } = require("./src/_data/sanity.js");
const sanityClient = require("@sanity/client");
const projectId = "g8vgowfg";
const imageUrl = require("@sanity/image-url");
const path = require('path')

const browserslist = require("browserslist");
const { bundle, browserslistToTargets } = require("lightningcss");

const client = sanityClient.createClient({
    projectId,
    dataset: "tcctdb",
    useCdn: true,
    apiVersion: "v2022-03-07",
});

module.exports = function (eleventyConfig) {
    eleventyConfig.addWatchTarget("./css/");

    
    eleventyConfig.addPassthroughCopy("bundle.js");
    
    eleventyConfig.addPassthroughCopy("**/*.ttf");
    eleventyConfig.addPassthroughCopy("**/*.svg");
    
    eleventyConfig.addPlugin(EleventyRenderPlugin);

    eleventyConfig.addShortcode("svgClose", function () {
        return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
    });
    eleventyConfig.addShortcode("svgUser", function () {
        return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>`;
    });
    eleventyConfig.addShortcode("svgShow", function () {
        return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>`;
    });
    eleventyConfig.addShortcode(
        "imageSrc",
        function (photoData, targetSize, square = false) {
            let value = "";
            if (photoData) {
                let { width, height } = imgSizes[targetSize];
                if (square) {
                    value = imageUrl(client)
                        .image(photoData)
                        .width(width)
                        .height(height)
                        .url();
                    // .replace(/\s/g, "");
                } else {
                    value = imageUrl(client)
                        .image(photoData)
                        .width(width)
                        .url();
                    // .replace(/\s/g, "");
                }
            }
            return value;
        },
    );
    eleventyConfig.addFilter("year", function (value) {
        return value.slice(0, 4)
    })
    eleventyConfig.addFilter("sanityToHTML", function (value) {
        return blocksToHtml({
            blocks: value,
        });
    });

    eleventyConfig.addTemplateFormats('css')
    eleventyConfig.addExtension("css", {
        outputFileExtension: "css",
        compile: async function (_inputContent, inputPath) {
            let parsed = path.parse(inputPath);
            if (parsed.name.startsWith("_")) {
                return;
            }

            let targets = browserslistToTargets(
                browserslist("> 0.2% and not dead"),
            );

            return async () => {
                let { code, map } = await bundle({
                    filename: inputPath,
                    minify: true,
                    sourceMap: false,
                    targets,
                    drafts: {
                        nesting: true,
                    },
                });
                return code;
            };
        },
    });
    return {
        dir: {
        input: "src",
        output: "_site"
      }}
};
