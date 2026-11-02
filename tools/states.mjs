// Place text for the page: state names spelled out (never TX, NM or QLD), and a card line of
// just city, state and country (no street or postal code: this is for reading, not mailing).
export const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
const AU_STATES = {
  QLD: 'Queensland', NSW: 'New South Wales', VIC: 'Victoria', WA: 'Western Australia', SA: 'South Australia',
  TAS: 'Tasmania', NT: 'Northern Territory', ACT: 'Australian Capital Territory',
};
// Mexico City (CDMX) is left out: its city name already says it
const MX_STATES = { 'B.C.S.': 'Baja California Sur', 'B.C.': 'Baja California', 'Q.R.': 'Quintana Roo' };

// "Austin, Texas, United States", "New Farm, Queensland, Australia", "Lucerne, Switzerland".
// The city is the enriched display city (ci); a city borrowed from a nearby place reads "near …".
// US states come from ci; Australian and Mexican ones from the raw address fields when present.
export function placeLine(p) {
  const i = p.ci ? p.ci.indexOf(', ') : -1;
  const city = i < 0 ? p.ci : p.ci.slice(0, i);
  let state = p.co === 'United States' && i >= 0 ? p.ci.slice(i + 2) : null;
  const au = p.co === 'Australia' && /\b(QLD|NSW|VIC|WA|SA|TAS|NT|ACT)\b/.exec(`${p.c || ''} ${p.a || ''}`);
  if (au) state = AU_STATES[au[1]];
  const mx = p.co === 'Mexico' && /, (B\.C\.S\.|B\.C\.|Q\.R\.), Mexico$/.exec(p.a || '');
  if (mx) state = MX_STATES[mx[1]];
  const parts = [city, state, p.co].filter((x, j, a) => x && x !== a[j - 1]); // "Baja California Sur, Baja California Sur"
  return parts.length ? (p.cin ? 'near ' : '') + parts.join(', ') : '';
}
