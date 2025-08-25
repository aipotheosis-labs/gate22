from pydantic import BaseModel, Field


class MCPToolMetadata(BaseModel):
    canonical_tool_name: str = Field(
        ...,
        description="The canonical name of the tool of the mcp server",
    )
    canonical_tool_description_hash: str = Field(
        ...,
        description="The description of the tool of the mcp server in html format",
    )
    canonical_tool_input_schema_hash: str = Field(
        ...,
        description="The input schema of the tool of the mcp server in json schema format",
    )
