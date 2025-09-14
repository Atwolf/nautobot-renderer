"""Nautobot GraphQL client for schema discovery."""

import asyncio
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin

import httpx
import structlog

from ..core.config import settings
from ..core.logging import get_logger
from .exceptions import (
    AuthenticationError,
    ConnectionTimeoutError,
    GraphQLError,
    InvalidSchemaError,
    NautobotClientError,
)

# GraphQL introspection query to discover schema
INTROSPECTION_QUERY = """
    query IntrospectionQuery {
        __schema {
            types {
                name
                kind
                description
                fields {
                    name
                    description
                    type {
                        name
                        kind
                        ofType {
                            name
                            kind
                            ofType {
                                name
                                kind
                                ofType {
                                    name
                                    kind
                                    ofType {
                                        name
                                        kind
                                    }
                                }
                            }
                        }
                    }
                    args {
                        name
                        description
                        type {
                            name
                            kind
                            ofType {
                                name
                                kind
                                ofType {
                                    name
                                    kind
                                }
                            }
                        }
                        defaultValue
                    }
                }
                inputFields {
                    name
                    description
                    type {
                        name
                        kind
                        ofType {
                            name
                            kind
                            ofType {
                                name
                                kind
                            }
                        }
                    }
                    defaultValue
                }
                interfaces {
                    name
                    kind
                }
                enumValues {
                    name
                    description
                    isDeprecated
                    deprecationReason
                }
                possibleTypes {
                    name
                    kind
                }
            }
            queryType {
                name
            }
            mutationType {
                name
            }
            subscriptionType {
                name
            }
            directives {
                name
                description
                locations
                args {
                    name
                    description
                    type {
                        name
                        kind
                        ofType {
                            name
                            kind
                        }
                    }
                    defaultValue
                }
            }
        }
    }
"""


