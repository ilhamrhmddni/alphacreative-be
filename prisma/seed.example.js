const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("\n🌱 Seeding comprehensive dataset...");

  // Bersihkan data agar hasil seed deterministik.
  await prisma.scoreDetail.deleteMany();
  await prisma.score.deleteMany();
  await prisma.partisipasi.deleteMany();
  await prisma.juara.deleteMany();
  await prisma.detailPeserta.deleteMany();
  await prisma.peserta.deleteMany();
  await prisma.eventCategory.deleteMany();
  await prisma.event.deleteMany();
  await prisma.berita.deleteMany();
  await prisma.galleryItem.deleteMany();
  await prisma.partnership.deleteMany();
  await prisma.merchandise.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();

  const saltRounds = 10;
  const adminPassword = await bcrypt.hash("admin123", saltRounds);
  const defaultPassword = await bcrypt.hash("password", saltRounds);

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      username: "admin",
      password: adminPassword,
      role: "admin",
      isActive: true,
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: "operator@example.com",
      username: "operator",
      password: defaultPassword,
      role: "operator",
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const juror = await prisma.user.create({
    data: {
      email: "juri@example.com",
      username: "juri",
      password: defaultPassword,
      role: "juri",
      isActive: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const participantUsers = await Promise.all(
    Array.from({ length: 3 }).map((_, index) =>
      prisma.user.create({
        data: {
          email: `peserta${index + 1}@example.com`,
          username: `peserta${index + 1}`,
          password: defaultPassword,
          role: "peserta",
          isActive: true,
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      })
    )
  );

  const event = await prisma.event.create({
    data: {
      namaEvent: "Alpha Creative Challenge",
      deskripsiEvent: "Kompetisi LKBB tahunan.",
      tanggalEvent: new Date("2025-08-17T08:00:00.000Z"),
      tempatEvent: "Balikpapan",
      venue: "GOR Kadrie Oening",
      status: "open",
      kuota: 100,
      biaya: 150000,
      isFeatured: true,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  const categoryPayload = [
    { name: "Kategori A", description: "Jenjang SD", quota: 10 },
    { name: "Kategori B", description: "Jenjang SMP", quota: 12 },
    { name: "Kategori C", description: "Jenjang SMA", quota: 15 },
    { name: "Kategori D", description: "Umum", quota: 20 },
  ].map((category) => ({
    ...category,
    eventId: event.id,
    createdBy: admin.id,
    updatedBy: admin.id,
  }));

  await prisma.eventCategory.createMany({ data: categoryPayload });

  const categories = await prisma.eventCategory.findMany({
    where: { eventId: event.id },
    orderBy: { id: "asc" },
  });

  const pesertaRecords = await Promise.all(
    participantUsers.map((user, index) =>
      prisma.peserta.create({
        data: {
          userId: user.id,
          eventId: event.id,
          eventCategoryId: categories[index]?.id ?? null,
          namaTim: `Tim ${['Alpha', 'Beta', 'Gamma'][index] || `Peserta ${index + 1}`}`,
          namaPerwakilan: `Ketua Tim ${index + 1}`,
          noPeserta: `AC2025-${String(index + 1).padStart(3, "0")}`,
          status: index === 0 ? "approved" : "pending",
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      })
    )
  );

  // Detail peserta untuk tim pertama
  await prisma.detailPeserta.createMany({
    data: [
      {
        pesertaId: pesertaRecords[0].id,
        namaDetail: "Andi Prasetyo",
        tanggalLahir: new Date("2010-05-15"),
        umur: 15,
        nisnNta: "0012345678",
        alamat: "Jl. Sudirman No. 123, Balikpapan",
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        pesertaId: pesertaRecords[0].id,
        namaDetail: "Budi Santoso",
        tanggalLahir: new Date("2010-08-20"),
        umur: 15,
        nisnNta: "0012345679",
        alamat: "Jl. Ahmad Yani No. 45, Balikpapan",
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    ],
  });

  // Berita
  await prisma.berita.createMany({
    data: [
      {
        title: "Alpha Creative Challenge 2025 Resmi Dibuka!",
        deskripsi: "Kompetisi LKBB tahunan terbesar di Kalimantan Timur kembali hadir dengan tema 'Membangun Karakter Melalui Disiplin dan Kerjasama'. Pendaftaran dibuka mulai hari ini hingga 30 Juli 2025.",
        tanggal: new Date("2025-06-01"),
        eventId: event.id,
        tags: ["event", "pendaftaran"],
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        title: "Tips Persiapan Mengikuti Lomba LKBB",
        deskripsi: "Berikut adalah tips-tips penting yang perlu diperhatikan oleh tim yang akan mengikuti lomba LKBB: latihan rutin, koordinasi tim, memahami peraturan, dan menjaga kondisi fisik.",
        tanggal: new Date("2025-06-15"),
        tags: ["tips", "persiapan"],
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        title: "Profil Juara Tahun Lalu: Inspirasi untuk Kompetitor Baru",
        deskripsi: "Tim Garuda dari SMA 1 Balikpapan berhasil meraih juara umum tahun lalu dengan persiapan matang dan kekompakan tim yang luar biasa. Simak kisah inspiratif mereka.",
        tanggal: new Date("2025-07-01"),
        tags: ["profil", "inspirasi"],
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    ],
  });

  // Gallery
  await prisma.galleryItem.createMany({
    data: [
      {
        title: "Pembukaan Alpha Creative Challenge 2024",
        caption: "Upacara pembukaan dengan kehadiran Walikota Balikpapan",
        photoPath: "/uploads/gallery/opening-2024.jpg",
        order: 1,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        title: "Tim Juara Umum 2024",
        caption: "Tim Garuda SMA 1 Balikpapan - Juara Umum",
        photoPath: "/uploads/gallery/champion-2024.jpg",
        order: 2,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        title: "Aksi Penampilan Terbaik",
        caption: "Formasi sempurna dari salah satu peserta",
        photoPath: "/uploads/gallery/performance-2024.jpg",
        order: 3,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    ],
  });

  // Partnerships
  await prisma.partnership.createMany({
    data: [
      {
        name: "Pemerintah Kota Balikpapan",
        role: "Sponsor Utama",
        description: "Mendukung penuh penyelenggaraan Alpha Creative Challenge",
        type: "government",
        order: 1,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Bank Kaltimtara",
        role: "Sponsor Platinum",
        description: "Partner finansial terpercaya",
        type: "sponsor",
        order: 2,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Radio Kharisma FM",
        role: "Media Partner",
        description: "Media partner untuk publikasi event",
        type: "media",
        order: 3,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Universitas Balikpapan",
        role: "Partner Akademis",
        description: "Kerjasama dalam pengembangan event",
        type: "education",
        order: 4,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    ],
  });

  // Merchandise
  await prisma.merchandise.createMany({
    data: [
      {
        name: "Kaos Official Alpha Creative 2025",
        productCode: "KAOS-AC-2025",
        category: "Pakaian",
        description: "Kaos official event dengan bahan katun combed 30s, nyaman dan berkualitas. Tersedia ukuran S, M, L, XL, XXL.",
        price: 85000,
        stock: 100,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Topi Snapback Alpha Creative",
        productCode: "TOPI-AC-001",
        category: "Aksesoris",
        description: "Topi snapback dengan bordir logo Alpha Creative. Material premium dan nyaman dipakai.",
        price: 75000,
        stock: 50,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Tumbler Alpha Creative",
        productCode: "TUMBLER-AC-001",
        category: "Peralatan",
        description: "Tumbler stainless steel 500ml dengan desain eksklusif Alpha Creative. Tahan panas dan dingin hingga 12 jam.",
        price: 120000,
        stock: 30,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Jaket Bomber Alpha Creative",
        productCode: "JAKET-AC-2025",
        category: "Pakaian",
        description: "Jaket bomber premium dengan logo bordir dan lining satin. Cocok untuk berbagai acara.",
        price: 250000,
        stock: 25,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Tas Ransel Alpha Creative",
        productCode: "TAS-AC-001",
        category: "Aksesoris",
        description: "Ransel multifungsi dengan banyak kantong dan kompartemen laptop. Material tahan air.",
        price: 185000,
        stock: 40,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      {
        name: "Pin Enamel Alpha Creative",
        productCode: "PIN-AC-001",
        category: "Koleksi",
        description: "Pin enamel eksklusif dengan desain logo Alpha Creative. Limited edition.",
        price: 25000,
        stock: 200,
        isPublished: true,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    ],
  });

  // App Settings
  await prisma.appSetting.createMany({
    data: [
      {
        key: "merch.whatsapp",
        value: "6281234567890",
      },
      {
        key: "site.title",
        value: "Alpha Creative Challenge",
      },
      {
        key: "site.description",
        value: "Kompetisi LKBB Terbesar di Kalimantan Timur",
      },
    ],
  });

  // Score untuk peserta pertama
  const score1 = await prisma.score.create({
    data: {
      eventId: event.id,
      pesertaId: pesertaRecords[0].id,
      juriId: juror.id,
      nilai: null,
      useManualNilai: false,
      catatan: "Penampilan bagus, perlu perbaikan di formasi",
      createdBy: juror.id,
      updatedBy: juror.id,
    },
  });

  // Score details
  await prisma.scoreDetail.createMany({
    data: [
      {
        scoreId: score1.id,
        kriteria: "Kerapian",
        nilai: 85,
        bobot: 0.3,
        catatan: "Sangat rapi dan terkoordinasi",
        createdBy: juror.id,
        updatedBy: juror.id,
      },
      {
        scoreId: score1.id,
        kriteria: "Kekompakan",
        nilai: 88,
        bobot: 0.3,
        catatan: "Kekompakan tim sangat baik",
        createdBy: juror.id,
        updatedBy: juror.id,
      },
      {
        scoreId: score1.id,
        kriteria: "Formasi",
        nilai: 82,
        bobot: 0.2,
        catatan: "Formasi cukup baik, ada beberapa yang perlu diperbaiki",
        createdBy: juror.id,
        updatedBy: juror.id,
      },
      {
        scoreId: score1.id,
        kriteria: "Disiplin",
        nilai: 90,
        bobot: 0.2,
        catatan: "Disiplin sangat tinggi",
        createdBy: juror.id,
        updatedBy: juror.id,
      },
    ],
  });

  // Update score nilai berdasarkan score details
  const details = await prisma.scoreDetail.findMany({
    where: { scoreId: score1.id },
  });
  const totalNilai = details.reduce((sum, d) => sum + (d.nilai * (d.bobot || 0)), 0);
  await prisma.score.update({
    where: { id: score1.id },
    data: { nilai: Math.round(totalNilai) },
  });

  // Juara untuk peserta pertama
  const juara1 = await prisma.juara.create({
    data: {
      eventId: event.id,
      pesertaId: pesertaRecords[0].id,
      juara: "Juara 1",
      kategori: categories[0].name,
      berkasLink: "https://drive.google.com/sample-berkas",
      setByUserId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  // Partisipasi untuk peserta pertama
  await prisma.partisipasi.create({
    data: {
      pesertaId: pesertaRecords[0].id,
      eventId: event.id,
      juaraId: juara1.id,
      linkDrive: "https://drive.google.com/sample-dokumentasi",
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  });

  console.log("\n✅ Seed selesai! Data lengkap tersedia:");
  console.log("\n👤 Users:");
  console.log("  • Admin      : admin@example.com / admin123");
  console.log("  • Operator   : operator@example.com / password");
  console.log("  • Juri       : juri@example.com / password");
  console.log("  • Peserta    : peserta1..3@example.com / password");
  console.log("\n🎯 Events:");
  console.log("  • 1 event    : Alpha Creative Challenge 2025");
  console.log("  • 4 kategori : A (SD), B (SMP), C (SMA), D (Umum)");
  console.log("\n📝 Peserta:");
  console.log("  • 3 tim terdaftar");
  console.log("  • 1 tim approved dengan detail anggota");
  console.log("  • 1 tim dengan score dan juara");
  console.log("\n📰 Content:");
  console.log("  • 3 berita");
  console.log("  • 3 gallery items");
  console.log("  • 4 partnerships");
  console.log("  • 6 merchandise items");
  console.log("\n⚙️  Settings:");
  console.log("  • WhatsApp dan site settings configured");
  console.log("");
}

main()
  .catch((err) => {
    console.error("❌ Error saat seeding:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
