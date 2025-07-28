import { PrismaClient, Role, SecretType } from '@prisma/client'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import path from 'path'
import { EncryptionService } from '../src/lib/encryption'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

const prisma = new PrismaClient()
const encryptionService = EncryptionService.getInstance()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a test user
  const hashedPassword = await bcrypt.hash('admin', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      username: 'admin',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
    },
  })

  const user2 = await prisma.user.upsert({
    where: { email: 'admin2@gmail.com' },
    update: {},
    create: {
      email: 'admin2@gmail.com',
      username: 'admin2',
      password: hashedPassword,
      firstName: 'Admin2',
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

  // Create second user membership (WRITE role)
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user2.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: user2.id,
      organizationId: org.id,
      role: Role.WRITE,
    },
  })

  console.log('📁 Creating folder tree...')

  // Clean up existing folders and secrets for this org (for clean re-seeding)
  await prisma.secret.deleteMany({
    where: {
      folder: {
        organizationId: org.id
      }
    }
  })
  await prisma.folder.deleteMany({
    where: {
      organizationId: org.id
    }
  })

  // Create Production folder
  const prodFolder = await prisma.folder.create({
    data: {
      name: 'Production',
      description: 'Production environment secrets',
      organizationId: org.id,
    },
  })

  // Create Development folder  
  const devFolder = await prisma.folder.create({
    data: {
      name: 'Development',
      description: 'Development environment secrets',
      organizationId: org.id,
    },
  })

  // Create Staging folder
  const stagingFolder = await prisma.folder.create({
    data: {
      name: 'Staging',
      description: 'Staging environment secrets',
      organizationId: org.id,
    },
  })

  // Create Infrastructure parent folder
  const infraFolder = await prisma.folder.create({
    data: {
      name: 'Infrastructure',
      description: 'Infrastructure and DevOps secrets',
      organizationId: org.id,
    },
  })

  // Create child folders under Infrastructure
  const awsFolder = await prisma.folder.create({
    data: {
      name: 'AWS',
      description: 'AWS service credentials',
      organizationId: org.id,
      parentId: infraFolder.id,
    },
  })

  const dockerFolder = await prisma.folder.create({
    data: {
      name: 'Docker',
      description: 'Docker registry credentials',
      organizationId: org.id,
      parentId: infraFolder.id,
    },
  })

  // Create CI/CD folder
  const cicdFolder = await prisma.folder.create({
    data: {
      name: 'CI-CD',
      description: 'Continuous Integration and Deployment secrets',
      organizationId: org.id,
    },
  })

  console.log('🔐 Creating secrets...')

  // Get encryption service instance
  const encryptionService = EncryptionService.getInstance()

  // Helper function to create secrets with proper encryption
  const createSecret = async (name: string, description: string, value: string, type: SecretType, folderId: string) => {
    const encryptionResult = encryptionService.encrypt(value)
    if (!encryptionResult.success) {
      throw new Error(`Failed to encrypt secret "${name}"`)
    }

    return await prisma.secret.create({
      data: {
        name,
        description,
        encryptedValue: encryptionResult.encryptedData,
        type,
        folderId,
      },
    })
  }

  // Production secrets
  const prodDbSecret = await createSecret(
    'DATABASE_URL',
    'Production database connection string',
    'postgresql://prod_user:super_secure_password@prod-db.company.com:5432/app_prod',
    SecretType.DATABASE_URL,
    prodFolder.id
  )

  await createSecret(
    'REDIS_PASSWORD',
    'Production Redis password',
    'redis_prod_password_2024!',
    SecretType.PASSWORD,
    prodFolder.id
  )

  await createSecret(
    'JWT_SECRET',
    'JWT signing secret for production',
    'super-secret-jwt-key-production-2024-secure',
    SecretType.TOKEN,
    prodFolder.id
  )

  await createSecret(
    'STRIPE_SECRET_KEY',
    'Stripe payment processing secret key',
    'sk_live_fake_key_for_testing_only_not_real',
    SecretType.API_KEY,
    prodFolder.id
  )

  // Development secrets
  await createSecret(
    'DATABASE_URL',
    'Development database connection string',
    'postgresql://dev_user:dev_password@localhost:5432/app_dev',
    SecretType.DATABASE_URL,
    devFolder.id
  )

  await createSecret(
    'API_KEY_DEVELOPMENT',
    'Development API key for external services',
    'dev-api-key-12345-abcdef',
    SecretType.API_KEY,
    devFolder.id
  )

  await createSecret(
    'ADMIN_PASSWORD',
    'Development admin user password',
    'dev_admin_pass_123',
    SecretType.PASSWORD,
    devFolder.id
  )

  // Staging secrets
  await createSecret(
    'DATABASE_URL',
    'Staging database connection string',
    'postgresql://staging_user:staging_password@staging-db.company.com:5432/app_staging',
    SecretType.DATABASE_URL,
    stagingFolder.id
  )

  await createSecret(
    'STRIPE_TEST_KEY',
    'Stripe test key for staging',
    'sk_test_fake_key_for_testing_only_not_real',
    SecretType.API_KEY,
    stagingFolder.id
  )

  // AWS Infrastructure secrets
  await createSecret(
    'AWS_ACCESS_KEY_ID',
    'AWS programmatic access key ID',
    'AKIA_FAKE_KEY_FOR_TESTING_ONLY',
    SecretType.API_KEY,
    awsFolder.id
  )

  await createSecret(
    'AWS_SECRET_ACCESS_KEY',
    'AWS secret access key',
    'fake_aws_secret_key_for_testing_only_not_real',
    SecretType.API_KEY,
    awsFolder.id
  )

  await createSecret(
    'EC2_KEY_PAIR',
    'EC2 SSH private key',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA4f5wg5l2hKsTeNem/V41fGnJm6gOdrj8ym3rFkEjWT2btYZ6\n...\n-----END RSA PRIVATE KEY-----',
    SecretType.CERTIFICATE,
    awsFolder.id
  )

  // Docker secrets
  await createSecret(
    'DOCKER_HUB_TOKEN',
    'Docker Hub access token',
    'dckr_pat_1234567890abcdef1234567890abcdef',
    SecretType.TOKEN,
    dockerFolder.id
  )

  await createSecret(
    'DOCKER_REGISTRY_PASSWORD',
    'Private Docker registry password',
    'docker_registry_secure_password_2024',
    SecretType.PASSWORD,
    dockerFolder.id
  )

  // CI/CD secrets
  await createSecret(
    'GITHUB_TOKEN',
    'GitHub Actions personal access token',
    'ghp_fake_token_for_testing_only_not_real_token',
    SecretType.TOKEN,
    cicdFolder.id
  )

  await createSecret(
    'SONAR_TOKEN',
    'SonarCloud analysis token',
    'sonar_token_abcdef1234567890abcdef1234567890',
    SecretType.TOKEN,
    cicdFolder.id
  )

  await createSecret(
    'DEPLOY_SSH_KEY',
    'SSH key for deployment server',
    '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAlwAAAAdzc2gt\n...\n-----END OPENSSH PRIVATE KEY-----',
    SecretType.CERTIFICATE,
    cicdFolder.id
  )

  await createSecret(
    'SLACK_WEBHOOK',
    'Slack webhook URL for deployment notifications',
    'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
    SecretType.GENERIC,
    cicdFolder.id
  )

  console.log('✅ Seeding completed!')
  console.log(`👤 Admin User: ${user.email}`)
  console.log(`👤 Write User: ${user2.email}`)
  console.log(`🏢 Organization: ${org.name}`)
  console.log('')
  console.log('📁 Folder Structure Created:')
  console.log(`├── ${prodFolder.name} (${await prisma.secret.count({ where: { folderId: prodFolder.id }})}) secrets`)
  console.log(`├── ${devFolder.name} (${await prisma.secret.count({ where: { folderId: devFolder.id }})}) secrets`)
  console.log(`├── ${stagingFolder.name} (${await prisma.secret.count({ where: { folderId: stagingFolder.id }})}) secrets`)
  console.log(`├── ${infraFolder.name}`)
  console.log(`│   ├── ${awsFolder.name} (${await prisma.secret.count({ where: { folderId: awsFolder.id }})}) secrets`)
  console.log(`│   └── ${dockerFolder.name} (${await prisma.secret.count({ where: { folderId: dockerFolder.id }})}) secrets`)
  console.log(`└── ${cicdFolder.name} (${await prisma.secret.count({ where: { folderId: cicdFolder.id }})}) secrets`)
  console.log('')
  console.log(`🔐 Total secrets created: ${await prisma.secret.count()}`)
  console.log('')
  console.log('🧪 Test credentials:')
  console.log('   Admin: admin@gmail.com / admin')
  console.log('   Writer: admin2@gmail.com / admin')
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
