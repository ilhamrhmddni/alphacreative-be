-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Berita" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "photoPath" TEXT,
    "deskripsi" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Berita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "namaEvent" TEXT NOT NULL,
    "photoPath" TEXT,
    "deskripsiEvent" TEXT,
    "tanggalEvent" TIMESTAMP(3) NOT NULL,
    "tempatEvent" TEXT NOT NULL,
    "venue" TEXT,
    "status" TEXT,
    "kuota" INTEGER,
    "biaya" INTEGER,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Peserta" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "namaTim" TEXT NOT NULL,
    "namaPerwakilan" TEXT,
    "tanggalPendaftaran" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Peserta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailPeserta" (
    "id" SERIAL NOT NULL,
    "pesertaId" INTEGER NOT NULL,
    "namaDetail" TEXT NOT NULL,
    "tanggalLahir" TIMESTAMP(3),
    "umur" INTEGER,

    CONSTRAINT "DetailPeserta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Juara" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "pesertaId" INTEGER NOT NULL,
    "juara" TEXT NOT NULL,
    "kategori" TEXT,

    CONSTRAINT "Juara_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partisipasi" (
    "id" SERIAL NOT NULL,
    "pesertaId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "juaraId" INTEGER,

    CONSTRAINT "Partisipasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Peserta" ADD CONSTRAINT "Peserta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Peserta" ADD CONSTRAINT "Peserta_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailPeserta" ADD CONSTRAINT "DetailPeserta_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Juara" ADD CONSTRAINT "Juara_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Juara" ADD CONSTRAINT "Juara_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partisipasi" ADD CONSTRAINT "Partisipasi_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partisipasi" ADD CONSTRAINT "Partisipasi_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partisipasi" ADD CONSTRAINT "Partisipasi_juaraId_fkey" FOREIGN KEY ("juaraId") REFERENCES "Juara"("id") ON DELETE SET NULL ON UPDATE CASCADE;
