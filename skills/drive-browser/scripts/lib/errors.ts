/** An error in how a command was invoked: reported as a message, not a stack. */
export class UserError extends Error {}

/** Message for a UserError, stack for anything unexpected. */
export function describeError(error: unknown): string {
  if (error instanceof UserError) return error.message;
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}
