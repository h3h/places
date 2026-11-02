// State and territory names, so the page never shows postal abbreviations like TX, NM or QLD.
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
const MX_STATES = { CDMX: 'Ciudad de México', 'B.C.S.': 'Baja California Sur', 'B.C.': 'Baja California', 'Q.R.': 'Quintana Roo' };

// Spell out the state in a Google Maps address: "Austin, TX 78701" -> "Austin, Texas 78701",
// "New Farm QLD 4005, Australia" -> "New Farm Queensland 4005, Australia", "…, CDMX, Mexico" -> "…, Ciudad de México, Mexico".
export function spellOutAddress(a) {
  if (!a) return a;
  a = a.replace(/, ([A-Z]{2})(?= \d{5}(?:-\d{4})?(?:,|$)|,|$)/g, (m, s) => US_STATES[s] ? `, ${US_STATES[s]}` : m);
  a = a.replace(/ (QLD|NSW|VIC|WA|SA|TAS|NT|ACT) (\d{4})(?=,|$)/g, (m, s, z) => ` ${AU_STATES[s]} ${z}`);
  a = a.replace(/, (CDMX|B\.C\.S\.|B\.C\.|Q\.R\.)(?=,|$)/g, (m, s) => `, ${MX_STATES[s]}`);
  return a.replace(/(Ciudad de México), Ciudad de México(?=,|$)/, '$1'); // CDMX after the city name repeats it
}
