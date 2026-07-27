import { DemoViewer } from "@/app/demo/DemoViewer";

type PageProps = {
  params: Promise<{ runId: string }>;
};

export default async function DemoRunPage({ params }: PageProps) {
  const { runId } = await params;
  return <DemoViewer mode="run" runId={runId} />;
}
