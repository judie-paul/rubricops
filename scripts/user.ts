import { PrismaClient, Role } from '@prisma/client';
import { z } from 'zod';
const [email, name, role] = z
  .tuple([z.email(), z.string().min(1).max(120), z.enum(Role)])
  .parse(process.argv.slice(2));
const db = new PrismaClient();
db.user
  .upsert({
    where: { email: email.toLowerCase() },
    create: { id: crypto.randomUUID(), email: email.toLowerCase(), name, role },
    update: { name, role },
  })
  .then((user) => console.log(`Provisioned ${user.email} as ${user.role}`))
  .finally(() => db.$disconnect());
