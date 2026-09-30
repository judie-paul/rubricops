import { auth } from '@/auth';
import { db } from './db';
import { AppError } from './service';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
export async function actor() {
  const session = await auth();
  if (!session?.user?.id) throw new AppError('Sign in to continue.', 401);
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new AppError('Account unavailable.', 401);
  return user;
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      },
      { status: 400 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2034'].includes(error.code)
  )
    return Response.json(
      { error: 'Another request changed this record. Refresh and try again.' },
      { status: 409 },
    );
  console.error(error);
  return Response.json(
    { error: 'The request could not be completed. Please try again.' },
    { status: 500 },
  );
}
export async function readBody(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.AUTH_URL || request.url).origin;
  if (origin !== expected) throw new AppError('Invalid request origin.', 403);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Missing request body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new AppError('Import exceeds 2 MB.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('Invalid JSON.');
  }
}
