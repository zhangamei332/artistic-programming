export function formatRenameDate(
  date: Date,
  format: string,
): string {
  const tokens: Record<string, string> = {
    YYYY: date.getFullYear().toString(),
    YY: date
      .getFullYear()
      .toString()
      .slice(-2),
    MM: (date.getMonth() + 1)
      .toString()
      .padStart(2, "0"),
    DD: date
      .getDate()
      .toString()
      .padStart(2, "0"),
    HH: date
      .getHours()
      .toString()
      .padStart(2, "0"),
    mm: date
      .getMinutes()
      .toString()
      .padStart(2, "0"),
    ss: date
      .getSeconds()
      .toString()
      .padStart(2, "0"),
  };

  let output = format;

  for (const token of [
    "YYYY",
    "YY",
    "MM",
    "DD",
    "HH",
    "mm",
    "ss",
  ]) {
    output = output
      .split(token)
      .join(tokens[token]);
  }

  return output;
}
