interface ChartDataTableProps {
  caption: string;
  columns: string[];
  rows: string[][];
}

/**
 * Screen-reader-only table carrying the same values as the chart beside it.
 *
 * Recharts renders SVG with no accessible structure, and several chart legends
 * distinguish series by colour alone (WCAG 1.4.1). Marking the chart
 * `aria-hidden` and pairing it with this table gives assistive tech the real
 * numbers without changing the visual design at all.
 *
 * Shared by /dashboard and /reports — it lives here rather than under
 * `dashboard/home/` because both pages chart the same data.
 */
export function ChartDataTable({ caption, columns, rows }: ChartDataTableProps) {
  if (rows.length === 0) return null;

  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={j}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
