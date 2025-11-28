// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomName() {
  const names = [
    "Ilham",
    "Rizky",
    "Fajar",
    "Dimas",
    "Andi",
    "Budi",
    "Satria",
    "Rama",
    "Yudha",
    "Farhan",
    "Dewi",
    "Intan",
    "Salsa",
    "Anisa",
    "Rara",
    "Citra",
  ];
  return names[randomInt(0, names.length - 1)];
}

function randomTeam() {
  const teams = [
    "Alpha Corps",
    "Bravo LKBB",
    "Crescent Band",
    "Delta Rhythm",
    "Echo Drums",
    "Falcon Sound",
    "Galaxy LKBB",
    "Harmony Squad",
    "Illusion Corps",
    "Jupiter Drums",
  ];
  return teams[randomInt(0, teams.length - 1)];
}

async function main() {
  console.log("🌱 Seeding mulai (versi ringkas)...\n");

  const saltRounds = 10;

  const adminPassword = await bcrypt.hash("admin123", saltRounds);
  const defaultPassword = await bcrypt.hash("password", saltRounds);

  // bersihkan data agar seed konsisten
  await prisma.scoreDetail.deleteMany();
  await prisma.score.deleteMany();
  await prisma.partisipasi.deleteMany();
  await prisma.juara.deleteMany();
  await prisma.detailPeserta.deleteMany();
  await prisma.peserta.deleteMany();
  await prisma.berita.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // -------------------------------------------------------
  // 1. ADMIN
  // -------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      username: "admin",
      password: adminPassword,
      role: "admin",
      isActive: true,
      createdBy: null,
      updatedBy: null,
    },
  });

  // -------------------------------------------------------
  // 2. OPERATOR
  // -------------------------------------------------------
  const operator = await prisma.user.upsert({
    where: { email: "operator@example.com" },
    update: {},
    create: {
      email: "operator@example.com",
      username: "operator",
      password: defaultPassword,
      role: "operator",
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  // -------------------------------------------------------
  // 3. JURI (2 orang)
  // -------------------------------------------------------
  const juri1 = await prisma.user.upsert({
    where: { email: "juri1@example.com" },
    update: {},
    create: {
      email: "juri1@example.com",
      username: "juri1",
      password: defaultPassword,
      role: "juri",
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const juri2 = await prisma.user.upsert({
    where: { email: "juri2@example.com" },
    update: {},
    create: {
      email: "juri2@example.com",
      username: "juri2",
      password: defaultPassword,
      role: "juri",
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const juriList = [juri1, juri2];

  // -------------------------------------------------------
  // 4. Buat 5 user peserta
  // -------------------------------------------------------
  const userPeserta = [];
  for (let i = 1; i <= 5; i++) {
    const email = `peserta${i}@example.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        username: `peserta${i}`,
        password: defaultPassword,
        role: "peserta",
        isActive: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    userPeserta.push(user);
  }

  // -------------------------------------------------------
  // 5. Buat 2 event
  // -------------------------------------------------------
  const events = [];
  for (let i = 1; i <= 2; i++) {
    const event = await prisma.event.create({
      data: {
        namaEvent: `Event LKBB ${i}`,
        deskripsiEvent: `Deskripsi event LKBB ke-${i}`,
        tanggalEvent: new Date(2025, 9 + i, 10 + i),
        tempatEvent: "Balikpapan",
        venue: "GOR",
        status: i === 1 ? "open" : "draft",
        kuota: 20,
        biaya: 150000,
        photoPath: null,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    events.push(event);
  }

  // -------------------------------------------------------
  // 6. Buat Peserta (1 user = 1 peserta untuk 1 event)
  //    Distribusi: 5 peserta ke 2 event
  // -------------------------------------------------------
  const allPeserta = [];

  for (let i = 0; i < userPeserta.length; i++) {
    const user = userPeserta[i];
    const event = events[i % events.length];

    const peserta = await prisma.peserta.create({
      data: {
        userId: user.id,
        eventId: event.id,
        namaTim: randomTeam(),
        namaPerwakilan: randomName(),
        noPeserta: `NP-${String(i + 1).padStart(3, "0")}`,
        createdBy: admin.id,
        updatedBy: admin.id,
        detailPeserta: {
          create: [
            {
              namaDetail: randomName(),
              umur: randomInt(15, 25),
              createdBy: admin.id,
              updatedBy: admin.id,
            },
            {
              namaDetail: randomName(),
              umur: randomInt(15, 25),
              createdBy: admin.id,
              updatedBy: admin.id,
            },
          ],
        },
      },
      include: {
        detailPeserta: true,
      },
    });

    allPeserta.push(peserta);
  }

  // -------------------------------------------------------
  // 7. Buat juara: tiap event ada juara 1 & 2
  // -------------------------------------------------------
  const allJuara = [];
  for (const ev of events) {
    const pesertaEvent = allPeserta.filter((p) => p.eventId === ev.id);
    const juaraPositions = ["1", "2"];

    for (let i = 0; i < juaraPositions.length; i++) {
      const pesertaRandom =
        pesertaEvent[randomInt(0, pesertaEvent.length - 1)];

      const juara = await prisma.juara.create({
        data: {
          eventId: ev.id,
          pesertaId: pesertaRandom.id,
          juara: juaraPositions[i],
          kategori: "Umum",
          setByUserId: admin.id,      // <<< PENTING: pakai setByUserId, BUKAN userId
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      });

      allJuara.push(juara);
    }
  }

  // -------------------------------------------------------
  // 8. Buat partisipasi: 1 peserta = 1 partisipasi
  // -------------------------------------------------------
  for (const peserta of allPeserta) {
    const juaraUntukEvent = allJuara.filter(
      (j) => j.eventId === peserta.eventId
    );

    const pilihanJuara =
      juaraUntukEvent.length === 0 || randomInt(0, 3) === 0
        ? null
        : juaraUntukEvent[randomInt(0, juaraUntukEvent.length - 1)].id;

    await prisma.partisipasi.create({
      data: {
        pesertaId: peserta.id,
        eventId: peserta.eventId,
        juaraId: pilihanJuara,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
  }

  // -------------------------------------------------------
  // 9. Buat Score: setiap juri memberi nilai ke tiap peserta
  // -------------------------------------------------------
  for (const peserta of allPeserta) {
    for (const juri of juriList) {
      const nilai = randomInt(70, 95);

      const scoreRecord = await prisma.score.create({
        data: {
          eventId: peserta.eventId,
          pesertaId: peserta.id,
          juriId: juri.id,
          nilai,
          catatan:
            nilai > 85
              ? "Perform rapi dan kompak"
              : nilai > 75
              ? "Cukup baik, perlu peningkatan sinkronisasi"
              : "Masih banyak yang perlu diperbaiki",
          createdBy: juri.id,
          updatedBy: juri.id,
        },
      });

      await prisma.scoreDetail.createMany({
        data: [
          {
            scoreId: scoreRecord.id,
            kriteria: "Musik",
            nilai: randomInt(70, 95),
            bobot: 0.4,
            createdBy: juri.id,
            updatedBy: juri.id,
          },
          {
            scoreId: scoreRecord.id,
            kriteria: "Visual",
            nilai: randomInt(70, 95),
            bobot: 0.3,
            createdBy: juri.id,
            updatedBy: juri.id,
          },
          {
            scoreId: scoreRecord.id,
            kriteria: "Umum",
            nilai: randomInt(70, 95),
            bobot: 0.3,
            createdBy: juri.id,
            updatedBy: juri.id,
          },
        ],
      });
    }
  }

  // -------------------------------------------------------
  // 10. Berita (news) dummy, 3 saja
  // -------------------------------------------------------
  const beritaList = [
    {
      title: "Pendaftaran Liga Pembaris Dibuka",
      deskripsi:
        "Pendaftaran peserta Liga Pembaris 2025 sudah dapat dilakukan.",
      tanggal: new Date(2025, 9, 1),
      photoPath: null,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      title: "Technical Meeting",
      deskripsi:
        "Technical meeting akan dilaksanakan secara online untuk seluruh ketua tim.",
      tanggal: new Date(2025, 9, 10),
      photoPath: null,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      title: "Pengumuman Jadwal Tampil",
      deskripsi: "Jadwal tampil tim sudah tersedia di halaman jadwal.",
      tanggal: new Date(2025, 9, 20),
      photoPath: null,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  ];

  await prisma.berita.createMany({
    data: beritaList,
  });

  console.log("🌱 Seed DONE!\n");
  console.log(
    [
      "🟢 Admin: admin@example.com / admin123",
      "🟢 Operator: operator@example.com / password",
      "🟢 Juri: juri1@example.com, juri2@example.com / password",
      "🟢 5 user peserta (role: peserta)",
      "🟢 2 event",
      "🟢 5 peserta (1 user, 1 event)",
      "🟢 DetailPeserta: 2 per peserta",
      "🟢 Juara: 2 per event",
      "🟢 Partisipasi: 1 per peserta",
      "🟢 Score: 2 juri × 5 peserta = 10 nilai",
      "🟢 3 berita",
    ].join("\n")
  );
}

main()
  .catch((err) => {
    console.error("❌ Error saat seeding:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
