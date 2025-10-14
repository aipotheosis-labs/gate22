import logging

from fastapi import FastAPI
from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.botocore import BotocoreInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.openai_v2 import OpenAIInstrumentor
from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor, ConsoleLogExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import ConsoleMetricExporter, PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from aci.common.enums import Environment

logger = logging.getLogger(__name__)


def setup_telemetry(
    app: FastAPI,
    service_name: str,
    environment: Environment,
    otlp_traces_endpoint: str | None = None,
    otlp_metrics_endpoint: str | None = None,
    otlp_logs_endpoint: str | None = None,
    enable_console_export: bool = False,
) -> None:
    """
    Setup OpenTelemetry instrumentation for traces, metrics, and logs.

    Args:
        app: FastAPI application instance
        service_name: Name of the service for tracing
        environment: Current environment (LOCAL, DEV, PROD, etc.)
        otlp_traces_endpoint: OTLP collector endpoint for traces (optional)
        otlp_metrics_endpoint: OTLP collector endpoint for metrics (optional)
        otlp_logs_endpoint: OTLP collector endpoint for logs (optional)
        enable_console_export: If True, export spans to console (useful for local dev)
    """
    logger.info(f"Setting up OpenTelemetry for service: {service_name}")

    # Create shared resource with service name and environment
    resource = Resource(
        attributes={
            SERVICE_NAME: service_name,
            "environment": environment.value,
        }
    )

    # ==================== TRACES ====================
    trace_provider = TracerProvider(resource=resource)

    # Add OTLP trace exporter if endpoint is configured
    if otlp_traces_endpoint:
        logger.info(f"Configuring OTLP trace exporter with endpoint: {otlp_traces_endpoint}")
        otlp_trace_exporter = OTLPSpanExporter(endpoint=otlp_traces_endpoint, insecure=False)
        trace_provider.add_span_processor(BatchSpanProcessor(otlp_trace_exporter))
    else:
        logger.warning("No OTLP traces endpoint configured, spans will not be exported")

    # Add console exporter if explicitly enabled
    if enable_console_export:
        logger.info("Enabling console span exporter")
        console_exporter = ConsoleSpanExporter()
        trace_provider.add_span_processor(BatchSpanProcessor(console_exporter))

    # Set the global tracer provider
    trace.set_tracer_provider(trace_provider)

    # ==================== METRICS ====================
    metric_readers = []

    if otlp_metrics_endpoint:
        logger.info(f"Configuring OTLP metric exporter with endpoint: {otlp_metrics_endpoint}")
        otlp_metric_exporter = OTLPMetricExporter(endpoint=otlp_metrics_endpoint, insecure=False)
        metric_readers.append(
            PeriodicExportingMetricReader(otlp_metric_exporter, export_interval_millis=60000)
        )
    else:
        logger.warning("No OTLP metrics endpoint configured, metrics will not be exported")

    # Add console exporter if explicitly enabled
    if enable_console_export:
        logger.info("Enabling console metric exporter")
        console_metric_exporter = ConsoleMetricExporter()
        metric_readers.append(
            PeriodicExportingMetricReader(console_metric_exporter, export_interval_millis=60000)
        )

    if metric_readers:
        meter_provider = MeterProvider(resource=resource, metric_readers=metric_readers)
        metrics.set_meter_provider(meter_provider)
        logger.info("Metrics provider configured")
    else:
        logger.warning("No metric readers configured")

    # ==================== LOGS ====================
    log_provider = LoggerProvider(resource=resource)

    if otlp_logs_endpoint:
        logger.info(f"Configuring OTLP log exporter with endpoint: {otlp_logs_endpoint}")
        otlp_log_exporter = OTLPLogExporter(endpoint=otlp_logs_endpoint, insecure=False)
        log_provider.add_log_record_processor(BatchLogRecordProcessor(otlp_log_exporter))
    else:
        logger.warning("No OTLP logs endpoint configured, logs will not be exported to OTLP")

    # Add console exporter if explicitly enabled
    if enable_console_export:
        logger.info("Enabling console log exporter")
        console_log_exporter = ConsoleLogExporter()
        log_provider.add_log_record_processor(BatchLogRecordProcessor(console_log_exporter))

    set_logger_provider(log_provider)

    # Attach OTLP handler to root logger
    handler = LoggingHandler(level=logging.NOTSET, logger_provider=log_provider)
    logging.getLogger().addHandler(handler)
    logger.info("Logs provider configured")

    # Instrument libraries
    logger.info("Instrumenting libraries with OpenTelemetry")

    # FastAPI instrumentation
    FastAPIInstrumentor.instrument_app(app)

    # HTTPX instrumentation (for outgoing HTTP requests)
    HTTPXClientInstrumentor().instrument()

    # SQLAlchemy instrumentation (for database queries)
    SQLAlchemyInstrumentor().instrument(enable_commenter=True)

    # Psycopg instrumentation (for PostgreSQL queries)
    PsycopgInstrumentor().instrument()

    # Botocore/Boto3 instrumentation (for AWS SDK calls)
    BotocoreInstrumentor().instrument()  # type: ignore

    # OpenAI instrumentation (for OpenAI API calls)
    OpenAIInstrumentor().instrument()  # type: ignore

    # Logging instrumentation (adds trace context to logs)
    LoggingInstrumentor().instrument(set_logging_format=True)

    logger.info("OpenTelemetry instrumentation setup complete")


def get_tracer(name: str) -> trace.Tracer:
    """
    Get a tracer instance for manual instrumentation.

    Args:
        name: Name of the tracer (typically __name__ of the module)

    Returns:
        Tracer instance
    """
    return trace.get_tracer(name)


def get_meter(name: str) -> metrics.Meter:
    """
    Get a meter instance for custom metrics.

    Args:
        name: Name of the meter (typically __name__ of the module)

    Returns:
        Meter instance for creating counters, histograms, gauges, etc.

    Example:
        meter = get_meter(__name__)
        request_counter = meter.create_counter(
            "http_requests_total",
            description="Total HTTP requests",
            unit="1"
        )
        request_counter.add(1, {"method": "GET", "endpoint": "/api/v1/users"})
    """
    return metrics.get_meter(name)
