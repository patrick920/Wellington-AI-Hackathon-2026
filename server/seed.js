/**
 * seed.js
 * -------
 * The starting dataset for LoopNZ. This is what fills the marketplace when you
 * first run the app (or after you delete data/db.json).
 *
 * Everything here is modelled on real New Zealand primary-industry waste
 * streams. The numbers (tonnages, CO2e factors, disposal costs) are realistic
 * order-of-magnitude estimates for a hackathon demo, NOT audited figures.
 *
 * HOW TO ADD YOUR OWN LISTING:
 * Copy any object in SEED_LISTINGS, change the fields, and delete data/db.json
 * so the app re-seeds on next start.
 *
 * FIELD GUIDE for a listing:
 *   category      - one of CATEGORIES below (drives filters + icons)
 *   quantity      - { amount, unit, frequency } e.g. 40 tonnes per week
 *   shelfLifeDays - how long before the material spoils / loses value.
 *                   Critical for primary industry: wet organics rot fast.
 *   priceType     - 'free' | 'paid' | 'negotiable' | 'pay-to-take'
 *                   ('pay-to-take' = the producer PAYS you to remove it,
 *                    because that's still cheaper than landfill for them)
 *   visibility    - 'public'  = anyone can see it in Browse
 *                   'private' = hidden from Browse, but the AI matcher may
 *                               reveal it to a genuinely strong match
 *   co2PerTonne   - tonnes of CO2e avoided per tonne diverted from landfill
 *   disposalCostPerTonne - NZD the producer currently pays to dump it
 */

/** Top-level categories. Each has an emoji used throughout the UI. */
export const CATEGORIES = [
  { id: 'horticulture',   label: 'Horticulture',        icon: '🥝' },
  { id: 'dairy',          label: 'Dairy',               icon: '🥛' },
  { id: 'meat-seafood',   label: 'Meat & Seafood',      icon: '🐟' },
  { id: 'forestry',       label: 'Forestry & Timber',   icon: '🌲' },
  { id: 'viticulture',    label: 'Viticulture & Brewing', icon: '🍇' },
  { id: 'arable',         label: 'Arable & Cropping',   icon: '🌾' },
  { id: 'aquaculture',    label: 'Aquaculture',         icon: '🦪' },
  { id: 'wool-fibre',     label: 'Wool & Fibre',        icon: '🐑' },
  { id: 'food-processing',label: 'Food Processing',     icon: '🏭' },
  { id: 'agri-plastics',  label: 'Agri-Plastics',       icon: '♻️' }
];

/** Units a producer can measure their waste in. */
export const UNITS = ['tonnes', 'kg', 'cubic metres', 'litres', 'bales', 'pallets'];

/** How often the waste becomes available. */
export const FREQUENCIES = ['one-off', 'daily', 'weekly', 'fortnightly', 'monthly', 'seasonal'];

/**
 * Rough conversion of a listing's quantity into tonnes, so we can compute
 * consistent impact statistics no matter what unit the user chose.
 * These densities are approximations — fine for a demo dashboard.
 */
export const UNIT_TO_TONNES = {
  tonnes: 1,
  kg: 0.001,
  'cubic metres': 0.4,   // assume ~400kg/m3 for loose organic material
  litres: 0.001,
  bales: 0.25,           // ~250kg per large bale
  pallets: 0.5           // ~500kg per loaded pallet
};

/** How many times per year each frequency occurs (used to annualise impact). */
export const FREQUENCY_PER_YEAR = {
  'one-off': 1,
  daily: 250,        // working days
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  seasonal: 3        // ~3 months of a harvest season
};

/**
 * The seed listings. ~28 realistic NZ primary-industry waste streams.
 * `ownerId: 'demo'` marks them as demo data rather than something you created.
 */
