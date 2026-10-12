'use strict';
// School search and UI use only the adapter contract. Backgrounds are separate
// configuration: change their style URLs without changing school interactions.
const schoolMapProviders = {
  engine: 'maplibre',
  defaultBackground: 'quiet',
  library: {
    script: 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.js',
    stylesheet: 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.css'
  },
  backgrounds: {
    quiet: {label: 'Quiet', kind: 'vector-style', url: 'https://tiles.openfreemap.org/styles/positron'},
    streets: {label: 'Street detail', kind: 'vector-style', url: 'https://tiles.openfreemap.org/styles/bright'}
  },
  colors: {point: '#49756b', cluster: '#49756b', text: '#ffffff', highlight: '#28679d', halo: '#ffffff'}
};

function schoolMapBackgroundChoices() {
  return Object.entries(schoolMapProviders.backgrounds).map(([key, definition]) => ({key, label:definition.label}));
}

const schoolMapEngines = {
  maplibre: async options => createMapLibreSchoolAdapter(options)
};

async function createSchoolMap(options) {
  const factory = schoolMapEngines[schoolMapProviders.engine];
  if (!factory) throw new Error('This map engine is unavailable.');
  return factory({...options, config: schoolMapProviders});
}
