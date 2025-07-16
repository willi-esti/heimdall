import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a test user
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@heimdall.local' },
    update: {},
    create: {
      email: 'admin@heimdall.local',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
    },
  })

  // Create a test organization
  const org = await prisma.organization.upsert({
    where: { id: 'test-org' },
    update: {},
    create: {
      id: 'test-org',
      name: 'Test Organization',
      description: 'A test organization for development',
    },
  })

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: Role.ADMIN,
    },
  })

  // Create a test folder
  const folder = await prisma.folder.create({
    data: {
      name: 'Production',
      description: 'Production environment secrets',
      organizationId: org.id,
    },
  })

  console.log('✅ Seeding completed!')
  console.log(`👤 User: ${user.email}`)
  console.log(`🏢 Organization: ${org.name}`)
  console.log(`📁 Folder: ${folder.name}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
