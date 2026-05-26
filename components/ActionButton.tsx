type ActionButtonProps = {
  children: React.ReactNode;
  tone?: "primary" | "secondary";
  type?: "button" | "submit";
};

export function ActionButton({ children, tone = "secondary", type = "button" }: ActionButtonProps) {
  return (
    <button className={`action-button action-button-${tone}`} type={type}>
      {children}
    </button>
  );
}
