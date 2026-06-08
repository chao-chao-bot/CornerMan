export default function SessionDetailPage({
  params
}: {
  params: { id: string };
}) {
  // 占位：单次训练详情 + AI 报告（draft/final）+ 逐条修订
  return (
    <main className="p-10">
      <h1 className="text-xl font-semibold">训练详情 #{params.id}</h1>
    </main>
  );
}
