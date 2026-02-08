import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTestAccounts() {
  // Find all users except 'monkeydunky'
  const users = await prisma.user.findMany({
    where: { username: { not: 'monkeydunky' } },
    select: { id: true, username: true }
  });

  if (users.length === 0) {
    console.log('No test accounts found.');
    return;
  }

  // Delete leaderboard entries and users
  for (const user of users) {
    // Delete ratings
    await prisma.rating.deleteMany({ where: { userId: user.id } });
    // Delete daily scores
    await prisma.dailyScore.deleteMany({ where: { userId: user.id } });
    // Delete matches and match players
    await prisma.matchPlayer.deleteMany({ where: { userId: user.id } });
    await prisma.match.deleteMany({ where: { players: { some: { userId: user.id } } } });
    // Delete user
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Deleted user: ${user.username}`);
  }

  console.log('Cleanup complete.');
}

cleanupTestAccounts()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