class NautobotGraphQLClient:
    """Client for interacting with Nautobot's GraphQL API and discovering schema."""

    def __init__(self) -> None:
        """Initialize the Nautobot GraphQL client."""
        self.base_url = settings.nautobot_url.rstrip("/")
        self.graphql_url = urljoin(self.base_url + "/", "api/graphql/")
        self.token = settings.nautobot_token
        self.timeout = settings.nautobot_timeout
        self.retries = settings.nautobot_retries
        self.logger = get_logger("nautobot_client")

        # HTTP client configuration
        self.headers = {
            "Authorization": f"Token {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"{settings.app_name}/{settings.app_version}",
        }

        self.client = httpx.AsyncClient(
            headers=self.headers,
            timeout=httpx.Timeout(self.timeout, connect=5.0),
            follow_redirects=True,
        )

    async def __aenter__(self) -> "NautobotGraphQLClient":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        await self.client.aclose()

    async def close(self) -> None:
        """Close the HTTP client."""
        await self.client.aclose()

    async def _execute_request(
        self, query: str, variables: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute a GraphQL request with retry logic and error handling."""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        last_exception = None

        for attempt in range(self.retries + 1):
            start_time = time.perf_counter()

            try:
                self.logger.info(
                    "Executing GraphQL request",
                    attempt=attempt + 1,
                    max_attempts=self.retries + 1,
                    url=self.graphql_url,
                )

                response = await self.client.post(
                    self.graphql_url,
                    json=payload,
                )

                elapsed_time = time.perf_counter() - start_time

                # Check for HTTP errors
                if response.status_code == 401:
                    self.logger.error(
                        "Authentication failed",
                        status_code=response.status_code,
                        elapsed_time=elapsed_time,
                    )
                    raise AuthenticationError(
                        "Invalid or expired Nautobot token",
                        details={"status_code": response.status_code},
                    )

                if response.status_code == 403:
                    self.logger.error(
                        "Authorization failed",
                        status_code=response.status_code,
                        elapsed_time=elapsed_time,
                    )
                    raise AuthenticationError(
                        "Insufficient permissions for Nautobot API access",
                        details={"status_code": response.status_code},
                    )

                response.raise_for_status()

                # Parse JSON response
                try:
                    data = response.json()
                except ValueError as e:
                    self.logger.error(
                        "Invalid JSON response",
                        error=str(e),
                        elapsed_time=elapsed_time,
                    )
                    raise InvalidSchemaError(
                        "Invalid JSON response from Nautobot GraphQL API",
                        details={"json_error": str(e)},
                    )

                # Check for GraphQL errors
                if "errors" in data and data["errors"]:
                    self.logger.error(
                        "GraphQL errors in response",
                        errors=data["errors"],
                        elapsed_time=elapsed_time,
                    )
                    raise GraphQLError(
                        "GraphQL query returned errors", errors=data["errors"]
                    )

                self.logger.info(
                    "GraphQL request completed successfully",
                    elapsed_time=elapsed_time,
                    response_size=len(str(data)),
                )

                return data

            except (httpx.TimeoutException, httpx.ConnectTimeout) as e:
                elapsed_time = time.perf_counter() - start_time
                last_exception = ConnectionTimeoutError(
                    f"Request timed out after {elapsed_time:.2f}s",
                    details={"timeout": self.timeout, "attempt": attempt + 1},
                )
                self.logger.warning(
                    "Request timeout, will retry",
                    error=str(e),
                    attempt=attempt + 1,
                    elapsed_time=elapsed_time,
                )

            except (httpx.ConnectError, httpx.NetworkError) as e:
                elapsed_time = time.perf_counter() - start_time
                last_exception = NautobotClientError(
                    f"Network error: {str(e)}",
                    details={"network_error": str(e), "attempt": attempt + 1},
                )
                self.logger.warning(
                    "Network error, will retry",
                    error=str(e),
                    attempt=attempt + 1,
                    elapsed_time=elapsed_time,
                )

            except (AuthenticationError, GraphQLError, InvalidSchemaError):
                # Don't retry auth, GraphQL, or schema errors
                raise

            except Exception as e:
                elapsed_time = time.perf_counter() - start_time
                last_exception = NautobotClientError(
                    f"Unexpected error: {str(e)}",
                    details={"error_type": type(e).__name__, "attempt": attempt + 1},
                )
                self.logger.error(
                    "Unexpected error in request",
                    error=str(e),
                    error_type=type(e).__name__,
                    attempt=attempt + 1,
                    elapsed_time=elapsed_time,
                )

            # Exponential backoff for retries (1s, 2s, 4s)
            if attempt < self.retries:
                delay = 2**attempt
                self.logger.info(
                    "Retrying request after delay",
                    delay=delay,
                    attempt=attempt + 1,
                )
                await asyncio.sleep(delay)

        # If we get here, all retries failed
        if last_exception:
            raise last_exception
        else:
            raise NautobotClientError("All retry attempts failed")

    def _unwrap_type(self, type_info: Dict[str, Any]) -> Tuple[str, bool, bool]:
        """
        Unwrap GraphQL type information to get the actual type name.

        Returns:
            Tuple of (type_name, is_list, is_non_null)
        """
        if not type_info:
            return "Unknown", False, False

        current_type = type_info
        is_list = False
        is_non_null = False

        # Unwrap NON_NULL and LIST wrappers
        while current_type and current_type.get("kind") in ["NON_NULL", "LIST"]:
            if current_type["kind"] == "NON_NULL":
                is_non_null = True
            elif current_type["kind"] == "LIST":
                is_list = True

            current_type = current_type.get("ofType")

        if current_type and current_type.get("name"):
            return current_type["name"], is_list, is_non_null

        return "Unknown", is_list, is_non_null

    def _identify_relationship_type(
        self,
        field_name: str,
        field_type: str,
        is_list: bool,
        source_type: str,
        all_types: Set[str],
    ) -> Optional[str]:
        """Identify the type of relationship based on field characteristics."""

        # Skip built-in GraphQL types and scalars
        builtin_types = {
            "String",
            "Int",
            "Float",
            "Boolean",
            "ID",
            "DateTime",
            "Date",
            "Time",
            "Decimal",
            "JSON",
            "Upload",
            "UUID",
        }

        if field_type in builtin_types:
            return None

        # Skip if target type is not a known model type
        if field_type not in all_types:
            return None

        # Common patterns for relationship identification
        field_lower = field_name.lower()

        # Many-to-many relationships (usually plural and lists)
        if is_list:
            # Common M2M field patterns
            m2m_patterns = [
                "tags",
                "devices",
                "interfaces",
                "cables",
                "circuits",
                "vlans",
                "prefixes",
                "addresses",
                "routes",
                "users",
                "groups",
                "roles",
                "permissions",
                "sites",
                "racks",
            ]

            if any(pattern in field_lower for pattern in m2m_patterns):
                return "MANY_TO_MANY"

            # If it's a list of model objects, likely M2M
            return "MANY_TO_MANY"

        # Foreign key relationships (single object references)
        else:
            # Common FK field patterns
            fk_patterns = [
                "site",
                "rack",
                "device",
                "interface",
                "cable",
                "circuit",
                "provider",
                "tenant",
                "role",
                "status",
                "platform",
                "manufacturer",
                "type",
                "parent",
                "primary",
                "master",
                "cluster",
                "group",
                "user",
                "assigned",
                "created_by",
                "updated_by",
            ]

            if any(pattern in field_lower for pattern in fk_patterns):
                return "FOREIGN_KEY"

            # If field name ends with common FK suffixes
            if field_lower.endswith(("_id", "_type", "_status", "_role")):
                return "FOREIGN_KEY"

            # If it's a single model object reference
            if field_type != source_type:  # Avoid self-references for now
                return "FOREIGN_KEY"

        # One-to-one relationships (less common, usually explicit)
        # These are harder to detect automatically and may need manual classification

        return "CUSTOM_RELATIONSHIP"

    async def discover_schema(self) -> Dict[str, Any]:
        """
        Discover the Nautobot schema using GraphQL introspection.

        Returns:
            Dictionary containing discovered types and relationships.
        """
        self.logger.info("Starting schema discovery")
        start_time = time.perf_counter()

        try:
            # Execute introspection query
            response = await self._execute_request(INTROSPECTION_QUERY)

            if "data" not in response or "__schema" not in response["data"]:
                raise InvalidSchemaError(
                    "Invalid schema response structure",
                    details={"response_keys": list(response.keys())},
                )

            schema_data = response["data"]["__schema"]
            types_data = schema_data.get("types", [])

            # Filter for object types that represent Nautobot models
            nautobot_types = []
            all_type_names = set()

            for type_info in types_data:
                type_name = type_info.get("name", "")
                type_kind = type_info.get("kind", "")

                # Skip built-in GraphQL types and system types
                if (
                    type_name.startswith("__")
                    or type_kind != "OBJECT"
                    or type_name in ["Query", "Mutation", "Subscription"]
                ):
                    continue

                # Look for types that have fields suggesting they're Nautobot models
                fields = type_info.get("fields", [])
                has_model_fields = any(
                    field["name"] in ["id", "url", "display", "created", "lastUpdated"]
                    for field in fields
                )

                if has_model_fields and fields:
                    nautobot_types.append(type_info)
                    all_type_names.add(type_name)

            # Build models and relationships
            models = {}
            relationships = []

            for type_info in nautobot_types:
                type_name = type_info["name"]
                fields = type_info.get("fields", [])

                # Process fields for this model
                model_fields = []
                for field in fields:
                    field_name = field["name"]
                    field_type_info = field.get("type", {})

                    # Unwrap the field type
                    field_type, is_list, is_non_null = self._unwrap_type(
                        field_type_info
                    )

                    model_fields.append(
                        {
                            "name": field_name,
                            "type": field_type,
                            "is_list": is_list,
                            "is_required": is_non_null,
                            "description": field.get("description", ""),
                        }
                    )

                    # Check if this field represents a relationship
                    relationship_type = self._identify_relationship_type(
                        field_name, field_type, is_list, type_name, all_type_names
                    )

                    if relationship_type:
                        relationships.append(
                            {
                                "source": type_name,
                                "target": field_type,
                                "field": field_name,
                                "type": relationship_type,
                                "is_list": is_list,
                                "description": field.get("description", ""),
                            }
                        )

                models[type_name] = {
                    "name": type_name,
                    "description": type_info.get("description", ""),
                    "fields": model_fields,
                }

            elapsed_time = time.perf_counter() - start_time

            self.logger.info(
                "Schema discovery completed",
                elapsed_time=elapsed_time,
                models_count=len(models),
                relationships_count=len(relationships),
            )

            return {
                "models": models,
                "relationships": relationships,
                "metadata": {
                    "discovery_time": elapsed_time,
                    "total_types": len(types_data),
                    "nautobot_models": len(models),
                    "total_relationships": len(relationships),
                    "graphql_schema_version": schema_data.get("queryType", {}).get(
                        "name", "Unknown"
                    ),
                },
            }

        except Exception as e:
            elapsed_time = time.perf_counter() - start_time
            self.logger.error(
                "Schema discovery failed",
                error=str(e),
                error_type=type(e).__name__,
                elapsed_time=elapsed_time,
            )
            raise

    async def test_connection(self) -> Dict[str, Any]:
        """
        Test the connection to Nautobot GraphQL API.

        Returns:
            Dictionary with connection test results.
        """
        self.logger.info("Testing connection to Nautobot")
        start_time = time.perf_counter()

        # Simple query to test connection and auth
        test_query = """
            query TestConnection {
                __schema {
                    queryType {
                        name
                    }
                }
            }
        """

        try:
            response = await self._execute_request(test_query)
            elapsed_time = time.perf_counter() - start_time

            self.logger.info(
                "Connection test successful",
                elapsed_time=elapsed_time,
            )

            return {
                "success": True,
                "elapsed_time": elapsed_time,
                "nautobot_url": self.base_url,
                "graphql_url": self.graphql_url,
                "query_type": response.get("data", {})
                .get("__schema", {})
                .get("queryType", {})
                .get("name"),
            }

        except Exception as e:
            elapsed_time = time.perf_counter() - start_time
            self.logger.error(
                "Connection test failed",
                error=str(e),
                error_type=type(e).__name__,
                elapsed_time=elapsed_time,
            )

            return {
                "success": False,
                "elapsed_time": elapsed_time,
                "error": str(e),
                "error_type": type(e).__name__,
                "nautobot_url": self.base_url,
                "graphql_url": self.graphql_url,
            }
