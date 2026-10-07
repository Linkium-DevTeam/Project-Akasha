import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gem, ScanLine } from 'lucide-react';
import { api } from '../api';
import { EmptyState, Spinner } from '../components/ui';

/** 二维码 / NFC 标签的落地页：/b/AKS-XXXX → 解析并跳转到盒子，带 scan=1 解锁隐藏内容 */
export default function BoxByCode() {
  const { code } = useParams();
  const query = useQuery({
    queryKey: ['resolve', code],
    queryFn: () => api.resolve(code!),
    retry: false,
  });

  if (query.isPending) return <div className="flex justify-center py-24"><Spinner className="size-8" /></div>;

  if (query.isError || !query.data?.box) {
    return (
      <EmptyState
        icon={<Gem size={26} />}
        title={`没找到盒码 ${code}`}
        hint="可能已被删除，或者码贴错了地方。"
        action={
          <Link to="/lens" className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-aether-500 to-aether-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-aether-500/30">
            <ScanLine size={14} /> 打开透镜
          </Link>
        }
      />
    );
  }
  return <Navigate to={`/boxes/${query.data.box.id}?scan=1`} replace />;
}
