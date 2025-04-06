from yaml import load, dump
from icecream import ic
from jinja2 import Environment, PackageLoader, select_autoescape
from os.path import basename, splitext, exists
from os import mkdir
from shutil import copy2, rmtree
import glob
from time import time
import copy

try:
    from yaml import CLoader as Loader
except ImportError:
    from yaml import Loader
  
def save_people(people):
  tp = copy.deepcopy(people)
  for person, data in tp.items():
    del data['cast']
    del data['crew']
  with open('data/people.yaml', 'w') as f:
    dump(tp, f)
  
def gather_data():
  productions = {}
  companies = {}
  with open('data/people.yaml', 'r') as f:
    people = load(f, Loader=Loader)
  for person, data in people.items():
    data['cast'] = []
    data['crew'] = []
  

  for file in glob.glob('data/productions/*.yaml'):
    with open(file,'r') as f:
      data = load(f, Loader=Loader)
      slug = splitext(basename(file))[0]
      company_slug = slug.split('-')[0]
      if company_slug not in companies.keys():
        companies[company_slug] = {'productions':[],'name':data.get('company') }
      companies[company_slug]['productions'].append(slug)
      for group in ['cast','crew']:
        if data.get(group) is None:
          data[group] = []
        for line in data.get(group,[]):
          role, person = next(iter(dict(line).items()))
          if person is None:
            continue
          if person not in people:
            name_parts = person.split('-')
            people[person] = {
              'nameFirst': str(name_parts[0]).title(),
              'nameLast': "-".join(map(lambda x: str(x).title(), name_parts[1:])),
              }
            people[person]['cast'] = []
            people[person]['crew'] = []
          people[person][group].append((slug,role))
        data[group] = map(lambda x: list(x.items()), data[group])
        grouped = {}
        for row in data[group]:
          key, value = row[0]
          if key not in grouped:
            grouped[key] = []
          grouped[key].append(value)
        data[group] = list(grouped.items())
      data['year'] = data['date'].year
      data['company_slug'] = slug.split('-')[0]
      productions[slug] = data
      save_people(people)
  return productions, people, companies
  
def group_productions_for_person(people):
  for data in people.values():
    for group in ['cast','crew']:
      grouped = {}
      for line in data.get(group,[]):
        slug, role = line
        if slug not in grouped:
          grouped[slug] = []
        grouped[slug].append(role)
      data[group] = list(grouped.items())
  return people

def build_site(productions, people, companies):
  t = time()
  env = Environment(
      loader=PackageLoader("build"),
      autoescape=select_autoescape(),
      trim_blocks = True,
      lstrip_blocks = True,
  )
  rmtree('_site/productions', ignore_errors=True)
  rmtree('_site/people', ignore_errors=True)
  rmtree('_site/companies', ignore_errors=True)
  rmtree('_site/by', ignore_errors=True)
  mkdir('_site/productions')
  mkdir('_site/people')
  mkdir('_site/companies')
  mkdir('_site/by')
  mkdir('_site/by/company')
  mkdir('_site/by/date')
  mkdir('_site/by/title')
  copy2('static/style.css','_site/style.css')
  sorted_productions = []
  for slug, details in productions.items():
    details['slug'] = slug
    sorted_productions.append(details)
  sorted_productions = sorted(sorted_productions, key=lambda x: x['date'], reverse=True)
  template = env.get_template("production.jinja2")
  for production in sorted_productions:
    slug = production['slug']
    if not exists(f'_site/productions/{slug}'): # if the directory does not exist
      mkdir(f'_site/productions/{slug}')
    with open(f'_site/productions/{slug}/index.html', 'w') as f:
      try:
        f.write(template.render(companies = companies, production = production, people = people))
      except:
        ic(production)
        raise
        
  template = env.get_template("person.jinja2")
  for slug, person in people.items():
    if not exists(f'_site/people/{slug}'): # if the directory does not exist
      mkdir(f'_site/people/{slug}')
    with open(f'_site/people/{slug}/index.html', 'w') as f:
      try:
        f.write(template.render(person = person, productions = productions))
      except:
        ic(person)
        raise
      
  template = env.get_template("people.jinja2")
  with open(f'_site/people/index.html', 'w') as f:
    sorted_people = sorted(people.items(), key=lambda x:x[1]['nameLast'])
    f.write(template.render(sorted_people = sorted_people, people = people))
    
  template = env.get_template("index.jinja2")
  with open(f'_site/index.html','w') as f:
    f.write(template.render(productions = sorted_productions, companies = companies))
  
  with open(f'_site/by/date/index.html','w') as f:
    sorted_productions = sorted(sorted_productions, key=lambda x: x['date'], reverse=True)
    f.write(template.render(productions = sorted_productions, companies = companies))
    
  with open(f'_site/by/company/index.html','w') as f:
    sorted_productions = sorted(sorted_productions, key=lambda x: x['company'])
    f.write(template.render(productions = sorted_productions, companies = companies))
    
  with open(f'_site/by/title/index.html','w') as f:
    sorted_productions = sorted(sorted_productions, key=lambda x: x['title'])
    f.write(template.render(productions = sorted_productions, companies = companies))
  template = env.get_template("companies.jinja2")
  with open(f'_site/companies/index.html', 'w') as f:
    f.write(template.render(companies = companies, productions = productions))
  
  template = env.get_template("company.jinja2")
  for slug, company in companies.items():
    company['productions'] = sorted(
      company['productions'], 
      key=lambda x:productions[x]['date'], 
      reverse=True
    )
    if not exists(f'_site/companies/{slug}'):
      mkdir(f'_site/companies/{slug}')
    with open(f'_site/companies/{slug}/index.html', 'w') as f:
      try:
        f.write(template.render(company = company, productions = productions))
      except:
        ic(company)
        raise
  log = f'built {len(productions)} productions and {len(people)} people in {time()-t:0.2f}s.'
  ic(log)
  
if __name__ == "__main__":
  productions, people, companies = gather_data()
  people = group_productions_for_person(people)
  build_site(productions=productions, people=people, companies = companies)
  
    
  