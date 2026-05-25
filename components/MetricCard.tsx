type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative" | "neutral";
};

export function MetricCard({ label, value, detail, tone = "neutral" }: MetricCardProps) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}
