import products from '../data/supplier-products.json';

const search = document.querySelector('#search');
const category = document.querySelector('#category');
const grid = document.querySelector('#grid');
const count = document.querySelector('#count');
const supplierFilter = document.createElement('select');
supplierFilter.id = 'supplier';
supplierFilter.setAttribute('aria-label', 'Gyártó');
supplierFilter.innerHTML = '<option value="">Minden gyártó</option>';
document.querySelector('.toolbar').append(supplierFilter);

for (const value of [...new Set(products.map(p => p.category))].sort()) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  category.append(option);
}
for (const value of [...new Set(products.map(p => p.manufacturer))].sort()) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  supplierFilter.append(option);
}

function render() {
  const query = search.value.trim().toLocaleLowerCase('hu');
  const filtered = products.filter(p =>
    (!category.value || p.category === category.value) &&
    (!supplierFilter.value || p.manufacturer === supplierFilter.value) &&
    [p.name, p.category, p.manufacturer, p.sku, p.ean].join(' ').toLocaleLowerCase('hu').includes(query)
  );

  grid.replaceChildren();
  count.textContent = filtered.length + ' ellenőrzött gyártói mintatermék (Maxima / HENDI)';
  for (const product of filtered) {
    const card = document.createElement('article');
    card.className = 'product';
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = product.manufacturer === 'Maxima' ? 'M' : 'H';
    const details = document.createElement('div');
    details.className = 'details';
    const name = document.createElement('h3');
    name.textContent = product.name;
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = product.manufacturer + ' · ' + product.category;
    const sku = document.createElement('p');
    sku.className = 'meta';
    sku.textContent = 'Cikkszám: ' + product.sku + ' · EAN: ' + product.ean;
    const description = document.createElement('p');
    description.textContent = product.description;
    const specifications = document.createElement('p');
    specifications.className = 'meta';
    specifications.textContent = Object.entries(product.specifications || {})
      .map(([key, value]) => key + ': ' + value).join(' · ');
    const source = document.createElement('a');
    source.href = product.source_url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Gyártói termékoldal';
    details.append(name, meta, sku, description, specifications, source);
    card.append(placeholder, details);
    grid.append(card);
  }
}

for (const element of [search, category, supplierFilter]) {
  element.addEventListener(element === search ? 'input' : 'change', render);
}
render();
