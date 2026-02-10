export interface MaterialOrigin {
  material: string;
  origin: string;
  verified: boolean;
  certification?: string;
}

export interface AuditStep {
  id: string;
  title: string;
  description: string;
  status: 'verified' | 'flagged' | 'pending';
  facility?: string;
  energySource?: string;
  certification?: string;
  emissions?: string;
}

export interface ProductScan {
  id: string;
  name: string;
  brand: string;
  category: string;
  scanDate: string;
  score: number;
  status: 'verified' | 'flagged' | 'pending';
  renewablePercent: number;
  emissions: string;
  transportDistance: string;
  materials: MaterialOrigin[];
  auditSteps: AuditStep[];
  auditProgress: number;
}

export const MOCK_PRODUCTS: ProductScan[] = [
  {
    id: 'SCAN-2024-001',
    name: 'Organic Cotton T-Shirt',
    brand: 'EcoWear',
    category: 'Apparel',
    scanDate: '2024-01-15',
    score: 87,
    status: 'verified',
    renewablePercent: 92,
    emissions: '2.1kg CO₂',
    transportDistance: '1,240 km',
    materials: [
      { material: 'Organic Cotton', origin: 'India, Gujarat', verified: true, certification: 'GOTS Certified' },
      { material: 'Natural Dyes', origin: 'Germany, Berlin', verified: true, certification: 'OEKO-TEX' },
      { material: 'Recycled Polyester', origin: 'Japan, Osaka', verified: true, certification: 'GRS Certified' },
    ],
    auditSteps: [
      { id: 'AS-001', title: 'Raw Material Sourcing', description: 'Organic cotton sourced from certified farms in Gujarat, India. Fair trade practices confirmed.', status: 'verified', facility: 'Gujarat Organic Farms Co-op', energySource: 'Solar Grid', certification: 'GOTS Level 1', emissions: '0.3kg CO₂' },
      { id: 'AS-002', title: 'Processing & Dyeing', description: 'Natural dye processing at zero-waste facility. Water recycling at 95% efficiency.', status: 'verified', facility: 'Berlin Green Textiles GmbH', energySource: 'Wind Power', certification: 'OEKO-TEX Standard 100', emissions: '0.5kg CO₂' },
      { id: 'AS-003', title: 'Manufacturing', description: 'Assembly at ISO 14001 certified facility with living wage compliance.', status: 'verified', facility: 'EcoWear Manufacturing Hub', energySource: 'Solar Grid', certification: 'ISO 14001', emissions: '0.8kg CO₂' },
      { id: 'AS-004', title: 'Distribution & Logistics', description: 'Carbon-neutral shipping via electric fleet and rail transport.', status: 'verified', facility: 'Green Logistics Network', energySource: 'Electric Fleet', certification: 'Carbon Neutral Certified', emissions: '0.5kg CO₂' },
    ],
    auditProgress: 85,
  },
  {
    id: 'SCAN-2024-002',
    name: 'Bamboo Water Bottle',
    brand: 'HydroNature',
    category: 'Accessories',
    scanDate: '2024-01-14',
    score: 76,
    status: 'verified',
    renewablePercent: 78,
    emissions: '1.8kg CO₂',
    transportDistance: '3,450 km',
    materials: [
      { material: 'Bamboo Shell', origin: 'Vietnam, Da Nang', verified: true, certification: 'FSC Certified' },
      { material: 'Stainless Steel', origin: 'South Korea, Seoul', verified: true },
      { material: 'Silicone Seal', origin: 'China, Shenzhen', verified: false },
    ],
    auditSteps: [
      { id: 'AS-005', title: 'Raw Material Sourcing', description: 'Bamboo harvested from managed forests. Steel sourced from recycled scrap.', status: 'verified', facility: 'Da Nang Bamboo Collective', energySource: 'Hydro Power', certification: 'FSC Chain of Custody', emissions: '0.4kg CO₂' },
      { id: 'AS-006', title: 'Processing', description: 'Bamboo treated with non-toxic sealant. Steel formed at energy-efficient facility.', status: 'verified', facility: 'Seoul Steel Works', energySource: 'Mixed Grid', certification: 'ISO 9001', emissions: '0.7kg CO₂' },
      { id: 'AS-007', title: 'Assembly', description: 'Final assembly combines bamboo and steel components.', status: 'pending', facility: 'HydroNature Factory', energySource: 'Coal Grid', emissions: '0.4kg CO₂' },
      { id: 'AS-008', title: 'Distribution', description: 'Ocean freight with carbon offset program.', status: 'verified', facility: 'Pacific Green Shipping', energySource: 'Diesel + Offset', certification: 'Carbon Offset Verified', emissions: '0.3kg CO₂' },
    ],
    auditProgress: 72,
  },
  {
    id: 'SCAN-2024-003',
    name: 'Fast Fashion Jacket',
    brand: 'QuickStyle',
    category: 'Apparel',
    scanDate: '2024-01-13',
    score: 32,
    status: 'flagged',
    renewablePercent: 12,
    emissions: '14.7kg CO₂',
    transportDistance: '8,920 km',
    materials: [
      { material: 'Polyester Blend', origin: 'China, Guangzhou', verified: false },
      { material: 'Synthetic Dyes', origin: 'Bangladesh, Dhaka', verified: false },
      { material: 'Plastic Buttons', origin: 'Unknown', verified: false },
    ],
    auditSteps: [
      { id: 'AS-009', title: 'Raw Material Sourcing', description: 'Petroleum-based polyester from unverified supplier. No sustainability certifications found.', status: 'flagged', facility: 'Guangzhou Textile Mill #47', energySource: 'Coal Grid', emissions: '4.2kg CO₂' },
      { id: 'AS-010', title: 'Processing & Dyeing', description: 'Synthetic dye process with potential water contamination. No wastewater treatment verified.', status: 'flagged', facility: 'Dhaka Processing Zone', energySource: 'Coal Grid', emissions: '3.8kg CO₂' },
      { id: 'AS-011', title: 'Manufacturing', description: 'High-volume factory with unverified labor practices. Multiple compliance gaps detected.', status: 'flagged', facility: 'QuickStyle Production Unit', energySource: 'Coal Grid', emissions: '4.1kg CO₂' },
      { id: 'AS-012', title: 'Distribution', description: 'Air freight shipping with no carbon offset. Long-haul from Asia to North America.', status: 'flagged', facility: 'Standard Air Cargo', energySource: 'Jet Fuel', emissions: '2.6kg CO₂' },
    ],
    auditProgress: 45,
  },
  {
    id: 'SCAN-2024-004',
    name: 'Solar Power Bank',
    brand: 'SunCharge',
    category: 'Electronics',
    scanDate: '2024-01-12',
    score: 91,
    status: 'verified',
    renewablePercent: 95,
    emissions: '1.2kg CO₂',
    transportDistance: '980 km',
    materials: [
      { material: 'Recycled Aluminum', origin: 'Norway, Oslo', verified: true, certification: 'ASI Certified' },
      { material: 'Solar Cells', origin: 'Germany, Munich', verified: true, certification: 'IEC 61215' },
      { material: 'LiFePO4 Battery', origin: 'Sweden, Stockholm', verified: true, certification: 'UN38.3' },
    ],
    auditSteps: [
      { id: 'AS-013', title: 'Raw Material Sourcing', description: '100% recycled aluminum from certified smelter. Solar cells from leading European manufacturer.', status: 'verified', facility: 'Oslo Green Metals', energySource: 'Hydro Power', certification: 'ASI Performance', emissions: '0.2kg CO₂' },
      { id: 'AS-014', title: 'Component Manufacturing', description: 'Precision assembly in carbon-neutral facility powered entirely by renewable energy.', status: 'verified', facility: 'Munich Solar Tech', energySource: 'Solar + Wind', certification: 'Carbon Neutral', emissions: '0.4kg CO₂' },
      { id: 'AS-015', title: 'Final Assembly', description: 'Automated assembly with minimal waste. All packaging from recycled materials.', status: 'verified', facility: 'SunCharge HQ', energySource: 'Solar Grid', certification: 'ISO 14001', emissions: '0.3kg CO₂' },
      { id: 'AS-016', title: 'Distribution', description: 'Electric vehicle last-mile delivery. Regional distribution only.', status: 'verified', facility: 'Green Fleet Logistics', energySource: 'Electric Fleet', certification: 'Zero Emission Certified', emissions: '0.3kg CO₂' },
    ],
    auditProgress: 95,
  },
  {
    id: 'SCAN-2024-005',
    name: 'Disposable Coffee Cups',
    brand: 'CupCo',
    category: 'Packaging',
    scanDate: '2024-01-11',
    score: 18,
    status: 'flagged',
    renewablePercent: 5,
    emissions: '22.3kg CO₂',
    transportDistance: '12,400 km',
    materials: [
      { material: 'Virgin Paper Pulp', origin: 'Brazil, Amazon Region', verified: false },
      { material: 'Plastic Lining (PE)', origin: 'China, Shenzhen', verified: false },
      { material: 'Plastic Lid (PS)', origin: 'China, Shenzhen', verified: false },
    ],
    auditSteps: [
      { id: 'AS-017', title: 'Raw Material Sourcing', description: 'Paper pulp linked to deforestation zones. No FSC certification. Supply chain transparency score: 8%.', status: 'flagged', facility: 'Amazon Pulp Industries', energySource: 'Diesel Generators', emissions: '8.1kg CO₂' },
      { id: 'AS-018', title: 'Processing', description: 'Petroleum-based plastic lining makes cups non-recyclable. High chemical usage in bleaching.', status: 'flagged', facility: 'Shenzhen Plastics #12', energySource: 'Coal Grid', emissions: '6.4kg CO₂' },
      { id: 'AS-019', title: 'Manufacturing', description: 'Mass production facility with no environmental certifications. Worker safety concerns flagged.', status: 'flagged', facility: 'CupCo Mass Production', energySource: 'Coal Grid', emissions: '4.5kg CO₂' },
      { id: 'AS-020', title: 'Distribution', description: 'Intercontinental shipping via container ships. No carbon offset.', status: 'flagged', facility: 'Global Freight Corp', energySource: 'Heavy Fuel Oil', emissions: '3.3kg CO₂' },
    ],
    auditProgress: 22,
  },
  {
    id: 'SCAN-2024-006',
    name: 'Hemp Sneakers',
    brand: 'GreenStep',
    category: 'Footwear',
    scanDate: '2024-01-10',
    score: 82,
    status: 'verified',
    renewablePercent: 85,
    emissions: '3.1kg CO₂',
    transportDistance: '2,100 km',
    materials: [
      { material: 'Organic Hemp', origin: 'France, Normandy', verified: true, certification: 'EU Organic' },
      { material: 'Natural Rubber', origin: 'Sri Lanka, Colombo', verified: true, certification: 'FSC Certified' },
      { material: 'Cork Insole', origin: 'Portugal, Alentejo', verified: true, certification: 'PEFC Certified' },
    ],
    auditSteps: [
      { id: 'AS-021', title: 'Raw Material Sourcing', description: 'Organic hemp from regenerative farm. Natural rubber from certified plantation.', status: 'verified', facility: 'Normandy Hemp Farm', energySource: 'Solar Grid', certification: 'EU Organic Certified', emissions: '0.6kg CO₂' },
      { id: 'AS-022', title: 'Processing', description: 'Low-impact processing with natural adhesives. Zero toxic chemicals.', status: 'verified', facility: 'GreenStep Processing', energySource: 'Wind Power', certification: 'REACH Compliant', emissions: '0.9kg CO₂' },
      { id: 'AS-023', title: 'Manufacturing', description: 'Artisan workshop with fair labor practices. Small batch production.', status: 'verified', facility: 'GreenStep Atelier', energySource: 'Solar + Grid', certification: 'B Corp Certified', emissions: '1.0kg CO₂' },
      { id: 'AS-024', title: 'Distribution', description: 'Rail and electric van delivery within Europe.', status: 'verified', facility: 'EcoShip EU', energySource: 'Electric + Rail', certification: 'Carbon Low', emissions: '0.6kg CO₂' },
    ],
    auditProgress: 80,
  },
];

export const getRandomProduct = (): ProductScan => {
  const index = Math.floor(Math.random() * MOCK_PRODUCTS.length);
  return { ...MOCK_PRODUCTS[index], id: `SCAN-${Date.now()}`, scanDate: new Date().toISOString().split('T')[0] };
};

export const SCAN_PROTOCOLS = ['ATMOSPHERIC', 'LOGISTICS', 'MATERIAL', 'CARBON', 'LABOR'];
