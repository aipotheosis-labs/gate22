SEARCH_TOOLS = {
    "name": "SEARCH_TOOLS",
    "description": "This tool allows you to find relevant tools and their schemas that can help complete your tasks.",  # noqa: E501
    "inputSchema": {
        "type": "object",
        "properties": {
            "intent": {
                "type": "string",
                "description": "Use this to find relevant tools you might need. Returned results of this "  # noqa: E501
                "tool will be sorted by relevance to the intent.",
            },
            "limit": {
                "type": "integer",
                "default": 100,
                "description": "The maximum number of tools to return from the search per response.",  # noqa: E501
                "minimum": 1,
            },
            "offset": {
                "type": "integer",
                "default": 0,
                "minimum": 0,
                "description": "Pagination offset.",
            },
        },
        "required": [],
        "additionalProperties": False,
    },
}
