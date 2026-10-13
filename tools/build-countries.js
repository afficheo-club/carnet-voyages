// Génère js/countries.js (195 pays : ISO alpha-2, code numérique world-atlas, continent, nom FR)
const RAW = {
  AF: 'DZ012 AO024 BJ204 BW072 BF854 BI108 CV132 CM120 CF140 TD148 KM174 CG178 CD180 CI384 DJ262 EG818 GQ226 ER232 SZ748 ET231 GA266 GM270 GH288 GN324 GW624 KE404 LS426 LR430 LY434 MG450 MW454 ML466 MR478 MU480 MA504 MZ508 NA516 NE562 NG566 RW646 ST678 SN686 SC690 SL694 SO706 ZA710 SS728 SD729 TZ834 TG768 TN788 UG800 ZM894 ZW716',
  EU: 'AL008 AD020 AT040 BY112 BE056 BA070 BG100 HR191 CY196 CZ203 DK208 EE233 FI246 FR250 DE276 GR300 HU348 IS352 IE372 IT380 LV428 LI438 LT440 LU442 MT470 MD498 MC492 ME499 NL528 MK807 NO578 PL616 PT620 RO642 RU643 SM674 RS688 SK703 SI705 ES724 SE752 CH756 UA804 GB826 VA336',
  AS: 'AF004 AM051 AZ031 BH048 BD050 BT064 BN096 KH116 CN156 GE268 IN356 ID360 IR364 IQ368 IL376 JP392 JO400 KZ398 KW414 KG417 LA418 LB422 MY458 MV462 MN496 MM104 NP524 KP408 OM512 PK586 PS275 PH608 QA634 SA682 SG702 KR410 LK144 SY760 TJ762 TH764 TL626 TR792 TM795 AE784 UZ860 VN704 YE887',
  NA: 'AG028 BS044 BB052 BZ084 CA124 CR188 CU192 DM212 DO214 SV222 GD308 GT320 HT332 HN340 JM388 MX484 NI558 PA591 KN659 LC662 VC670 TT780 US840',
  SA: 'AR032 BO068 BR076 CL152 CO170 EC218 GY328 PY600 PE604 SR740 UY858 VE862',
  OC: 'AU036 FJ242 KI296 MH584 FM583 NR520 NZ554 PW585 PG598 WS882 SB090 TO776 TV798 VU548',
};
const OVERRIDE = { CG: 'Congo', CD: 'RD Congo', MM: 'Myanmar', PS: 'Palestine', VA: 'Vatican', CI: "Côte d'Ivoire", MK: 'Macédoine du Nord', BA: 'Bosnie-Herzégovine', KN: 'Saint-Christophe-et-Niévès' };
const names = new Intl.DisplayNames(['fr'], { type: 'region' });
const topo = require('../vendor/countries-50m.json');
const ids = new Set(topo.objects.countries.geometries.map(g => g.id));
const out = [];
for (const [cont, s] of Object.entries(RAW)) for (const t of s.split(' ')) {
  const a2 = t.slice(0, 2), num = t.slice(2);
  const name = (OVERRIDE[a2] || names.of(a2)).replace(/’/g, "'");
  if (!ids.has(num)) console.warn('absent de la carte :', a2, num, name);
  out.push([a2, num, cont, name]);
}
out.sort((a, b) => a[3].localeCompare(b[3], 'fr'));
console.log('total', out.length, new Set(out.map(o => o[0])).size, new Set(out.map(o => o[1])).size);
require('fs').writeFileSync(__dirname + '/../js/countries.js',
  '// Généré par tools/build-countries.js — [iso2, id numérique world-atlas, continent, nom]\nexport const COUNTRIES = [\n' +
  out.map(o => '  ' + JSON.stringify(o)).join(',\n') + '\n];\n');
