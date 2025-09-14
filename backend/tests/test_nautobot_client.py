"""Unit tests for NautobotGraphQLClient."""

import json
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from typing import Dict, Any

from app.services.nautobot_client import NautobotGraphQLClient
from app.services.exceptions import (
    AuthenticationError,
    ConnectionTimeoutError,
    GraphQLError,
    InvalidSchemaError,
    NautobotClientError,
)


class TestNautobotGraphQLClient:
    """Test cases for NautobotGraphQLClient."""

    @pytest.fixture
    async def client(self):
        """Create a test client instance."""
        client = NautobotGraphQLClient()
        yield client
        await client.close()

    @pytest.fixture
    def mock_response_data(self):
        """Mock GraphQL introspection response data."""
        return {
            "data": {
                "__schema": {
                    "types": [
                        {
                            "name": "Device",
                            "kind": "OBJECT",
                            "description": "A network device",
                            "fields": [
                                {
                                    "name": "id",
                                    "description": "Unique identifier",
                                    "type": {
                                        "name": None,
                                        "kind": "NON_NULL",
                                        "ofType": {"name": "ID", "kind": "SCALAR"},
                                    },
                                },
                                {
                                    "name": "name",
                                    "description": "Device name",
                                    "type": {"name": "String", "kind": "SCALAR"},
                                },
                                {
                                    "name": "site",
                                    "description": "Site where device is located",
                                    "type": {"name": "Site", "kind": "OBJECT"},
                                },
                                {
                                    "name": "interfaces",
                                    "description": "Device interfaces",
                                    "type": {
                                        "name": None,
                                        "kind": "LIST",
                                        "ofType": {
                                            "name": "Interface",
                                            "kind": "OBJECT",
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            "name": "Site",
                            "kind": "OBJECT",
                            "description": "A physical site",
                            "fields": [
                                {
                                    "name": "id",
                                    "description": "Unique identifier",
                                    "type": {
                                        "name": None,
                                        "kind": "NON_NULL",
                                        "ofType": {"name": "ID", "kind": "SCALAR"},
                                    },
                                },
                                {
                                    "name": "name",
                                    "description": "Site name",
                                    "type": {"name": "String", "kind": "SCALAR"},
                                },
                            ],
                        },
                        {
                            "name": "Interface",
                            "kind": "OBJECT",
                            "description": "A network interface",
                            "fields": [
                                {
                                    "name": "id",
                                    "description": "Unique identifier",
                                    "type": {
                                        "name": None,
                                        "kind": "NON_NULL",
                                        "ofType": {"name": "ID", "kind": "SCALAR"},
                                    },
                                },
                                {
                                    "name": "name",
                                    "description": "Interface name",
                                    "type": {"name": "String", "kind": "SCALAR"},
                                },
                                {
                                    "name": "device",
                                    "description": "Parent device",
                                    "type": {"name": "Device", "kind": "OBJECT"},
                                },
                            ],
                        },
                        {
                            "name": "Query",
                            "kind": "OBJECT",
                            "description": "Root query type",
                        },
                        {
                            "name": "__Schema",
                            "kind": "OBJECT",
                            "description": "GraphQL schema type",
                        },
                    ],
                    "queryType": {"name": "Query"},
                }
            }
        }

    def test_client_initialization(self):
        """Test client initialization with proper configuration."""
        client = NautobotGraphQLClient()

        assert client.base_url == "http://localhost:8000"
        assert client.graphql_url == "http://localhost:8000/graphql/"
        assert client.token == "0123456789abcdef0123456789abcdef01234567"
        assert (
            "Token 0123456789abcdef0123456789abcdef01234567"
            in client.headers["Authorization"]
        )
        assert client.headers["Content-Type"] == "application/json"

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test client as async context manager."""
        async with NautobotGraphQLClient() as client:
            assert isinstance(client, NautobotGraphQLClient)
            assert client.client is not None

    @pytest.mark.asyncio
    async def test_successful_request(self, client, mock_response_data):
        """Test successful GraphQL request execution."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status.return_value = None

        with patch.object(client.client, "post", return_value=mock_response):
            result = await client._execute_request(
                "query { __schema { queryType { name } } }"
            )

            assert result == mock_response_data
            client.client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_authentication_error_401(self, client):
        """Test authentication error handling for 401 status."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        with patch.object(client.client, "post", return_value=mock_response):
            with pytest.raises(AuthenticationError) as exc_info:
                await client._execute_request(
                    "query { __schema { queryType { name } } }"
                )

            assert "Invalid or expired Nautobot token" in str(exc_info.value)
            assert exc_info.value.details["status_code"] == 401

    @pytest.mark.asyncio
    async def test_authentication_error_403(self, client):
        """Test authentication error handling for 403 status."""
        mock_response = MagicMock()
        mock_response.status_code = 403

        with patch.object(client.client, "post", return_value=mock_response):
            with pytest.raises(AuthenticationError) as exc_info:
                await client._execute_request(
                    "query { __schema { queryType { name } } }"
                )

            assert "Insufficient permissions" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_timeout_error_with_retry(self, client):
        """Test timeout error handling with retry logic."""
        with patch.object(
            client.client, "post", side_effect=httpx.TimeoutException("Timeout")
        ):
            with pytest.raises(ConnectionTimeoutError) as exc_info:
                await client._execute_request(
                    "query { __schema { queryType { name } } }"
                )

            assert "timed out" in str(exc_info.value)
            assert client.client.post.call_count == client.retries + 1

    @pytest.mark.asyncio
    async def test_network_error_with_retry(self, client):
        """Test network error handling with retry logic."""
        with patch.object(
            client.client, "post", side_effect=httpx.ConnectError("Connection failed")
        ):
            with pytest.raises(NautobotClientError) as exc_info:
                await client._execute_request(
                    "query { __schema { queryType { name } } }"
                )

            assert "Network error" in str(exc_info.value)
            assert client.client.post.call_count == client.retries + 1

    @pytest.mark.asyncio
    async def test_graphql_error_response(self, client):
        """Test GraphQL error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "errors": [
                {
                    "message": "Field 'invalid' not found",
                    "locations": [{"line": 1, "column": 10}],
                }
            ]
        }
        mock_response.raise_for_status.return_value = None

        with patch.object(client.client, "post", return_value=mock_response):
            with pytest.raises(GraphQLError) as exc_info:
                await client._execute_request("query { invalid }")

            assert "GraphQL query returned errors" in str(exc_info.value)
            assert len(exc_info.value.errors) == 1
            assert "Field 'invalid' not found" in exc_info.value.errors[0]["message"]

    @pytest.mark.asyncio
    async def test_invalid_json_response(self, client):
        """Test invalid JSON response handling."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_response.raise_for_status.return_value = None

        with patch.object(client.client, "post", return_value=mock_response):
            with pytest.raises(InvalidSchemaError) as exc_info:
                await client._execute_request(
                    "query { __schema { queryType { name } } }"
                )

            assert "Invalid JSON response" in str(exc_info.value)

    def test_unwrap_type_scalar(self, client):
        """Test type unwrapping for scalar types."""
        type_info = {"name": "String", "kind": "SCALAR"}
        name, is_list, is_non_null = client._unwrap_type(type_info)

        assert name == "String"
        assert not is_list
        assert not is_non_null

    def test_unwrap_type_non_null(self, client):
        """Test type unwrapping for NON_NULL types."""
        type_info = {
            "name": None,
            "kind": "NON_NULL",
            "ofType": {"name": "String", "kind": "SCALAR"},
        }
        name, is_list, is_non_null = client._unwrap_type(type_info)

        assert name == "String"
        assert not is_list
        assert is_non_null

    def test_unwrap_type_list(self, client):
        """Test type unwrapping for LIST types."""
        type_info = {
            "name": None,
            "kind": "LIST",
            "ofType": {"name": "String", "kind": "SCALAR"},
        }
        name, is_list, is_non_null = client._unwrap_type(type_info)

        assert name == "String"
        assert is_list
        assert not is_non_null

    def test_unwrap_type_complex(self, client):
        """Test type unwrapping for complex nested types."""
        type_info = {
            "name": None,
            "kind": "NON_NULL",
            "ofType": {
                "name": None,
                "kind": "LIST",
                "ofType": {
                    "name": None,
                    "kind": "NON_NULL",
                    "ofType": {"name": "Device", "kind": "OBJECT"},
                },
            },
        }
        name, is_list, is_non_null = client._unwrap_type(type_info)

        assert name == "Device"
        assert is_list
        assert is_non_null

    def test_identify_relationship_foreign_key(self, client):
        """Test relationship identification for foreign keys."""
        all_types = {"Device", "Site", "Interface"}

        # Test common FK patterns
        rel_type = client._identify_relationship_type(
            "site", "Site", False, "Device", all_types
        )
        assert rel_type == "FOREIGN_KEY"

        rel_type = client._identify_relationship_type(
            "device", "Device", False, "Interface", all_types
        )
        assert rel_type == "FOREIGN_KEY"

        # Test FK suffix patterns
        rel_type = client._identify_relationship_type(
            "device_id", "Device", False, "Cable", all_types
        )
        assert rel_type == "FOREIGN_KEY"

    def test_identify_relationship_many_to_many(self, client):
        """Test relationship identification for many-to-many relationships."""
        all_types = {"Device", "Site", "Interface", "Tag"}

        # Test M2M patterns with lists
        rel_type = client._identify_relationship_type(
            "interfaces", "Interface", True, "Device", all_types
        )
        assert rel_type == "MANY_TO_MANY"

        rel_type = client._identify_relationship_type(
            "tags", "Tag", True, "Device", all_types
        )
        assert rel_type == "MANY_TO_MANY"

    def test_identify_relationship_scalar_type(self, client):
        """Test relationship identification skips scalar types."""
        all_types = {"Device", "Site", "Interface"}

        rel_type = client._identify_relationship_type(
            "name", "String", False, "Device", all_types
        )
        assert rel_type is None

        rel_type = client._identify_relationship_type(
            "id", "ID", False, "Device", all_types
        )
        assert rel_type is None

    @pytest.mark.asyncio
    async def test_discover_schema_success(self, client, mock_response_data):
        """Test successful schema discovery."""
        with patch.object(client, "_execute_request", return_value=mock_response_data):
            result = await client.discover_schema()

            assert "models" in result
            assert "relationships" in result
            assert "metadata" in result

            # Check models
            assert "Device" in result["models"]
            assert "Site" in result["models"]
            assert "Interface" in result["models"]

            device_model = result["models"]["Device"]
            assert device_model["name"] == "Device"
            assert len(device_model["fields"]) == 4

            # Check relationships
            relationships = result["relationships"]
            assert len(relationships) > 0

            # Check for expected relationships
            site_rel = next((r for r in relationships if r["field"] == "site"), None)
            assert site_rel is not None
            assert site_rel["source"] == "Device"
            assert site_rel["target"] == "Site"
            assert site_rel["type"] == "FOREIGN_KEY"

            interfaces_rel = next(
                (r for r in relationships if r["field"] == "interfaces"), None
            )
            assert interfaces_rel is not None
            assert interfaces_rel["source"] == "Device"
            assert interfaces_rel["target"] == "Interface"
            assert interfaces_rel["type"] == "MANY_TO_MANY"

            # Check metadata
            assert "discovery_time" in result["metadata"]
            assert "nautobot_models" in result["metadata"]
            assert result["metadata"]["nautobot_models"] == 3

    @pytest.mark.asyncio
    async def test_discover_schema_invalid_response(self, client):
        """Test schema discovery with invalid response structure."""
        invalid_response = {"invalid": "structure"}

        with patch.object(client, "_execute_request", return_value=invalid_response):
            with pytest.raises(InvalidSchemaError) as exc_info:
                await client.discover_schema()

            assert "Invalid schema response structure" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_test_connection_success(self, client):
        """Test successful connection test."""
        mock_response = {"data": {"__schema": {"queryType": {"name": "Query"}}}}

        with patch.object(client, "_execute_request", return_value=mock_response):
            result = await client.test_connection()

            assert result["success"] is True
            assert "elapsed_time" in result
            assert result["nautobot_url"] == "http://localhost:8000"
            assert result["graphql_url"] == "http://localhost:8000/graphql/"
            assert result["query_type"] == "Query"

    @pytest.mark.asyncio
    async def test_test_connection_failure(self, client):
        """Test connection test with failure."""
        with patch.object(
            client, "_execute_request", side_effect=AuthenticationError("Auth failed")
        ):
            result = await client.test_connection()

            assert result["success"] is False
            assert "elapsed_time" in result
            assert result["error"] == "Auth failed"
            assert result["error_type"] == "AuthenticationError"

    @pytest.mark.asyncio
    async def test_retry_with_exponential_backoff(self, client):
        """Test retry mechanism with exponential backoff timing."""
        # Mock sleep to capture timing
        sleep_calls = []

        async def mock_sleep(delay):
            sleep_calls.append(delay)

        with patch("asyncio.sleep", side_effect=mock_sleep):
            with patch.object(
                client.client, "post", side_effect=httpx.TimeoutException("Timeout")
            ):
                with pytest.raises(ConnectionTimeoutError):
                    await client._execute_request("query { test }")

        # Check that exponential backoff was used (1s, 2s, 4s)
        assert len(sleep_calls) == client.retries  # 3 retries = 3 sleep calls
        assert sleep_calls == [1, 2, 4]  # 2^0, 2^1, 2^2

    @pytest.mark.asyncio
    async def test_no_retry_on_auth_error(self, client):
        """Test that authentication errors don't trigger retries."""
        with patch.object(client.client, "post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_post.return_value = mock_response

            with pytest.raises(AuthenticationError):
                await client._execute_request("query { test }")

            # Should only be called once (no retries for auth errors)
            assert mock_post.call_count == 1

    @pytest.mark.asyncio
    async def test_request_logging(self, client, mock_response_data):
        """Test that requests are properly logged with timing metrics."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_response_data
        mock_response.raise_for_status.return_value = None

        with patch.object(client.client, "post", return_value=mock_response):
            with patch.object(client.logger, "info") as mock_log_info:
                await client._execute_request("query { test }")

                # Check that logging calls were made
                assert mock_log_info.call_count >= 2  # At least start and end log

                # Check that timing information is logged
                log_calls = [call.args for call in mock_log_info.call_args_list]
                completion_call = None
                for call in log_calls:
                    if len(call) > 0 and "completed successfully" in str(call[0]):
                        completion_call = call
                        break

                assert (
                    completion_call is not None
                ), f"Expected completion log not found in calls: {log_calls}"

                # Check that elapsed_time is in the kwargs of the completion log call
                completion_kwargs = None
                for call in mock_log_info.call_args_list:
                    if len(call.args) > 0 and "completed successfully" in str(
                        call.args[0]
                    ):
                        completion_kwargs = call.kwargs
                        break

                assert completion_kwargs is not None
                assert "elapsed_time" in completion_kwargs
