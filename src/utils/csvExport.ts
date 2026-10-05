// src/utils/csvExport.ts

/**
 * Escapes a cell value for safe inclusion in a CSV stream.
 * Double quotes are escaped with an extra double quote, and strings containing
 * commas, quotes, or newlines are wrapped in double quotes.
 */
export const escapeCsvValue = (val: any): string => {
  if (val === null || val === undefined) return '';
  
  let str = String(val);

  // If complex object or array, serialize it simply
  if (typeof val === 'object') {
    try {
      str = JSON.stringify(val);
    } catch {
      str = '[Object]';
    }
  }

  // Escape quotes
  const escaped = str.replace(/"/g, '""');
  
  // Wrap in quotes if it contains sensitive characters
  if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
    return `"${escaped}"`;
  }
  
  return escaped;
};

/**
 * Formats an array of objects into a matching CSV string.
 */
export const convertToCsv = <T extends Record<string, any>>(
  data: T[],
  headersMap?: Record<string, string>
): string => {
  if (data.length === 0) return '';

  // Resolve headers
  const keys = Object.keys(data[0]);
  const headers = headersMap 
    ? Object.keys(headersMap).map(k => headersMap[k]) 
    : keys;

  const csvRows: string[] = [];

  // Add BOM for proper Excel UTF-8 reading
  csvRows.push('\uFEFF' + headers.map(h => escapeCsvValue(h)).join(','));

  const keyKeys = headersMap ? Object.keys(headersMap) : keys;

  for (const row of data) {
    const values = keyKeys.map(key => {
      // Handle nested values if key has dots
      if (typeof key === 'string' && key.includes('.')) {
        const parts = key.split('.');
        let current: any = row;
        for (const part of parts) {
          if (current === null || current === undefined) break;
          current = current[part];
        }
        return escapeCsvValue(current);
      }
      return escapeCsvValue(row[key]);
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
};

/**
 * Triggers a browser download of a CSV file.
 */
export const downloadCsvFile = (csvContent: string, fileName: string): boolean => {
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Failed to export CSV file:', error);
    return false;
  }
};
