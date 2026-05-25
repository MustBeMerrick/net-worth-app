type ActionButtonProps = {
  children: React.ReactNode;
  tone?: "primary" | "secondary";
};

export function ActionButton({ children, tone = "secondary" }: ActionButtonProps) {
  return (
    <button className={`action-button action-button-${tone}`} type="button">
      {children}
    </button>
  );
}
