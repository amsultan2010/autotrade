/** Turn internal strategy ids into readable labels for the UI. */
export function formatStrategyLabel(id: string): string {
  return id
    .replace(/^legacy_/, 'Legacy ')
    .replace(/_v\d+$/, '')
    .replace(/_/g, ' ')
    .replace(/\w/g, (c) => c.toUpperCase());
}
