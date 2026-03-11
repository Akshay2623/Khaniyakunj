function EmptyState({ message = 'No data available.', className = '' }) {
  return <p className={`empty-state ${className}`}>{message}</p>;
}

export default EmptyState;
