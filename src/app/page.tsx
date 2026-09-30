import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Workspace from '@/components/workspace';
export default async function Home() {
  if (!(await auth())) redirect('/login');
  return <Workspace demo={process.env.DEMO_MODE === 'true'} />;
}
