function AppCard({ children, className = '', as: Component = 'section' }) {
  return <Component className={`saas-card p-4 md:p-5 ${className}`}>{children}</Component>;
}

export default AppCard;
