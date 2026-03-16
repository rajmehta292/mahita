import('@prisma/client').then(async ({ PrismaClient }) => {
    const prisma = new PrismaClient()
    console.log('Available Models:', Object.keys(prisma).filter((key) => !key.startsWith('$') && !key.startsWith('_')))
    await prisma.$disconnect()
}).catch((error) => {
    console.error(error)
    process.exit(1)
})
