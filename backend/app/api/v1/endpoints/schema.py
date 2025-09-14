"""Schema discovery API endpoints."""

import hashlib
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.logging import get_logger
from app.models.schema import (
    FilteredSchemaResponse,
    SchemaDiscoveryResponse,
    SchemaGraph,
    SchemaStatistics,
)
from app.services.exceptions import (
    AuthenticationError,
    ConnectionTimeoutError,
    GraphQLError,
    InvalidSchemaError,
    NautobotClientError,
)
from app.services.nautobot_client import NautobotGraphQLClient
from app.services.schema_transformer import SchemaTransformerService

router = APIRouter()
logger = get_logger(__name__)


@router.get("/schema/discover", response_model=SchemaDiscoveryResponse)
async def discover_schema(
    response: Response,
    include_abstract: bool = Query(False, description="Include abstract models"),
    include_proxy: bool = Query(False, description="Include proxy models"),
    max_depth: int = Query(10, description="Maximum relationship depth", ge=1, le=20),
) -> SchemaDiscoveryResponse:
    """
    Discover the complete Nautobot schema structure.

    This endpoint performs GraphQL introspection on the connected Nautobot instance
    and returns a comprehensive schema graph including all models and relationships.
    """
    logger.info(
        "Starting full schema discovery",
        include_abstract=include_abstract,
        include_proxy=include_proxy,
        max_depth=max_depth,
    )

    try:
        async with NautobotGraphQLClient() as client:
            # Test connection first
            connection_test = await client.test_connection()
            if not connection_test["success"]:
                logger.error("Connection test failed", **connection_test)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Cannot connect to Nautobot: {connection_test.get('error', 'Unknown error')}",
                )

            # Discover schema
            raw_schema = await client.discover_schema()

            # Transform to structured format
            transformer = SchemaTransformerService()
            schema_graph = await transformer.transform_graphql_to_schema(
                raw_schema,
                include_abstract=include_abstract,
                include_proxy=include_proxy,
                max_depth=max_depth,
            )

            # Create response
            discovery_response = SchemaDiscoveryResponse.from_schema_graph(
                schema=schema_graph,
                metadata={
                    **raw_schema.get("metadata", {}),
                    "connection_test": connection_test,
                    "transformer_options": {
                        "include_abstract": include_abstract,
                        "include_proxy": include_proxy,
                        "max_depth": max_depth,
                    },
                },
            )

            # Generate ETag for caching
            etag = _generate_etag(discovery_response.model_dump())
            response.headers["ETag"] = etag
            response.headers["Cache-Control"] = "private, max-age=300"  # 5 minutes

            logger.info(
                "Schema discovery completed successfully",
                total_models=discovery_response.statistics.total_models,
                total_relationships=discovery_response.statistics.total_relationships,
                etag=etag,
            )

            return discovery_response

    except AuthenticationError as e:
        logger.error("Authentication failed during schema discovery", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Nautobot authentication failed: {e.message}",
            headers={"WWW-Authenticate": "Token"},
        )
    except ConnectionTimeoutError as e:
        logger.error("Connection timeout during schema discovery", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Nautobot connection timeout: {e.message}",
        )
    except (GraphQLError, InvalidSchemaError) as e:
        logger.error("GraphQL error during schema discovery", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Nautobot GraphQL error: {e.message}",
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(
            "Unexpected error during schema discovery",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during schema discovery",
        )


@router.get("/schema/filtered", response_model=FilteredSchemaResponse)
async def get_filtered_schema(
    response: Response,
    apps: Optional[str] = Query(
        None, description="Comma-separated list of Django apps to include"
    ),
    exclude_apps: Optional[str] = Query(
        None, description="Comma-separated list of Django apps to exclude"
    ),
    include_abstract: bool = Query(False, description="Include abstract models"),
    include_proxy: bool = Query(False, description="Include proxy models"),
    max_depth: int = Query(5, description="Maximum relationship depth", ge=1, le=20),
    model_pattern: Optional[str] = Query(
        None, description="Regex pattern to filter model names"
    ),
) -> FilteredSchemaResponse:
    """
    Get a filtered subset of the Nautobot schema.

    This endpoint allows filtering the schema by apps, model patterns, and other criteria
    to focus on specific parts of the data model.
    """
    # Parse filter parameters
    include_apps = [app.strip() for app in apps.split(",")] if apps else None
    exclude_apps_list = (
        [app.strip() for app in exclude_apps.split(",")] if exclude_apps else None
    )

    logger.info(
        "Starting filtered schema discovery",
        include_apps=include_apps,
        exclude_apps=exclude_apps_list,
        include_abstract=include_abstract,
        include_proxy=include_proxy,
        max_depth=max_depth,
        model_pattern=model_pattern,
    )

    try:
        async with NautobotGraphQLClient() as client:
            # Get full schema first
            raw_schema = await client.discover_schema()

            # Transform and filter
            transformer = SchemaTransformerService()
            original_schema = await transformer.transform_graphql_to_schema(
                raw_schema,
                include_abstract=True,  # Get all for filtering
                include_proxy=True,
                max_depth=max_depth,
            )

            # Apply filters
            filtered_schema = await transformer.filter_schema(
                schema=original_schema,
                include_apps=include_apps,
                exclude_apps=exclude_apps_list,
                include_abstract=include_abstract,
                include_proxy=include_proxy,
                model_pattern=model_pattern,
            )

            # Track what filters were applied
            filters_applied = {
                "include_apps": include_apps,
                "exclude_apps": exclude_apps_list,
                "include_abstract": include_abstract,
                "include_proxy": include_proxy,
                "max_depth": max_depth,
                "model_pattern": model_pattern,
            }

            # Create response
            filtered_response = FilteredSchemaResponse.from_filtered_graph(
                filtered_schema=filtered_schema,
                filters_applied=filters_applied,
                original_totals={
                    "models": len(original_schema.nodes),
                    "relationships": len(original_schema.relationships),
                },
            )

            # Generate ETag for caching
            etag = _generate_etag({**filtered_response.model_dump(), **filters_applied})
            response.headers["ETag"] = etag
            response.headers["Cache-Control"] = (
                "private, max-age=600"  # 10 minutes for filtered results
            )

            logger.info(
                "Filtered schema discovery completed",
                original_models=filtered_response.original_total_models,
                filtered_models=filtered_response.statistics.total_models,
                original_relationships=filtered_response.original_total_relationships,
                filtered_relationships=filtered_response.statistics.total_relationships,
            )

            return filtered_response

    except AuthenticationError as e:
        logger.error(
            "Authentication failed during filtered schema discovery", error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Nautobot authentication failed: {e.message}",
            headers={"WWW-Authenticate": "Token"},
        )
    except ConnectionTimeoutError as e:
        logger.error(
            "Connection timeout during filtered schema discovery", error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Nautobot connection timeout: {e.message}",
        )
    except (GraphQLError, InvalidSchemaError) as e:
        logger.error("GraphQL error during filtered schema discovery", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Nautobot GraphQL error: {e.message}",
        )
    except Exception as e:
        logger.error(
            "Unexpected error during filtered schema discovery",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during filtered schema discovery",
        )


@router.get("/schema/statistics", response_model=SchemaStatistics)
async def get_schema_statistics(
    response: Response,
    apps: Optional[str] = Query(
        None, description="Comma-separated list of Django apps to include"
    ),
) -> SchemaStatistics:
    """
    Get summary statistics about the Nautobot schema.

    Returns high-level metrics about models, relationships, and app distribution
    without the full schema details.
    """
    include_apps = [app.strip() for app in apps.split(",")] if apps else None

    logger.info("Getting schema statistics", include_apps=include_apps)

    try:
        async with NautobotGraphQLClient() as client:
            raw_schema = await client.discover_schema()

            transformer = SchemaTransformerService()
            schema_graph = await transformer.transform_graphql_to_schema(raw_schema)

            # Apply app filtering if requested
            if include_apps:
                schema_graph = await transformer.filter_schema(
                    schema=schema_graph,
                    include_apps=include_apps,
                )

            statistics = SchemaStatistics.from_schema_graph(schema_graph)

            # Cache statistics longer since they change less frequently
            response.headers["Cache-Control"] = "private, max-age=1800"  # 30 minutes

            logger.info(
                "Schema statistics generated",
                total_models=statistics.total_models,
                total_relationships=statistics.total_relationships,
                apps_count=statistics.apps_count,
            )

            return statistics

    except AuthenticationError as e:
        logger.error("Authentication failed during statistics request", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Nautobot authentication failed: {e.message}",
            headers={"WWW-Authenticate": "Token"},
        )
    except ConnectionTimeoutError as e:
        logger.error("Connection timeout during statistics request", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Nautobot connection timeout: {e.message}",
        )
    except Exception as e:
        logger.error(
            "Unexpected error during statistics request",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during statistics request",
        )


@router.get("/schema/model/{model_name}")
async def get_model_details(
    model_name: str,
    response: Response,
    include_relationships: bool = Query(
        True, description="Include model relationships"
    ),
) -> Dict[str, Any]:
    """
    Get detailed information about a specific model.

    Returns the model definition, fields, and optionally its relationships
    with other models in the schema.
    """
    logger.info(
        "Getting model details",
        model_name=model_name,
        include_relationships=include_relationships,
    )

    try:
        async with NautobotGraphQLClient() as client:
            raw_schema = await client.discover_schema()

            transformer = SchemaTransformerService()
            schema_graph = await transformer.transform_graphql_to_schema(raw_schema)

            # Find the requested model
            model_node = schema_graph.get_model(model_name)
            if not model_node:
                logger.warning("Model not found", model_name=model_name)
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Model '{model_name}' not found in schema",
                )

            # Build response
            model_data = {
                "id": model_node.id,
                "name": model_node.name,
                "app_label": model_node.app_label,
                "table_name": model_node.table_name,
                "is_abstract": model_node.is_abstract,
                "description": model_node.description,
                "fields": [
                    {
                        "name": field.name,
                        "type": field.field_type,
                        "is_nullable": field.is_nullable,
                        "is_list": field.is_list,
                        "description": field.description,
                        "default_value": field.default_value,
                        "max_length": field.max_length,
                        "choices": field.choices,
                    }
                    for field in model_node.fields
                ],
                "field_count": len(model_node.fields),
                "meta_options": model_node.meta_options,
            }

            # Add relationships if requested
            if include_relationships:
                relationships = schema_graph.get_relationships_for_model(model_name)
                model_data["relationships"] = [
                    {
                        "id": rel.id,
                        "source_model": rel.source_model,
                        "target_model": rel.target_model,
                        "relationship_type": rel.relationship_type.value,
                        "field_name": rel.field_name,
                        "related_name": rel.related_name,
                        "through_model": rel.through_model,
                        "is_nullable": rel.is_nullable,
                        "description": rel.description,
                    }
                    for rel in relationships
                ]
                model_data["relationship_count"] = len(relationships)

            # Cache model details for a longer time
            response.headers["Cache-Control"] = "private, max-age=3600"  # 1 hour

            logger.info(
                "Model details retrieved",
                model_name=model_name,
                field_count=len(model_node.fields),
                relationship_count=(
                    len(schema_graph.get_relationships_for_model(model_name))
                    if include_relationships
                    else 0
                ),
            )

            return model_data

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except AuthenticationError as e:
        logger.error("Authentication failed during model details request", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Nautobot authentication failed: {e.message}",
            headers={"WWW-Authenticate": "Token"},
        )
    except ConnectionTimeoutError as e:
        logger.error("Connection timeout during model details request", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Nautobot connection timeout: {e.message}",
        )
    except Exception as e:
        logger.error(
            "Unexpected error during model details request",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during model details request",
        )


