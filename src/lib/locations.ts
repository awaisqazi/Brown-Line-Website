// Dropdown data for the public "submit an event" form, from the Events DB Spec.

export const LOCATION_TYPES = ['Chicago', 'Suburb', 'Other Illinois', 'Outside Illinois'] as const;

// Diaspora community tags. `value` is the canonical tag stored on events (so the
// events Category filter stays consistent); `label` is what the submitter sees.
export const DIASPORA_TAGS: { value: string; label: string }[] = [
  { value: 'South Asian', label: 'South Asian' },
  { value: 'SWANA', label: 'SWANA' },
  { value: 'East Asian', label: 'East Asian' },
  { value: 'Southeast Asian', label: 'Southeast Asian' },
  { value: 'Black Diaspora', label: 'Black Diaspora' },
  { value: 'Latine', label: 'Latine' },
  { value: 'Afro-Latine', label: 'Afro-Latine' },
  { value: 'Indigenous', label: 'Indigenous' },
  { value: 'Cross-cultural', label: 'Multi-diaspora / Cross-cultural' },
];

// Chicago's 77 official community areas, grouped by side for <optgroup>s.
export const NEIGHBORHOOD_GROUPS: { side: string; names: string[] }[] = [
  {
    side: 'North Side',
    names: [
      'Rogers Park', 'West Ridge', 'Uptown', 'Lincoln Square', 'North Center',
      'Lake View', 'Lincoln Park', 'Edison Park', 'Norwood Park', 'Jefferson Park',
      'Forest Glen', 'North Park', 'Albany Park', 'Portage Park', 'Irving Park',
      'Dunning', 'Montclare', 'Belmont Cragin', "O'Hare", 'Edgewater',
    ],
  },
  {
    side: 'West / Central',
    names: [
      'Near North Side', 'Hermosa', 'Avondale', 'Logan Square', 'Humboldt Park',
      'West Town', 'Austin', 'West Garfield Park', 'East Garfield Park',
      'Near West Side', 'North Lawndale', 'South Lawndale', 'Lower West Side', 'Loop',
    ],
  },
  {
    side: 'South Side',
    names: [
      'Near South Side', 'Armour Square', 'Douglas', 'Oakland', 'Fuller Park',
      'Grand Boulevard', 'Kenwood', 'Washington Park', 'Hyde Park', 'Woodlawn',
      'South Shore', 'Chatham', 'Avalon Park', 'South Chicago', 'Burnside',
      'Calumet Heights', 'Roseland', 'Pullman', 'South Deering', 'East Side',
      'West Pullman', 'Riverdale', 'Hegewisch',
    ],
  },
  {
    side: 'Southwest Side',
    names: [
      'Garfield Ridge', 'Archer Heights', 'Brighton Park', 'McKinley Park',
      'Bridgeport', 'New City', 'West Elsdon', 'Gage Park', 'Clearing', 'West Lawn',
      'Chicago Lawn', 'West Englewood', 'Englewood', 'Greater Grand Crossing',
      'Ashburn', 'Auburn Gresham', 'Beverly', 'Washington Heights', 'Mount Greenwood',
      'Morgan Park',
    ],
  },
];

// Suburbs with notable diaspora communities, plus an "Other" free-text escape.
export const SUBURBS: string[] = [
  'Evanston',
  'Skokie',
  'Bridgeview',
  'Oak Park',
  'Cicero',
  'Berwyn',
  'Des Plaines',
  'Niles',
  'Schaumburg',
  'Worth / Palos Hills / Orland Park area',
  'Other',
];
