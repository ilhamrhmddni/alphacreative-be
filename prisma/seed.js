const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

/**
 * Seed function - generates default admin user
 * Run with: npx prisma db seed
 * 
 * NOTE: This generates only admin user. For full test data, 
 * use seed.example.js as reference to create custom seed.
 */
async function main() {
  console.log("\n🌱 Seeding default admin user...\n");

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@example.com" }
  });

  if (existingAdmin) {
    console.log("✅ Admin user already exists");
    console.log(`   Email: admin@example.com`);
    console.log(`   Status: Active\n`);
    return;
  }

  // Create default admin user
  const saltRounds = 10;
  const adminPassword = await bcrypt.hash("admin123", saltRounds);

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      username: "admin",
      password: adminPassword,
      role: "admin",
      isActive: true,
    },
  });

  console.log("✅ Default admin user created!");
  console.log(`   Email: admin@example.com`);
  console.log(`   Username: admin`);
  console.log(`   Password: admin123`);
  console.log(`   Role: admin`);
  console.log(`   Status: Active\n`);
  console.log("⚠️  Change password after first login!\n`);
}

main()
  .catch((err) => {
    console.error("❌ Error saat seeding:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
