const { PrismaClient } = require("@prisma/client");

const prisma = process.env.NODE_ENV === "production" 
  ? new PrismaClient() 
  : (global.prisma ||= new PrismaClient());

module.exports = prisma;