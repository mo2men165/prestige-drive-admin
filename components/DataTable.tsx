'use client';

interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  onEdit?: (row: Record<string, unknown>) => void;
  onDelete?: (row: Record<string, unknown>) => void;
  idField?: string;
  editLabel?: string;
}

export default function DataTable({ columns, data, onEdit, onDelete, idField = 'id', editLabel = 'Edit' }: DataTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No data found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={(row[idField] as string) || i} className="border-b border-gray-100 hover:bg-gray-50 transition">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-gray-700 max-w-xs truncate">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-4 py-3 text-right space-x-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(row)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {editLabel}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(row)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
