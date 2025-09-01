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
    const errorData = await response.json();

    // Try to extract error message from common API error response formats
    if (errorData.detail) {
      return errorData.detail;
    }

    if (errorData.message) {
      return errorData.message;
    }

    if (typeof errorData === "string") {
      return errorData;
    }

    // If errorData is an object but doesn't have expected fields
    return defaultMessage;
  } catch {
    // If response body can't be parsed as JSON, try text
    try {
      const errorText = await response.text();
      return errorText || defaultMessage;
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
