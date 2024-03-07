const {} = require("@sanity/client");
const groq = require("groq");
const { client, generateImageData } = require("../utils/sanity.js");

module.exports = async function () {
    const query = groq`*[_type == 'production']|order(performanceDates[0].dateAndTime desc){
    'title':show->title + " " + company->name,
    description,
    slug,
    poster,
    'photos':*[_type=='photo' && references(^._id)]{'_id':_id,caption,photo,'metadata':photo.asset->metadata,"attribution":attribution->name,roles[]->{"characterName":character->characterName, castMember{"name":person->nameFirst + " " + person->nameLast, "slug":person->slug}}},
    show->,
    company->{name,logo, slug},
    'year':performanceDates[0].dateAndTime,
    'cast':*[_type=='character' && references(^.show._ref)]|order(orderRank asc){
      characterName,
      roleSize,
      'castMembers':*[ _type == 'role' && references(^.^._id) && character->characterName==^.characterName && !(_id in path("drafts.**"))]{
          'castMember':castMember.person->{
            nameLast,
            nameFirst,
            slug,
            _id,
            "name":nameFirst + " " + nameLast,
            headshot,
          },
          'characterPhotos':castMember.characterPhotos
        }
    },
    'crew':*[_type=="job" ]|order(orderRank asc){
        _id,
        jobName,
        orderRank,
        'crewMembers':*[ _type == 'assignment' && references(^.^._id) && job->jobName==^.jobName && !(_id in path("drafts.**"))]{
          'crewMember':crewMember.person->{
            nameLast,
            nameFirst,
            slug,
            _id,
            "name":nameFirst + " " + nameLast,
            headshot,
          }
        }
    }
  }`;
    let productions = await client.fetch(query);
    productions = productions.map((p) => {
        if (p.year != null) {
            p.year = p.year.slice(0, 4);
        } else {
            p.year = "—";
        }
        p.photosrc = p.photos.map(generateImageData);
        if (p.poster) {
            p.postersrc = generateImageData({photo:p.poster});
        } else {
            p.postersrc = { src_sm: "", src_lg: "" };
        }
        return p;
    });

    return productions;
};
