export interface RetailerInfo {
  name: string;
  domain: string;
  searchUrl?: string;
}

export interface VehicleTypeRetailers {
  primary: RetailerInfo[];
  secondary: RetailerInfo[];
}

const MOTORCYCLE_RETAILERS: VehicleTypeRetailers = {
  primary: [
    { name: 'RevZilla', domain: 'revzilla.com', searchUrl: 'https://www.revzilla.com/search?query=' },
    { name: 'CycleGear', domain: 'cyclegear.com', searchUrl: 'https://www.cyclegear.com/search?q=' },
    { name: 'J&P Cycles', domain: 'jpcycles.com', searchUrl: 'https://www.jpcycles.com/search/' },
    { name: 'Dennis Kirk', domain: 'denniskirk.com', searchUrl: 'https://www.denniskirk.com/search?q=' },
    { name: 'BikeBandit', domain: 'bikebandit.com' },
    { name: 'Rocky Mountain ATV/MC', domain: 'rockymountainatvmc.com' },
    { name: 'Partzilla', domain: 'partzilla.com', searchUrl: 'https://www.partzilla.com/search?q=' },
  ],
  secondary: [
    { name: 'CMSNL', domain: 'cmsnl.com' },
    { name: '4into1', domain: '4into1.com' },
    { name: 'Demon Tweeks', domain: 'demon-tweeks.com' },
    { name: 'XLMOTO', domain: 'xlmoto.com' },
    { name: 'Louis Moto', domain: 'louis.eu' },
    { name: 'Motocard', domain: 'motocard.com' },
    { name: 'Evotech Performance', domain: 'evotech-performance.com' },
  ],
};

const CAR_RETAILERS: VehicleTypeRetailers = {
  primary: [
    { name: 'RockAuto', domain: 'rockauto.com', searchUrl: 'https://www.rockauto.com/en/partsearch/?partnum=' },
    { name: 'FCP Euro', domain: 'fcpeuro.com', searchUrl: 'https://www.fcpeuro.com/Search/?q=' },
    { name: 'Parts Geek', domain: 'partsgeek.com' },
    { name: 'CarParts.com', domain: 'carparts.com' },
    { name: 'Advance Auto Parts', domain: 'advanceautoparts.com' },
    { name: 'AutoZone', domain: 'autozone.com' },
    { name: 'NAPA', domain: 'napaonline.com' },
  ],
  secondary: [
    { name: 'AUTODOC', domain: 'autodoc.co.uk' },
    { name: 'Euro Car Parts', domain: 'eurocarparts.com' },
    { name: 'ECS Tuning', domain: 'ecstuning.com', searchUrl: 'https://www.ecstuning.com/Search/?q=' },
    { name: 'Throtl', domain: 'throtl.com' },
    { name: 'Enjuku Racing', domain: 'enjukuracing.com' },
    { name: 'Summit Racing', domain: 'summitracing.com' },
    { name: 'JEGS', domain: 'jegs.com' },
    { name: '3W Distributing', domain: '3wdistributing.com' },
    { name: 'Scuderia Car Parts', domain: 'scuderiacarparts.com' },
  ],
};

const OFFROAD_RETAILERS: VehicleTypeRetailers = {
  primary: [
    { name: '4 Wheel Parts', domain: '4wheelparts.com' },
    { name: 'Offroad Alliance', domain: 'offroadalliance.com' },
    { name: 'Off Road Warehouse', domain: 'offroadwarehouse.com' },
    { name: 'ARB 4x4', domain: 'arbusa.com' },
    { name: 'Rough Country', domain: 'roughcountry.com' },
    { name: 'TeraFlex', domain: 'teraflex.com' },
  ],
  secondary: [
    { name: 'Expedition One', domain: 'expeditionone.biz' },
    { name: 'Front Runner', domain: 'frontrunneroutfitters.com' },
    { name: 'Overland Vehicle Systems', domain: 'overlandvehiclesystems.com' },
  ],
};

