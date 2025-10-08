from enum import Enum
from typing import Any

from pydantic import BaseModel, model_validator

from aci.common.logging_setup import get_logger

logger = get_logger(__name__)


class BehaviorOnDumpWithoutExcludeUnset(Enum):
    WARN = "warn"
    ERROR = "error"


class UndefinedAwareBaseModel(BaseModel):
    """
    A base model that allows all fields to be nullable and use a custom validator to check for
    non-nullable fields.
    """

    _non_nullable_fields: list[str] = []
    _dump_without_exclude_unset_behavior: BehaviorOnDumpWithoutExcludeUnset = (
        BehaviorOnDumpWithoutExcludeUnset.WARN
    )

    @model_validator(mode="after")
    def validate_non_nullable_fields(self) -> "UndefinedAwareBaseModel":
        """
        As there is no easy way to differentiate between "None" and "Undefined" with Pydantic.
        We don't know whether caller do not provide a value for a field or want to explicitly set
        it to None. We use a workaround as follow:
        - We allow all fields to be nullable and default to None ewhen defining the pydantic model.
        - We use a custom validator to check for non-nullable fields.
        - Only when caller provided a value, field name will be in `model.model_fields_set`.
        - When updating to database, we either check `model.model_fields_set` or use
          `model_dump(exclude_unset=True)` to exclude unset fields.
        - If model_dump is called without exclude_unset, we console warn (default) or raise error.
        """

        non_nullable_fields = self._non_nullable_fields
        for field in self.model_fields_set:
            if field in non_nullable_fields and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be None if it is provided.")
        return self

    def model_dump(self, **kwargs: Any) -> dict:
        # Warn if model_dump is called without exclude_unset
        if "exclude_unset" not in kwargs:
            match self._dump_without_exclude_unset_behavior:
                case BehaviorOnDumpWithoutExcludeUnset.WARN:
                    logger.warning(
                        "model_dump is called without providing `exclude_unset` args. This may "
                        "accidentally include unset fields."
                    )
                case BehaviorOnDumpWithoutExcludeUnset.ERROR:
                    raise ValueError(
                        "model_dump is called without providing `exclude_unset` args. This may "
                        "accidentally include unset fields."
                    )
        return super().model_dump(**kwargs)

    # TODO: Do we need to intercept __getattribute__() to protect when directly accessing the field
    # via `model.field` ?
