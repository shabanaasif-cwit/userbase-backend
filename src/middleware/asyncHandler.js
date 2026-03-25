/** Wraps an async route handler so rejections reach Express error middleware. */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
//instead of using try catch, we use Promise.resolve to wrap the function and catch the error