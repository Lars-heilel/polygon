import { type ReactNode } from 'react';
import { Spinner } from '../spinner/spinner';
import { cn } from '../../lib/utils/cn';

interface ResourceListProps<T> {
  data:        T[];
  renderItem:  (item: T, index: number) => ReactNode;
  isLoading:   boolean;
  isError:     boolean;
  emptyState:  ReactNode;
  errorState:  ReactNode;
  className?:  string;
}

export function ResourceList<T>({
  data,
  renderItem,
  isLoading,
  isError,
  emptyState,
  errorState,
  className,
}: ResourceListProps<T>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner color="primary" />
      </div>
    );
  }

  if (isError) return <>{errorState}</>;

  if (data.length === 0) return <>{emptyState}</>;

  return (
    <div className={cn('flex flex-col', className)}>
      {data.map((item, index) => renderItem(item, index))}
    </div>
  );
}