export const SEED_LISTINGS = [
  {
    title: 'Kiwifruit skin & pomace from packhouse grading',
    wasteType: 'Kiwifruit skin and pomace',
    category: 'horticulture',
    description:
      'Green and SunGold kiwifruit rejects, skins and press pomace from our Te Puke packhouse line. Currently trucked to landfill at real cost. High in pectin, vitamin C, and actinidin enzyme. Available in 1 tonne bulk bins, loaded onto your truck.',
    quantity: { amount: 42, unit: 'tonnes', frequency: 'weekly' },
    region: 'Bay of Plenty',
    city: 'Te Puke',
    shelfLifeDays: 4,
    condition: 'fresh',
    priceType: 'pay-to-take',
    price: 20,
    visibility: 'public',
    contact: { org: 'Puketai Packhouse Co-op', name: 'Hine Ropata', email: 'hine@puketai.example.nz', phone: '07 555 0142' },
    suggestedUses: [
      'Actinidin enzyme extraction for meat tenderiser',
      'Pectin for food gelling agents',
      'Cosmetic-grade fruit acid (AHA) exfoliants',
      'Stock feed supplement when ensiled',
      'Anaerobic digestion feedstock for biogas'
    ],
    co2PerTonne: 0.62,
    disposalCostPerTonne: 195,
    ownerId: 'demo'
  },
  {
    title: 'Grape marc (skins, seeds, stems) — vintage surplus',
    wasteType: 'Grape marc',
    category: 'viticulture',
    description:
      'Sauvignon Blanc and Pinot Noir marc from a mid-size Marlborough winery. Currently spread on paddocks but we produce far more than the land can absorb. Rich in polyphenols and grape seed oil.',
    quantity: { amount: 180, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Marlborough',
    city: 'Blenheim',
    shelfLifeDays: 10,
    condition: 'fresh',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Wairau Bend Wines', name: 'Tom Fairweather', email: 'tom@wairaubend.example.nz', phone: '03 555 0198' },
    suggestedUses: [
      'Grape seed oil cold-pressing',
      'Polyphenol / resveratrol nutraceutical extraction',
      'Natural textile dye (deep purple)',
      'Compost and vineyard soil conditioner',
      'Grappa / distillate production'
    ],
    co2PerTonne: 0.58,
    disposalCostPerTonne: 90,
    ownerId: 'demo'
  },
  {
    title: 'Apple pomace from juicing line',
    wasteType: 'Apple pomace',
    category: 'horticulture',
    description:
      'Pressed apple solids from our Hastings juice plant. Consistent moisture content, no additives, loaded same-day. We run six days a week through the season.',
    quantity: { amount: 26, unit: 'tonnes', frequency: 'weekly' },
    region: "Hawke's Bay",
    city: 'Hastings',
    shelfLifeDays: 3,
    condition: 'fresh',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Heretaunga Juice Ltd', name: 'Sam Peterson', email: 'sam@heretaungajuice.example.nz', phone: '06 555 0113' },
    suggestedUses: [
      'Apple pectin extraction',
      'High-fibre flour for baking',
      'Pig and cattle feed',
      'Dietary fibre supplements',
      'Biochar feedstock'
    ],
    co2PerTonne: 0.60,
    disposalCostPerTonne: 175,
    ownerId: 'demo'
  },
  {
    title: 'Whey permeate — surplus from cheese plant',
    wasteType: 'Whey permeate',
    category: 'dairy',
    description:
      'Lactose-rich permeate stream left after protein recovery. Currently irrigated to land, which is nutrient-loading our consented area. Tanker collection required.',
    quantity: { amount: 55000, unit: 'litres', frequency: 'daily' },
    region: 'Waikato',
    city: 'Morrinsville',
    shelfLifeDays: 2,
    condition: 'liquid',
    priceType: 'pay-to-take',
    price: 8,
    visibility: 'public',
    contact: { org: 'Piako Valley Dairy', name: 'Aroha Ngata', email: 'aroha@piakovalley.example.nz', phone: '07 555 0166' },
    suggestedUses: [
      'Lactose crystallisation for pharmaceutical excipients',
      'Fermentation substrate for lactic acid / bioethanol',
      'Calf milk replacer base',
      'Prebiotic galacto-oligosaccharide production'
    ],
    co2PerTonne: 0.35,
    disposalCostPerTonne: 45,
    ownerId: 'demo'
  },
  {
    title: 'Untreated pine sawdust and shavings',
    wasteType: 'Pine sawdust',
    category: 'forestry',
    description:
      'Clean, untreated radiata pine sawdust and planer shavings from our Rotorua sawmill. No CCA, no glue, no paint. Bulk loaded or in 1m³ bulka bags.',
    quantity: { amount: 300, unit: 'cubic metres', frequency: 'weekly' },
    region: 'Bay of Plenty',
    city: 'Rotorua',
    shelfLifeDays: 365,
    condition: 'dry',
    priceType: 'negotiable',
    price: 15,
    visibility: 'public',
    contact: { org: 'Whakarewa Timber', name: 'Dave Lin', email: 'dave@whakarewatimber.example.nz', phone: '07 555 0177' },
    suggestedUses: [
      'Animal bedding for poultry and equine',
      'Mushroom growing substrate',
      'Wood pellet fuel manufacture',
      'Bioplastic / wood-plastic composite filler',
      'Nanocellulose extraction research'
    ],
    co2PerTonne: 1.10,
    disposalCostPerTonne: 60,
    ownerId: 'demo'
  },
  {
    title: 'Green-lipped mussel shells (washed)',
    wasteType: 'Mussel shell',
    category: 'aquaculture',
    description:
      'Washed and de-fleshed Perna canaliculus shell from our Havelock processing site. Stockpiled outdoors. Approximately 95% calcium carbonate. Huge volumes — we are desperate for an outlet.',
    quantity: { amount: 120, unit: 'tonnes', frequency: 'monthly' },
    region: 'Marlborough',
    city: 'Havelock',
    shelfLifeDays: 3650,
    condition: 'processed',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Pelorus Shellfish', name: 'Marama Wiremu', email: 'marama@pelorusshellfish.example.nz', phone: '03 555 0121' },
    suggestedUses: [
      'Agricultural lime substitute (soil pH correction)',
      'Poultry grit and calcium supplement',
      'Aggregate for permeable paving and concrete',
      'Water filtration media for phosphate removal',
      'Bio-ceramic bone-graft research material'
    ],
    co2PerTonne: 0.15,
    disposalCostPerTonne: 110,
    ownerId: 'demo'
  },
  {
    title: 'Fish frames, heads and trimmings',
    wasteType: 'Fish processing offal',
    category: 'meat-seafood',
    description:
      'Hoki and ling frames, heads and belly flaps from our Timaru filleting operation. Chilled, in 200L bins. Must be collected within 24 hours of packing.',
    quantity: { amount: 9, unit: 'tonnes', frequency: 'daily' },
    region: 'Canterbury',
    city: 'Timaru',
    shelfLifeDays: 1,
    condition: 'chilled',
    priceType: 'negotiable',
    price: 40,
    visibility: 'public',
    contact: { org: 'South Bay Seafoods', name: 'Nikau Tapsell', email: 'nikau@southbayseafoods.example.nz', phone: '03 555 0155' },
    suggestedUses: [
      'Fish oil and omega-3 extraction',
      'Marine collagen and gelatine',
      'Hydrolysed fish fertiliser',
      'Pet food and aquaculture feed meal',
      'Calcium-rich bone meal'
    ],
    co2PerTonne: 0.95,
    disposalCostPerTonne: 260,
    ownerId: 'demo'
  },
  {
    title: 'Dag wool and crutchings (low grade)',
    wasteType: 'Dag wool',
    category: 'wool-fibre',
    description:
      'Low-grade crutchings, dags and belly wool from a 6,000 ewe operation. Not economic to scour for textiles at current strong wool prices. Baled and dry-stored.',
    quantity: { amount: 14, unit: 'bales', frequency: 'seasonal' },
    region: 'Otago',
    city: 'Ranfurly',
    shelfLifeDays: 720,
    condition: 'dry',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Maniototo Station', name: 'Bill Hargreaves', email: 'bill@maniototostation.example.nz', phone: '03 555 0134' },
    suggestedUses: [
      'Slow-release nitrogen fertiliser pellets',
      'Wool-based weed mat and garden mulch',
      'Oil spill absorbent booms',
      'Keratin extraction for cosmetics',
      'Insulation batt manufacture'
    ],
    co2PerTonne: 0.45,
    disposalCostPerTonne: 130,
    ownerId: 'demo'
  },
  {
    title: 'Onion skins, tails and grade-out bulbs',
    wasteType: 'Onion waste',
    category: 'horticulture',
    description:
      'Dry papery skins plus undersized and split bulbs from our Pukekohe grading shed. Skins are separated and available dry — the culls are wet and need faster collection.',
    quantity: { amount: 18, unit: 'tonnes', frequency: 'weekly' },
    region: 'Auckland',
    city: 'Pukekohe',
    shelfLifeDays: 14,
    condition: 'mixed',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Franklin Fresh Produce', name: 'Priya Naidu', email: 'priya@franklinfresh.example.nz', phone: '09 555 0188' },
    suggestedUses: [
      'Quercetin antioxidant extraction',
      'Natural golden-brown fabric dye',
      'Onion powder and stock flavouring',
      'Composting bulking agent',
      'Biodegradable food packaging film research'
    ],
    co2PerTonne: 0.64,
    disposalCostPerTonne: 185,
    ownerId: 'demo'
  },
  {
    title: 'Potato peel and starch slurry',
    wasteType: 'Potato peel',
    category: 'food-processing',
    description:
      'Steam-peeled potato skin plus settled starch fines from our chip line near Ashburton. Continuous production, screw-conveyed into your bin.',
    quantity: { amount: 30, unit: 'tonnes', frequency: 'weekly' },
    region: 'Canterbury',
    city: 'Ashburton',
    shelfLifeDays: 2,
    condition: 'fresh',
    priceType: 'pay-to-take',
    price: 25,
    visibility: 'public',
    contact: { org: 'Mid Canterbury Potato Co', name: 'Greg Aitken', email: 'greg@mcpotato.example.nz', phone: '03 555 0109' },
    suggestedUses: [
      'Industrial starch recovery',
      'Bioplastic film precursor',
      'Cattle feed (wet blended)',
      'Anaerobic digestion feedstock',
      'Glycoalkaloid extraction for research'
    ],
    co2PerTonne: 0.66,
    disposalCostPerTonne: 170,
    ownerId: 'demo'
  },
  {
    title: 'Spent brewers grain — craft brewery',
    wasteType: 'Spent brewers grain',
    category: 'viticulture',
    description:
      'Wet spent grain (mostly barley malt) from a 30hL brewhouse. Fresh, warm and free. We brew Tuesday and Thursday — collect same day please, it sours quickly in summer.',
    quantity: { amount: 1.2, unit: 'tonnes', frequency: 'weekly' },
    region: 'Wellington',
    city: 'Petone',
    shelfLifeDays: 2,
    condition: 'fresh',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Harbourline Brewing', name: 'Josh Ellery', email: 'josh@harbourline.example.nz', phone: '04 555 0170' },
    suggestedUses: [
      'High-protein flour for baking and snack bars',
      'Dairy and beef cattle feed',
      'Mushroom substrate',
      'Dog treat manufacture',
      'Compost nitrogen source'
    ],
    co2PerTonne: 0.59,
    disposalCostPerTonne: 210,
    ownerId: 'demo'
  },
  {
    title: 'Used coffee grounds — CBD cafés collective',
    wasteType: 'Coffee grounds',
    category: 'food-processing',
    description:
      'Aggregated spent espresso grounds from 22 cafés across central Auckland. Collected into a shared chilled hub each afternoon. Consistent, contaminant-free.',
    quantity: { amount: 2.4, unit: 'tonnes', frequency: 'weekly' },
    region: 'Auckland',
    city: 'Auckland Central',
    shelfLifeDays: 5,
    condition: 'fresh',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Queen St Café Collective', name: 'Lena Fu', email: 'lena@qscafes.example.nz', phone: '09 555 0126' },
    suggestedUses: [
      'Oyster mushroom cultivation substrate',
      'Coffee oil extraction for cosmetics',
      'Body scrub and soap manufacture',
      'Vermicomposting feedstock',
      'Biodiesel feedstock (residual oil)'
    ],
    co2PerTonne: 0.68,
    disposalCostPerTonne: 220,
    ownerId: 'demo'
  },
  {
    title: 'Avocado stones and skins from oil pressing',
    wasteType: 'Avocado stone and skin',
    category: 'horticulture',
    description:
      'Separated stones and skin from cold-press avocado oil extraction in Kerikeri. Stones are hard and dry well; skins are wet. Can supply separately.',
    quantity: { amount: 7, unit: 'tonnes', frequency: 'monthly' },
    region: 'Northland',
    city: 'Kerikeri',
    shelfLifeDays: 20,
    condition: 'mixed',
    priceType: 'negotiable',
    price: 30,
    visibility: 'public',
    contact: { org: 'Bay of Islands Avocado Oil', name: 'Rangi Heta', email: 'rangi@boioil.example.nz', phone: '09 555 0151' },
    suggestedUses: [
      'Natural dye (stones yield a pink/peach tone)',
      'Avocado stone starch for bioplastics',
      'Antioxidant (perseitol) extraction',
      'Activated carbon precursor',
      'Ground stone as exfoliant in cosmetics'
    ],
    co2PerTonne: 0.61,
    disposalCostPerTonne: 165,
    ownerId: 'demo'
  },
  {
    title: 'Industrial hemp hurd (shiv) surplus',
    wasteType: 'Hemp hurd',
    category: 'arable',
    description:
      'Decorticated hemp hurd left over after fibre separation. Clean, dry, dust-screened. We only have a market for the bast fibre, so the hurd is stockpiling.',
    quantity: { amount: 45, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Canterbury',
    city: 'Rangiora',
    shelfLifeDays: 730,
    condition: 'dry',
    priceType: 'paid',
    price: 120,
    visibility: 'public',
    contact: { org: 'Waimak Hemp Fibre', name: 'Ella Brookes', email: 'ella@waimakhemp.example.nz', phone: '03 555 0193' },
    suggestedUses: [
      'Hempcrete construction blocks',
      'High-absorbency animal bedding',
      'Biodegradable packaging pulp',
      'Particle board manufacture',
      'Mycelium composite growing medium'
    ],
    co2PerTonne: 1.35,
    disposalCostPerTonne: 70,
    ownerId: 'demo'
  },
  {
    title: 'Mānuka pruning leaf and small-branch residue',
    wasteType: 'Mānuka leaf residue',
    category: 'forestry',
    description:
      'Leaf, twig and thin-branch material from mānuka plantation maintenance. Contains extractable oil. Currently mulched on site but we would rather it created value.',
    quantity: { amount: 22, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Northland',
    city: 'Kaitaia',
    shelfLifeDays: 21,
    condition: 'fresh',
    priceType: 'free',
    price: 0,
    visibility: 'private',
    contact: { org: 'Te Hiku Mānuka Trust', name: 'Wiremu Kaa', email: 'wiremu@tehikumanuka.example.nz', phone: '09 555 0117' },
    suggestedUses: [
      'Steam distillation for mānuka essential oil',
      'Triketone-rich antimicrobial extracts',
      'Smoking chips for food',
      'Bioactive skincare ingredients',
      'Mulch for erosion control'
    ],
    co2PerTonne: 0.90,
    disposalCostPerTonne: 55,
    ownerId: 'demo'
  },
  {
    title: 'Separated dairy effluent solids (dried)',
    wasteType: 'Dairy effluent solids',
    category: 'dairy',
    description:
      'Screw-press separated solids from a 900 cow shed, air dried under cover. Low odour, high organic matter. Loader available for pickup.',
    quantity: { amount: 60, unit: 'cubic metres', frequency: 'monthly' },
    region: 'Southland',
    city: 'Winton',
    shelfLifeDays: 180,
    condition: 'dry',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Oreti Plains Dairy', name: 'Kate Sorensen', email: 'kate@oretiplains.example.nz', phone: '03 555 0102' },
    suggestedUses: [
      'Compost base for horticulture',
      'Vermicomposting feedstock',
      'Free-stall bedding after further drying',
      'Nutrient-rich potting mix component',
      'Biogas digestate blending'
    ],
    co2PerTonne: 0.72,
    disposalCostPerTonne: 40,
    ownerId: 'demo'
  },
  {
    title: 'Barley straw bales — post-harvest surplus',
    wasteType: 'Barley straw',
    category: 'arable',
    description:
      'Large square bales of barley straw left after harvest. Dry stored under cover. We burn or incorporate the excess most years, which is a waste.',
    quantity: { amount: 400, unit: 'bales', frequency: 'seasonal' },
    region: 'Canterbury',
    city: 'Methven',
    shelfLifeDays: 540,
    condition: 'dry',
    priceType: 'paid',
    price: 45,
    visibility: 'public',
    contact: { org: 'Rakaia Arable Ltd', name: 'Duncan McRae', email: 'duncan@rakaiaarable.example.nz', phone: '03 555 0140' },
    suggestedUses: [
      'Straw-bale construction and insulation',
      'Mushroom growing substrate',
      'Livestock bedding',
      'Algae-control in farm ponds',
      'Cellulosic ethanol feedstock'
    ],
    co2PerTonne: 1.05,
    disposalCostPerTonne: 25,
    ownerId: 'demo'
  },
  {
    title: 'Feijoa pulp and grade-outs',
    wasteType: 'Feijoa pulp',
    category: 'horticulture',
    description:
      'Second-grade feijoas and scooped pulp surplus from a short, intense harvest window. Frozen in 20kg blocks so shelf life is workable.',
    quantity: { amount: 5, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Bay of Plenty',
    city: 'Katikati',
    shelfLifeDays: 120,
    condition: 'frozen',
    priceType: 'negotiable',
    price: 200,
    visibility: 'public',
    contact: { org: 'Katikati Feijoa Growers', name: 'Anahera Poole', email: 'anahera@ktfeijoa.example.nz', phone: '07 555 0184' },
    suggestedUses: [
      'Craft cider and fruit wine production',
      'Kombucha and soda flavouring',
      'Freeze-dried fruit powder',
      'Jam and chutney manufacture',
      'Natural flavour extraction'
    ],
    co2PerTonne: 0.63,
    disposalCostPerTonne: 190,
    ownerId: 'demo'
  },
  {
    title: 'Walnut shell (cracked, cleaned)',
    wasteType: 'Walnut shell',
    category: 'arable',
    description:
      'Hard shell fragments from our cracking line, aspirated to remove kernel dust. Very hard, uniform, dry. Currently landfilled.',
    quantity: { amount: 11, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Canterbury',
    city: 'Oxford',
    shelfLifeDays: 1095,
    condition: 'dry',
    priceType: 'negotiable',
    price: 60,
    visibility: 'public',
    contact: { org: 'Waimakariri Nut Co', name: 'Ruth Deane', email: 'ruth@waimaknut.example.nz', phone: '03 555 0129' },
    suggestedUses: [
      'Abrasive blasting media (gentle, non-toxic)',
      'Filtration media for oil/water separation',
      'Activated carbon precursor',
      'Anti-slip additive in coatings',
      'Cosmetic exfoliant granules'
    ],
    co2PerTonne: 0.85,
    disposalCostPerTonne: 155,
    ownerId: 'demo'
  },
  {
    title: 'Bluff oyster shell — season stockpile',
    wasteType: 'Oyster shell',
    category: 'aquaculture',
    description:
      'Shucked Bluff oyster shell from the season. Weathered outdoors for six months so it is clean and odour-free. Loader loading available.',
    quantity: { amount: 65, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Southland',
    city: 'Bluff',
    shelfLifeDays: 3650,
    condition: 'processed',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Foveaux Oyster Co', name: 'Hemi Barrett', email: 'hemi@foveauxoyster.example.nz', phone: '03 555 0163' },
    suggestedUses: [
      'Oyster reef restoration substrate',
      'Poultry calcium grit',
      'Soil pH conditioner',
      'Decorative and drainage aggregate',
      'Calcium carbonate feedstock'
    ],
    co2PerTonne: 0.14,
    disposalCostPerTonne: 105,
    ownerId: 'demo'
  },
  {
    title: 'Blueberry seconds and press cake',
    wasteType: 'Blueberry waste',
    category: 'horticulture',
    description:
      'Soft, split and undersized blueberries plus juice press cake. Frozen immediately on grading so quality is high — just not retail-presentable.',
    quantity: { amount: 3.5, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Waikato',
    city: 'Ngatea',
    shelfLifeDays: 150,
    condition: 'frozen',
    priceType: 'paid',
    price: 400,
    visibility: 'public',
    contact: { org: 'Hauraki Berry Farms', name: 'Sione Latu', email: 'sione@haurakiberry.example.nz', phone: '07 555 0148' },
    suggestedUses: [
      'Anthocyanin natural colourant extraction',
      'Freeze-dried powder for supplements',
      'Fruit leather and snack manufacture',
      'Craft brewing and fruit beer',
      'Cosmetic antioxidant ingredient'
    ],
    co2PerTonne: 0.63,
    disposalCostPerTonne: 200,
    ownerId: 'demo'
  },
  {
    title: 'Wool scour grease / lanolin sludge',
    wasteType: 'Wool grease sludge',
    category: 'wool-fibre',
    description:
      'Recovered grease and sludge from our wool scouring line. Contains crude lanolin. Currently a costly trade-waste problem for us.',
    quantity: { amount: 16, unit: 'tonnes', frequency: 'monthly' },
    region: "Hawke's Bay",
    city: 'Napier',
    shelfLifeDays: 90,
    condition: 'processed',
    priceType: 'pay-to-take',
    price: 55,
    visibility: 'private',
    contact: { org: 'Ahuriri Wool Scour', name: 'Grace Tumahai', email: 'grace@ahuririscour.example.nz', phone: '06 555 0136' },
    suggestedUses: [
      'Refined lanolin for cosmetics and nipple balm',
      'Leather and timber conditioning treatments',
      'Industrial lubricant and rust preventative',
      'Cholesterol / vitamin D3 precursor extraction'
    ],
    co2PerTonne: 0.50,
    disposalCostPerTonne: 340,
    ownerId: 'demo'
  },
  {
    title: 'Citrus peel and pulp from juicing',
    wasteType: 'Citrus peel',
    category: 'horticulture',
    description:
      'Mandarin, orange and lemon peel with pith and pulp from a Gisborne juicing operation. Strong citrus oil content in the flavedo.',
    quantity: { amount: 14, unit: 'tonnes', frequency: 'weekly' },
    region: 'Gisborne',
    city: 'Gisborne',
    shelfLifeDays: 3,
    condition: 'fresh',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Tairāwhiti Citrus', name: 'Manaia Brown', email: 'manaia@tairawhiticitrus.example.nz', phone: '06 555 0175' },
    suggestedUses: [
      'D-limonene extraction for natural cleaners',
      'Citrus pectin production',
      'Candied peel and confectionery',
      'Essential oil cold-pressing',
      'Livestock feed pellets (dried)'
    ],
    co2PerTonne: 0.65,
    disposalCostPerTonne: 180,
    ownerId: 'demo'
  },
  {
    title: 'Used silage wrap and bale netting (baled)',
    wasteType: 'Agricultural plastic film',
    category: 'agri-plastics',
    description:
      'LDPE silage wrap and HDPE netting collected across a dairy catchment and compacted into 200kg bales. Some soil contamination, roughly 8% by weight.',
    quantity: { amount: 24, unit: 'tonnes', frequency: 'monthly' },
    region: 'Taranaki',
    city: 'Hāwera',
    shelfLifeDays: 3650,
    condition: 'processed',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'South Taranaki Farm Plastics Hub', name: 'Owen Reid', email: 'owen@stplastics.example.nz', phone: '06 555 0159' },
    suggestedUses: [
      'Recycled LDPE pellet manufacture',
      'Plastic fence post and decking extrusion',
      'Refuse-derived fuel (last resort)',
      'Drainage coil manufacture'
    ],
    co2PerTonne: 1.80,
    disposalCostPerTonne: 240,
    ownerId: 'demo'
  },
  {
    title: 'Egg shell waste from grading floor',
    wasteType: 'Egg shell',
    category: 'food-processing',
    description:
      'Cracked and broken shell with residual membrane from our egg grading and liquid-egg line. Washed and lightly dried.',
    quantity: { amount: 4, unit: 'tonnes', frequency: 'weekly' },
    region: 'Waikato',
    city: 'Te Awamutu',
    shelfLifeDays: 30,
    condition: 'processed',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Kihikihi Egg Co', name: 'Nadia Osman', email: 'nadia@kihikihiegg.example.nz', phone: '07 555 0111' },
    suggestedUses: [
      'Calcium carbonate for supplements',
      'Eggshell membrane collagen extraction',
      'Soil amendment and seedling starter',
      'Bioceramic and filler research',
      'Poultry grit'
    ],
    co2PerTonne: 0.20,
    disposalCostPerTonne: 160,
    ownerId: 'demo'
  },
  {
    title: 'Macadamia husk and shell',
    wasteType: 'Macadamia husk',
    category: 'horticulture',
    description:
      'Green husk (dehusking waste) plus hard shell after cracking. Husk composts fast; shell is extremely hard and high energy value.',
    quantity: { amount: 6, unit: 'tonnes', frequency: 'seasonal' },
    region: 'Northland',
    city: 'Whangārei',
    shelfLifeDays: 60,
    condition: 'mixed',
    priceType: 'free',
    price: 0,
    visibility: 'public',
    contact: { org: 'Northland Macadamia Growers', name: 'Tui Rapana', email: 'tui@nlmacadamia.example.nz', phone: '09 555 0181' },
    suggestedUses: [
      'Biochar and activated carbon',
      'High-calorie boiler fuel',
      'Landscaping mulch (shell)',
      'Antioxidant extraction from husk',
      'Compost feedstock'
    ],
    co2PerTonne: 0.88,
    disposalCostPerTonne: 145,
    ownerId: 'demo'
  },
  {
    title: 'Sheep pelt trimmings and fleshings',
    wasteType: 'Pelt trimmings',
    category: 'meat-seafood',
    description:
      'Edge trimmings and fleshings from our fellmongery. Collagen-rich. Currently rendered at low value. Chilled bins, daily availability.',
    quantity: { amount: 5.5, unit: 'tonnes', frequency: 'daily' },
    region: 'Manawatū-Whanganui',
    city: 'Feilding',
    shelfLifeDays: 2,
    condition: 'chilled',
    priceType: 'pay-to-take',
    price: 35,
    visibility: 'public',
    contact: { org: 'Oroua Fellmongery', name: 'Pete Vaughan', email: 'pete@orouafell.example.nz', phone: '06 555 0173' },
    suggestedUses: [
      'Gelatine and collagen peptide extraction',
      'Pet chew manufacture',
      'Technical-grade glue production',
      'Bio-fertiliser hydrolysate'
    ],
    co2PerTonne: 0.98,
    disposalCostPerTonne: 250,
    ownerId: 'demo'
  },
  {
    title: 'Pine bark fines from log debarking',
    wasteType: 'Pine bark',
    category: 'forestry',
    description:
      'Screened bark fines under 10mm from log yard debarking. Consistent, weathered, ready to use. Bulk truck-and-trailer loads.',
    quantity: { amount: 500, unit: 'cubic metres', frequency: 'monthly' },
    region: 'Bay of Plenty',
    city: 'Kawerau',
    shelfLifeDays: 365,
    condition: 'dry',
    priceType: 'negotiable',
    price: 12,
    visibility: 'public',
    contact: { org: 'Tarawera Log Yard', name: 'Simon Katene', email: 'simon@taraweralogs.example.nz', phone: '07 555 0195' },
    suggestedUses: [
      'Potting mix and growing media',
      'Landscaping mulch',
      'Tannin extraction for leather and adhesives',
      'Playground softfall surfacing',
      'Biofilter media for odour control'
    ],
    co2PerTonne: 1.00,
    disposalCostPerTonne: 50,
    ownerId: 'demo'
  }
];

/**
 * "Wanted" posts — people looking for waste. These make the Match page work
 * from both directions and give the AI something to reason about when someone
 * is a waste producer wondering who might want their material.
 */
export const SEED_WANTS = [
  {
    title: 'Seeking fruit pomace for pectin extraction pilot',
    description:
      'University spin-out building a small pectin extraction plant. Need consistent, contaminant-free fruit pomace — apple, citrus or kiwifruit all work. Can collect weekly with our own chilled truck.',
    category: 'horticulture',
    region: 'Bay of Plenty',
    quantityNeeded: '5-20 tonnes per week',
    ownerId: 'demo',
    org: 'PectiLab NZ'
  },
  {
    title: 'Wanted: calcium carbonate shell for soil trials',
    description:
      'Regenerative farming co-op running pH correction trials across 400ha. Looking for crushed or whole shell as an alternative to imported ag-lime. Willing to invest in crushing gear if supply is reliable.',
    category: 'aquaculture',
    region: 'Canterbury',
    quantityNeeded: '80-150 tonnes per year',
    ownerId: 'demo',
    org: 'Plains Regen Collective'
  },
  {
    title: 'Mushroom farm seeking lignocellulose substrate',
    description:
      'Expanding oyster and shiitake production. Need untreated sawdust, straw, spent grain or coffee grounds. Volume needed grows each month. Happy to take mixed streams.',
    category: 'forestry',
    region: 'Auckland',
    quantityNeeded: '10 tonnes per month, growing',
    ownerId: 'demo',
    org: 'Fungi Forward'
  },
  {
    title: 'Bioplastics researcher needs starch-rich waste',
    description:
      'PhD project developing compostable packaging film. Looking for potato peel, cassava or other starch-heavy processing waste. Small quantities, but need it reliably every fortnight.',
    category: 'food-processing',
    region: 'Canterbury',
    quantityNeeded: '50-200 kg per fortnight',
    ownerId: 'demo',
    org: 'University of Canterbury — Materials Lab'
  },
  {
    title: 'Natural dye studio seeking plant waste',
    description:
      'Textile studio producing naturally dyed garments. Want onion skins, avocado stones, grape marc or bark — anything with strong colourfast pigment. Small volumes, will pay for quality.',
    category: 'horticulture',
    region: 'Wellington',
    quantityNeeded: '20-100 kg per month',
    ownerId: 'demo',
    org: 'Whenua Dye Studio'
  },
  {
    title: 'Biogas plant seeking wet organic feedstock',
    description:
      'Commissioning a 500kW anaerobic digester. Need high-moisture organics: pomace, peel, whey, effluent solids, food processing residues. Can arrange our own tanker and bin logistics.',
    category: 'dairy',
    region: 'Waikato',
    quantityNeeded: '100+ tonnes per week',
    ownerId: 'demo',
    org: 'Waikato Bioenergy Ltd'
  }
];

/**
 * Deals that have already been "completed" in the demo. These populate the
 * Impact page with a plausible history so the statistics are not all zeroes
 * at the start of a pitch.
 */
export const SEED_DEALS = [
  { listingTitle: 'Kiwifruit skin & pomace from packhouse grading', buyer: 'PectiLab NZ',           tonnes: 168, co2Saved: 104, moneySaved: 32760, daysAgo: 12 },
  { listingTitle: 'Grape marc (skins, seeds, stems) — vintage surplus', buyer: 'Southern Seed Oils', tonnes: 180, co2Saved: 104, moneySaved: 16200, daysAgo: 34 },
  { listingTitle: 'Green-lipped mussel shells (washed)',            buyer: 'Plains Regen Collective', tonnes: 240, co2Saved: 36,  moneySaved: 26400, daysAgo: 21 },
  { listingTitle: 'Untreated pine sawdust and shavings',            buyer: 'Fungi Forward',           tonnes: 96,  co2Saved: 106, moneySaved: 5760,  daysAgo: 8 },
  { listingTitle: 'Spent brewers grain — craft brewery',            buyer: 'Fungi Forward',           tonnes: 14,  co2Saved: 8,   moneySaved: 2940,  daysAgo: 5 },
  { listingTitle: 'Potato peel and starch slurry',                  buyer: 'University of Canterbury — Materials Lab', tonnes: 6, co2Saved: 4, moneySaved: 1020, daysAgo: 17 },
  { listingTitle: 'Onion skins, tails and grade-out bulbs',         buyer: 'Whenua Dye Studio',       tonnes: 2,   co2Saved: 1,   moneySaved: 370,   daysAgo: 3 },
  { listingTitle: 'Used silage wrap and bale netting (baled)',      buyer: 'Polymer Renew NZ',        tonnes: 48,  co2Saved: 86,  moneySaved: 11520, daysAgo: 27 },
  { listingTitle: 'Whey permeate — surplus from cheese plant',      buyer: 'Waikato Bioenergy Ltd',   tonnes: 385, co2Saved: 135, moneySaved: 17325, daysAgo: 40 },
  { listingTitle: 'Fish frames, heads and trimmings',               buyer: 'Ocean Nutrition NZ',      tonnes: 54,  co2Saved: 51,  moneySaved: 14040, daysAgo: 15 }
];
