const unexpectedControlCharsPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function hasUnexpectedControlChars(value: string): boolean {
  return unexpectedControlCharsPattern.test(value);
}
