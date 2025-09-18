# MCP Gateway Backend

## Development Setup

### Prerequisites

- Python 3.12+
- Docker and Docker Compose
- `uv` package manager

### Code Style

We follow strict code quality standards:

- **Formatting & Linting**: We use `ruff` for code formatting and linting
- **Type Checking**: We use `mypy` for static type checking
- **Pre-commit Hooks**: Install with `pre-commit install`

### IDE Configuration

For VS Code users, configure Ruff formatter:

```json
{
  "[python]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.codeActionsOnSave": {
      "source.organizeImports.ruff": "always"
    }
  }
}
```

### Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/aipotheosis-labs/mcp-gateway.git
   cd mcp-gateway/backend
   ```

1. Install dependencies and activate virtual environment:

   ```bash
   uv sync
   source .venv/bin/activate
   ```

1. Install `pre-commit` hooks:

   ```bash
   pre-commit install
   ```

1. Set up environment variables for **local** development:

   ```bash
   cp .env.example .env.local
   ```

   Most sensitive variables and dummy values are already defined in `.env.example`, so you only need to set the following env vars in `.env.local`:

   - `CONTROL_PLANE_OPENAI_API_KEY`: Use your own OpenAI API key
   - `CLI_OPENAI_API_KEY`: Use your own OpenAI API key (can be the same as `CONTROL_PLANE_OPENAI_API_KEY`)

1. Start services with Docker Compose:

   ```bash
   docker compose up --build
   ```

   This will start:

   - `control-plane`: Backend API service
   - `runner`: Container for running commands like pytest, cli commands or scripts

1. Seed the database with sample data:

   ```bash
   docker compose exec runner ./scripts/seed_db.sh
   ```

1. (Optional) Connect to the database using a GUI client (e.g., `DBeaver`)

   - Parameters for the db connection can be found in the `.env.local` file you created in step 4.

1. Access the API documentation at:

   ```bash
   http://localhost:8000/v1/control-plane-docs
   ```

### Running Tests

Run the test suite in an ephemeral container (automatically applies migrations before executing tests):

```bash
docker compose exec test-runner pytest
```

## Database Management

### Working with Migrations

When making changes to database models:

1. Check for detected changes:

   ```bash
   docker compose exec runner alembic check
   ```

1. Generate a migration:

   ```bash
   docker compose exec runner alembic revision --autogenerate -m "description of changes"
   ```

1. Manually review and edit the generated file in `database/alembic/versions/` if needed to add custom changes, e.g.,:

   - pgvector library imports
   - Index creation/deletion
   - Vector extension setup
   - Other database-specific operations

1. Apply the migration (to the local db):

   ```bash
   docker compose exec runner alembic upgrade head
   ```

1. To revert the latest migration:

   ```bash
   docker compose exec runner alembic downgrade -1
   ```
