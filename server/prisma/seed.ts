/**
 * Seed: 50+ equipos de audio reales
 * Categorías: PA, Estudio, Instrumentos, Cables, Iluminación, Multimedia
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Códigos internos por categoría
const CODE_PREFIXES: Record<string, string> = {
  pa: 'PA',
  studio: 'REC',
  instruments: 'INST',
  cables: 'CAB',
  lighting: 'LGT',
  multimedia: 'MM',
};

async function main() {
  // Limpiar en orden por foreign keys
  await prisma.auditLog.deleteMany();
  await prisma.loanRecord.deleteMany();
  await prisma.maintenance.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.document.deleteMany();
  await prisma.deviceImage.deleteMany();
  await prisma.device.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Usuario admin
  const adminUser = await prisma.user.create({
    data: {
      name: 'Administrador SoundVault',
      email: 'admin@thewarehouse.com',
      password: hashedPassword,
      role: 'ADMIN',
      phone: '+56912345678',
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      name: 'Juan Técnico',
      email: 'tecnico@thewarehouse.com',
      password: hashedPassword,
      role: 'TECHNICIAN',
      phone: '+56987654321',
    },
  });

  // Categorías - árbol jerárquico
  const catPA = await prisma.category.create({
    data: { name: 'Sistema PA', slug: 'audio-pa', icon: 'Speaker', color: '#F59E0B' },
  });
  const catConsola = await prisma.category.create({
    data: { name: 'Consolas', slug: 'consolas', icon: 'Sliders', color: '#3B82F6', parentId: catPA.id },
  });
  const catParlantes = await prisma.category.create({
    data: { name: 'Parlantes', slug: 'parlantes', icon: 'Radio', color: '#10B981', parentId: catPA.id },
  });
  const catAmplificadores = await prisma.category.create({
    data: { name: 'Amplificadores', slug: 'amplificadores', icon: 'Zap', color: '#EF4444', parentId: catPA.id },
  });
  const catProcesadores = await prisma.category.create({
    data: { name: 'Procesadores', slug: 'procesadores', icon: 'Cpu', color: '#8B5CF6', parentId: catPA.id },
  });

  const catEstudio = await prisma.category.create({
    data: { name: 'Estudio de Grabación', slug: 'recording-studio', icon: 'Mic2', color: '#EC4899' },
  });
  const catInterfaces = await prisma.category.create({
    data: { name: 'Interfaces de Audio', slug: 'interfaces', icon: 'HardDrive', color: '#06B6D4', parentId: catEstudio.id },
  });
  const catMicrofonos = await prisma.category.create({
    data: { name: 'Micrófonos', slug: 'microfonos', icon: 'Mic', color: '#84CC16', parentId: catEstudio.id },
  });
  const catMonitores = await prisma.category.create({
    data: { name: 'Monitores de Estudio', slug: 'monitores-estudio', icon: 'Monitor', color: '#F97316', parentId: catEstudio.id },
  });

  const catInstrumentos = await prisma.category.create({
    data: { name: 'Instrumentos Musicales', slug: 'instruments', icon: 'Music', color: '#14B8A6' },
  });
  const catGuitarras = await prisma.category.create({
    data: { name: 'Guitarras y Bajos', slug: 'guitarras-bajos', icon: 'Music2', color: '#A855F7', parentId: catInstrumentos.id },
  });
  const catTeclados = await prisma.category.create({
    data: { name: 'Teclados', slug: 'teclados', icon: 'Piano', color: '#6366F1', parentId: catInstrumentos.id },
  });
  const catBateria = await prisma.category.create({
    data: { name: 'Batería y Percusión', slug: 'bateria', icon: 'Drum', color: '#EAB308', parentId: catInstrumentos.id },
  });

  const catCables = await prisma.category.create({
    data: { name: 'Cables y Accesorios', slug: 'cables-accessories', icon: 'Cable', color: '#64748B' },
  });
  const catIluminacion = await prisma.category.create({
    data: { name: 'Iluminación', slug: 'lighting', icon: 'Lightbulb', color: '#F59E0B' },
  });
  const catMultimedia = await prisma.category.create({
    data: { name: 'Multimedia', slug: 'multimedia', icon: 'Tv', color: '#1E3A5F' },
  });

  // Dispositivos - Consolas
  const devicesData = [
    { name: 'Behringer X32', brand: 'Behringer', model: 'X32', categoryId: catConsola.id, code: 'PA-001', serial: 'BHR-X32-001', price: 2499 },
    { name: 'Allen & Heath QU-16', brand: 'Allen & Heath', model: 'QU-16', categoryId: catConsola.id, code: 'PA-002', serial: 'AH-QU16-002', price: 3499 },
    { name: 'Behringer Wing', brand: 'Behringer', model: 'Wing', categoryId: catConsola.id, code: 'PA-003', serial: 'BHR-WING-003', price: 4999 },
    { name: 'Allen & Heath SQ-5', brand: 'Allen & Heath', model: 'SQ-5', categoryId: catConsola.id, code: 'PA-004', serial: 'AH-SQ5-004', price: 2799 },
    { name: 'Behringer X32 Compact', brand: 'Behringer', model: 'X32 Compact', categoryId: catConsola.id, code: 'PA-005', serial: 'BHR-X32C-005', price: 2199 },
    { name: 'Yamaha QL5', brand: 'Yamaha', model: 'QL5', categoryId: catConsola.id, code: 'PA-006', serial: 'YAM-QL5-006', price: 8999 },
    { name: 'Soundcraft Vi1', brand: 'Soundcraft', model: 'Vi1', categoryId: catConsola.id, code: 'PA-007', serial: 'SC-VI1-007', price: 15999 },
    { name: 'Behringer X32 Rack', brand: 'Behringer', model: 'X32 Rack', categoryId: catConsola.id, code: 'PA-008', serial: 'BHR-X32R-008', price: 1999 },

    // Parlantes
    { name: 'QSC K12.2', brand: 'QSC', model: 'K12.2', categoryId: catParlantes.id, code: 'PA-009', serial: 'QSC-K122-009', price: 899 },
    { name: 'QSC K12.2', brand: 'QSC', model: 'K12.2', categoryId: catParlantes.id, code: 'PA-010', serial: 'QSC-K122-010', price: 899 },
    { name: 'JBL PRX415M', brand: 'JBL', model: 'PRX415M', categoryId: catParlantes.id, code: 'PA-011', serial: 'JBL-PRX415-011', price: 1299 },
    { name: 'JBL PRX415M', brand: 'JBL', model: 'PRX415M', categoryId: catParlantes.id, code: 'PA-012', serial: 'JBL-PRX415-012', price: 1299 },
    { name: 'QSC KS118 Subwoofer', brand: 'QSC', model: 'KS118', categoryId: catParlantes.id, code: 'PA-013', serial: 'QSC-KS118-013', price: 1299 },
    { name: 'QSC KS118 Subwoofer', brand: 'QSC', model: 'KS118', categoryId: catParlantes.id, code: 'PA-014', serial: 'QSC-KS118-014', price: 1299 },
    { name: 'JBL VRX932LAP', brand: 'JBL', model: 'VRX932LAP', categoryId: catParlantes.id, code: 'PA-015', serial: 'JBL-VRX932-015', price: 1899 },
    { name: 'EV ZLX-12P', brand: 'Electro-Voice', model: 'ZLX-12P', categoryId: catParlantes.id, code: 'PA-016', serial: 'EV-ZLX12-016', price: 499 },
    { name: 'EV ZLX-12P', brand: 'Electro-Voice', model: 'ZLX-12P', categoryId: catParlantes.id, code: 'PA-017', serial: 'EV-ZLX12-017', price: 499 },
    { name: 'Bose L1 Compact', brand: 'Bose', model: 'L1 Compact', categoryId: catParlantes.id, code: 'PA-018', serial: 'BOSE-L1C-018', price: 999 },

    // Amplificadores
    { name: 'Crown XLi 3500', brand: 'Crown', model: 'XLi 3500', categoryId: catAmplificadores.id, code: 'PA-019', serial: 'CRW-XLI3500-019', price: 699 },
    { name: 'Crown XLi 3500', brand: 'Crown', model: 'XLi 3500', categoryId: catAmplificadores.id, code: 'PA-020', serial: 'CRW-XLI3500-020', price: 699 },
    { name: 'QSC GX5', brand: 'QSC', model: 'GX5', categoryId: catAmplificadores.id, code: 'PA-021', serial: 'QSC-GX5-021', price: 599 },
    { name: 'Crown DCi 4|600', brand: 'Crown', model: 'DCi 4|600', categoryId: catAmplificadores.id, code: 'PA-022', serial: 'CRW-DCI-022', price: 2499 },

    // Procesadores
    { name: 'DBX DriveRack PA2', brand: 'DBX', model: 'DriveRack PA2', categoryId: catProcesadores.id, code: 'PA-023', serial: 'DBX-PA2-023', price: 499 },
    { name: 'Ashly Protea 3.24', brand: 'Ashly', model: 'Protea 3.24', categoryId: catProcesadores.id, code: 'PA-024', serial: 'ASHLY-324-024', price: 899 },
    { name: 'Behringer DCX2496', brand: 'Behringer', model: 'DCX2496', categoryId: catProcesadores.id, code: 'PA-025', serial: 'BHR-DCX-025', price: 299 },

    // Interfaces de audio
    { name: 'Focusrite Scarlett 18i20', brand: 'Focusrite', model: 'Scarlett 18i20 3rd Gen', categoryId: catInterfaces.id, code: 'REC-001', serial: 'FOC-18I20-001', price: 549 },
    { name: 'Universal Audio Apollo x8', brand: 'Universal Audio', model: 'Apollo x8', categoryId: catInterfaces.id, code: 'REC-002', serial: 'UA-APX8-002', price: 2999 },
    { name: 'PreSonus Studio 1824c', brand: 'PreSonus', model: 'Studio 1824c', categoryId: catInterfaces.id, code: 'REC-003', serial: 'PRS-1824-003', price: 699 },
    { name: 'RME Fireface UFX+', brand: 'RME', model: 'Fireface UFX+', categoryId: catInterfaces.id, code: 'REC-004', serial: 'RME-UFX-004', price: 2499 },
    { name: 'Universal Audio Apollo Twin', brand: 'Universal Audio', model: 'Apollo Twin X', categoryId: catInterfaces.id, code: 'REC-005', serial: 'UA-APT-005', price: 999 },

    // Micrófonos
    { name: 'Shure SM58', brand: 'Shure', model: 'SM58', categoryId: catMicrofonos.id, code: 'REC-006', serial: 'SH-SM58-006', price: 99 },
    { name: 'Shure SM58', brand: 'Shure', model: 'SM58', categoryId: catMicrofonos.id, code: 'REC-007', serial: 'SH-SM58-007', price: 99 },
    { name: 'Shure SM58', brand: 'Shure', model: 'SM58', categoryId: catMicrofonos.id, code: 'REC-008', serial: 'SH-SM58-008', price: 99 },
    { name: 'Shure SM58', brand: 'Shure', model: 'SM58', categoryId: catMicrofonos.id, code: 'REC-009', serial: 'SH-SM58-009', price: 99 },
    { name: 'Shure SM58', brand: 'Shure', model: 'SM58', categoryId: catMicrofonos.id, code: 'REC-010', serial: 'SH-SM58-010', price: 99 },
    { name: 'Sennheiser e935', brand: 'Sennheiser', model: 'e935', categoryId: catMicrofonos.id, code: 'REC-011', serial: 'SEN-E935-011', price: 199 },
    { name: 'Sennheiser e935', brand: 'Sennheiser', model: 'e935', categoryId: catMicrofonos.id, code: 'REC-012', serial: 'SEN-E935-012', price: 199 },
    { name: 'Shure Beta 52A', brand: 'Shure', model: 'Beta 52A', categoryId: catMicrofonos.id, code: 'REC-013', serial: 'SH-B52-013', price: 199 },
    { name: 'AKG C214', brand: 'AKG', model: 'C214', categoryId: catMicrofonos.id, code: 'REC-014', serial: 'AKG-C214-014', price: 399 },
    { name: 'AKG C214', brand: 'AKG', model: 'C214', categoryId: catMicrofonos.id, code: 'REC-015', serial: 'AKG-C214-015', price: 399 },
    { name: 'Neumann TLM 103', brand: 'Neumann', model: 'TLM 103', categoryId: catMicrofonos.id, code: 'REC-016', serial: 'NEU-TLM103-016', price: 1299 },
    { name: 'Shure SM7B', brand: 'Shure', model: 'SM7B', categoryId: catMicrofonos.id, code: 'REC-017', serial: 'SH-SM7B-017', price: 399 },
    { name: 'Rode NT1-A', brand: 'Rode', model: 'NT1-A', categoryId: catMicrofonos.id, code: 'REC-018', serial: 'ROD-NT1A-018', price: 169 },
    { name: 'Sennheiser MD421', brand: 'Sennheiser', model: 'MD 421 II', categoryId: catMicrofonos.id, code: 'REC-019', serial: 'SEN-MD421-019', price: 349 },
    { name: 'Shure Beta 91A', brand: 'Shure', model: 'Beta 91A', categoryId: catMicrofonos.id, code: 'REC-020', serial: 'SH-B91-020', price: 249 },

    // Monitores de estudio
    { name: 'Yamaha HS8', brand: 'Yamaha', model: 'HS8', categoryId: catMonitores.id, code: 'REC-021', serial: 'YAM-HS8-021', price: 349 },
    { name: 'Yamaha HS8', brand: 'Yamaha', model: 'HS8', categoryId: catMonitores.id, code: 'REC-022', serial: 'YAM-HS8-022', price: 349 },
    { name: 'Adam A7X', brand: 'Adam Audio', model: 'A7X', categoryId: catMonitores.id, code: 'REC-023', serial: 'ADM-A7X-023', price: 899 },
    { name: 'Adam A7X', brand: 'Adam Audio', model: 'A7X', categoryId: catMonitores.id, code: 'REC-024', serial: 'ADM-A7X-024', price: 899 },
    { name: 'KRK Rokit 5 G4', brand: 'KRK', model: 'Rokit 5 G4', categoryId: catMonitores.id, code: 'REC-025', serial: 'KRK-R5-025', price: 199 },
    { name: 'KRK Rokit 5 G4', brand: 'KRK', model: 'Rokit 5 G4', categoryId: catMonitores.id, code: 'REC-026', serial: 'KRK-R5-026', price: 199 },

    // Instrumentos - Guitarras
    { name: 'Taylor 314ce', brand: 'Taylor', model: '314ce', categoryId: catGuitarras.id, code: 'INST-001', serial: 'TAY-314-001', price: 1899 },
    { name: 'Fender Stratocaster American', brand: 'Fender', model: 'American Stratocaster', categoryId: catGuitarras.id, code: 'INST-002', serial: 'FEN-STRAT-002', price: 1499 },
    { name: 'Fender Precision Bass', brand: 'Fender', model: 'Precision Bass', categoryId: catGuitarras.id, code: 'INST-003', serial: 'FEN-PBASS-003', price: 1299 },
    { name: 'Martin D-28', brand: 'Martin', model: 'D-28', categoryId: catGuitarras.id, code: 'INST-004', serial: 'MAR-D28-004', price: 2999 },
    { name: 'Gibson Les Paul Studio', brand: 'Gibson', model: 'Les Paul Studio', categoryId: catGuitarras.id, code: 'INST-005', serial: 'GIB-LP-005', price: 1499 },

    // Teclados
    { name: 'Yamaha P-125', brand: 'Yamaha', model: 'P-125', categoryId: catTeclados.id, code: 'INST-006', serial: 'YAM-P125-006', price: 649 },
    { name: 'Roland RD-2000', brand: 'Roland', model: 'RD-2000', categoryId: catTeclados.id, code: 'INST-007', serial: 'ROL-RD2000-007', price: 2499 },
    { name: 'Nord Stage 3', brand: 'Nord', model: 'Stage 3 88', categoryId: catTeclados.id, code: 'INST-008', serial: 'NORD-ST3-008', price: 3999 },
    { name: 'Korg Kronos', brand: 'Korg', model: 'Kronos 2 61', categoryId: catTeclados.id, code: 'INST-009', serial: 'KOR-KRON-009', price: 2999 },
    { name: 'Yamaha MODX8', brand: 'Yamaha', model: 'MODX8', categoryId: catTeclados.id, code: 'INST-010', serial: 'YAM-MODX-010', price: 1299 },

    // Batería
    { name: 'Roland TD-27KV', brand: 'Roland', model: 'TD-27KV', categoryId: catBateria.id, code: 'INST-011', serial: 'ROL-TD27-011', price: 2499 },
    { name: 'Yamaha DTX6K-X', brand: 'Yamaha', model: 'DTX6K-X', categoryId: catBateria.id, code: 'INST-012', serial: 'YAM-DTX6-012', price: 899 },
    { name: 'DW Collector\'s Series', brand: 'DW', model: 'Collector\'s 5pc', categoryId: catBateria.id, code: 'INST-013', serial: 'DW-COLL-013', price: 4999 },

    // Cables
    { name: 'Cable XLR 5m Pro Co', brand: 'Pro Co', model: 'XLR 5m', categoryId: catCables.id, code: 'CAB-001', serial: null, price: 25 },
    { name: 'Cable XLR 10m Pro Co', brand: 'Pro Co', model: 'XLR 10m', categoryId: catCables.id, code: 'CAB-002', serial: null, price: 35 },
    { name: 'Cable TRS 3m Mogami', brand: 'Mogami', model: 'Gold TRS 3m', categoryId: catCables.id, code: 'CAB-003', serial: null, price: 45 },
    { name: 'Cable Speakon 5m', brand: 'Neutrik', model: 'Speakon NL4', categoryId: catCables.id, code: 'CAB-004', serial: null, price: 55 },
    { name: 'Patch Cable 1m', brand: 'Hosa', model: 'TRS 1m', categoryId: catCables.id, code: 'CAB-005', serial: null, price: 15 },

    // Iluminación
    { name: 'Chauvet Intimidator 355', brand: 'Chauvet', model: 'Intimidator Spot 355', categoryId: catIluminacion.id, code: 'LGT-001', serial: 'CHV-355-001', price: 599 },
    { name: 'Chauvet Intimidator 355', brand: 'Chauvet', model: 'Intimidator Spot 355', categoryId: catIluminacion.id, code: 'LGT-002', serial: 'CHV-355-002', price: 599 },
    { name: 'Elation LED Par 200', brand: 'Elation', model: 'PAR 200', categoryId: catIluminacion.id, code: 'LGT-003', serial: 'ELT-PAR200-003', price: 129 },
    { name: 'ADJ Vizi Wash', brand: 'ADJ', model: 'Vizi Wash RX', categoryId: catIluminacion.id, code: 'LGT-004', serial: 'ADJ-VW-004', price: 349 },
    { name: 'Chauvet Obey 40', brand: 'Chauvet', model: 'Obey 40', categoryId: catIluminacion.id, code: 'LGT-005', serial: 'CHV-OBEY-005', price: 199 },
    { name: 'Antari HZ-500', brand: 'Antari', model: 'HZ-500', categoryId: catIluminacion.id, code: 'LGT-006', serial: 'ANT-HZ500-006', price: 899 },

    // Multimedia
    { name: 'Epson PowerLite L615U', brand: 'Epson', model: 'PowerLite L615U', categoryId: catMultimedia.id, code: 'MM-001', serial: 'EPS-L615-001', price: 1299 },
    { name: 'Samsung 55" Display', brand: 'Samsung', model: 'UE55', categoryId: catMultimedia.id, code: 'MM-002', serial: 'SAM-UE55-002', price: 699 },
    { name: 'Blackmagic ATEM Mini', brand: 'Blackmagic', model: 'ATEM Mini Pro', categoryId: catMultimedia.id, code: 'MM-003', serial: 'BMD-ATEM-003', price: 495 },
    { name: 'PTZ Optics 20X', brand: 'PTZ Optics', model: '20X-NDI', categoryId: catMultimedia.id, code: 'MM-004', serial: 'PTZ-20X-004', price: 1999 },
  ];

  const locations = ['MAIN_AUDITORIUM', 'RECORDING_STUDIO', 'STORAGE_ROOM', 'YOUTH_ROOM', 'CHAPEL'] as const;
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'MAINTENANCE', 'LOANED'] as const;

  for (let i = 0; i < devicesData.length; i++) {
    const d = devicesData[i] as (typeof devicesData)[number] & { serial: string | null; price: number };
    const purchaseDate = new Date(2020 + (i % 4), i % 12, (i % 28) + 1);
    const warrantyExpiry = new Date(purchaseDate);
    warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + 2);

    await prisma.device.create({
      data: {
        name: d.name,
        brand: d.brand,
        model: d.model,
        serialNumber: d.serial,
        internalCode: d.code,
        categoryId: d.categoryId,
        status: statuses[i % statuses.length],
        location: locations[i % locations.length],
        purchaseDate,
        purchasePrice: d.price,
        warrantyExpiry,
        supplier: 'ProAudio Chile',
        condition: 70 + (i % 30),
        createdBy: adminUser.id,
      },
    });
  }

  // Crear algunos movimientos de ejemplo
  const devices = await prisma.device.findMany({ take: 10 });
  for (const device of devices) {
    await prisma.movement.create({
      data: {
        deviceId: device.id,
        type: 'CHECK_OUT',
        fromLocation: 'STORAGE_ROOM',
        toLocation: 'MAIN_AUDITORIUM',
        reason: 'Servicio dominical',
        userId: managerUser.id,
      },
    });
  }

  // Mantenimientos de ejemplo
  await prisma.maintenance.create({
    data: {
      deviceId: devices[0].id,
      type: 'preventivo',
      description: 'Limpieza de canales y calibración',
      cost: 150,
      technician: 'Juan Técnico',
      startDate: new Date(),
      status: 'SCHEDULED',
      userId: adminUser.id,
    },
  });

  await prisma.maintenance.create({
    data: {
      deviceId: devices[1].id,
      type: 'correctivo',
      description: 'Reparación de fader defectuoso',
      cost: 200,
      technician: 'Servicio externo',
      startDate: new Date(Date.now() - 86400000 * 5),
      endDate: new Date(),
      status: 'COMPLETED',
      userId: adminUser.id,
    },
  });

  // Préstamo de ejemplo
  await prisma.loanRecord.create({
    data: {
      deviceId: devices[2].id,
      borrowerName: 'Ministro de alabanza',
      borrowerEmail: 'alabanza@iglesia.com',
      borrowerPhone: '+56911111111',
      purpose: 'Ensayo de banda',
      loanDate: new Date(),
      expectedReturn: new Date(Date.now() + 86400000 * 2),
      status: 'ACTIVE',
      approvedBy: adminUser.id,
    },
  });

  console.log(`✅ Seed completado: ${devicesData.length} equipos, ${await prisma.category.count()} categorías`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
