"""Service for transforming GraphQL schema data to Pydantic models."""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import structlog

from app.core.logging import get_logger
from app.models.schema import (
    FieldInfo,
    ModelNode,
    Relationship,
    RelationshipType,
    SchemaGraph,
)


class SchemaTransformerService:
    """Service for transforming raw GraphQL schema data into structured Pydantic models."""

    def __init__(self):
        self.logger = get_logger("schema_transformer")

    async def transform_graphql_to_schema(
        self,
        raw_schema: Dict[str, Any],
        include_abstract: bool = False,
        include_proxy: bool = False,
        max_depth: int = 10,
    ) -> SchemaGraph:
        """
        Transform raw GraphQL schema response into structured SchemaGraph.

        Args:
            raw_schema: Raw schema data from GraphQL introspection
            include_abstract: Whether to include abstract models
            include_proxy: Whether to include proxy models
            max_depth: Maximum relationship depth to process

        Returns:
            SchemaGraph with all discovered models and relationships
        """
        self.logger.info(
            "Starting schema transformation",
            include_abstract=include_abstract,
            include_proxy=include_proxy,
            max_depth=max_depth,
        )

        models_data = raw_schema.get("models", {})
        relationships_data = raw_schema.get("relationships", [])
        metadata = raw_schema.get("metadata", {})

        # Transform models
        model_nodes = []
        for model_name, model_info in models_data.items():
            try:
                model_node = await self._transform_model(
                    model_name, model_info, include_abstract, include_proxy
                )
                if model_node:
                    model_nodes.append(model_node)
            except Exception as e:
                self.logger.warning(
                    "Failed to transform model",
                    model_name=model_name,
                    error=str(e),
                )
                continue

        # Transform relationships
        relationships = []
        for rel_data in relationships_data:
            try:
                relationship = await self._transform_relationship(rel_data)
                if relationship and self._should_include_relationship(
                    relationship, model_nodes, max_depth
                ):
                    relationships.append(relationship)
            except Exception as e:
                self.logger.warning(
                    "Failed to transform relationship",
                    relationship=rel_data,
                    error=str(e),
                )
                continue

        schema_graph = SchemaGraph(
            nodes=model_nodes,
            relationships=relationships,
            discovery_timestamp=datetime.utcnow(),
            nautobot_version=metadata.get("graphql_schema_version"),
        )

        self.logger.info(
            "Schema transformation completed",
            total_models=len(model_nodes),
            total_relationships=len(relationships),
            apps_count=len(schema_graph.apps),
        )

        return schema_graph

    async def _transform_model(
        self,
        model_name: str,
        model_info: Dict[str, Any],
        include_abstract: bool,
        include_proxy: bool,
    ) -> Optional[ModelNode]:
        """Transform a single model from GraphQL format to ModelNode."""

        # Extract app label from model name or description
        app_label = self._extract_app_label(model_name, model_info)

        # Skip models that don't meet inclusion criteria
        if not self._should_include_model(model_info, include_abstract, include_proxy):
            return None

        # Transform fields
        fields = []
        for field_data in model_info.get("fields", []):
            try:
                field_info = await self._transform_field(field_data)
                if field_info:
                    fields.append(field_info)
            except Exception as e:
                self.logger.debug(
                    "Failed to transform field",
                    model_name=model_name,
                    field=field_data.get("name", "unknown"),
                    error=str(e),
                )
                continue

        return ModelNode(
            name=model_name,
            app_label=app_label,
            table_name=self._generate_table_name(model_name, app_label),
            fields=fields,
            is_abstract=self._is_abstract_model(model_info),
            description=(model_info.get("description") or "").strip() or None,
            meta_options=self._extract_meta_options(model_info),
        )

    async def _transform_field(self, field_data: Dict[str, Any]) -> Optional[FieldInfo]:
        """Transform a field from GraphQL format to FieldInfo."""
        field_name = field_data.get("name", "")
        field_type = field_data.get("type", "")

        if not field_name or not field_type:
            return None

        # Skip system/GraphQL fields that aren't actual model fields
        if self._is_system_field(field_name):
            return None

        return FieldInfo(
            name=field_name,
            field_type=self._normalize_field_type(field_type),
            is_nullable=not field_data.get("is_required", False),
            is_list=field_data.get("is_list", False),
            description=(field_data.get("description") or "").strip() or None,
            default_value=field_data.get("default_value"),
            max_length=self._extract_max_length(field_data),
            choices=self._extract_choices(field_data),
        )

    async def _transform_relationship(
        self, rel_data: Dict[str, Any]
    ) -> Optional[Relationship]:
        """Transform a relationship from GraphQL format to Relationship."""
        source = (rel_data.get("source") or "").strip()
        target = (rel_data.get("target") or "").strip()
        field_name = (rel_data.get("field") or "").strip()
        rel_type_str = (rel_data.get("type") or "").strip()

        if not all([source, target, field_name, rel_type_str]):
            return None

        # Map relationship type
        try:
            relationship_type = RelationshipType((rel_type_str or "").lower())
        except ValueError:
            # Default to custom relationship for unknown types
            relationship_type = RelationshipType.CUSTOM_RELATIONSHIP

        return Relationship(
            source_model=source,
            target_model=target,
            relationship_type=relationship_type,
            field_name=field_name,
            related_name=self._generate_related_name(source, field_name),
            through_model=rel_data.get("through_model"),
            is_nullable=not rel_data.get("is_required", False),
            description=(rel_data.get("description") or "").strip() or None,
        )

    async def filter_schema(
        self,
        schema: SchemaGraph,
        include_apps: Optional[List[str]] = None,
        exclude_apps: Optional[List[str]] = None,
        include_abstract: bool = False,
        include_proxy: bool = False,
        model_pattern: Optional[str] = None,
    ) -> SchemaGraph:
        """
        Filter a schema graph based on various criteria.

        Args:
            schema: Original schema graph
            include_apps: Apps to include (None means all)
            exclude_apps: Apps to exclude
            include_abstract: Whether to include abstract models
            include_proxy: Whether to include proxy models
            model_pattern: Regex pattern to match model names

        Returns:
            Filtered schema graph
        """
        self.logger.info(
            "Filtering schema",
            original_models=len(schema.nodes),
            original_relationships=len(schema.relationships),
            include_apps=include_apps,
            exclude_apps=exclude_apps,
            model_pattern=model_pattern,
        )

        # Compile regex pattern if provided
        pattern = None
        if model_pattern:
            try:
                pattern = re.compile(model_pattern, re.IGNORECASE)
            except re.error as e:
                self.logger.warning(
                    "Invalid regex pattern, ignoring",
                    pattern=model_pattern,
                    error=str(e),
                )

        # Filter nodes
        filtered_nodes = []
        for node in schema.nodes:
            # App filtering
            if include_apps and node.app_label not in include_apps:
                continue
            if exclude_apps and node.app_label in exclude_apps:
                continue

            # Abstract/proxy filtering
            if node.is_abstract and not include_abstract:
                continue
            # Note: We don't have proxy model detection in the current schema
            # This would need to be added based on Django model meta information

            # Pattern matching
            if pattern and not pattern.search(node.name):
                continue

            filtered_nodes.append(node)

        # Get model names that passed filtering
        filtered_model_names = {node.name for node in filtered_nodes}

        # Filter relationships to only include those between filtered models
        filtered_relationships = [
            rel
            for rel in schema.relationships
            if rel.source_model in filtered_model_names
            and rel.target_model in filtered_model_names
        ]

        filtered_schema = SchemaGraph(
            nodes=filtered_nodes,
            relationships=filtered_relationships,
            discovery_timestamp=schema.discovery_timestamp,
            nautobot_version=schema.nautobot_version,
        )

        self.logger.info(
            "Schema filtering completed",
            filtered_models=len(filtered_nodes),
            filtered_relationships=len(filtered_relationships),
            apps_remaining=len(filtered_schema.apps),
        )

        return filtered_schema

    def _extract_app_label(self, model_name: str, model_info: Dict[str, Any]) -> str:
        """Extract Django app label from model information."""
        # Try to get from model description or name patterns
        description = model_info.get("description", "")

        # Common Nautobot app patterns
        nautobot_apps = {
            "circuits",
            "dcim",
            "extras",
            "ipam",
            "tenancy",
            "users",
            "virtualization",
            "plugins",
            "core",
            "contenttypes",
            "auth",
            "sessions",
            "admin",
        }

        model_lower = (model_name or "").lower()

        # Check if model name suggests an app
        for app in nautobot_apps:
            if model_lower.startswith(app) or app in model_lower:
                return app

        # Look for app hints in description
        if description:  # Add null check to prevent None.lower() error
            description_lower = description.lower()
            for app in nautobot_apps:
                if app in description_lower:
                    return app

        # Default fallback based on model name patterns
        if any(
            term in model_lower for term in ["device", "rack", "cable", "interface"]
        ):
            return "dcim"
        elif any(term in model_lower for term in ["circuit", "provider"]):
            return "circuits"
        elif any(
            term in model_lower for term in ["prefix", "ipaddress", "vlan", "vrf"]
        ):
            return "ipam"
        elif any(term in model_lower for term in ["tenant", "tenantgroup"]):
            return "tenancy"
        elif any(term in model_lower for term in ["user", "group", "permission"]):
            return "users"
        elif any(term in model_lower for term in ["vm", "cluster", "virtual"]):
            return "virtualization"
        elif any(term in model_lower for term in ["tag", "customfield", "webhook"]):
            return "extras"
        else:
            return "core"  # Default app

    def _should_include_model(
        self, model_info: Dict[str, Any], include_abstract: bool, include_proxy: bool
    ) -> bool:
        """Check if a model should be included based on criteria."""
        is_abstract = self._is_abstract_model(model_info)

        if is_abstract and not include_abstract:
            return False

        # Note: Proxy model detection would need additional GraphQL schema information
        # For now, we assume all non-abstract models are concrete

        return True

    def _is_abstract_model(self, model_info: Dict[str, Any]) -> bool:
        """Check if a model is abstract based on available information."""
        # Look for hints in description or field patterns
        description = model_info.get("description", "")
        if description and "abstract" in (description or "").lower():
            return True

        # Models with very few fields might be abstract
        fields = model_info.get("fields", [])
        if len(fields) <= 2:  # Only id and maybe one other field
            return True

        return False

    def _is_system_field(self, field_name: str) -> bool:
        """Check if a field is a system/GraphQL field rather than a model field."""
        system_fields = {
            "__typename",
            "_state",
            "pk",
            "objects",
            "DoesNotExist",
            "MultipleObjectsReturned",
        }
        return field_name in system_fields

    def _normalize_field_type(self, field_type: str) -> str:
        """Normalize GraphQL field types to Django field types."""
        type_mapping = {
            "ID": "AutoField",
            "String": "CharField",
            "Int": "IntegerField",
            "Float": "FloatField",
            "Boolean": "BooleanField",
            "DateTime": "DateTimeField",
            "Date": "DateField",
            "Time": "TimeField",
            "Decimal": "DecimalField",
            "UUID": "UUIDField",
            "JSON": "JSONField",
            "Upload": "FileField",
        }
        return type_mapping.get(field_type, field_type)

    def _extract_max_length(self, field_data: Dict[str, Any]) -> Optional[int]:
        """Extract max length from field data if available."""
        # This would need to be extracted from GraphQL schema arguments
        # For now, return None as this info isn't readily available
        return None

    def _extract_choices(self, field_data: Dict[str, Any]) -> Optional[List[str]]:
        """Extract field choices if available."""
        # This would need to be extracted from GraphQL enum types
        # For now, return None as this needs additional schema analysis
        return None

    def _extract_meta_options(self, model_info: Dict[str, Any]) -> Dict[str, Any]:
        """Extract Django Meta options from model information."""
        # This would need additional schema information
        return {}

    def _generate_table_name(self, model_name: str, app_label: str) -> str:
        """Generate database table name following Django conventions."""
        # Convert CamelCase to snake_case
        safe_model_name = model_name or "unknown"
        table_name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", safe_model_name)
        table_name = re.sub("([a-z0-9])([A-Z])", r"\1_\2", table_name).lower()
        return f"{app_label}_{table_name}"

    def _generate_related_name(
        self, source_model: str, field_name: str
    ) -> Optional[str]:
        """Generate related name for reverse relationships."""
        # Follow Django conventions for related names
        source_lower = (source_model or "").lower()
        if field_name.endswith("s"):
            return f"{source_lower}_set"
        else:
            return f"{source_lower}s"

    def _should_include_relationship(
        self, relationship: Relationship, model_nodes: List[ModelNode], max_depth: int
    ) -> bool:
        """Check if a relationship should be included based on depth and model availability."""
        # Check if both source and target models exist in our node list
        model_names = {node.name for node in model_nodes}

        if relationship.source_model not in model_names:
            return False
        if relationship.target_model not in model_names:
            return False

        # For now, include all relationships within max_depth
        # More sophisticated depth calculation could be implemented here
        return True
