export const tryCatchPromise = <T>(
  promise: Promise<T>,
): Promise<[T, null] | [null, Error]> => {
  return promise
    .then((data) => [data, null] as [T, null])
    .catch((error: unknown) => {
      if (error instanceof Error) {
        return [null, error] as [null, Error];
      }
      return [null, new Error(error?.toString() || "Unknown error")] as [
        null,
        Error,
      ];
    });
};