@router.get("/schema/react-flow")
async def get_react_flow_schema(
    response: Response,
    apps: Optional[str] = Query(
        None, description="Comma-separated list of Django apps to include"
    ),
    max_depth: int = Query(5, description="Maximum relationship depth", ge=1, le=20),
) -> Dict[str, Any]:
    """
    Get schema in React Flow format for frontend visualization.

    Returns nodes and edges formatted specifically for the React Flow library,
    including positioning hints and visual styling information.
    """
    include_apps = [app.strip() for app in apps.split(",")] if apps else None

    logger.info(
        "Getting React Flow formatted schema",
        include_apps=include_apps,
        max_depth=max_depth,
    )

    try:
        async with NautobotGraphQLClient() as client:
            raw_schema = await client.discover_schema()

            transformer = SchemaTransformerService()
            schema_graph = await transformer.transform_graphql_to_schema(
                raw_schema, max_depth=max_depth
            )

            # Apply app filtering if requested
            if include_apps:
                schema_graph = await transformer.filter_schema(
                    schema=schema_graph,
                    include_apps=include_apps,
                )

            # Convert to React Flow format
            react_flow_data = schema_graph.to_react_flow()

            # Add metadata
            react_flow_data["metadata"] = {
                "total_nodes": len(react_flow_data["nodes"]),
                "total_edges": len(react_flow_data["edges"]),
                "apps_included": include_apps or list(schema_graph.apps),
                "max_depth": max_depth,
            }

            # Cache React Flow format for frontend
            response.headers["Cache-Control"] = "private, max-age=900"  # 15 minutes
            response.headers["Content-Type"] = "application/json"

            logger.info(
                "React Flow schema generated",
                nodes_count=len(react_flow_data["nodes"]),
                edges_count=len(react_flow_data["edges"]),
            )

            return react_flow_data

    except AuthenticationError as e:
        logger.error("Authentication failed during React Flow request", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Nautobot authentication failed: {e.message}",
            headers={"WWW-Authenticate": "Token"},
        )
    except ConnectionTimeoutError as e:
        logger.error("Connection timeout during React Flow request", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Nautobot connection timeout: {e.message}",
        )
    except Exception as e:
        logger.error(
            "Unexpected error during React Flow request",
            error=str(e),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during React Flow request",
        )


def _generate_etag(data: Dict[str, Any]) -> str:
    """Generate ETag hash for response caching."""
    import json

    content = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(content.encode()).hexdigest()