const BOAT_RETAILERS: VehicleTypeRetailers = {
  primary: [
    { name: 'West Marine', domain: 'westmarine.com', searchUrl: 'https://www.westmarine.com/search?q=' },
    { name: 'Defender Marine', domain: 'defender.com' },
    { name: 'Fawcett Boat Supplies', domain: 'fawcettboat.com' },
    { name: "Overton's", domain: 'overtons.com' },
  ],
  secondary: [
    { name: 'Deep Blue Yacht Supply', domain: 'deepblueyacht.com' },
    { name: 'Boat Propeller Store', domain: 'boatpropellerstore.com' },
    { name: 'MarineEngine.com', domain: 'marineengine.com' },
    { name: 'MarineMax', domain: 'marinemax.com' },
  ],
};

const TRAILER_RETAILERS: VehicleTypeRetailers = {
  primary: [
    { name: 'etrailer', domain: 'etrailer.com', searchUrl: 'https://www.etrailer.com/search.aspx?k=' },
    { name: 'Northern Tool', domain: 'northerntool.com' },
    { name: 'OrderTrailerParts.com', domain: 'ordertrailerparts.com' },
  ],
  secondary: [
    { name: 'Camping World', domain: 'campingworld.com' },
    { name: 'PPL Motor Homes', domain: 'pplmotorhomes.com' },
    { name: 'Roadmaster Inc', domain: 'roadmasterinc.com' },
    { name: 'FleetPride', domain: 'fleetpride.com' },
    { name: 'TruckPro', domain: 'truckpro.com' },
  ],
};

const GENERAL_RETAILERS: RetailerInfo[] = [
  { name: 'eBay', domain: 'ebay.com', searchUrl: 'https://www.ebay.com/sch/i.html?_nkw=' },
];

export function getRetailersForVehicleType(vehicleType: string): VehicleTypeRetailers {
  switch (vehicleType.toLowerCase()) {
    case 'motorcycle':
      return MOTORCYCLE_RETAILERS;
    case 'car':
      return CAR_RETAILERS;
    case 'boat':
      return BOAT_RETAILERS;
    case 'trailer':
      return TRAILER_RETAILERS;
    default:
      // Return car retailers as default with some motorcycle mixed in
      return {
        primary: [...CAR_RETAILERS.primary.slice(0, 4), ...MOTORCYCLE_RETAILERS.primary.slice(0, 2)],
        secondary: CAR_RETAILERS.secondary,
      };
  }
}

export function getPreferredDomains(vehicleType: string): string[] {
  const retailers = getRetailersForVehicleType(vehicleType);
  const domains = [
    ...retailers.primary.map((r) => r.domain),
    ...retailers.secondary.map((r) => r.domain),
    ...GENERAL_RETAILERS.map((r) => r.domain),
  ];
  return domains;
}

export function getSearchFallbackUrl(retailerDomain: string, query: string): string | null {
  const allRetailers = [
    ...MOTORCYCLE_RETAILERS.primary,
    ...MOTORCYCLE_RETAILERS.secondary,
    ...CAR_RETAILERS.primary,
    ...CAR_RETAILERS.secondary,
    ...OFFROAD_RETAILERS.primary,
    ...OFFROAD_RETAILERS.secondary,
    ...BOAT_RETAILERS.primary,
    ...BOAT_RETAILERS.secondary,
    ...TRAILER_RETAILERS.primary,
    ...TRAILER_RETAILERS.secondary,
    ...GENERAL_RETAILERS,
  ];

  const retailer = allRetailers.find((r) => retailerDomain.includes(r.domain));
  if (retailer?.searchUrl) {
    return retailer.searchUrl + encodeURIComponent(query);
  }
  return null;
}

export function getRetailerName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const allRetailers = [
      ...MOTORCYCLE_RETAILERS.primary,
      ...MOTORCYCLE_RETAILERS.secondary,
      ...CAR_RETAILERS.primary,
      ...CAR_RETAILERS.secondary,
      ...OFFROAD_RETAILERS.primary,
      ...OFFROAD_RETAILERS.secondary,
      ...BOAT_RETAILERS.primary,
      ...BOAT_RETAILERS.secondary,
      ...TRAILER_RETAILERS.primary,
      ...TRAILER_RETAILERS.secondary,
      ...GENERAL_RETAILERS,
    ];

    const retailer = allRetailers.find((r) => domain.includes(r.domain));
    return retailer?.name || domain;
  } catch {
    return 'Link';
  }
}
