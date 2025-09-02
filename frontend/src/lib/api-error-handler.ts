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
      if (typeof anyData.error === "string") return anyData.error;
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
  let errorMessage: string = defaultMessage;

  try {
    const errorData: unknown = await response.json();

    // Extract error message from various possible fields
    if (typeof errorData === "string" && errorData.trim()) {
      errorMessage = errorData;
    } else if (errorData && typeof errorData === "object") {
      const anyData = errorData as Record<string, unknown>;

      // Check common error field names in order of preference
      if (typeof anyData.error === "string" && anyData.error.trim()) {
        errorMessage = anyData.error;
      } else if (typeof anyData.detail === "string" && anyData.detail.trim()) {
        errorMessage = anyData.detail;
      } else if (
        typeof anyData.message === "string" &&
        anyData.message.trim()
      ) {
        errorMessage = anyData.message;
      } else if (typeof anyData.msg === "string" && anyData.msg.trim()) {
        errorMessage = anyData.msg;
      } else if (typeof anyData.reason === "string" && anyData.reason.trim()) {
        errorMessage = anyData.reason;
      } else if (
        typeof anyData.description === "string" &&
        anyData.description.trim()
      ) {
        errorMessage = anyData.description;
      }

      // Handle nested error objects
      if (typeof anyData.error === "object" && anyData.error !== null) {
        const nestedError = anyData.error as Record<string, unknown>;
        if (
          typeof nestedError.message === "string" &&
          nestedError.message.trim()
        ) {
          errorMessage = nestedError.message;
        } else if (
          typeof nestedError.detail === "string" &&
          nestedError.detail.trim()
        ) {
          errorMessage = nestedError.detail;
        }
      }
    }
  } catch {
    // If JSON parsing fails, try to get text
    try {
      const errorText = await response.text();
      if (errorText.trim()) {
        errorMessage = errorText;
      }
    } catch {
      // Use default message if all parsing fails
    }
  }

  throw new Error(errorMessage);
}
