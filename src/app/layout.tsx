import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'RubricOps · Evaluation workspace',
  description:
    'Evaluate model responses, review decisions, and measure agreement.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
