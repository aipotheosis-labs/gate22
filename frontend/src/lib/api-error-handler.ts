/**
 * Centralized API error handler to reduce repetitive error parsing
 */
export async function parseApiError(
  response: Response,
  defaultMessage: string,
): Promise<string> {
  if (response.ok) {
    return defaultMessage;
  }

  try {
    const cloned = response.clone();
    const errorData: unknown = await cloned.json();

    if (typeof errorData === "string") {
      return errorData;
    }
    if (errorData && typeof errorData === "object") {
      const anyData = errorData as Record<string, unknown>;
      if (typeof anyData.detail === "string") return anyData.detail;
      if (typeof anyData.message === "string") return anyData.message;
    }
    return defaultMessage;
  } catch {
    // If JSON parse fails, fall back to raw text from the original response
    try {
      const errorText = await response.text();
      return errorText.trim() || defaultMessage;
    } catch {
      return defaultMessage;
    }
  }
}

/**
 * Throws an error with parsed API error message
 */
export async function throwApiError(
  response: Response,
  defaultMessage: string,
): Promise<never> {
  const errorMessage = await parseApiError(response, defaultMessage);
  throw new Error(errorMessage);
}
