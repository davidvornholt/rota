/** Whether a zone name is one the platform can resolve. */
export const isTimeZone = (timeZone: string): boolean => {
  try {
    const format = new Intl.DateTimeFormat('en-CA', { timeZone });
    return format.resolvedOptions().timeZone !== '';
  } catch {
    return false;
  }
};
