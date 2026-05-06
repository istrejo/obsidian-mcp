export async function callHandler<TContext, TInput, TOutput>(
  handler: (ctx: TContext, input: TInput) => Promise<TOutput>,
  ctx: TContext,
  input: TInput,
): Promise<TOutput> {
  return handler(ctx, input);
}
