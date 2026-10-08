import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, ListChecks } from 'lucide-react';
import { api } from '../../lib/api';
import { STATUS_LABELS } from '../tasks/status-labels';

export function OperationalDashboard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['metrics'], queryFn: api.metrics });
  if (isLoading) return <div className="state"><p>Calculating operational metrics…</p></div>;
  if (isError || !data) return <div className="state error"><p>Could not load operational metrics.</p></div>;
  return <section className="dashboard">
    <div className="page-head"><div><span className="eyebrow">OPERATIONS</span><h1>Operational dashboard</h1><p>Verified workload, delivery risk, and flow performance.</p></div></div>
    <div className="metric-grid">
      <Metric icon={<ListChecks/>} label="Active tasks" value={data.activeTasks}/>
      <Metric icon={<CheckCircle2/>} label="Completion rate" value={`${data.completionRate}%`} detail={`${data.completedTasks} completed`}/>
      <Metric icon={<Clock3/>} label="Median cycle time" value={data.medianCycleTimeHours === null ? '—' : `${data.medianCycleTimeHours}h`}/>
      <Metric icon={<AlertTriangle/>} label="Needs action" value={data.overdueTasks + data.attentionTasks} detail={`${data.overdueTasks} overdue · ${data.attentionTasks} escalated`} danger={data.overdueTasks + data.attentionTasks > 0}/>
    </div>
    <div className="dashboard-panels"><article><h2>Tasks by status</h2>{Object.entries(data.byStatus).map(([status, count]) => <div className="bar-row" key={status}><span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span><div><i style={{ width: `${data.activeTasks ? Math.max(4, count / data.activeTasks * 100) : 0}%` }}/></div><strong>{count}</strong></div>)}</article><article><h2>Tasks by priority</h2>{Object.entries(data.byPriority).map(([priority, count]) => <div className="summary-row" key={priority}><span className={`priority ${priority}`}>{priority}</span><strong>{count}</strong></div>)}</article></div>
  </section>;
}

function Metric({ icon, label, value, detail, danger = false }: { icon: React.ReactNode; label: string; value: string | number; detail?: string; danger?: boolean }) {
  return <article className={`metric ${danger ? 'danger' : ''}`}><span>{icon}</span><small>{label}</small><strong>{value}</strong>{detail && <p>{detail}</p>}</article>;
}
